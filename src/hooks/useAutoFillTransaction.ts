import { useEffect, useState } from 'react';
import { UseFormWatch, UseFormSetValue, UseFormGetValues } from 'react-hook-form';
import { useNatureMapping } from './useNatureMapping';

interface AutoFillState {
  isManual: {
    amount: boolean;
    label: boolean;
    category: boolean;
  };
  autoSuggestions: {
    amount?: number;
    label?: string;
    category?: string;
  };
}

interface UseAutoFillTransactionProps {
  watch: UseFormWatch<any>;
  setValue: UseFormSetValue<any>;
  getValues: UseFormGetValues<any>;
  properties: any[];
  leases: any[];
  categories: any[];
  selectedNature?: string; // Ajouter selectedNature pour le filtrage
  natures?: any[]; // Ajouter natures pour passer au hook useNatureMapping en mode app-shell
  /** Quand true (ex: pré-remplissage depuis échéance), ne pas écraser nature/catégorie par Loyer */
  skipLeaseAutoFill?: boolean;
}

export const useAutoFillTransaction = ({
  watch,
  setValue,
  getValues,
  properties,
  leases,
  categories,
  selectedNature,
  natures,
  skipLeaseAutoFill = false,
  mode = 'create' // Ajouter le mode pour désactiver les automatismes en édition
}: UseAutoFillTransactionProps & { mode?: 'create' | 'edit' }) => {
  const [autoFillState, setAutoFillState] = useState<AutoFillState>({
    isManual: {
      amount: false,
      label: false,
      category: false
    },
    autoSuggestions: {}
  });

  // Hook pour le mapping Nature ↔ Catégorie
  // En mode app-shell, passer les natures et catégories chargées depuis IndexedDB
  const {
    getCompatibleCategories,
    getDefaultCategory,
    isCategoryCompatible,
    getFirstCompatibleCategory,
    loading: mappingLoading
  } = useNatureMapping({
    natures,
    categories,
    mode: natures && categories ? 'app-shell' : 'normal'
  });

  // Watchers pour les champs clés
  const propertyId = watch('propertyId');
  const leaseId = watch('leaseId');
  const nature = watch('nature');
  const date = watch('date');
  const periodStart = watch('periodStart');
  const monthsCovered = watch('monthsCovered');
  const amount = watch('amount');
  const label = watch('label');
  const category = watch('category');

  // 1) Chargement initial - Date par défaut (seulement en mode création)
  useEffect(() => {
    if (mode === 'create' && !date) {
      setValue('date', new Date().toISOString().split('T')[0]);
    }
  }, [date, setValue, mode]);

  // 2) Sélection du Bien - Filtrer les baux ACTIFS et vider le bail si nécessaire (seulement en mode création)
  useEffect(() => {
    if (mode === 'create' && propertyId) {
      const leasesArray = Array.isArray(leases) ? leases : (leases?.data || leases?.items || []);
      const propertyLeases = leasesArray.filter(lease => 
        lease.Property?.id === propertyId && lease.status === 'ACTIF'
      );
      
      // Ne pas écraser nature/catégorie si pré-remplissage depuis échéance
      if (skipLeaseAutoFill) {
        return;
      }
      
      // Vérifier si le bail actuel appartient encore au bien
      const currentLeaseId = getValues('leaseId');
      if (currentLeaseId) {
        const currentLease = leasesArray.find(lease => lease.id === currentLeaseId);
        if (!currentLease || currentLease.Property?.id !== propertyId || currentLease.status !== 'ACTIF') {
          // Le bail n'appartient plus au bien ou n'est plus actif, le vider
          setValue('leaseId', '');
          setValue('nature', '');
          setValue('categoryId', '');
          // setValue('amount', ''); // DÉSACTIVÉ - géré localement
          setValue('label', '');
          setAutoFillState(prev => ({
            ...prev,
            isManual: { amount: false, label: false, category: false },
            autoSuggestions: {}
          }));
        }
      }
      
      // Si un seul bail ACTIF, auto-sélectionner (sauf si skipLeaseAutoFill)
      if (propertyLeases.length === 1) {
        const singleLease = propertyLeases[0];
        setValue('leaseId', singleLease.id);
        
        // Auto-remplir selon le bail
        setValue('nature', 'RECETTE_LOYER'); // Utiliser la clé complète
        // setValue('amount', (singleLease.rentAmount || singleLease.rent || 0) + (singleLease.charges || 0)); // DÉSACTIVÉ - géré localement
        
        // Générer le libellé auto
        const property = (Array.isArray(properties) ? properties : (properties?.data || [])).find(p => p.id === propertyId);
        const dateObj = new Date(date);
        const monthYear = dateObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        const autoLabel = `Loyer ${monthYear} – ${property?.address || ''}`;
        setValue('label', autoLabel);
        
        // Marquer comme suggestions auto
        setAutoFillState(prev => ({
          ...prev,
          autoSuggestions: {
            amount: (singleLease.rentAmount || singleLease.rent || 0) + (singleLease.charges || 0),
            label: autoLabel
          }
        }));
      }
    } else {
      // Pas de bien sélectionné, vider tout
      setValue('leaseId', '');
      setValue('nature', '');
      setValue('categoryId', '');
      // setValue('amount', ''); // DÉSACTIVÉ - géré localement
      setValue('label', '');
      setAutoFillState(prev => ({
        ...prev,
        isManual: { amount: false, label: false, category: false },
        autoSuggestions: {}
      }));
    }
  }, [propertyId, leases, properties, date, setValue, getValues, skipLeaseAutoFill]);

  // 3) Modification du Bail - Recalculer et pré-sélectionner la nature
  // DÉSACTIVÉ pour éviter les resets automatiques
  // useEffect(() => {
  //   if (leaseId) {
  //     
  //     const selectedLease = (Array.isArray(leases) ? leases : (leases?.data || leases?.items || [])).find(lease => lease.id === leaseId);
  //     if (selectedLease) {
  //       
  //       // Pré-sélectionner la première nature (RECETTE_LOYER)
  //       setValue('nature', 'RECETTE_LOYER');
  //       
  //       // Réinitialiser le flag manuel pour le montant lors d'un changement de bail
  //       // pour permettre le calcul automatique
  //       setAutoFillState(prev => ({
  //         ...prev,
  //         isManual: {
  //           ...prev.isManual,
  //           amount: false
  //         }
  //       }));
  //       
  //       // Recalculer le montant - DÉSACTIVÉ - géré localement
  //       // const autoAmount = (selectedLease.rentAmount || selectedLease.rent || 0) + (selectedLease.charges || 0);
  //       // setValue('amount', autoAmount);
  //       
  //       // Générer le libellé auto si pas de modification manuelle
  //       let autoLabel = '';
  //       if (!autoFillState.isManual.label) {
  //         const property = (Array.isArray(properties) ? properties : (properties?.data || [])).find(p => p.id === propertyId);
  //         const dateObj = new Date(date);
  //         const monthYear = dateObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  //         autoLabel = `Loyer ${monthYear} – ${property?.address || ''}`;
  //         setValue('label', autoLabel);
  //       }
  //       
  //       setAutoFillState(prev => ({
  //         ...prev,
  //         autoSuggestions: {
  //           amount: (selectedLease.rentAmount || selectedLease.rent || 0) + (selectedLease.charges || 0),
  //           label: autoLabel
  //         }
  //       }));
  //       
  //     }
  //   } else {
  //     // Pas de bail sélectionné, vider la nature
  //     setValue('nature', '');
  //   }
  // }, [leaseId, leases, properties, propertyId, date, setValue, autoFillState.isManual.amount, autoFillState.isManual.label]);

  // 3.5) Montant auto spécifique - DÉSACTIVÉ pour laisser la gestion locale
  // Le montant est maintenant géré directement dans TransactionModalV2.tsx
  // useEffect(() => {
  //   if (leaseId && nature === 'RECETTE_LOYER' && !autoFillState.isManual.amount) {
  //     const selectedLease = (Array.isArray(leases) ? leases : (leases?.data || leases?.items || [])).find(lease => lease.id === leaseId);
  //     if (selectedLease) {
  //       const autoAmount = (selectedLease.rentAmount || selectedLease.rent || 0) + (selectedLease.charges || 0);
  //       setValue('amount', autoAmount);
  //       
  //       setAutoFillState(prev => ({
  //         ...prev,
  //         autoSuggestions: {
  //           ...prev.autoSuggestions,
  //           amount: autoAmount
  //         }
  //       }));
  //     }
  //   }
  // }, [leaseId, nature, leases, setValue, autoFillState.isManual.amount]);

  // 4) Sélection de Nature - Auto-sélectionner la catégorie par défaut
  useEffect(() => {
    if (nature && !mappingLoading) {
      // 🐛 FIX : Toujours appliquer la catégorie par défaut quand on change la nature
      // En mode création ET édition : appliquer la catégorie par défaut
      // Exception : en édition, si on a une catégorie compatible qui est déjà la catégorie par défaut, ne rien faire
      const currentCategoryId = watch('categoryId');
      const defaultCategory = getDefaultCategory(nature);
      
      // Vérifier si la catégorie actuelle est déjà la catégorie par défaut
      const isAlreadyDefault = defaultCategory && currentCategoryId === defaultCategory.id;
      
      // Ne changer que si ce n'est pas déjà la catégorie par défaut
      if (!isAlreadyDefault) {
        if (defaultCategory) {
          setValue('categoryId', defaultCategory.id);
        } else {
          // Si pas de catégorie par défaut, prendre la première compatible
          const firstCompatible = getFirstCompatibleCategory(nature);
          if (firstCompatible) {
            setValue('categoryId', firstCompatible.id);
          }
        }
      }
    }
  }, [nature, mappingLoading, getDefaultCategory, getFirstCompatibleCategory, setValue, watch]);

  // 5) Génération automatique du libellé
  // DÉSACTIVÉ - géré par TransactionModalV2.tsx
  // useEffect(() => {
  //   if (!autoFillState.isManual.label && nature && propertyId) {
  //     const property = (Array.isArray(properties) ? properties : (properties?.data || [])).find(p => p.id === propertyId);
  //     const selectedCategory = categories.find(c => c.id === category);
  //     
  //     let autoLabel = '';
  //     
  //     if (nature === 'RECETTE_LOYER') {
  //       const dateObj = new Date(date);
  //       const monthYear = dateObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  //       autoLabel = `Loyer ${monthYear} – ${property?.address || ''}`;
  //     } else if (selectedCategory) {
  //       autoLabel = `${selectedCategory.label} – ${property?.name || ''}`;
  //     }
  //     
  //     if (autoLabel) {
  //       setValue('label', autoLabel);
  //       setAutoFillState(prev => ({
  //         ...prev,
  //         autoSuggestions: {
  //           ...prev.autoSuggestions,
  //           label: autoLabel
  //         }
  //       }));
  //     }
  //   }
  // }, [nature, propertyId, category, categories, properties, date, setValue, autoFillState.isManual.label]);

  // 6) Période - Mise à jour du libellé
  // DÉSACTIVÉ - géré par TransactionModalV2.tsx
  // useEffect(() => {
  //   if (!autoFillState.isManual.label && nature === 'RECETTE_LOYER' && periodStart) {
  //     const property = (Array.isArray(properties) ? properties : (properties?.data || [])).find(p => p.id === propertyId);
  //     const dateObj = new Date(periodStart);
  //     const monthYear = dateObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  //     const autoLabel = `Loyer ${monthYear} – ${property?.address || ''}`;
  //     
  //     setValue('label', autoLabel);
  //     setAutoFillState(prev => ({
  //       ...prev,
  //       autoSuggestions: {
  //         ...prev.autoSuggestions,
  //         label: autoLabel
  //       }
  //     }));
  //   }
  // }, [periodStart, nature, propertyId, properties, setValue, autoFillState.isManual.label]);

  // Fonctions pour gérer les overrides manuels
  const markAsManual = (field: 'amount' | 'label' | 'category') => {
    setAutoFillState(prev => ({
      ...prev,
      isManual: {
        ...prev.isManual,
        [field]: true
      }
    }));
  };

  const resetToAuto = (field: 'amount' | 'label' | 'category') => {
    setAutoFillState(prev => ({
      ...prev,
      isManual: {
        ...prev.isManual,
        [field]: false
      }
    }));
    
    // Réappliquer la valeur auto
    if (field === 'amount' && autoFillState.autoSuggestions.amount) {
      setValue('amount', autoFillState.autoSuggestions.amount);
    } else if (field === 'label' && autoFillState.autoSuggestions.label) {
      setValue('label', autoFillState.autoSuggestions.label);
    }
  };

  // Détecter les modifications manuelles - Version corrigée sans boucle
  useEffect(() => {
    const currentAmount = getValues('amount');
    const currentLabel = getValues('label');
    
    // Ne marquer comme manuel que si l'utilisateur a vraiment modifié
    // et que ce n'est pas un changement automatique
    if (currentAmount !== autoFillState.autoSuggestions.amount && 
        !autoFillState.isManual.amount && 
        currentAmount !== '' && 
        currentAmount !== 0 &&
        autoFillState.autoSuggestions.amount !== undefined) {
      setAutoFillState(prev => ({
        ...prev,
        isManual: {
          ...prev.isManual,
          amount: true
        }
      }));
    }
    
    if (currentLabel !== autoFillState.autoSuggestions.label && 
        !autoFillState.isManual.label && 
        currentLabel !== '' &&
        autoFillState.autoSuggestions.label !== undefined) {
      setAutoFillState(prev => ({
        ...prev,
        isManual: {
          ...prev.isManual,
          label: true
        }
      }));
    }
  }, [amount, label, autoFillState.autoSuggestions.amount, autoFillState.autoSuggestions.label, autoFillState.isManual.amount, autoFillState.isManual.label]); // Dépendances stables

  // S'assurer que les données sont des tableaux
  const leasesArray = Array.isArray(leases) ? leases : (leases?.data || leases?.items || []);
  const categoriesArray = Array.isArray(categories) ? categories : (categories?.data || categories?.items || []);

  // Debug: vérifier les données - Filtrer seulement les baux ACTIFS
  const filteredLeases = propertyId ? leasesArray.filter(lease => 
    lease.Property?.id === propertyId && lease.status === 'ACTIF'
  ) : [];
  
  // Debug logs supprimés pour éviter le spam en console

  // Filtrer les catégories selon le mapping Nature ↔ Catégorie
  // Utiliser selectedNature en priorité, sinon watch('nature')
  const currentNature = selectedNature || nature;
  
  // Debug: vérifier le mapping
  if (currentNature && !mappingLoading) {
    const compatible = getCompatibleCategories(currentNature);
    console.log('[useAutoFillTransaction] 🔍 Catégories compatibles pour', currentNature, ':', compatible.length);
  }
  
  const filteredCategories = currentNature && !mappingLoading 
    ? getCompatibleCategories(currentNature)
    : categoriesArray;

  return {
    autoFillState,
    markAsManual,
    resetToAuto,
    filteredLeases: filteredLeases,
    filteredCategories: filteredCategories,
    mappingLoading
  };
};

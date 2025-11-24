'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, RotateCcw, Info, ChevronDown, Search, Upload, FileText, Eye, Link, AlertCircle } from 'lucide-react';
import { notify2 } from '@/lib/notify2';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Tabs } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import { transactionFormSchema, TransactionFormData } from '@/lib/validations/transaction';
import { useAutoFillTransaction } from '@/hooks/useAutoFillTransaction';
import { useNatureLabels } from '@/hooks/useNatureLabels';
import { useUploadReviewModal } from '@/contexts/UploadReviewModalContext';
import { useUploadStaging } from '@/hooks/useUploadStaging';
import { useGestionDelegueStatus } from '@/hooks/useGestionDelegueStatus';
import { useGestionCodes } from '@/hooks/useGestionCodes';
import { StagedUploadModal } from '@/components/documents/StagedUploadModal';
import { UploadReviewModal } from '@/components/documents/UploadReviewModal';
import { DuplicateDetectedModal } from '@/components/documents/DuplicateDetectedModal';
import { ConfirmDeleteDocumentModal } from '@/components/documents/ConfirmDeleteDocumentModal';
import { UnclassifiedDocumentsModal } from './UnclassifiedDocumentsModal';
import { TransactionSuggestionConfirmModal } from './TransactionSuggestionConfirmModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { SearchableSelect } from '@/components/forms/SearchableSelect';

// Configuration des natures avec libellés clairs et groupes
const getNatureOptions = (getNatureLabel: (key: string) => string) => [
  {
    group: 'Recettes',
    icon: '⬆️',
    options: [
      { value: 'RECETTE_LOYER', label: getNatureLabel('RECETTE_LOYER') || 'Loyer', description: 'Loyers et charges locatives' },
      { value: 'RECETTE_AUTRE', label: getNatureLabel('RECETTE_AUTRE') || 'Autre recette', description: 'Autres revenus locatifs' }
    ]
  },
  {
    group: 'Dépenses',
    icon: '⬇️',
    options: [
      { value: 'DEPENSE_ENTRETIEN', label: getNatureLabel('DEPENSE_ENTRETIEN') || 'Entretien', description: 'Réparations et maintenance' },
      { value: 'DEPENSE_ASSURANCE', label: getNatureLabel('DEPENSE_ASSURANCE') || 'Assurance', description: 'Assurances propriétaire' },
      { value: 'DEPENSE_TAXE', label: getNatureLabel('DEPENSE_TAXE') || 'Taxe foncière', description: 'Taxes et impôts fonciers' },
      { value: 'DEPENSE_BANQUE', label: getNatureLabel('DEPENSE_BANQUE') || 'Frais bancaires', description: 'Frais bancaires et financiers' }
    ]
  }
];

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TransactionFormData) => Promise<void>;
  context: {
    type: 'property' | 'global';
    propertyId?: string;
    isFromLease?: boolean;
  };
  mode: 'create' | 'edit';
  transactionId?: string;
  title?: string;
  // Pré-remplissage depuis suggestion OCR
  prefill?: {
    propertyId?: string;
    leaseId?: string;
    nature?: string;
    categoryId?: string;
    amount?: number;
    date?: string;
    periodMonth?: string;
    periodYear?: number;
    label?: string;
    reference?: string;
    notes?: string;
    // Détail du loyer (gestion déléguée)
    montantLoyer?: number;
    chargesRecup?: number;
    chargesNonRecup?: number;
    // Date de paiement
    paymentDate?: string;
    // Factures de la section DÉPENSES ET AUTRES RECETTES
    factures?: Array<{
      date?: string;
      numero?: string;
      fournisseur?: string;
      dateService?: string;
      description?: string;
      montant: number;
    }>;
  };
  // Métadonnées de suggestion (pour affichage)
  suggestionMeta?: {
    documentId?: string;
    confidence?: number;
    highlightedFields?: string[];
  };
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  context,
  mode,
  transactionId,
  title,
  prefill,
  suggestionMeta
}) => {
  const [activeTab, setActiveTab] = useState('essentielles');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // États pour les données
  const [properties, setProperties] = useState<any[]>([]);
  const [leases, setLeases] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [natures, setNatures] = useState<any[]>([]);
  
  // État local pour gérer le mode auto du montant
  const [isAutoAmount, setIsAutoAmount] = useState(true);
  
  // États pour la combobox Nature
  const [isNatureOpen, setIsNatureOpen] = useState(false);
  const [natureSearch, setNatureSearch] = useState('');
  const [selectedNature, setSelectedNature] = useState<string>('');
  
  // États pour la combobox Catégorie
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  
  // États locaux pour tous les champs
  const [localFormData, setLocalFormData] = useState({
    label: '',
    periodMonth: '',
    periodYear: new Date().getFullYear()
  });
  
  // État pour le bail lié (en mode édition)
  const [linkedBail, setLinkedBail] = useState<any>(null);
  const [showLinkBailModal, setShowLinkBailModal] = useState(false);
  
  // États pour la modale de review-draft
  const [showReviewDraftModal, setShowReviewDraftModal] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  
  // États pour la modal d'avertissement des documents non classés
  const [showUnclassifiedModal, setShowUnclassifiedModal] = useState(false);
  const [unclassifiedDocuments, setUnclassifiedDocuments] = useState<any[]>([]);
  
  // État pour la modal d'avertissement du bien manquant
  const [showMissingPropertyModal, setShowMissingPropertyModal] = useState(false);

  // Hook pour récupérer les libellés personnalisés des natures
  const { getNatureLabel, loading: natureLabelsLoading } = useNatureLabels();
  
  // Hook pour l'upload de documents
  const { openModalWithFileSelection } = useUploadReviewModal();
  
  // Hook pour le staging des documents
  const {
    uploadSessionId,
    stagedDocuments,
    setStagedDocuments,
    loading: stagingLoading,
    error: stagingError,
    createUploadSession,
    loadStagedDocuments,
    addStagedDocument,
    removeStagedDocument,
    clearStaging
  } = useUploadStaging();
  
  // Hook pour vérifier le statut de la gestion déléguée (depuis settings)
  const { isEnabled: isGestionEnabled, isLoading: isGestionLoading } = useGestionDelegueStatus();
  
  // Hook pour récupérer les codes système de la gestion déléguée
  const { codes: gestionCodes, isLoading: isGestionCodesLoading } = useGestionCodes();
  
  // État pour les documents liés à la transaction (en mode édition)
  const [linkedDocuments, setLinkedDocuments] = useState<any[]>([]);
  
  // État pour les liens vers documents existants
  const [stagedLinks, setStagedLinks] = useState<any[]>([]);
  
  // Ref pour éviter de lier le même document plusieurs fois
  const linkedDocumentIds = React.useRef<Set<string>>(new Set());
  
  // Ref pour empêcher la double création de session d'upload
  const sessionInitializedRef = React.useRef(false);
  
  // État pour la modal d'upload avec staging
  const [showStagedUploadModal, setShowStagedUploadModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  
  // État pour la modale de doublon détecté
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateData, setDuplicateData] = useState<any>(null);
  
  // États pour la modal de suppression de document
  const [showDeleteDocModal, setShowDeleteDocModal] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<any>(null);
  
  // États pour la modale de suggestion de transaction depuis document
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<{
    documentId: string;
    documentTypeName: string;
  } | null>(null);
  
  // Ref pour suivre les documents déjà traités pour les suggestions
  const processedDocIds = React.useRef<Set<string>>(new Set());
  
  // Ref pour indiquer qu'on applique une suggestion OCR (évite l'écrasement par le pré-remplissage du bail)
  const isApplyingOcrSuggestion = React.useRef(false);
  
  // États pour indiquer qu'un document existe déjà en brouillon
  const [showDraftExistsModal, setShowDraftExistsModal] = useState(false);
  const [draftExistsData, setDraftExistsData] = useState<{
    documentId: string;
    fileName: string;
  } | null>(null);
  
  // Fonction pour gérer l'upload avec détection de doublons
  const handleFileUpload = async (files: File[]) => {
    console.log('[TransactionModal] handleFileUpload appelé avec:', files.length, 'fichiers');
    
    if (!uploadSessionId) {
      notify2.error('Session d\'upload non disponible');
      return;
    }
    
    console.log('[TransactionModal] Session ID:', uploadSessionId);

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('uploadSessionId', uploadSessionId);
        formData.append('intendedContextType', 'transaction');
        formData.append('intendedContextTempKey', mode === 'create' ? 'transaction:new' : 'transaction:edit');

        const response = await fetch('/api/uploads/staged', {
          method: 'POST',
          body: formData
        });

        if (response.status === 409) {
          // Doublon détecté
          const duplicateInfo = await response.json();
          setDuplicateData(duplicateInfo);
          setShowDuplicateModal(true);
          return; // Arrêter l'upload des autres fichiers
        } else if (response.ok) {
          // Upload réussi
          const result = await response.json();
          if (result.success) {
            // Recharger la liste des documents et liens
            console.log('[TransactionModal] Rechargement des documents...');
            await loadStagedDocuments(uploadSessionId);
            
            // Recharger aussi les liens vers documents existants
            try {
              const sessionResponse = await fetch(`/api/uploads/session/${uploadSessionId}`);
              if (sessionResponse.ok) {
                const sessionData = await sessionResponse.json();
                if (sessionData.success) {
                  setStagedLinks(sessionData.DocumentLink || []);
                  console.log('[TransactionModal] Liens rechargés:', sessionData.DocumentLink?.length || 0);
                }
              }
            } catch (error) {
              console.error('[TransactionModal] Erreur lors du rechargement des liens:', error);
            }
            
            console.log('[TransactionModal] Upload terminé avec succès');
            notify2.success(`Document "${file.name}" ajouté en brouillon`);
          }
        } else {
          let errorMessage = `Erreur lors de l'upload de "${file.name}"`;
          try {
            const errorData = await response.json();
            if (errorData?.code === 'DRAFT_EXISTS') {
              setDraftExistsData({
                documentId: errorData.draftId,
                fileName: errorData.fileName || file.name
              });
              setShowDraftExistsModal(true);
              return; // Arrêter l'upload des autres fichiers
            }
            if (errorData?.error) {
              errorMessage = errorData.error;
            }
          } catch (err) {
            console.warn('[TransactionModal] Impossible de parser la réponse d\'erreur', err);
          }
          notify2.error(errorMessage);
        }
      } catch (error) {
        console.error('Erreur lors de l\'upload:', error);
        notify2.error(`Erreur lors de l'upload de "${file.name}"`);
      }
    }
  };
  
  // Fonction pour lier un document existant
  const handleLinkExisting = async () => {
    if (!duplicateData || !uploadSessionId) return;

    try {
      const response = await fetch('/api/uploads/staged/link-existing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uploadSessionId,
          existingDocumentId: duplicateData.existing.id,
          context: {
            type: 'transaction',
            tempKey: mode === 'create' ? 'transaction:new' : 'transaction:edit',
            refId: mode === 'edit' ? transactionId : undefined
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Ajouter le lien à la liste locale
          setStagedLinks(prev => [...prev, result.item]);
          setShowDuplicateModal(false);
          setDuplicateData(null);
          notify2.success('Document existant lié avec succès');
        }
      } else {
        notify2.error('Erreur lors de la liaison du document');
      }
    } catch (error) {
      console.error('Erreur lors de la liaison:', error);
      notify2.error('Erreur lors de la liaison du document');
    }
  };
  
  // Fonction pour charger les documents liés à la transaction
  const loadLinkedDocuments = async () => {
    if (!transactionId) return;
    
    console.log('[TransactionModal] 🔍 loadLinkedDocuments appelé pour transactionId:', transactionId);
    console.log('[TransactionModal] 🔍 État linkedDocuments AVANT chargement:', linkedDocuments);
    
    try {
      const response = await fetch(`/api/transactions/${transactionId}/documents`);
      if (response.ok) {
        const data = await response.json();
        console.log('[TransactionModal] 📄 Données reçues de l\'API documents:', data);
        console.log('[TransactionModal] 📄 Nombre de documents:', data.documents?.length || 0);
        console.log('[TransactionModal] 📄 Premier document reçu:', data.documents?.[0]);
        
        const documentsToSet = data.documents || [];
        console.log('[TransactionModal] 📄 Documents à définir:', documentsToSet);
        
        console.log('[TransactionModal] 📄 Appel de setLinkedDocuments avec:', documentsToSet);
        setLinkedDocuments(documentsToSet);
        
        // Vérifier l'état après un délai - utiliser la valeur locale au lieu de la closure
        setTimeout(() => {
          console.log('[TransactionModal] 📄 État linkedDocuments après setState (délai):', documentsToSet);
        }, 100);
        
      } else {
        console.error('[TransactionModal] ❌ Erreur API documents:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('[TransactionModal] ❌ Erreur lors du chargement des documents:', error);
    }
  };

  // Surveiller les changements de linkedDocuments
  useEffect(() => {
    console.log('[TransactionModal] 🔄 useEffect linkedDocuments - Nouvelle valeur:', linkedDocuments);
    console.log('[TransactionModal] 🔄 useEffect linkedDocuments - Longueur:', linkedDocuments.length);
  }, [linkedDocuments]);

  // Fonction pour formater les liaisons d'un document de manière compacte
  const formatDocumentLinks = (doc: any) => {
    console.log('[formatDocumentLinks] Document reçu:', doc);
    console.log('[formatDocumentLinks] Document links:', doc.DocumentLink);
    
    if (!doc.DocumentLink || doc.DocumentLink.length === 0) {
      console.log('[formatDocumentLinks] Aucune liaison trouvée');
      return null;
    }
    
    // Filtrer la liaison vers la transaction courante pour ne pas l'afficher
    const otherLinks = doc.DocumentLink.filter((link: any) => 
      !(link.linkedType === 'transaction' && link.linkedId === transactionId)
    );
    
    console.log('[formatDocumentLinks] Autres liaisons après filtrage:', otherLinks);
    
    if (otherLinks.length === 0) {
      console.log('[formatDocumentLinks] Aucune autre liaison après filtrage');
      return null;
    }
    
    // Utiliser entityInfo si disponible, sinon utiliser les types bruts
    const linkLabels = otherLinks.map((link: any) => {
      console.log('[formatDocumentLinks] Traitement de la liaison:', link);
      if (link.entityInfo) {
        const label = link.entityInfo.type === 'Transaction' || link.entityInfo.type === 'Bien' || link.entityInfo.type === 'Bail' 
          ? link.entityInfo.name 
          : link.entityInfo.type;
        console.log('[formatDocumentLinks] Label généré (entityInfo):', label);
        return label;
      } else {
        const typeMap: Record<string, string> = {
          'transaction': 'Txn',
          'property': 'Bien',
          'lease': 'Bail',
          'tenant': 'Locataire',
          'global': 'Global'
        };
        
        const label = typeMap[link.linkedType] || link.linkedType;
        console.log('[formatDocumentLinks] Label généré (typeMap):', label);
        return label;
      }
    });

    const result = linkLabels.join(', ');
    console.log('[formatDocumentLinks] Résultat final:', result);
    return result;
  };
  
  // Charger les documents au montage du composant si en mode édition
  useEffect(() => {
    if (mode === 'edit' && transactionId) {
      loadLinkedDocuments();
    }
  }, [mode, transactionId]);

  // Fonctions utilitaires pour la combobox Nature
  const getSelectedNatureLabel = () => {
    const selectedValue = selectedNature || watch('nature');
    if (!selectedValue) return 'Sélectionner une nature';
    
    // Chercher la nature dans les données chargées de la base
    const nature = natures.find(n => n.key === selectedValue);
    return nature ? nature.label : selectedValue;
  };



  const getFilteredNatureOptions = () => {
    // Utiliser directement les natures de la base de données
    // Inférer le flow à partir du code de la nature
    const incomeNatures = natures.filter(nature => nature.key.startsWith('RECETTE_'));
    const expenseNatures = natures.filter(nature => nature.key.startsWith('DEPENSE_'));
    
    console.log('[Debug] Natures for combobox:', natures.length, 'Income:', incomeNatures.length, 'Expense:', expenseNatures.length);
    
    const natureOptions = [
      {
        group: 'Recettes',
        icon: '⬆️',
        options: incomeNatures.map(nature => ({
          value: nature.key, // Utiliser directement le code de la base
          label: nature.label, // Utiliser directement le label de la base
          description: `Code: ${nature.key}`
        }))
      },
      {
        group: 'Dépenses', 
        icon: '⬇️',
        options: expenseNatures.map(nature => ({
          value: nature.key, // Utiliser directement le code de la base
          label: nature.label, // Utiliser directement le label de la base
          description: `Code: ${nature.key}`
        }))
      }
    ];
    
    console.log('[Debug] Nature options:', natureOptions);
    
    if (!natureSearch) return natureOptions;
    
    return natureOptions.map(group => ({
      ...group,
      options: group.options.filter(option => 
        option.label.toLowerCase().includes(natureSearch.toLowerCase()) ||
        option.description.toLowerCase().includes(natureSearch.toLowerCase())
      )
    })).filter(group => group.options.length > 0);
  };

  const handleNatureSelect = (value: string) => {
    setValue('nature', value);
    setSelectedNature(value);
    setIsNatureOpen(false);
    setNatureSearch('');
    // Note: La sélection auto de la catégorie par défaut est gérée par useAutoFillTransaction
  };

  // Configuration du formulaire avec react-hook-form et zod
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
    reset
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      propertyId: context.propertyId || '',
      leaseId: '',
      tenantId: '',
      date: new Date().toISOString().split('T')[0],
      nature: '',
      categoryId: '',
      label: '',
      amount: 0,
      reference: '',
      paymentDate: '',
      paymentMethod: '',
      notes: '',
      periodMonth: '',
      periodYear: new Date().getFullYear(),
      autoDistribution: false
    }
  });

  // Fonction pour générer le libellé automatiquement
  const generateLabel = useCallback(() => {
    const natureValue = watch('nature');
    const categoryId = watch('categoryId');
    const periodMonth = watch('periodMonth');
    const periodYear = watch('periodYear');
    const propertyId = watch('propertyId');
    const monthsCovered = watch('monthsCovered');

    let labelParts = [];

    // 1. Catégorie (ou nature si pas de catégorie)
    if (categoryId) {
      const selectedCategory = categories.find(cat => cat.id === categoryId);
      if (selectedCategory) {
        labelParts.push(selectedCategory.label);
      }
    } else if (natureValue) {
      const selectedNature = natures.find(nature => nature.key === natureValue);
      if (selectedNature) {
        labelParts.push(selectedNature.label);
      }
    }

    // 2. Période - UNIQUEMENT si mode édition OU si monthsCovered = 1
    // Si monthsCovered > 1, le backend ajoutera la période spécifique pour chaque transaction
    if (mode === 'edit' || !monthsCovered || monthsCovered === 1) {
      if (periodMonth && periodYear) {
        const monthNames = [
          'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
          'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
        ];
        const monthName = monthNames[parseInt(periodMonth) - 1] || periodMonth;
        labelParts.push(`${monthName} ${periodYear}`);
      }
    }

    // 3. Bien
    if (propertyId) {
      const selectedProperty = properties.find(prop => prop.id === propertyId);
      if (selectedProperty) {
        labelParts.push(selectedProperty.name);
      }
    }

    return labelParts.join(' - ');
  }, [watch, categories, natures, properties, mode]);

  // Mise à jour automatique du libellé
  useEffect(() => {
    const subscription = watch((value, { name }) => {
      // Mettre à jour le libellé quand nature, catégorie, période ou bien changent
      if (name === 'nature' || name === 'categoryId' || name === 'periodMonth' || name === 'periodYear' || name === 'propertyId') {
        const newLabel = generateLabel();
        if (newLabel) {
          setValue('label', newLabel);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, setValue, generateLabel]);

  // Synchroniser les états locaux avec les valeurs du formulaire
  useEffect(() => {
    const natureValue = watch('nature');
    const categoryValue = watch('categoryId');
    
    if (natureValue && natureValue !== selectedNature) {
      console.log('[TransactionModal] Synchronisation nature:', natureValue);
      setSelectedNature(natureValue);
    }
    
    if (categoryValue && categoryValue !== selectedCategory) {
      console.log('[TransactionModal] Synchronisation catégorie:', categoryValue);
      setSelectedCategory(categoryValue);
    }
  }, [watch('nature'), watch('categoryId'), selectedNature, selectedCategory]);

  // Hook pour la logique de pré-remplissage automatique
  const {
    autoFillState,
    markAsManual,
    resetToAuto,
    filteredLeases,
    filteredCategories,
    mappingLoading
  } = useAutoFillTransaction({
    watch,
    setValue,
    getValues,
    properties: properties || [],
    leases: leases || [],
    categories: categories || [],
    mode: mode, // Passer le mode pour désactiver les automatismes en édition
    selectedNature: selectedNature // Passer la nature sélectionnée pour le filtrage
  });

  // Calculer la valeur auto du montant basée sur le bail sélectionné
  const leasesArray = Array.isArray(leases) ? leases : [];
  const leaseId = watch('leaseId');
  const selectedLease = leaseId ? leasesArray.find(lease => lease.id === leaseId) : null;
  const autoAmountValue = selectedLease 
    ? (selectedLease.rentAmount || selectedLease.rent || 0) + (selectedLease.chargesRecupMensuelles || selectedLease.charges || 0) 
    : 0;
  
  // Debug logs (commenté pour la production)
  // console.log('[Debug] leaseId:', leaseId, 'leasesArray:', leasesArray.length, 'selectedLease:', selectedLease);

  // Gestion du mode auto du montant (déclenché au changement de BAIL uniquement)
  useEffect(() => {
    // ⚠️ Ne pas écraser les valeurs si on applique une suggestion OCR
    if (isApplyingOcrSuggestion.current) {
      console.log('[TransactionModal] ⏭️ Application suggestion OCR en cours, skip pré-remplissage bail');
      return;
    }
    
    // Quand le bail change et qu'on est en mode auto, mettre à jour le montant
    if (isAutoAmount && selectedLease) {
      setValue('amount', autoAmountValue);
      
      // ⚙️ GESTION DÉLÉGUÉE: Préremplir les champs de détail du loyer (seulement si activée)
      if (isGestionEnabled && gestionCodes) {
        // Vérifier que nature et catégorie correspondent aux codes système
        const selectedCategoryObj = categories.find(c => c.id === selectedCategory);
        const selectedCategorySlug = selectedCategoryObj?.slug || '';
        const matchesCodes = selectedNature === gestionCodes.rentNature &&
                            selectedCategorySlug === gestionCodes.rentCategory;
        
        // Préremplir uniquement si les codes correspondent (évite le pré-remplissage pour d'autres natures)
        if (matchesCodes) {
          // Préremplir le loyer hors charges
          if (selectedLease.rentAmount) {
            setValue('montantLoyer', selectedLease.rentAmount);
          }
          // Préremplir les charges récupérables
          if (selectedLease.chargesRecupMensuelles) {
            setValue('chargesRecup', selectedLease.chargesRecupMensuelles);
          }
          // Préremplir les charges non récupérables
          if (selectedLease.chargesNonRecupMensuelles) {
            setValue('chargesNonRecup', selectedLease.chargesNonRecupMensuelles);
          }
          
          console.log('[TransactionModal] Pré-remplissage breakdown (changement bail):', {
            montantLoyer: selectedLease.rentAmount,
            chargesRecup: selectedLease.chargesRecupMensuelles,
            chargesNonRecup: selectedLease.chargesNonRecupMensuelles
          });
        }
      }
    }
  }, [selectedLease?.id, isAutoAmount, autoAmountValue, setValue, isGestionEnabled, gestionCodes]); 
  // 🎯 Note : selectedNature et selectedCategory ne sont PAS dans les dépendances
  // Le pré-remplissage au changement de nature/catégorie est géré par l'autre useEffect

  // Initialisation de isAutoAmount en CRÉATION uniquement
  useEffect(() => {
    // En édition, on ne touche jamais à isAutoAmount (restauré depuis la BDD)
    if (mode !== 'create') return;
    
    // Ne pas gérer isAutoAmount pour les transactions enfant (commissions)
    const isChildTransaction = watch('parentTransactionId' as any);
    if (isChildTransaction) return;
    
    if (isGestionEnabled && gestionCodes && selectedNature && selectedCategory) {
      const selectedCategoryObj = categories.find(c => c.id === selectedCategory);
      const selectedCategorySlug = selectedCategoryObj?.slug || '';
      const matchesCodes = selectedNature === gestionCodes.rentNature &&
                           selectedCategorySlug === gestionCodes.rentCategory;
      
      console.log('[TransactionModal] 🔄 useEffect isAutoAmount (création):', {
        matchesCodes,
        selectedNature,
        selectedCategorySlug,
        gestionCodes
      });
      
      // En création : Auto ON par défaut si codes loyer correspondent
      if (matchesCodes) {
        setIsAutoAmount(true);
        console.log('[TransactionModal] ✅ isAutoAmount défini: true (codes loyer)');
      } else {
        setIsAutoAmount(false);
        console.log('[TransactionModal] ⚠️ isAutoAmount défini: false (pas codes loyer)');
      }
    }
  }, [mode, isGestionEnabled, gestionCodes, selectedNature, selectedCategory, categories]);
  
  // Recalcul automatique du montant quand isAutoAmount est ON et que le breakdown change
  const montantLoyer = watch('montantLoyer') || 0;
  const chargesRecup = watch('chargesRecup') || 0;
  const chargesNonRecup = watch('chargesNonRecup') || 0;
  
  useEffect(() => {
    // Ne pas recalculer pour les transactions enfant (commissions)
    const isChildTransaction = watch('parentTransactionId' as any);
    if (isChildTransaction) return;
    
    if (isAutoAmount) {
      const selectedCategoryObj = categories.find(c => c.id === selectedCategory);
      const selectedCategorySlug = selectedCategoryObj?.slug || '';
      const matchesCodes = isGestionEnabled &&
                           gestionCodes &&
                           selectedNature === gestionCodes.rentNature &&
                           selectedCategorySlug === gestionCodes.rentCategory;
      
      // En édition, vérifier si un breakdown existe déjà (depuis les champs du formulaire)
      const hasBreakdown = mode === 'edit' && (
        montantLoyer !== 0 ||
        chargesRecup !== 0 ||
        chargesNonRecup !== 0
      );
      
      // Recalculer le montant si le bloc breakdown est visible
      // IMPORTANT : Montant = loyer_hc + charges_recup SEULEMENT (pas les charges non récup)
      // Les charges non récup sont à la charge du propriétaire, pas du locataire
      if (matchesCodes || hasBreakdown) {
        const total = montantLoyer + chargesRecup; // SANS chargesNonRecup
        if (total > 0) {
          setValue('amount', total, { shouldDirty: true });
        }
      }
    }
  }, [isAutoAmount, montantLoyer, chargesRecup, chargesNonRecup, isGestionEnabled, gestionCodes, selectedNature, selectedCategory, categories, mode, setValue]);

  // Note: La gestion du mode auto du montant est maintenant gérée localement
  // Le hook useAutoFillTransaction ne doit pas interférer avec notre logique locale

  // Réinitialiser le mode auto quand on change de bien (nouveau contexte)
  const propertyId = watch('propertyId');
  useEffect(() => {
    if (propertyId && mode === 'create') {
      // En mode création, réinitialiser le mode auto quand on change de bien
      setIsAutoAmount(true);
    }
  }, [propertyId, mode]);

  // Fermer la combobox Nature quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isNatureOpen && !(event.target as Element).closest('.nature-combobox')) {
        setIsNatureOpen(false);
        setNatureSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNatureOpen]);

  // 🐛 FIX : Gestion intelligente du breakdown (pré-remplissage OU nettoyage)
  useEffect(() => {
    if (!isGestionEnabled || !gestionCodes || !selectedNature || !selectedCategory) return;
    
    const selectedCategoryObj = categories.find(c => c.id === selectedCategory);
    const selectedCategorySlug = selectedCategoryObj?.slug || '';
    const matchesCodes = selectedNature === gestionCodes.rentNature &&
                        selectedCategorySlug === gestionCodes.rentCategory;
    
    // Si les codes ne correspondent PAS, nettoyer les champs
    if (!matchesCodes) {
      const currentMontantLoyer = watch('montantLoyer');
      const currentChargesRecup = watch('chargesRecup');
      const currentChargesNonRecup = watch('chargesNonRecup');
      
      // Seulement si au moins un champ est rempli
      if (currentMontantLoyer || currentChargesRecup || currentChargesNonRecup) {
        setValue('montantLoyer', 0);
        setValue('chargesRecup', 0);
        setValue('chargesNonRecup', 0);
        console.log('[TransactionModal] Nettoyage des champs breakdown (codes ne correspondent plus)');
      }
    }
    // Si les codes correspondent ET qu'on a un bail, pré-remplir si les champs sont vides
    else if (matchesCodes && selectedLease && isAutoAmount) {
      const currentMontantLoyer = watch('montantLoyer') || 0;
      const currentChargesRecup = watch('chargesRecup') || 0;
      const currentChargesNonRecup = watch('chargesNonRecup') || 0;
      
      // Pré-remplir uniquement si les champs sont vides (évite d'écraser les valeurs manuelles)
      const areFieldsEmpty = currentMontantLoyer === 0 && currentChargesRecup === 0 && currentChargesNonRecup === 0;
      
      if (areFieldsEmpty) {
        if (selectedLease.rentAmount) {
          setValue('montantLoyer', selectedLease.rentAmount);
        }
        if (selectedLease.chargesRecupMensuelles) {
          setValue('chargesRecup', selectedLease.chargesRecupMensuelles);
        }
        if (selectedLease.chargesNonRecupMensuelles) {
          setValue('chargesNonRecup', selectedLease.chargesNonRecupMensuelles);
        }
        
        console.log('[TransactionModal] Pré-remplissage breakdown (retour à loyer):', {
          montantLoyer: selectedLease.rentAmount,
          chargesRecup: selectedLease.chargesRecupMensuelles,
          chargesNonRecup: selectedLease.chargesNonRecupMensuelles
        });
      }
    }
  }, [selectedNature, selectedCategory, isGestionEnabled, gestionCodes, categories, watch, setValue, selectedLease, isAutoAmount]);

  // Chargement des données initiales
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      // TOUJOURS nettoyer l'état au début, peu importe le mode
      await clearStaging();
      
      // VIDER COMPLÈTEMENT l'état local du composant
      setLinkedDocuments([]);
      setShowStagedUploadModal(false);
      
      setIsLoading(true);
      try {
        // Charger les propriétés avec une limite élevée pour récupérer tous les biens
        const propertiesResponse = await fetch('/api/properties?limit=10000');
        const propertiesData = await propertiesResponse.json();
        // L'API retourne { data: [...], pagination: {...} }
        const propertiesList = propertiesData.data || propertiesData.properties || propertiesData.items || (Array.isArray(propertiesData) ? propertiesData : []);
        const finalList = Array.isArray(propertiesList) ? propertiesList : [];
        console.log('[TransactionModal] Propriétés chargées:', finalList.length, 'sur', propertiesData?.pagination?.total || '?');
        setProperties(finalList);

        // Charger les baux
        const leasesResponse = await fetch('/api/leases');
        const leasesData = await leasesResponse.json();
        const leasesArray = leasesData.items || leasesData.data || leasesData || [];
        // console.log('[Debug] Leases API response:', leasesData);
        // console.log('[Debug] Leases array:', leasesArray);
        setLeases(leasesArray);

        // Charger les catégories
        const categoriesResponse = await fetch('/api/accounting/categories');
        const categoriesData = await categoriesResponse.json();
        setCategories(categoriesData || []);

        // Charger les natures depuis l'API admin
        const naturesResponse = await fetch('/api/admin/natures');
        const naturesData = await naturesResponse.json();
        const naturesArray = naturesData.data || [];
        console.log('[Debug] Natures loaded:', naturesArray);
        console.log('[Debug] First nature structure:', naturesArray[0]);
        setNatures(naturesArray);

        // Si mode édition, charger la transaction + initialiser session + charger drafts
        if (mode === 'edit' && transactionId) {
          // Charger en parallèle : transaction + session + drafts
          const [transactionResponse, sessionId] = await Promise.all([
            fetch(`/api/transactions/${transactionId}`),
            createUploadSession({ scope: 'transaction:edit', transactionId })
          ]);
          
          const transactionData = await transactionResponse.json();
          console.log('[TransactionModal] Données chargées:', transactionData);
          console.log('[TransactionModal] Nature:', transactionData.nature);
          console.log('[TransactionModal] CategoryId:', transactionData.categoryId);
          console.log('[TransactionModal] Amount:', transactionData.amount);
          
          // ⚙️ CORRECTION: Convertir les montants négatifs (dépenses) en positifs pour l'affichage
          // Dans le formulaire, on saisit toujours en positif, le signe est déterminé par la nature
          const displayAmount = Math.abs(transactionData.amount || 0);
          console.log('[TransactionModal] Display Amount (abs):', displayAmount);
          
          // Charger le bail lié si bailId existe - AVANT de pré-remplir le formulaire
          if (transactionData.bailId) {
            setLinkedBail(transactionData.bail);
          }
          
          // Pré-remplir le formulaire avec TOUS les champs
          console.log('[TransactionModal] Pré-remplissage des champs:', {
            propertyId: transactionData.propertyId,
            leaseId: transactionData.leaseId,
            date: transactionData.date,
            nature: transactionData.nature,
            categoryId: transactionData.categoryId,
            amount: displayAmount,
            label: transactionData.label,
            reference: transactionData.reference
          });

          if (transactionData.propertyId) setValue('propertyId', transactionData.propertyId);
          if (transactionData.leaseId) setValue('leaseId', transactionData.leaseId);
          if (transactionData.date) setValue('date', transactionData.date);
          if (transactionData.nature) {
            console.log('[TransactionModal] Définition de la nature:', transactionData.nature);
            setSelectedNature(transactionData.nature);
            setValue('nature', transactionData.nature);
            // Forcer la mise à jour de la combobox nature
            setTimeout(() => {
              const currentNature = getValues('nature');
              console.log('[TransactionModal] Nature après setValue:', currentNature);
            }, 50);
          }
          if (transactionData.categoryId) {
            console.log('[TransactionModal] Définition de la catégorie:', transactionData.categoryId);
            setSelectedCategory(transactionData.categoryId);
            setValue('categoryId', transactionData.categoryId);
            // Forcer la mise à jour de la combobox catégorie
            setTimeout(() => {
              const currentCategory = getValues('categoryId');
              console.log('[TransactionModal] Catégorie après setValue:', currentCategory);
            }, 50);
          }
          if (displayAmount) setValue('amount', displayAmount);
          if (transactionData.label) setValue('label', transactionData.label);
          if (transactionData.reference) setValue('reference', transactionData.reference);
          // Champs de paiement
          if (transactionData.paymentDate) setValue('paymentDate', transactionData.paymentDate);
          if (transactionData.paymentMethod) setValue('paymentMethod', transactionData.paymentMethod);
          if (transactionData.paidAt) setValue('paidAt', transactionData.paidAt);
          if (transactionData.method) setValue('method', transactionData.method);
          // Champs de rapprochement
          if (transactionData.rapprochementStatus) setValue('rapprochementStatus', transactionData.rapprochementStatus);
          if (transactionData.bankRef) setValue('bankRef', transactionData.bankRef);
          // Champs de période
          if (transactionData.notes) setValue('notes', transactionData.notes);
          if (transactionData.periodStart) setValue('periodStart', transactionData.periodStart);
          if (transactionData.accountingMonth) setValue('accountingMonth', transactionData.accountingMonth);
          if (transactionData.periodMonth) setValue('periodMonth', transactionData.periodMonth);
          if (transactionData.periodYear) setValue('periodYear', transactionData.periodYear);
          if (transactionData.monthsCovered) setValue('monthsCovered', transactionData.monthsCovered);
          
          // Charger les champs de série (readonly en édition)
          if (transactionData.parentTransactionId) setValue('parentTransactionId' as any, transactionData.parentTransactionId);
          if (transactionData.autoSource) setValue('autoSource' as any, transactionData.autoSource);
          if (transactionData.moisIndex) setValue('moisIndex' as any, transactionData.moisIndex);
          if (transactionData.moisTotal) setValue('moisTotal' as any, transactionData.moisTotal);
          
          // Charger les champs de breakdown loyer (gestion déléguée)
          if (transactionData.montantLoyer) setValue('montantLoyer', transactionData.montantLoyer);
          if (transactionData.chargesRecup) setValue('chargesRecup', transactionData.chargesRecup);
          if (transactionData.chargesNonRecup) setValue('chargesNonRecup', transactionData.chargesNonRecup);
          
          // Restaurer l'état du toggle Auto en édition
          console.log('[TransactionModal] 🔄 Restauration isAutoAmount:', transactionData.isAutoAmount);
          
          // Fallback intelligent selon le type de transaction
          const isCommission = transactionData.parentTransactionId && transactionData.autoSource === 'gestion';
          
          if (transactionData.isAutoAmount !== undefined && transactionData.isAutoAmount !== null) {
            setIsAutoAmount(transactionData.isAutoAmount);
            console.log('[TransactionModal] ✅ isAutoAmount restauré:', transactionData.isAutoAmount);
          } else if (isCommission) {
            // Commission legacy (données anciennes) : forcer à false
            setIsAutoAmount(false);
            console.log('[TransactionModal] ⚠️ Commission legacy, isAutoAmount forcé: false');
          } else {
            // Transaction normale sans isAutoAmount défini : true par défaut
            setIsAutoAmount(true);
            console.log('[TransactionModal] ⚠️ isAutoAmount non défini, fallback: true');
          }

          // Forcer la mise à jour du formulaire avec reset
          const formData = {
            propertyId: transactionData.propertyId || '',
            leaseId: transactionData.leaseId || '',
            date: transactionData.date || '',
            nature: typeof transactionData.nature === 'object' ? transactionData.nature.id : (transactionData.nature || ''),
            categoryId: transactionData.categoryId || '',
            amount: displayAmount || 0,
            label: transactionData.label || '',
            reference: transactionData.reference || '',
            paymentDate: transactionData.paymentDate || '',
            paymentMethod: transactionData.paymentMethod || '',
            paidAt: transactionData.paidAt || '',
            method: transactionData.method || '',
            notes: transactionData.notes || '',
            periodStart: transactionData.periodStart || '',
            accountingMonth: transactionData.accountingMonth || '',
            periodMonth: transactionData.periodMonth || '',
            periodYear: transactionData.periodYear || new Date().getFullYear(),
            monthsCovered: transactionData.monthsCovered || 1,
            autoDistribution: false,
            rapprochementStatus: transactionData.rapprochementStatus || 'non_rapprochee',
            bankRef: transactionData.bankRef || ''
          };
          
          console.log('[TransactionModal] Reset du formulaire avec:', formData);
          
          // Utiliser setValue pour chaque champ au lieu de reset
          Object.entries(formData).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              setValue(key as any, value);
              console.log(`[TransactionModal] setValue(${key}, ${value})`);
            }
          });
          
          // Mettre à jour les états locaux immédiatement
          const natureValue = typeof transactionData.nature === 'object' ? transactionData.nature.id : (transactionData.nature || '');
          setSelectedNature(natureValue);
          setSelectedCategory(transactionData.categoryId || '');
          
          // Forcer la mise à jour des valeurs du formulaire
          setTimeout(() => {
            setValue('nature', natureValue);
            setValue('categoryId', transactionData.categoryId || '');
          }, 100);
          setLocalFormData({
            label: transactionData.label || '',
            periodMonth: transactionData.periodMonth || '',
            periodYear: transactionData.periodYear || new Date().getFullYear()
          });
          console.log('[TransactionModal] États locaux mis à jour immédiatement:', {
            nature: natureValue,
            categoryId: transactionData.categoryId,
            label: transactionData.label,
            periodMonth: transactionData.periodMonth,
            periodYear: transactionData.periodYear
          });
          
          // Vérifier les valeurs après reset
          setTimeout(() => {
            const currentValues = getValues();
            console.log('[TransactionModal] Valeurs du formulaire après reset:', {
              nature: currentValues.nature,
              categoryId: currentValues.categoryId,
              propertyId: currentValues.propertyId,
              leaseId: currentValues.leaseId
            });
            console.log('[TransactionModal] États locaux:', {
              selectedNature,
              selectedCategory
            });
          }, 100);
          
          // ✅ isAutoAmount est déjà restauré depuis transactionData.isAutoAmount (ligne 787-793)
          // Pas besoin de l'écraser ici !
          
          // Charger les documents liés actifs (avec liaisons détaillées)
          // Note: Ne pas écraser linkedDocuments car ils viennent de loadLinkedDocuments() 
          // qui contient les liaisons détaillées via /api/transactions/[id]/documents
          if (transactionData.Document) {
            console.log('[TransactionModal] Documents de la transaction (sans liaisons):', transactionData.Document);
            console.log('[TransactionModal] Premier document de la transaction:', transactionData.Document[0]);
            console.log('[TransactionModal] Premier document links de la transaction:', transactionData.Document[0]?.DocumentLink);
            // Ne pas faire setLinkedDocuments(transactionData.Document) car cela écrase les liaisons
            console.log('[TransactionModal] Documents avec liaisons déjà chargés via loadLinkedDocuments()');
          }
          
          // Charger les documents liés avec leurs liaisons détaillées
          await loadLinkedDocuments();

          // Charger les drafts et liens de la session
          if (sessionId) {
            await loadStagedDocuments(sessionId);
            
            // Charger aussi les liens vers documents existants
            try {
              const sessionResponse = await fetch(`/api/uploads/session/${sessionId}`);
              if (sessionResponse.ok) {
                const sessionData = await sessionResponse.json();
                if (sessionData.success) {
                  setStagedLinks(sessionData.DocumentLink || []);
                  console.log('[TransactionModal] Liens vers documents existants chargés:', sessionData.DocumentLink?.length || 0);
                }
              }
            } catch (error) {
              console.error('[TransactionModal] Erreur lors du chargement des liens:', error);
            }
            
            console.log('[TransactionModal] Session chargée et drafts récupérés');
          }
        } 
        // Si mode création, initialiser session pour nouveau
        else if (mode === 'create') {
          // Empêcher la double initialisation (React Strict Mode déclenche 2x le useEffect en dev)
          if (sessionInitializedRef.current) {
            console.log('[TransactionModal] ⏭️ Session déjà initialisée, skip');
            return;
          }
          
          sessionInitializedRef.current = true;
          
          let sessionIdToUse: string | null = null;
          
          // Si on a un document suggéré, récupérer sa session d'upload ou le document finalisé
          if (suggestionMeta?.documentId) {
            try {
              console.log('[TransactionModal] 📄 Récupération de la session du document uploadé:', suggestionMeta.documentId);
              
              // D'abord, essayer de récupérer le document en staging
              const docResponse = await fetch(`/api/uploads/staged/${suggestionMeta.documentId}`);
              if (docResponse.ok) {
                const docData = await docResponse.json();
                if (docData.uploadSessionId) {
                  sessionIdToUse = docData.uploadSessionId;
                  console.log('[TransactionModal] ✅ Session du document récupérée:', sessionIdToUse);
                  
                  // Charger les documents de la session existante
                  await loadStagedDocuments(sessionIdToUse);
                  
                  // Charger aussi les liens vers documents existants
                  try {
                    const sessionResponse = await fetch(`/api/uploads/session/${sessionIdToUse}`);
                    if (sessionResponse.ok) {
                      const sessionData = await sessionResponse.json();
                      if (sessionData.success) {
                        setStagedLinks(sessionData.links || []);
                        console.log('[TransactionModal] Liens vers documents existants chargés:', sessionData.links?.length || 0);
                      }
                    }
                  } catch (error) {
                    console.error('[TransactionModal] Erreur lors du chargement des liens:', error);
                  }
                }
              } else if (docResponse.status === 404) {
                // Le document n'est pas en staging, c'est un document finalisé
                // Créer une nouvelle session et lier le document finalisé
                console.log('[TransactionModal] 📄 Document finalisé détecté, création d\'un lien dans la session');
                
                // Créer une nouvelle session d'abord
                if (!sessionIdToUse) {
                  sessionIdToUse = await createUploadSession({ scope: 'transaction:new' });
                }
                
                // Créer un lien vers le document finalisé dans la session
                try {
                  const linkResponse = await fetch('/api/uploads/staged/link-existing', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      uploadSessionId: sessionIdToUse,
                      existingDocumentId: suggestionMeta.documentId,
                      context: {
                        type: 'transaction',
                        tempKey: 'new'
                      }
                    })
                  });
                  
                  if (linkResponse.ok) {
                    const linkData = await linkResponse.json();
                    console.log('[TransactionModal] ✅ Lien vers document finalisé créé:', linkData.itemId);
                    
                    // Charger les liens de la session
                    const sessionResponse = await fetch(`/api/uploads/session/${sessionIdToUse}`);
                    if (sessionResponse.ok) {
                      const sessionData = await sessionResponse.json();
                      if (sessionData.success) {
                        setStagedLinks(sessionData.links || []);
                        console.log('[TransactionModal] Liens vers documents existants chargés:', sessionData.links?.length || 0);
                      }
                    }
                  } else {
                    console.warn('[TransactionModal] ⚠️ Erreur lors de la création du lien:', await linkResponse.text());
                  }
                } catch (error) {
                  console.error('[TransactionModal] ⚠️ Erreur lors de la création du lien vers document finalisé:', error);
                }
              }
            } catch (error) {
              console.warn('[TransactionModal] ⚠️ Erreur lors de la récupération de la session du document:', error);
            }
          }
          
          // Si pas de session existante, créer une nouvelle
          if (!sessionIdToUse) {
            // FORCER le nettoyage complet pour une nouvelle transaction
            await clearStaging();
            setLinkedDocuments([]);
            setStagedDocuments([]);
            setStagedLinks([]); // Clear staged links
            sessionIdToUse = await createUploadSession({ scope: 'transaction:new' });
          }
          
          // Stocker l'ID pour la liaison du document
          (window as any).__currentUploadSessionId = sessionIdToUse;
          
          // En mode création, le montant est en mode auto par défaut
          setIsAutoAmount(true);
          console.log('[TransactionModal] 🆕 Mode création - isAutoAmount initialisé: true');
        }

        // Initialiser la période
        const currentDate = new Date();
        setValue('periodMonth', String(currentDate.getMonth() + 1).padStart(2, '0'));
        setValue('periodYear', currentDate.getFullYear());
        
        // Réinitialiser les états locaux SEULEMENT en mode création
        if (mode === 'create') {
          setSelectedNature('');
          setSelectedCategory('');
          setLocalFormData({
            label: '',
            periodMonth: String(currentDate.getMonth() + 1).padStart(2, '0'),
            periodYear: currentDate.getFullYear()
          });
        }

        // ✨ Appliquer le pré-remplissage OCR si disponible (mode création uniquement)
        if (mode === 'create' && prefill) {
          console.log('[TransactionModal] 🤖 Application du pré-remplissage OCR:', prefill);
          
          if (prefill.propertyId) setValue('propertyId', prefill.propertyId);
          if (prefill.leaseId) setValue('leaseId', prefill.leaseId);
          if (prefill.nature) {
            setSelectedNature(prefill.nature);
            setValue('nature', prefill.nature);
          }
          if (prefill.categoryId) {
            setSelectedCategory(prefill.categoryId);
            setValue('categoryId', prefill.categoryId);
          }
          if (prefill.amount) setValue('amount', prefill.amount);
          if (prefill.date) setValue('date', prefill.date);
          if (prefill.periodMonth) setValue('periodMonth', prefill.periodMonth);
          if (prefill.periodYear) setValue('periodYear', prefill.periodYear);
          if (prefill.label) setValue('label', prefill.label);
          if (prefill.reference) setValue('reference', prefill.reference);
          if (prefill.notes) setValue('notes', prefill.notes);
          
          // Détail du loyer (breakdown)
          if (prefill.montantLoyer) setValue('montantLoyer', prefill.montantLoyer);
          if (prefill.chargesRecup) setValue('chargesRecup', prefill.chargesRecup);
          if (prefill.chargesNonRecup) setValue('chargesNonRecup', prefill.chargesNonRecup);
          
          // Date de paiement
          if (prefill.paymentDate) {
            console.log('[TransactionModal] 🤖 Applique paymentDate depuis prefill:', prefill.paymentDate);
            setValue('paymentDate', prefill.paymentDate);
          }
          // Activer le calcul auto si breakdown présent
          if (prefill.montantLoyer || prefill.chargesRecup) {
            setIsAutoAmount(true);
          }
          
          // Mettre à jour les états locaux
          setLocalFormData({
            label: prefill.label || '',
            periodMonth: prefill.periodMonth || String(currentDate.getMonth() + 1).padStart(2, '0'),
            periodYear: prefill.periodYear || currentDate.getFullYear()
          });
          
          console.log('[TransactionModal] ✅ Pré-remplissage OCR appliqué avec confiance:', suggestionMeta?.confidence);
          
          // Lier automatiquement le document suggéré
          if (suggestionMeta?.documentId) {
            // Vérifier si ce document n'est pas déjà lié
            if (linkedDocumentIds.current.has(suggestionMeta.documentId)) {
              console.log('[TransactionModal] ⏭️ Document déjà lié, skip:', suggestionMeta.documentId);
            } else {
              // Récupérer l'ID de session (depuis window ou uploadSessionId)
              const sessionId = (window as any).__currentUploadSessionId || uploadSessionId;
              
              if (!sessionId) {
                console.warn('[TransactionModal] ⚠️ Pas de session ID disponible pour lier le document');
              } else {
                console.log('[TransactionModal] 📄 Liaison automatique du document:', suggestionMeta.documentId, 'session:', sessionId);
                try {
                  // Créer un lien vers le document suggéré
                  const linkResponse = await fetch('/api/uploads/staged/link-existing', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      uploadSessionId: sessionId,
                      existingDocumentId: suggestionMeta.documentId,
                      context: {
                        type: 'transaction',
                        tempKey: 'transaction:new',
                        refId: undefined
                      }
                    })
                  });

                  if (linkResponse.ok) {
                    const linkData = await linkResponse.json();
                    if (linkData.success && linkData.item) {
                      setStagedLinks(prev => [...prev, linkData.item]);
                      // Marquer comme lié pour éviter les doublons
                      linkedDocumentIds.current.add(suggestionMeta.documentId);
                      console.log('[TransactionModal] ✅ Document suggéré lié automatiquement');
                    }
                  }
                } catch (linkError) {
                  console.warn('[TransactionModal] ⚠️ Erreur liaison document suggéré:', linkError);
                  // Non-bloquant : continuer même si la liaison échoue
                }
              }
            }
          }
        }

      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        notify2.error('Erreur lors du chargement des données');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen, mode, transactionId, setValue]);

  // Réinitialiser le tracking des documents liés et de session quand la modale se ferme
  useEffect(() => {
    if (!isOpen) {
      linkedDocumentIds.current.clear();
      sessionInitializedRef.current = false;
      processedDocIds.current.clear();
      isApplyingOcrSuggestion.current = false; // Réinitialiser le flag OCR
      console.log('[TransactionModal] 🧹 Reset tracking documents liés et session');
    }
  }, [isOpen]);

  // 🤖 Surveiller les nouveaux documents uploadés pour détecter les types avec openTransaction
  useEffect(() => {
    const checkNewDocuments = async () => {
      // Ne vérifier que si la modale est ouverte et qu'il y a des documents
      if (!isOpen || stagedDocuments.length === 0) return;
      
      // Récupérer le dernier document ajouté
      const lastDoc = stagedDocuments[stagedDocuments.length - 1];
      
      // Éviter de traiter plusieurs fois le même document
      if (processedDocIds.current.has(lastDoc.id)) {
        return;
      }
      
      console.log('[TransactionModal] 🤖 Nouveau document détecté:', {
        id: lastDoc.id,
        name: lastDoc.name || lastDoc.fileName,
        detectedTypeId: lastDoc.detectedTypeId,
        documentTypeId: lastDoc.documentTypeId,
        type: lastDoc.type,
        ocrStatus: lastDoc.ocrStatus
      });
      
      // Récupérer le type de document ASSIGNÉ (pas les prédictions)
      // On ne vérifie openTransaction que si le document a un type réellement assigné
      let typeId = lastDoc.documentTypeId || lastDoc.typeId; // Utiliser documentTypeId (type assigné)
      let finalDoc = lastDoc as any;
      
      // Si pas de type assigné immédiatement, attendre et recharger plusieurs fois
      // MAIS on ne prend PAS les prédictions, seulement le type assigné
      if (!typeId) {
        const maxAttempts = 5;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          console.log(`[TransactionModal] 🤖 Pas de type assigné immédiatement, tentative ${attempt}/${maxAttempts} dans 1s...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          try {
            const docResponse = await fetch(`/api/uploads/staged/${lastDoc.id}`);
            if (docResponse.ok) {
              const updatedDoc = await docResponse.json();
              finalDoc = updatedDoc;
              console.log('[TransactionModal] 🤖 Document rechargé:', {
                id: updatedDoc.id,
                typeId: updatedDoc.typeId, // C'est le documentTypeId assigné
                type: updatedDoc.type,
                hasPredictions: !!updatedDoc.predictions?.length
              });
              // IMPORTANT: On ne prend QUE le typeId assigné, PAS les prédictions
              typeId = updatedDoc.typeId; // typeId correspond à documentTypeId dans l'API
              if (typeId) {
                console.log('[TransactionModal] ✅ Type assigné trouvé:', typeId);
                break;
              }
            } else {
              console.warn('[TransactionModal] ⚠️ Impossible de recharger le document, statut:', docResponse.status);
            }
          } catch (error) {
            console.error('[TransactionModal] ❌ Erreur rechargement document:', error);
          }
        }

        // Recharger la liste des documents pour mettre à jour l'affichage si on a récupéré le type
        if (typeId && uploadSessionId) {
          try {
            await loadStagedDocuments(uploadSessionId);
          } catch (error) {
            console.warn('[TransactionModal] ⚠️ Impossible de rafraîchir les documents après détection du type:', error);
          }
        }
      }
      
      // Si toujours pas de type ASSIGNÉ après toutes les tentatives, abandonner
      // On ne vérifie pas openTransaction si le document n'a pas de type assigné
      if (!typeId) {
        console.log('[TransactionModal] 🤖 Aucun type assigné après plusieurs tentatives pour:', lastDoc.name, '- Pas de vérification openTransaction');
        processedDocIds.current.add(lastDoc.id); // Marquer comme traité pour éviter de réessayer
        return;
      }
      
      // Marquer ce document comme traité
      processedDocIds.current.add(lastDoc.id);
      
      try {
        // Récupérer les infos du DocumentType pour vérifier openTransaction
        // MAIS seulement si le document a un type réellement assigné
        console.log('[TransactionModal] 🤖 Vérification du type assigné:', typeId);
        const response = await fetch(`/api/admin/document-types/${typeId}`);
        
        if (!response.ok) {
          console.warn('[TransactionModal] ⚠️ Erreur récupération type de document');
          return;
        }
        
        const responseData = await response.json();
        const docType = responseData.data || responseData; // Support les deux formats
        console.log('[TransactionModal] 🤖 Type récupéré:', docType.label, 'openTransaction:', docType.openTransaction);
        
        // Si le type a openTransaction = true, proposer la suggestion
        // MAIS seulement si le document a ce type réellement assigné (pas juste une prédiction)
        if (docType.openTransaction) {
          console.log('[TransactionModal] 🎯 Document avec type assigné et openTransaction=true, affichage modale suggestion');
          setPendingSuggestion({
            documentId: lastDoc.id,
            documentTypeName: docType.label
          });
          setShowSuggestionModal(true);
        } else {
          console.log('[TransactionModal] ℹ️ Type assigné mais openTransaction=false, pas de suggestion');
        }
      } catch (error) {
        console.error('[TransactionModal] ❌ Erreur lors de la vérification du type:', error);
      }
    };
    
    checkNewDocuments();
  }, [stagedDocuments, isOpen, uploadSessionId, loadStagedDocuments]);

  // 🤖 Fonction pour appliquer les suggestions de transaction depuis un document
  const handleConfirmSuggestion = async () => {
    if (!pendingSuggestion) return;
    
    setShowSuggestionModal(false);
    console.log('[TransactionModal] 🤖 Début extraction données depuis document:', pendingSuggestion.documentId);
    
    // ⚠️ Activer le flag pour éviter l'écrasement par le pré-remplissage du bail
    isApplyingOcrSuggestion.current = true;
    
    try {
      // Appeler l'API de suggestion
      const response = await fetch(
        `/api/documents/${pendingSuggestion.documentId}/suggest-transaction`
      );
      
      if (!response.ok) {
        throw new Error('Erreur lors de l\'extraction des données');
      }
      
      const responseData = await response.json();
      console.log('[TransactionModal] 🤖 Réponse complète:', responseData);
      
      // L'API retourne { success: true, data: { confidence, suggestions: {...}, meta } }
      const suggestionPayload = responseData.data || responseData;
      
      if (!suggestionPayload || !suggestionPayload.suggestions) {
        console.warn('[TransactionModal] ⚠️ Pas de suggestions dans la réponse:', responseData);
        notify2.warning('Aucune donnée exploitable trouvée dans le document');
        isApplyingOcrSuggestion.current = false; // Réinitialiser le flag
        return;
      }
      
      const suggestion = suggestionPayload.suggestions;
      console.log('[TransactionModal] 🤖 Suggestions extraites:', suggestion);
      console.log('[TransactionModal] 🤖 paymentDate dans suggestions:', (suggestion as any).paymentDate);
      
      // Appliquer les suggestions au formulaire
      // ⚠️ IMPORTANT: Appliquer propertyId et leaseId EN DERNIER pour éviter que le useEffect du bail ne s'exécute avant
      if (suggestion.date) {
        console.log('[TransactionModal] 🤖 Applique date:', suggestion.date);
        setValue('date', suggestion.date);
      }
      if (suggestion.nature) {
        console.log('[TransactionModal] 🤖 Applique nature:', suggestion.nature);
        setSelectedNature(suggestion.nature);
        setValue('nature', suggestion.nature);
      }
      if (suggestion.categoryId) {
        console.log('[TransactionModal] 🤖 Applique categoryId:', suggestion.categoryId);
        setSelectedCategory(suggestion.categoryId);
        setValue('categoryId', suggestion.categoryId);
      }
      if (suggestion.montantLoyer) {
        console.log('[TransactionModal] 🤖 Applique montantLoyer:', suggestion.montantLoyer);
        setValue('montantLoyer', suggestion.montantLoyer);
      }
      if (suggestion.chargesRecup) {
        console.log('[TransactionModal] 🤖 Applique chargesRecup:', suggestion.chargesRecup);
        setValue('chargesRecup', suggestion.chargesRecup);
      }
      if (suggestion.chargesNonRecup) {
        console.log('[TransactionModal] 🤖 Applique chargesNonRecup:', suggestion.chargesNonRecup);
        setValue('chargesNonRecup', suggestion.chargesNonRecup);
      }
      if (suggestion.periodMonth) {
        console.log('[TransactionModal] 🤖 Applique periodMonth:', suggestion.periodMonth);
        setValue('periodMonth', suggestion.periodMonth);
        setLocalFormData(prev => ({ ...prev, periodMonth: suggestion.periodMonth }));
      }
      if (suggestion.periodYear) {
        console.log('[TransactionModal] 🤖 Applique periodYear:', suggestion.periodYear);
        setValue('periodYear', suggestion.periodYear);
        setLocalFormData(prev => ({ ...prev, periodYear: suggestion.periodYear }));
      }
      if (suggestion.accountingMonth) {
        console.log('[TransactionModal] 🤖 Applique accountingMonth:', suggestion.accountingMonth);
        setValue('accountingMonth', suggestion.accountingMonth);
        // Extraire mois et année
        const [year, month] = suggestion.accountingMonth.split('-');
        setValue('periodMonth', month);
        setValue('periodYear', parseInt(year));
        setLocalFormData(prev => ({ ...prev, periodMonth: month, periodYear: parseInt(year, 10) }));
      }
      if (suggestion.label) {
        console.log('[TransactionModal] 🤖 Applique label:', suggestion.label);
        setValue('label', suggestion.label);
        setLocalFormData(prev => ({ ...prev, label: suggestion.label }));
      }
      console.log('[TransactionModal] 🤖 Vérification paymentDate:', {
        hasPaymentDate: !!(suggestion as any).paymentDate,
        paymentDate: (suggestion as any).paymentDate,
        allKeys: Object.keys(suggestion)
      });
      if ((suggestion as any).paymentDate) {
        console.log('[TransactionModal] 🤖 Applique paymentDate:', (suggestion as any).paymentDate);
        setValue('paymentDate', (suggestion as any).paymentDate);
        console.log('[TransactionModal] 🤖 paymentDate appliqué avec setValue');
      } else {
        console.log('[TransactionModal] ⚠️ paymentDate non trouvé dans les suggestions');
      }
      
      // Activer le mode auto-calcul si montants détaillés présents
      if (suggestion.montantLoyer || suggestion.chargesRecup) {
        console.log('[TransactionModal] 🤖 Active isAutoAmount');
        setIsAutoAmount(true);
      }
      
      // Appliquer propertyId et leaseId EN DERNIER (déclenche le useEffect du bail)
      if (suggestion.propertyId) {
        console.log('[TransactionModal] 🤖 Applique propertyId:', suggestion.propertyId);
        setValue('propertyId', suggestion.propertyId);
      }
      if (suggestion.leaseId) {
        console.log('[TransactionModal] 🤖 Applique leaseId:', suggestion.leaseId);
        setValue('leaseId', suggestion.leaseId);
      }
      if (suggestion.amount) {
        console.log('[TransactionModal] 🤖 Applique amount:', suggestion.amount);
        setValue('amount', suggestion.amount);
      }
      
      // Attendre un peu pour que tous les useEffect se déclenchent, puis désactiver le flag
      setTimeout(() => {
        isApplyingOcrSuggestion.current = false;
        console.log('[TransactionModal] ✅ Flag OCR suggestion désactivé');
      }, 500);
      
      // Basculer sur l'onglet "Information essentielle"
      setActiveTab('essentielles');
      
      notify2.success('Transaction pré-remplie avec succès !');
      console.log('[TransactionModal] ✅ Suggestion appliquée avec succès');
      
    } catch (error) {
      console.error('[TransactionModal] ❌ Erreur lors de l\'extraction:', error);
      notify2.error('Erreur lors de l\'extraction des données du document');
      isApplyingOcrSuggestion.current = false; // Réinitialiser le flag en cas d'erreur
    } finally {
      setPendingSuggestion(null);
    }
  };

  // Fonction pour vérifier si des données existent déjà dans le formulaire
  const hasExistingData = () => {
    const formValues = getValues();
    return !!(
      formValues.propertyId ||
      formValues.leaseId ||
      formValues.date ||
      (formValues.amount && formValues.amount > 0) ||
      formValues.label
    );
  };

  // Soumission directe sans vérification des documents non classés
  const submitFormDirectly = async (data: TransactionFormData) => {
    console.log('[TransactionModalV2] submitFormDirectly appelé avec:', data);
    setIsSubmitting(true);
    try {
      // Ajouter les documents en staging et les liens (création ET édition)
      const stagedDocumentIds = stagedDocuments.map(doc => doc.id);
      const stagedLinkItemIds = stagedLinks.map(link => link.id);
      
      // S'assurer que les valeurs des états locaux sont incluses
      console.log('[TransactionModalV2] États locaux:', {
        selectedNature,
        selectedCategory,
        localFormData
      });
      
      // Construire accountingMonth à partir de periodMonth et periodYear pour la modification
      const periodMonth = localFormData.periodMonth || data.periodMonth;
      const periodYear = localFormData.periodYear || data.periodYear;
      const accountingMonth = periodMonth && periodYear ? `${periodYear}-${periodMonth.padStart(2, '0')}` : data.accountingMonth;
      
      // Normaliser les champs de paiement pour l'API
      console.log('[TransactionModalV2] Champs de paiement dans data:', {
        paidAt: (data as any).paidAt,
        paymentDate: (data as any).paymentDate,
        method: (data as any).method,
        paymentMethod: (data as any).paymentMethod
      });
      
      // FIX: Prioriser les valeurs du formulaire (paymentDate, paymentMethod)
      const normalizedPaidAt = (data as any).paymentDate || (data as any).paidAt || undefined;
      const normalizedMethod = (data as any).paymentMethod || (data as any).method || undefined;
      
      console.log('[TransactionModalV2] Valeurs normalisées:', {
        normalizedPaidAt,
        normalizedMethod
      });

      const dataWithLocalStates = {
        ...data,
        nature: selectedNature || data.nature,
        categoryId: selectedCategory || data.categoryId,
        label: localFormData.label || data.label,
        // Champs de paiement (normalisés)
        paidAt: normalizedPaidAt,
        method: normalizedMethod,
        periodMonth: periodMonth,
        periodYear: periodYear,
        accountingMonth: accountingMonth
      };
      
      const dataWithStagedDocuments = {
        ...dataWithLocalStates,
        stagedDocumentIds,
        stagedLinkItemIds,
        // En mode création, utiliser leaseId comme bailId
        bailId: mode === 'create' ? data.leaseId : undefined,
        // Gestion déléguée - Breakdown loyer
        montantLoyer: (data as any).montantLoyer || undefined,
        chargesRecup: (data as any).chargesRecup || undefined,
        chargesNonRecup: (data as any).chargesNonRecup || undefined,
        isAutoAmount: isAutoAmount,
        // Factures de la section DÉPENSES ET AUTRES RECETTES
        factures: (prefill as any)?.factures || undefined
      };
      
      console.log('[TransactionModalV2] Mode:', mode);
      console.log('[TransactionModalV2] isAutoAmount actuel:', isAutoAmount);
      console.log('[TransactionModalV2] Données envoyées à onSubmit:', dataWithStagedDocuments);
      console.log('🔍 [DEBUG] Breakdown loyer FRONTEND:', {
        montantLoyer: dataWithStagedDocuments.montantLoyer,
        chargesRecup: dataWithStagedDocuments.chargesRecup,
        chargesNonRecup: dataWithStagedDocuments.chargesNonRecup,
        isAutoAmount: dataWithStagedDocuments.isAutoAmount
      });
      const result = await onSubmit(dataWithStagedDocuments);
      
      // Gérer la réponse avec les transactions multiples
      if (result && typeof result === 'object' && 'totalCreated' in result) {
        const { totalCreated, successMessage } = result;
        if (totalCreated > 1) {
          notify2.success(successMessage || `${totalCreated} transactions créées avec succès (période multi-mois)`);
        } else {
          notify2.success(successMessage || 'Transaction créée avec succès');
        }
      } else {
        notify2.success(mode === 'create' ? 'Transaction créée avec succès' : 'Transaction modifiée avec succès');
      }
      
      // Nettoyer les brouillons après création réussie
      if (mode === 'create') {
        await clearStaging();
      }
      
      onClose();
      reset();
      
      // En mode édition, recharger les documents liés après la sauvegarde
      if (mode === 'edit' && transactionId) {
        console.log('[TransactionModalV2] Rechargement des documents après sauvegarde...');
        // Délai pour éviter les conflits avec reset()
        setTimeout(async () => {
          await loadLinkedDocuments();
        }, 100);
      }
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
      notify2.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Gestion de la soumission
  const onSubmitForm = async (data: TransactionFormData) => {
    console.log('[TransactionModalV2] onSubmitForm appelé avec:', data);
    
    // Vérifier que le bien est sélectionné (sauf en mode property où il est pré-rempli)
    if (context.type === 'global' && (!data.propertyId || data.propertyId.trim() === '')) {
      setShowMissingPropertyModal(true);
      return; // Arrêter la soumission pour afficher la modal
    }
    
    // Vérifier les documents non classés avant la soumission
    const unclassifiedDocs = stagedDocuments.filter(doc => 
      !doc.type || doc.type === 'Non classé' || doc.type === 'Type inconnu'
    );
    
    if (unclassifiedDocs.length > 0) {
      setUnclassifiedDocuments(unclassifiedDocs);
      setShowUnclassifiedModal(true);
      return; // Arrêter la soumission pour afficher la modal
    }
    
    // Si pas de documents non classés, soumettre directement
    await submitFormDirectly(data);
  };

  // Gestion de la fermeture
  const handleClose = async () => {
    // Nettoyer le staging quand on ferme la modal
    await clearStaging();
    reset();
    onClose();
  };

  // Gestion de la modal d'avertissement des documents non classés
  const handleUnclassifiedConfirm = async () => {
    setShowUnclassifiedModal(false);
    setUnclassifiedDocuments([]);
    
    // Relancer la soumission en ignorant la vérification des documents non classés
    const formData = getValues();
    await submitFormDirectly(formData);
  };

  const handleUnclassifiedCancel = () => {
    setShowUnclassifiedModal(false);
    setUnclassifiedDocuments([]);
  };

  // Retourner null si la modal n'est pas ouverte
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl mx-4 my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {title || (mode === 'create' ? 'Nouvelle transaction' : 'Modifier la transaction')}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex">
              <button
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'essentielles'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('essentielles')}
              >
                Informations essentielles
              </button>
              <button
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'paiement'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('paiement')}
              >
                € Paiement
              </button>
              <button
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'periode'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('periode')}
              >
                Période
              </button>
              <button
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'documents'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('documents')}
              >
                Documents
              </button>
            </div>
          </Tabs>
        </div>

        {/* Contenu du formulaire */}
        <form onSubmit={handleSubmit((data) => {
          console.log('[TransactionModalV2] handleSubmit appelé avec:', data);
          console.log('[TransactionModalV2] Erreurs de validation:', errors);
          onSubmitForm(data);
        })} className="p-6 relative">
          {/* Overlay de chargement */}
          {isLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                <p className="text-gray-600 font-medium">Chargement en cours...</p>
              </div>
            </div>
          )}

          {activeTab === 'essentielles' && (
            <div className="space-y-6">
              {/* Bien */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  {context.type === 'property' || mode === 'edit' ? (
                    // Mode verrouillé : affichage en lecture seule
                    <div>
                      <Label htmlFor="propertyId" className="text-sm font-medium text-gray-700">
                        Bien *
                      </Label>
                      <div className="relative">
                        <input
                          type="text"
                          value={properties.find(p => p.id === watch('propertyId'))?.name + ' - ' + properties.find(p => p.id === watch('propertyId'))?.address || 'Bien sélectionné'}
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                        />
                        {context.type === 'property' && (
                          <Badge variant="secondary" className="absolute right-2 top-2">
                            Verrouillé
                          </Badge>
                        )}
                      </div>
                      {/* Champ caché pour react-hook-form */}
                      <input type="hidden" {...register('propertyId')} />
                    </div>
                  ) : (
                    // Mode création : SearchableSelect
                    <div>
                      <SearchableSelect
                        options={(properties || []).map(p => ({
                          id: p.id,
                          value: p.id,
                          label: `${p.name} - ${p.address}`
                        }))}
                        value={watch('propertyId') || ''}
                        onChange={(value) => {
                          setValue('propertyId', value, { shouldValidate: true });
                          // Réinitialiser le bail si le bien change
                          setValue('leaseId', '');
                        }}
                        placeholder="Rechercher un bien..."
                        required
                        label="Bien *"
                        className={errors.propertyId ? 'border-red-500' : ''}
                      />
                      {/* Champ caché pour react-hook-form */}
                      <input type="hidden" {...register('propertyId')} />
                      {errors.propertyId && (
                        <p className="text-red-500 text-sm mt-1">{errors.propertyId.message}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Bail */}
                <div>
                  <Label htmlFor="leaseId" className="text-sm font-medium text-gray-700">
                    Bail
                  </Label>
                  {mode === 'edit' && linkedBail ? (
                    // Mode édition avec bail lié - affichage en lecture seule
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 flex items-center justify-between">
                      <span className="text-gray-700">
                        {linkedBail.Tenant?.firstName} {linkedBail.Tenant?.lastName} - {linkedBail.status}
                      </span>
                      <span className="text-xs text-gray-500 bg-blue-100 px-2 py-1 rounded">
                        🔒 Lié
                      </span>
                    </div>
                  ) : mode === 'edit' && !linkedBail ? (
                    // Mode édition sans bail - bouton pour lier
                    <div className="space-y-2">
                      <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 flex items-center justify-between">
                        <span className="text-gray-500">Aucun bail enregistré</span>
                        <button
                          type="button"
                          onClick={() => setShowLinkBailModal(true)}
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          Lier un bail
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Mode création - sélecteur normal
                    <select
                      {...register('leaseId')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                    <option value="">Aucun bail</option>
                    {(filteredLeases || []).map((lease) => (
                      <option key={lease.id} value={lease.id}>
                        {lease.Tenant?.firstName} {lease.Tenant?.lastName} - {lease.rentAmount || lease.rent || 0}€
                      </option>
                    ))}
                  </select>
                  )}
                </div>
              </div>

              {/* Date et Nature */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date" className="text-sm font-medium text-gray-700">
                    Date *
                  </Label>
                  <Input
                    type="date"
                    {...register('date')}
                    className={errors.date ? 'border-red-500' : ''}
                  />
                  {errors.date && (
                    <p className="text-red-500 text-sm mt-1">{errors.date.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="nature" className="text-sm font-medium text-gray-700">
                    Nature *
                  </Label>
                  <div className="relative nature-combobox">
                    <button
                      type="button"
                      onClick={() => setIsNatureOpen(!isNatureOpen)}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex items-center justify-between ${
                        errors.nature ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <span className={(selectedNature || watch('nature')) ? 'text-gray-900' : 'text-gray-500'}>
                        {getSelectedNatureLabel()}
                      </span>
                      <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isNatureOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isNatureOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-hidden">
                        {/* Barre de recherche */}
                        <div className="p-2 border-b border-gray-200">
                          <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Rechercher une nature..."
                              value={natureSearch}
                              onChange={(e) => setNatureSearch(e.target.value)}
                              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
                          </div>
                        </div>
                        
                        {/* Liste des options */}
                        <div className="max-h-64 overflow-y-auto">
                          {getFilteredNatureOptions().map((group) => (
                            <div key={group.group}>
                              {/* En-tête de groupe */}
                              <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                                <span>{group.icon}</span>
                                {group.group}
                              </div>
                              
                              {/* Options du groupe */}
                              {group.options.map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => handleNatureSelect(option.value)}
                                  className={`w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors ${
                                    watch('nature') === option.value ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
                                  }`}
                                >
                                  <div className="flex flex-col">
                                    <span className="font-medium">{option.label}</span>
                                    <span className="text-xs text-gray-500">{option.description}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          ))}
                          
                          {getFilteredNatureOptions().length === 0 && (
                            <div className="px-3 py-4 text-center text-gray-500 text-sm">
                              Aucune nature trouvée
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {errors.nature && (
                    <p className="text-red-500 text-sm mt-1">{errors.nature.message}</p>
                  )}
                </div>
              </div>

              {/* Catégorie */}
              <div>
                <Label htmlFor="categoryId" className="text-sm font-medium text-gray-700">
                  Catégorie *
                </Label>
                <div className="relative">
                  <select
                    value={selectedCategory || watch('categoryId') || ''}
                    onChange={(e) => {
                      setValue('categoryId', e.target.value);
                      setSelectedCategory(e.target.value);
                    }}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.categoryId ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Sélectionner une catégorie</option>
                    {(filteredCategories || []).map((category) => (
                      <option key={category.id} value={category.id}>
                        {String(category.label || 'Catégorie sans nom')}
                      </option>
                    ))}
                  </select>
                  {filteredCategories.length === 0 && (selectedNature || watch('nature')) && (
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                      <p className="text-amber-800 text-sm mb-2">
                        ⚠️ Aucune catégorie compatible pour cette nature
                      </p>
                      <div className="flex gap-2">
                        <a 
                          href="/admin/nature-mapping" 
                          target="_blank"
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          🔧 Configurer le mapping
                        </a>
                        <span className="text-xs text-gray-500">•</span>
                        <button
                          type="button"
                          onClick={() => window.location.reload()}
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          🔄 Recharger les catégories
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="absolute right-2 top-2 flex items-center gap-1">
                    {mappingLoading && (
                      <div className="loading loading-spinner loading-xs text-blue-500"></div>
                    )}
                    <Tooltip content="La liste est filtrée selon la nature">
                      <Info className="h-4 w-4 text-gray-400" />
                    </Tooltip>
                  </div>
                </div>
                {errors.categoryId && (
                  <p className="text-red-500 text-sm mt-1">{errors.categoryId.message}</p>
                )}
              </div>

              {/* Montant */}
              <div>
                <Label htmlFor="amount" className="text-sm font-medium text-gray-700">
                  Montant * {isAutoAmount && <span className="text-xs text-gray-500">(calculé auto)</span>}
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    value={watch('amount') || ''}
                    className={errors.amount ? 'border-red-500' : ''}
                    disabled={isAutoAmount && (() => {
                      // 🚨 JAMAIS griser pour les commissions (montant éditable manuellement)
                      const parentTransactionId = watch('parentTransactionId' as any);
                      const autoSource = watch('autoSource' as any);
                      const isCommission = parentTransactionId && autoSource === 'gestion';
                      if (isCommission) return false;
                      
                      // Readonly si Auto ON et le bloc breakdown est visible
                      const selectedCategoryObj = categories.find(c => c.id === selectedCategory);
                      const selectedCategorySlug = selectedCategoryObj?.slug || '';
                      const matchesCodes = isGestionEnabled &&
                                           gestionCodes &&
                                           selectedNature === gestionCodes.rentNature &&
                                           selectedCategorySlug === gestionCodes.rentCategory;
                      const currentMontantLoyer = watch('montantLoyer') || 0;
                      const currentChargesRecup = watch('chargesRecup') || 0;
                      const currentChargesNonRecup = watch('chargesNonRecup') || 0;
                      const hasBreakdown = mode === 'edit' && (
                        currentMontantLoyer !== 0 ||
                        currentChargesRecup !== 0 ||
                        currentChargesNonRecup !== 0
                      );
                      return matchesCodes || hasBreakdown;
                    })()}
                    onChange={(e) => {
                      const newValue = Number(e.target.value);
                      setValue('amount', newValue, { shouldDirty: true });
                    }}
                  />
                  
                  {/* Badge auto si calculé depuis le breakdown */}
                  {isAutoAmount && (() => {
                    // Ne pas afficher le badge "auto" pour les transactions enfant
                    const isChildTransaction = watch('parentTransactionId' as any);
                    if (isChildTransaction) return null;
                    
                    const selectedCategoryObj = categories.find(c => c.id === selectedCategory);
                    const selectedCategorySlug = selectedCategoryObj?.slug || '';
                    const matchesCodes = isGestionEnabled &&
                                         gestionCodes &&
                                         selectedNature === gestionCodes.rentNature &&
                                         selectedCategorySlug === gestionCodes.rentCategory;
                    const currentMontantLoyer = watch('montantLoyer') || 0;
                    const currentChargesRecup = watch('chargesRecup') || 0;
                    const currentChargesNonRecup = watch('chargesNonRecup') || 0;
                    const hasBreakdown = mode === 'edit' && (
                      currentMontantLoyer !== 0 ||
                      currentChargesRecup !== 0 ||
                      currentChargesNonRecup !== 0
                    );
                    const autoFromBreakdown = currentMontantLoyer + currentChargesRecup; // SANS chargesNonRecup
                    
                    return (matchesCodes || hasBreakdown) && autoFromBreakdown > 0 && (
                      <div className="absolute right-2 top-2 flex items-center gap-1">
                        <Badge variant="secondary" className="text-xs">auto</Badge>
                        <Tooltip content="Calculé depuis le détail du loyer">
                          <Info className="h-3 w-3 text-gray-400" />
                        </Tooltip>
                      </div>
                    );
                  })()}
                </div>
                {errors.amount && (
                  <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>
                )}
              </div>

              {/* Granularité loyers (Gestion déléguée) - affichage conditionnel selon codes système */}
              {(() => {
                // Convertir selectedCategory (ID) en slug pour la comparaison
                const selectedCategoryObj = categories.find(c => c.id === selectedCategory);
                const selectedCategorySlug = selectedCategoryObj?.slug || '';
                
                // Vérifier si les codes correspondent
                const matchesCodes = isGestionEnabled &&
                                     gestionCodes &&
                                     selectedNature === gestionCodes.rentNature &&
                                     selectedCategorySlug === gestionCodes.rentCategory;
                
                // 🚨 IMPORTANT : Ne JAMAIS afficher pour les transactions enfant (commissions)
                const isChildTransaction = watch('parentTransactionId' as any);
                
                // 🐛 FIX : Règle d'affichage stricte basée uniquement sur les codes système
                // - Afficher UNIQUEMENT si nature ET catégorie correspondent aux codes système
                // - Ne PAS afficher si les codes ne correspondent pas (même avec breakdown existant)
                // - JAMAIS pour les transactions enfant (commission)
                const shouldShow = !isChildTransaction && matchesCodes;
                
                return shouldShow && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-blue-900">
                        Détail du loyer (optionnel)
                      </h4>
                      
                      {/* Toggle Auto pour calcul automatique du Montant */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">Calcul auto du montant</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isAutoAmount}
                          onClick={() => setIsAutoAmount(!isAutoAmount)}
                          className={`
                            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                            ${isAutoAmount ? 'bg-blue-600' : 'bg-gray-300'}
                          `}
                        >
                          <span
                            className={`
                              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                              ${isAutoAmount ? 'translate-x-6' : 'translate-x-1'}
                            `}
                          />
                        </button>
                      </div>
                    </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="montantLoyer" className="text-sm font-medium text-gray-700">
                        Loyer hors charges (€)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        {...register('montantLoyer', {
                          valueAsNumber: true,
                          onChange: (e) => {
                            // Arrondir à 2 décimales pour éviter les erreurs de précision flottante
                            const value = parseFloat(e.target.value) || 0;
                            const rounded = Math.round(value * 100) / 100;
                            if (value !== rounded) {
                              e.target.value = rounded.toString();
                              setValue('montantLoyer', rounded);
                            }
                            // Si Auto ON, recalculer le montant total (SANS charges non récup)
                            if (isAutoAmount) {
                              const chargesRecup = watch('chargesRecup') || 0;
                              setValue('amount', Math.round((rounded + chargesRecup) * 100) / 100);
                            }
                          }
                        })}
                        placeholder="Ex: 558.26"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="chargesRecup" className="text-sm font-medium text-gray-700">
                        Charges récupérables (€)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        {...register('chargesRecup', {
                          valueAsNumber: true,
                          onChange: (e) => {
                            // Arrondir à 2 décimales pour éviter les erreurs de précision flottante
                            const value = parseFloat(e.target.value) || 0;
                            const rounded = Math.round(value * 100) / 100;
                            if (value !== rounded) {
                              e.target.value = rounded.toString();
                              setValue('chargesRecup', rounded);
                            }
                            // Si Auto ON, recalculer le montant total (SANS charges non récup)
                            if (isAutoAmount) {
                              const montantLoyer = watch('montantLoyer') || 0;
                              setValue('amount', Math.round((montantLoyer + rounded) * 100) / 100);
                            }
                          }
                        })}
                        placeholder="Ex: 20.00"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="chargesNonRecup" className="text-sm font-medium text-gray-700">
                        Charges non-récup. (€)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        {...register('chargesNonRecup', {
                          valueAsNumber: true,
                          onChange: (e) => {
                            // Arrondir à 2 décimales pour éviter les erreurs de précision flottante
                            const value = parseFloat(e.target.value) || 0;
                            const rounded = Math.round(value * 100) / 100;
                            if (value !== rounded) {
                              e.target.value = rounded.toString();
                              setValue('chargesNonRecup', rounded);
                            }
                            // Note: chargesNonRecup ne sont PAS incluses dans le calcul du montant
                            // car ce sont des charges à la charge du propriétaire, pas du locataire
                          }
                        })}
                        placeholder="Ex: 35.00"
                      />
                    </div>
                  </div>
                  
                  {/* Total payé par le locataire (hors charges non récup) */}
                  <div className="bg-white rounded p-3 border border-blue-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        Total payé par le locataire:
                      </span>
                      <span className="text-lg font-bold text-blue-900">
                        {((watch('montantLoyer') || 0) + (watch('chargesRecup') || 0)).toFixed(2)} €
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      = Loyer HC + Charges récupérables (hors charges non récup.)
                    </p>
                  </div>
                </div>
              );
              })()}

              {/* Encart Commission estimée (Gestion déléguée) - seulement si activée ET nature/catégorie correspondent */}
              {(() => {
                // 🚨 Ne JAMAIS afficher pour les transactions enfant (commissions)
                const isChildTransaction = watch('parentTransactionId' as any);
                if (isChildTransaction) return null;
                
                // Convertir selectedCategory (ID) en slug pour la comparaison
                const selectedCategoryObj = categories.find(c => c.id === selectedCategory);
                const selectedCategorySlug = selectedCategoryObj?.slug || '';
                
                if (!isGestionEnabled || !gestionCodes || !watch('propertyId') || 
                    (watch('montantLoyer') || 0) <= 0 ||
                    selectedNature !== gestionCodes.rentNature ||
                    selectedCategorySlug !== gestionCodes.rentCategory) {
                  return null;
                }
                
                const selectedProperty = properties.find(p => p.id === watch('propertyId'));
                if (!selectedProperty?.ManagementCompany || !selectedProperty.ManagementCompany.actif) return null;
                
                const company = selectedProperty.ManagementCompany;
                const montantLoyer = watch('montantLoyer') || 0;
                const chargesRecup = watch('chargesRecup') || 0;
                
                // Récupérer les factures depuis prefill ou suggestions
                const factures = (prefill as any)?.factures || [];
                const montantFactures = factures.reduce((sum: number, f: any) => sum + (f.montant || 0), 0);
                
                // Calcul de la commission de base
                const base = company.modeCalcul === 'REVENUS_TOTAUX' 
                  ? montantLoyer + chargesRecup
                  : montantLoyer;
                
                let commission = base * company.taux;
                if (company.fraisMin) {
                  commission = Math.max(commission, company.fraisMin);
                }
                
                const commissionBaseTTC = company.tvaApplicable 
                  ? commission * (1 + (company.tauxTva || 0) / 100)
                  : commission;
                
                // Ajouter le montant des factures à la commission
                const commissionTTC = commissionBaseTTC + montantFactures;
                
                return (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-green-700">⚙️</span>
                      <h4 className="text-sm font-medium text-green-900">
                        Commission de gestion estimée
                      </h4>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <span className="text-gray-600">Base de calcul:</span>
                      <span className="font-medium text-right">{base.toFixed(2)} €</span>
                      
                      <span className="text-gray-600">Taux:</span>
                      <span className="font-medium text-right">{(company.taux * 100).toFixed(2)}%</span>
                      
                      {company.fraisMin && (
                        <>
                          <span className="text-gray-600">Minimum:</span>
                          <span className="font-medium text-right">{company.fraisMin.toFixed(2)} €</span>
                        </>
                      )}
                      
                      {company.tvaApplicable && (
                        <>
                          <span className="text-gray-600">TVA ({company.tauxTva}%):</span>
                          <span className="font-medium text-right">
                            {(commissionTTC - commission).toFixed(2)} €
                          </span>
                        </>
                      )}
                      
                      <span className="text-gray-700 font-medium">Commission {company.tvaApplicable ? 'TTC' : 'HT'}:</span>
                      <span className="font-medium text-right">
                        {commissionBaseTTC.toFixed(2)} €
                      </span>
                      
                      {montantFactures > 0 && (
                        <>
                          <span className="text-gray-600">+ Factures:</span>
                          <span className="font-medium text-right">
                            {montantFactures.toFixed(2)} €
                          </span>
                        </>
                      )}
                      
                      <span className="text-gray-700 font-medium">Total commission:</span>
                      <span className="font-bold text-green-900 text-right text-lg">
                        {commissionTTC.toFixed(2)} €
                      </span>
                    </div>
                    
                    {montantFactures > 0 && factures.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-green-200">
                        <p className="text-xs text-gray-600 mb-1">Factures incluses:</p>
                        <ul className="text-xs text-gray-500 space-y-1">
                          {factures.map((f: any, idx: number) => (
                            <li key={idx}>
                              • {f.numero ? `Facture ${f.numero}` : 'Facture'} 
                              {f.fournisseur ? ` - ${f.fournisseur}` : ''}
                              {f.description ? ` - ${f.description}` : ''}
                              : <span className="font-medium">{f.montant.toFixed(2)} €</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
                      <span>💡</span>
                      La commission sera créée automatiquement lors de l'enregistrement
                    </p>
                  </div>
                );
              })()}

              {/* Info-bulle si bien a société mais feature OFF */}
              {(() => {
                if (!gestionCodes || !watch('propertyId') || isGestionEnabled) return null;
                
                // Convertir selectedCategory (ID) en slug pour la comparaison
                const selectedCategoryObj = categories.find(c => c.id === selectedCategory);
                const selectedCategorySlug = selectedCategoryObj?.slug || '';
                
                if (selectedNature !== gestionCodes.rentNature || 
                    selectedCategorySlug !== gestionCodes.rentCategory) {
                  return null;
                }
                
                const selectedProperty = properties.find(p => p.id === watch('propertyId'));
                if (!selectedProperty?.ManagementCompany || !selectedProperty.ManagementCompany.actif) return null;
                
                return (
                  <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="h-5 w-5 text-gray-500" />
                      <h4 className="text-sm font-medium text-gray-700">
                        Gestion déléguée désactivée
                      </h4>
                    </div>
                    <p className="text-sm text-gray-600">
                      La gestion déléguée est désactivée dans les paramètres. Aucune commission ne sera calculée pour ce loyer, même si le bien est lié à une société de gestion ({selectedProperty.ManagementCompany.nom}).
                    </p>
                  </div>
                );
              })()}

              {/* Libellé */}
              <div>
                <Label htmlFor="label" className="text-sm font-medium text-gray-700">
                  Libellé
                </Label>
                <div className="relative">
                  <Input
                    value={localFormData.label || watch('label') || ''}
                    placeholder="Libellé de la transaction"
                    onChange={(e) => {
                      setValue('label', e.target.value);
                      setLocalFormData(prev => ({ ...prev, label: e.target.value }));
                      markAsManual('label');
                    }}
                  />
                  {!autoFillState.isManual.label && autoFillState.autoSuggestions.label && (
                    <div className="absolute right-2 top-2 flex items-center gap-1">
                      <Badge variant="secondary" className="text-xs">auto</Badge>
                    </div>
                  )}
                  {autoFillState.isManual.label && (
                    <button
                      type="button"
                      onClick={() => resetToAuto('label')}
                      className="absolute right-2 top-2 text-blue-500 hover:text-blue-700"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Référence */}
              <div>
                <Label htmlFor="reference" className="text-sm font-medium text-gray-700">
                  Référence
                </Label>
                <Input
                  {...register('reference')}
                  placeholder="Référence (optionnel)"
                />
              </div>
            </div>
          )}

          {activeTab === 'paiement' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="paymentDate" className="text-sm font-medium text-gray-700">
                    Date de paiement
                  </Label>
                  <Input type="date" {...register('paymentDate')} />
                </div>
                <div>
                  <Label htmlFor="paymentMethod" className="text-sm font-medium text-gray-700">
                    Mode de paiement
                  </Label>
                  <select
                    {...register('paymentMethod')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner un mode</option>
                    <option value="VIREMENT">Virement</option>
                    <option value="CHEQUE">Chèque</option>
                    <option value="ESPECES">Espèces</option>
                    <option value="CARTE">Carte bancaire</option>
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="notes" className="text-sm font-medium text-gray-700">
                  Notes
                </Label>
                <textarea
                  {...register('notes')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Notes additionnelles..."
                />
              </div>

              {/* Rapprochement bancaire */}
              <div className="border-t pt-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                    checked={watch('rapprochementStatus') === 'rapprochee'}
                    onChange={(e) => {
                      setValue('rapprochementStatus', e.target.checked ? 'rapprochee' : 'non_rapprochee');
                    }}
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Marquer comme rapprochée
                  </span>
                </label>
                {watch('rapprochementStatus') === 'rapprochee' && (
                  <div className="mt-3">
                    <Input
                      {...register('bankRef')}
                      placeholder="Référence bancaire (optionnel)"
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'periode' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="periodMonth" className="text-sm font-medium text-gray-700">
                    Mois
                  </Label>
                  <select
                    value={localFormData.periodMonth || watch('periodMonth') || ''}
                    onChange={(e) => {
                      setValue('periodMonth', e.target.value);
                      setLocalFormData(prev => ({ ...prev, periodMonth: e.target.value }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner un mois</option>
                    <option value="01">Janvier</option>
                    <option value="02">Février</option>
                    <option value="03">Mars</option>
                    <option value="04">Avril</option>
                    <option value="05">Mai</option>
                    <option value="06">Juin</option>
                    <option value="07">Juillet</option>
                    <option value="08">Août</option>
                    <option value="09">Septembre</option>
                    <option value="10">Octobre</option>
                    <option value="11">Novembre</option>
                    <option value="12">Décembre</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="periodYear" className="text-sm font-medium text-gray-700">
                    Année
                  </Label>
                  <Input
                    type="number"
                    min="2020"
                    max="2030"
                    value={localFormData.periodYear || watch('periodYear') || ''}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || new Date().getFullYear();
                      setValue('periodYear', value);
                      setLocalFormData(prev => ({ ...prev, periodYear: value }));
                    }}
                  />
                </div>
              </div>
              
              {/* Nombre de mois couverts - Visible UNIQUEMENT en mode création */}
              {mode === 'create' && (
                <div>
                  <Label htmlFor="monthsCovered" className="text-sm font-medium text-gray-700">
                    Nombre de mois couverts
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    max="12"
                    {...register('monthsCovered')}
                    placeholder="1"
                    className={errors.monthsCovered ? 'border-red-500' : ''}
                  />
                  {errors.monthsCovered && (
                    <p className="text-red-500 text-sm mt-1">{errors.monthsCovered.message}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Si supérieur à 1, plusieurs transactions mensuelles seront créées automatiquement
                  </p>
                </div>
              )}
              
              {/* Badge de série - Visible UNIQUEMENT en mode édition si transaction fait partie d'une série */}
              {(() => {
                const moisTotal = watch('moisTotal' as any);
                const moisIndex = watch('moisIndex' as any);
                console.log('[Badge Série] Mode:', mode, 'moisTotal:', moisTotal, 'moisIndex:', moisIndex);
                
                if (mode === 'edit' && moisTotal && moisIndex) {
                  return (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-sm text-blue-900 font-medium flex items-center gap-2">
                            Transaction multi-mois
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                              Série ({moisTotal}) — {moisIndex}/{moisTotal}
                            </Badge>
                          </p>
                          <p className="text-xs text-blue-700 mt-1">
                            Cette transaction fait partie d'une série de {moisTotal} mois. 
                            Le nombre de mois couverts n'est modifiable qu'à la création.
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Documents liés</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Ajoutez des documents justificatifs à cette transaction
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    // Utiliser notre fonction d'upload avec détection de doublons
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx';
                    input.multiple = true;
                    
                    input.onchange = (e) => {
                      const files = Array.from((e.target as HTMLInputElement).files || []);
                      if (files.length > 0) {
                        handleFileUpload(files);
                      }
                    };
                    
                    input.click();
                  }}
                  className="flex items-center gap-2"
                  disabled={stagingLoading}
                >
                  <Upload className="h-4 w-4" />
                  {stagingLoading ? 'Chargement...' : 'Ajouter des documents'}
                </Button>
              </div>

              {/* Liste des documents */}
              {(() => {
                console.log('[TransactionModal] 📋 Affichage documents - stagedDocuments:', stagedDocuments.length, 'stagedLinks:', stagedLinks.length, 'linkedDocuments:', linkedDocuments.length);
                console.log('[TransactionModal] 📋 linkedDocuments détail:', linkedDocuments);
                console.log('[TransactionModal] 📋 linkedDocuments JSON:', JSON.stringify(linkedDocuments, null, 2));
                console.log('[TransactionModal] 📋 Condition de rendu - stagedDocuments.length > 0:', stagedDocuments.length > 0);
                console.log('[TransactionModal] 📋 Condition de rendu - stagedLinks.length > 0:', stagedLinks.length > 0);
                console.log('[TransactionModal] 📋 Condition de rendu - linkedDocuments.length > 0:', linkedDocuments.length > 0);
                console.log('[TransactionModal] 📋 Condition de rendu - TOTAL:', (stagedDocuments.length > 0 || stagedLinks.length > 0 || linkedDocuments.length > 0));
                return null;
              })()}
              {(stagedDocuments.length > 0 || stagedLinks.length > 0 || linkedDocuments.length > 0) ? (
                <div className="space-y-3">
                  {/* Documents en staging (brouillon) */}
                  {stagedDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-yellow-600" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                            <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                              Brouillon
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500">
                            {(() => {
                              const documentType = String(doc.type || 'Type inconnu');
                              const isUnclassified = documentType === 'Non classé' || documentType === 'Type inconnu';
                              
                              return (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedDraftId(doc.id);
                                      setShowReviewDraftModal(true);
                                    }}
                                    className={isUnclassified 
                                      ? "text-orange-600 hover:text-orange-800 font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid transition-all"
                                      : "text-gray-600 hover:text-gray-800 font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid transition-all"
                                    }
                                    title="Cliquer pour modifier le type du document"
                                  >
                                    {documentType}
                                  </button>
                                  <span className="text-gray-400"> • {new Date(doc.uploadedAt).toLocaleDateString('fr-FR')}</span>
                                </>
                              );
                            })()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Ouvrir le fichier dans un nouvel onglet
                            window.open(`/api/documents/${doc.id}/file`, '_blank');
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            const success = await removeStagedDocument(doc.id);
                            if (success) {
                              console.log('Document en staging supprimé:', doc.id);
                            }
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Liens vers documents existants */}
                  {stagedLinks.map((link) => (
                    <div key={link.id} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Link className="h-5 w-5 text-blue-600" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">{link.existingDocument.fileName}</p>
                            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                              Lien existant
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500">
                            {link.existingDocument.typeLabel} • {new Date(link.existingDocument.uploadedAt).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Ouvrir le document existant en preview
                            window.open(`/api/documents/${link.existingDocument.id}/file`, '_blank');
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (confirm('Êtes-vous sûr de vouloir supprimer ce lien ?')) {
                              try {
                                const response = await fetch(`/api/uploads/staged-item/${link.id}`, {
                                  method: 'DELETE'
                                });
                                
                                if (response.ok) {
                                  // Supprimer le lien de la liste locale
                                  setStagedLinks(prev => prev.filter(l => l.id !== link.id));
                                  notify2.success('Lien supprimé avec succès');
                                } else {
                                  notify2.error('Erreur lors de la suppression du lien');
                                }
                              } catch (error) {
                                console.error('Erreur lors de la suppression du lien:', error);
                                notify2.error('Erreur lors de la suppression du lien');
                              }
                            }
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Documents liés (en mode édition) */}
                  {(() => {
                    console.log('[TransactionModal] 🔄 Rendu linkedDocuments - Nombre:', linkedDocuments.length);
                    console.log('[TransactionModal] 🔄 linkedDocuments pour map:', linkedDocuments);
                    console.log('[TransactionModal] 🔄 linkedDocuments.length > 0:', linkedDocuments.length > 0);
                    console.log('[TransactionModal] 🔄 linkedDocuments.map va s\'exécuter:', linkedDocuments.length);
                    return null;
                  })()}
                  {linkedDocuments.map((doc) => {
                    console.log('[TransactionModal] 🔄 Rendu document individuel:', doc);
                    return (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-gray-500" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{doc.fileName || doc.filename}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            {(() => {
                              const documentType = String(doc.DocumentType?.label || 'Type inconnu');
                              const isUnclassified = documentType === 'Non classé' || documentType === 'Type inconnu';
                              const isDraft = doc.status === 'draft';
                              
                              return (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      // Ouvrir le fichier dans un nouvel onglet (même pour les brouillons)
                                      window.open(`/api/documents/${doc.id}/file`, '_blank');
                                    }}
                                    className={isUnclassified 
                                      ? "text-orange-600 hover:text-orange-800 font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid transition-all"
                                      : "text-gray-600 hover:text-gray-800 font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid transition-all"
                                    }
                                    title="Cliquer pour voir le document"
                                  >
                                    {documentType}
                                  </button>
                                  <span className="text-gray-400">•</span>
                                  <span className="text-gray-400">{new Date(doc.uploadedAt || doc.createdAt).toLocaleDateString('fr-FR')}</span>
                                </>
                              );
                            })()}
                          </div>
                          {/* Affichage des liaisons */}
                          {(() => {
                            console.log('[TransactionModal] Document pour affichage des liaisons:', doc);
                            console.log('[TransactionModal] Document links détaillés:', doc.DocumentLink);
                            console.log('[TransactionModal] Document links JSON:', JSON.stringify(doc.DocumentLink, null, 2));
                            console.log('[TransactionModal] Transaction ID actuel:', transactionId);
                            const links = formatDocumentLinks(doc);
                            console.log('[TransactionModal] Liaisons formatées:', links);
                            return links ? (
                              <div className="mt-1 flex items-center gap-1">
                                <Link className="h-3 w-3 text-blue-500" />
                                <span className="text-xs text-blue-600 font-medium">
                                  Lié à: {links}
                                </span>
                              </div>
                            ) : (
                              <div className="mt-1 flex items-center gap-1">
                                <span className="text-xs text-gray-400">
                                  Aucune liaison détectée
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Ouvrir le document en preview
                            window.open(`/api/documents/${doc.id}/file`, '_blank');
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDocumentToDelete(doc);
                            setShowDeleteDocModal(true);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">Aucun document lié à cette transaction</p>
                  <p className="text-xs mt-1">Cliquez sur "Ajouter des documents" pour en associer</p>
                </div>
              )}

              {/* Information sur le contexte */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-900 font-medium">
                      Contexte de liaison automatique
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      Les documents uploadés seront automatiquement liés à cette transaction.
                      {context.type === 'property' && ' Ils seront également associés au bien sélectionné.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex justify-end gap-3 mt-8 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isLoading}
              onClick={(e) => {
                console.log('[TransactionModalV2] Bouton cliqué!', { isSubmitting, isLoading });
                e.preventDefault();
                const formData = getValues();
                console.log('[TransactionModalV2] Données du formulaire:', formData);
                onSubmitForm(formData);
              }}
            >
              {isSubmitting ? 'Enregistrement...' : (mode === 'create' ? 'Créer' : 'Modifier')}
            </Button>
          </div>
        </form>
      </div>
      
      {/* Modal pour lier un bail */}
      {showLinkBailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md">
            <h3 className="text-lg font-semibold mb-4">Lier un bail</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sélectionner un bail
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onChange={(e) => {
                    if (e.target.value) {
                      // Lier le bail via l'API
                      fetch(`/api/transactions/${transactionId}/link-bail`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ bailId: e.target.value })
                      })
                      .then(response => response.json())
                      .then(data => {
                        if (data.success) {
                          setLinkedBail(data.data.bail);
                          setShowLinkBailModal(false);
                          notify2.success('Bail lié avec succès');
                        } else {
                          notify2.error(data.error || 'Erreur lors de la liaison');
                        }
                      })
                      .catch(error => {
                        console.error('Erreur:', error);
                        notify2.error('Erreur lors de la liaison');
                      });
                    }
                  }}
                >
                  <option value="">Sélectionner un bail</option>
                  {(leases || []).map((lease) => (
                    <option key={lease.id} value={lease.id}>
                      {lease.Tenant?.firstName} {lease.Tenant?.lastName} - {lease.rentAmount || lease.rent || 0}€
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowLinkBailModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'upload avec staging */}
      <StagedUploadModal
        isOpen={showStagedUploadModal}
        onClose={() => {
          setShowStagedUploadModal(false);
          setUploadFiles([]);
        }}
        files={uploadFiles}
        onStagedDocuments={(documents) => {
          console.log('Documents ajoutés en staging:', documents);
          documents.forEach(doc => addStagedDocument(doc));
        }}
        context={{
          type: 'transaction',
          tempKey: 'transaction:new'
        }}
      />

      {/* Modale de review-draft pour modifier les documents en brouillon */}
      <UploadReviewModal
        isOpen={showReviewDraftModal}
        onClose={() => {
          setShowReviewDraftModal(false);
          setSelectedDraftId(null);
        }}
        files={[]} // Pas de fichiers pour le mode review-draft
        scope="global"
        strategy={{
          mode: 'review-draft',
          draftId: selectedDraftId || undefined,
          onStagedUpdate: async () => {
            // Recharger la liste des documents en staging
            console.log('Document brouillon modifié, rechargement...');
            if (uploadSessionId) {
              await loadStagedDocuments(uploadSessionId);
              console.log('Documents de la session rechargés après modification du brouillon');
            }
          }
        }}
      />

      {/* Modale de doublon détecté */}
      <DuplicateDetectedModal
        isOpen={showDuplicateModal}
        onClose={() => {
          setShowDuplicateModal(false);
          setDuplicateData(null);
        }}
        onLinkExisting={handleLinkExisting}
        onCancel={() => {
          setShowDuplicateModal(false);
          setDuplicateData(null);
        }}
        duplicateData={duplicateData}
      />
      
      {/* Modal de confirmation de suppression de document */}
      {documentToDelete && (
        <ConfirmDeleteDocumentModal
          isOpen={showDeleteDocModal}
          onClose={() => {
            setShowDeleteDocModal(false);
            setDocumentToDelete(null);
          }}
          onConfirm={() => {
            loadLinkedDocuments();
            setDocumentToDelete(null);
          }}
          documentId={documentToDelete.id}
          documentName={documentToDelete.fileName || documentToDelete.filenameOriginal}
        />
      )}

      {/* Modal d'avertissement des documents non classés */}
      <UnclassifiedDocumentsModal
        isOpen={showUnclassifiedModal}
        onClose={handleUnclassifiedCancel}
        onConfirm={handleUnclassifiedConfirm}
        documents={unclassifiedDocuments}
      />

      {/* Modal d'avertissement du bien manquant */}
      <Dialog open={showMissingPropertyModal} onOpenChange={setShowMissingPropertyModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <span>Bien obligatoire</span>
            </DialogTitle>
            <DialogDescription className="pt-4">
              <p className="text-gray-700 mb-2">
                Le bien est obligatoire pour créer une transaction.
              </p>
              <p className="text-sm text-gray-500">
                Veuillez sélectionner un bien dans l'onglet "Informations essentielles" avant de continuer.
              </p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowMissingPropertyModal(false);
                // Basculer vers l'onglet "Informations essentielles" pour que l'utilisateur puisse sélectionner le bien
                setActiveTab('essentielles');
              }}
            >
              Sélectionner un bien
            </Button>
            <Button
              onClick={() => setShowMissingPropertyModal(false)}
            >
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de suggestion de transaction depuis document */}
      {pendingSuggestion && (
        <TransactionSuggestionConfirmModal
          isOpen={showSuggestionModal}
          onClose={() => {
            setShowSuggestionModal(false);
            setPendingSuggestion(null);
          }}
          documentTypeName={pendingSuggestion.documentTypeName}
          onConfirm={handleConfirmSuggestion}
          hasExistingData={hasExistingData()}
        />
      )}

      {/* Modal pour informer qu'un brouillon existe déjà */}
      {draftExistsData && (
        <Dialog open={showDraftExistsModal} onOpenChange={(open) => {
          setShowDraftExistsModal(open);
          if (!open) setDraftExistsData(null);
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Document déjà en brouillon</DialogTitle>
              <DialogDescription>
                Ce document est déjà présent dans vos brouillons. Purgez-les avant de ré-uploader ce fichier.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-900">
                  <strong>Fichier :</strong> {draftExistsData.fileName}
                </p>
                <p className="text-sm text-amber-900 mt-2">
                  <strong>ID brouillon :</strong> {draftExistsData.documentId}
                </p>
              </div>

              <p className="text-sm text-gray-700">
                Rendez-vous sur la page Documents pour retrouver ce brouillon, le finaliser ou le supprimer.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDraftExistsModal(false);
                  setDraftExistsData(null);
                }}
              >
                Fermer
              </Button>
              <Button
                onClick={() => {
                  window.open('/documents', '_blank');
                  setShowDraftExistsModal(false);
                  setDraftExistsData(null);
                }}
              >
                Ouvrir la page Documents
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default TransactionModal;

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { 
  Building2,
  Euro,
  Calendar,
  FileText,
  Users,
  AlertCircle,
  CheckCircle,
  Upload,
  Mail,
  Receipt,
  X,
  Eye,
  Search
} from 'lucide-react';

interface TransactionFormTabsProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  title: string;
  defaultBienId?: string;
  defaultPropertyId?: string; // Alias pour compatibilité
  propertyId?: string; // Alias pour compatibilité
  properties?: any[]; // Propriétés passées directement
  tenants?: any[]; // Locataires passés directement
  leases?: any[]; // Baux passés directement
  initialData?: any;
  isEditMode?: boolean; // Indicateur de mode édition
}

interface DocumentFile {
  id: string;
  file: File;
  predictedTypeId?: string;
  typeId?: string;
  name: string;
  size: number;
}

export default function TransactionFormTabs({
  isOpen,
  onClose,
  onSubmit,
  title,
  defaultBienId,
  defaultPropertyId,
  propertyId,
  properties,
  tenants,
  leases,
  initialData,
  isEditMode = false
}: TransactionFormTabsProps) {
  const [activeTab, setActiveTab] = useState('essentielles');
  const [formData, setFormData] = useState({
    // Onglet 1 - Informations essentielles (TOUS OBLIGATOIRES sauf bail et référence)
    bienId: defaultBienId || defaultPropertyId || propertyId || '',
    bailId: '',
    locataireId: '',
    libelle: '',
    montant: 0,
    date: new Date().toISOString().split('T')[0],
    natureId: '',
    categorieId: '',
    reference: '',
    
    // Onglet 2 - Paiement (optionnels) + Notes et Email déplacés ici
    datePaiement: '',
    modePaiement: '',
    notes: '',
    envoyerEmail: false,
    
    // Onglet 3 - Période
    debutPeriode: '', // Format: "2025-10" (YYYY-MM)
    nbMois: 1,
    repartitionAuto: false
  });

  // États pour les données async
  const [biens, setBiens] = useState<any[]>([]);
  const [baux, setBaux] = useState<any[]>([]);
  const [locataires, setLocataires] = useState<any[]>([]);
  const [natures, setNatures] = useState<any[]>([]);
  const [compatibleCategories, setCompatibleCategories] = useState<any[]>([]);
  const [documentTypes, setDocumentTypes] = useState<any[]>([]);
  
  // États pour l'UI
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedBail, setSelectedBail] = useState<any>(null);
  const [touchedLabel, setTouchedLabel] = useState(false);
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  
  // États pour les recherches async
  const [searchBien, setSearchBien] = useState('');
  const [searchLocataire, setSearchLocataire] = useState('');
  
  // État pour l'aperçu des transactions
  const [transactionPreview, setTransactionPreview] = useState<Array<{
    month: string;
    amount: number;
    label: string;
  }>>([]);

  const tabs = [
    { id: 'essentielles', label: 'Informations essentielles', icon: Building2, required: true },
    { id: 'paiement', label: 'Paiement', icon: Euro, required: false },
    // Onglet Période seulement en mode création
    ...(isEditMode ? [] : [{ id: 'periode', label: 'Période', icon: Calendar, required: false }]),
  ];

  // Charger les données initiales
  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen]);

  // S'assurer que l'onglet actif est valide en mode édition
  useEffect(() => {
    if (isEditMode && activeTab === 'periode') {
      setActiveTab('essentielles');
    }
  }, [isEditMode, activeTab]);

  // Pré-remplir le formulaire en mode édition quand initialData est disponible (une seule fois)
  useEffect(() => {
    if (isEditMode && initialData && isOpen) {
      // Vérifier si les données sont déjà pré-remplies pour éviter les re-renders
      if (formData.libelle === initialData.label && formData.montant === initialData.amount) {
        return; // Déjà pré-rempli
      }

      const updatedFormData = {
        bienId: initialData.propertyId || '',
        bailId: initialData.leaseId || '',
        locataireId: initialData.tenantId || '',
        libelle: initialData.label || '',
        montant: initialData.amount || 0,
        date: initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : '',
        natureId: initialData.nature || '',
        categorieId: initialData.categoryId || '',
        reference: initialData.reference || '',
        notes: initialData.notes || '',
        // Onglet Paiement
        estPaye: !!initialData.paidAt, // true si paidAt existe, false sinon
        datePaiement: initialData.paidAt ? new Date(initialData.paidAt).toISOString().split('T')[0] : '',
        modePaiement: initialData.method || '',
        envoyerEmail: initialData.sendEmail || false,
        // Onglet Période (pour compatibilité)
        debutPeriode: '',
        nbMois: 1,
        repartitionAuto: false,
      };
      
      setFormData(updatedFormData);
      
      // Debug: Log des données complètes
      console.log('Données complètes de la transaction:', initialData);
      console.log('Données de paiement:', {
        paidAt: initialData.paidAt,
        method: initialData.method,
        estPaye: updatedFormData.estPaye,
        datePaiement: updatedFormData.datePaiement,
        modePaiement: updatedFormData.modePaiement
      });
      
      // Charger les catégories compatibles si une nature est définie
      if (initialData.nature) {
        // Charger les catégories compatibles et pré-sélectionner la catégorie
        loadCompatibleCategories(initialData.nature);
      }
    }
  }, [isEditMode, initialData?.id, isOpen]); // Utiliser initialData.id au lieu de initialData pour éviter les re-renders

  // S'assurer que la catégorie est sélectionnée quand les catégories compatibles sont chargées
  useEffect(() => {
    if (isEditMode && initialData?.categoryId && compatibleCategories.length > 0) {
      const categoryExists = compatibleCategories.find(cat => cat.id === initialData.categoryId);
      if (categoryExists && formData.categorieId !== initialData.categoryId) {
        setFormData(prev => ({ ...prev, categorieId: initialData.categoryId }));
      }
    }
  }, [compatibleCategories, isEditMode, initialData?.categoryId, formData.categorieId]);

  // Synchroniser la checkbox "Payé" avec la date de paiement
  useEffect(() => {
    if (formData.datePaiement && !formData.estPaye) {
      // Si une date de paiement est saisie mais que "Payé" n'est pas coché, cocher automatiquement
      setFormData(prev => ({ ...prev, estPaye: true }));
    } else if (!formData.datePaiement && formData.estPaye) {
      // Si aucune date de paiement mais que "Payé" est coché, décocher automatiquement
      setFormData(prev => ({ ...prev, estPaye: false }));
    }
  }, [formData.datePaiement, formData.estPaye]);

  // Initialiser les données quand les props changent
  useEffect(() => {
    if (properties && Array.isArray(properties)) {
      setBiens(properties);
    }
    if (tenants && Array.isArray(tenants)) {
      setLocataires(tenants);
    }
    if (leases && Array.isArray(leases)) {
      setBaux(leases);
    }
  }, [properties, tenants, leases]);

  const loadInitialData = async () => {
    try {
      // Utiliser les propriétés passées directement ou charger depuis l'API
      if (properties && Array.isArray(properties)) {
        setBiens(properties);
      } else {
        // Charger les biens depuis l'API
        const biensResponse = await fetch('/api/properties');
        if (biensResponse.ok) {
          const biensData = await biensResponse.json();
          // L'API retourne {data: []}
          const properties = biensData.data || biensData;
          setBiens(Array.isArray(properties) ? properties : []);
        } else {
          console.error('Failed to load biens:', biensResponse.status);
          setBiens([]);
        }
      }

      // Utiliser les locataires passés directement ou charger depuis l'API
      if (tenants && Array.isArray(tenants)) {
        setLocataires(tenants);
      }

      // Utiliser les baux passés directement ou charger depuis l'API
      if (leases && Array.isArray(leases)) {
        setBaux(leases);
      }

      // Charger les natures
      const naturesResponse = await fetch('/api/natures');
      if (naturesResponse.ok) {
        const naturesData = await naturesResponse.json();
        setNatures(Array.isArray(naturesData) ? naturesData : []);
        
        // Pré-sélectionner la première nature si aucune
        if (!formData.natureId && naturesData.length > 0) {
          setFormData(prev => ({ ...prev, natureId: naturesData[0].code }));
        }
      } else {
        console.error('Failed to load natures:', naturesResponse.status);
        setNatures([]);
      }

      // Charger les types de documents
      const docTypesResponse = await fetch('/api/document-types');
      if (docTypesResponse.ok) {
        const docTypesData = await docTypesResponse.json();
        setDocumentTypes(Array.isArray(docTypesData) ? docTypesData : []);
      } else {
        console.error('Failed to load document types:', docTypesResponse.status);
        setDocumentTypes([]);
      }

    } catch (error) {
      console.error('Error loading initial data:', error);
      // S'assurer que les arrays sont initialisés même en cas d'erreur
      setBiens([]);
      setNatures([]);
      setDocumentTypes([]);
    }
  };

  // Charger les baux du bien sélectionné
  useEffect(() => {
    if (formData.bienId) {
      loadBauxForBien(formData.bienId);
    } else {
      setBaux([]);
    }
  }, [formData.bienId]);

  const loadBauxForBien = async (bienId: string) => {
    try {
      const response = await fetch(`/api/leases?propertyId=${bienId}&status=DRAFT,SENT,SIGNED,ACTIVE,ACTIF`);
      if (response.ok) {
        const data = await response.json();
        // L'API retourne {leases: [], total: 0, pages: 0}
        const leases = data.Lease || data;
        setBaux(Array.isArray(leases) ? leases : []);
      } else {
        console.error('Failed to load baux:', response.status);
        setBaux([]);
      }
    } catch (error) {
      console.error('Error loading baux:', error);
      setBaux([]);
    }
  };

  // Charger les locataires selon le contexte
  useEffect(() => {
    if (formData.bailId) {
      // Si bail sélectionné, charger le locataire du bail
      if (Array.isArray(baux)) {
        const bail = baux.find(b => b.id === formData.bailId);
        if (bail?.Tenant) {
          setLocataires([bail.Tenant]);
          setFormData(prev => ({ 
            ...prev, 
            locataireId: bail.Tenant.id,
            // Auto-sélectionner "LOYER" comme nature
            natureId: 'LOYER',
            // Pré-remplir le montant avec le loyer du bail
            montant: bail.rentAmount || 0,
            // Réinitialiser la catégorie pour forcer le rechargement
            categorieId: ''
          }));
        }
      }
    } else if (formData.bienId) {
      // Sinon, charger les locataires liés au bien
      loadLocatairesForBien(formData.bienId);
    } else {
      setLocataires([]);
    }
  }, [formData.bailId, formData.bienId, baux]);

  const loadLocatairesForBien = async (bienId: string) => {
    try {
      const response = await fetch(`/api/tenants?propertyId=${bienId}`);
      if (response.ok) {
        const data = await response.json();
        // L'API retourne {data: []}
        const tenants = data.data || data;
        setLocataires(Array.isArray(tenants) ? tenants : []);
      } else {
        console.error('Failed to load locataires:', response.status);
        setLocataires([]);
      }
    } catch (error) {
      console.error('Error loading locataires:', error);
      setLocataires([]);
    }
  };

  // Charger les catégories compatibles quand la nature change
  useEffect(() => {
    if (formData.natureId) {
      loadCompatibleCategories(formData.natureId);
    } else {
      setCompatibleCategories([]);
    }
  }, [formData.natureId]);

  const loadCompatibleCategories = async (natureId: string) => {
    setLoadingCategories(true);
    try {
      const response = await fetch(`/api/categories?natureId=${natureId}`);
      if (response.ok) {
        const data = await response.json();
        setCompatibleCategories(Array.isArray(data) ? data : []);
        
        // En mode édition, pré-sélectionner la catégorie existante si elle existe
        if (isEditMode && initialData?.categoryId) {
          const categoryExists = data.find(cat => cat.id === initialData.categoryId);
          console.log('Debug catégorie en mode édition:', {
            categoryId: initialData.categoryId,
            categoryExists: !!categoryExists,
            availableCategories: data.map(cat => ({ id: cat.id, label: cat.label }))
          });
          if (categoryExists) {
            setFormData(prev => ({ ...prev, categorieId: initialData.categoryId }));
          }
        }
        // En mode création, suggérer la catégorie par défaut
        else if (!isEditMode && (!formData.categorieId || formData.natureId !== natureId) && data.length > 0) {
          // Pour les loyers, chercher une catégorie "Loyer" ou prendre la première
          let defaultCategoryId = data[0].id;
          if (natureId === 'LOYER') {
            const loyerCategory = data.find(cat => 
              cat.label.toLowerCase().includes('loyer') || 
              cat.label.toLowerCase().includes('rent') ||
              cat.label.toLowerCase().includes('revenu')
            );
            if (loyerCategory) {
              defaultCategoryId = loyerCategory.id;
            }
          }
          setFormData(prev => ({ ...prev, categorieId: defaultCategoryId }));
        }
      } else {
        console.error('Failed to load compatible categories:', response.status);
        setCompatibleCategories([]);
      }
    } catch (error) {
      console.error('Error loading compatible categories:', error);
      setCompatibleCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  // Auto-libellé
  const generateAutoLabel = useCallback(() => {
    if (touchedLabel) return; // Ne pas écraser si l'utilisateur a modifié manuellement

    // Vérifier que les arrays sont bien chargés et sont des arrays
    if (!Array.isArray(biens) || !Array.isArray(natures) || !Array.isArray(baux)) {
      return;
    }

    const bien = biens.find(b => b.id === formData.bienId);
    const nature = natures.find(n => n.code === formData.natureId);
    const bail = baux.find(b => b.id === formData.bailId);
    
    if (!bien || !nature || !formData.date) return;

    const date = new Date(formData.date);
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    const monthYear = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;

    let label = '';
    if (nature.code === 'LOYER') {
      label = `Loyer ${monthYear} — ${bien.name}`;
    } else {
      const context = bail ? `${bail.Tenant?.firstName} ${bail.Tenant?.lastName}` : bien.name;
      label = `${nature.label} ${monthYear} — ${context}`;
    }

    setFormData(prev => ({ ...prev, libelle: label }));
  }, [formData.bienId, formData.natureId, formData.bailId, formData.date, touchedLabel, biens, natures, baux]);

  // Pré-remplir le montant si c'est un loyer
  const handleNatureChange = useCallback((natureId: string) => {
    setFormData(prev => ({ ...prev, natureId, categorieId: '' }));
    
    // Si c'est un loyer, essayer de pré-remplir le montant
    if (natureId === 'LOYER' && Array.isArray(baux) && baux.length > 0) {
      const activeBail = baux.find(bail => 
        bail.status === 'ACTIVE' || bail.status === 'SIGNED'
      );
      if (activeBail && activeBail.rentAmount) {
        setFormData(prev => ({ ...prev, montant: activeBail.rentAmount }));
      }
    }
  }, [baux]);

  // Recalculer l'auto-libellé quand les dépendances changent
  useEffect(() => {
    generateAutoLabel();
  }, [generateAutoLabel]);

  // Calculer l'aperçu des transactions
  const calculateTransactionPreview = useCallback(() => {
    if (!formData.debutPeriode || formData.nbMois < 1 || formData.montant <= 0) {
      setTransactionPreview([]);
      return;
    }

    const preview = [];
    const [year, month] = formData.debutPeriode.split('-').map(Number);
    const startDate = new Date(year, month - 1); // month - 1 car Date commence à 0
    
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    if (formData.repartitionAuto) {
      // Répartition du total sur N mois
      const totalAmount = formData.montant;
      const amountPerMonth = Math.floor(totalAmount / formData.nbMois * 100) / 100; // Arrondi au centime
      const remainder = Math.round((totalAmount - amountPerMonth * formData.nbMois) * 100) / 100;
      
      for (let i = 0; i < formData.nbMois; i++) {
        const currentDate = new Date(startDate.getFullYear(), startDate.getMonth() + i);
        const amount = i === formData.nbMois - 1 ? amountPerMonth + remainder : amountPerMonth;
        
        preview.push({
          month: `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`,
          amount: amount,
          label: `${formData.libelle || 'Transaction'} - ${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
        });
      }
    } else {
      // Montant mensuel fixe
      for (let i = 0; i < formData.nbMois; i++) {
        const currentDate = new Date(startDate.getFullYear(), startDate.getMonth() + i);
        
        preview.push({
          month: `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`,
          amount: formData.montant,
          label: `${formData.libelle || 'Transaction'} - ${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
        });
      }
    }
    
    setTransactionPreview(preview);
  }, [formData.debutPeriode, formData.nbMois, formData.montant, formData.repartitionAuto, formData.libelle]);

  // Recalculer l'aperçu quand les dépendances changent
  useEffect(() => {
    calculateTransactionPreview();
  }, [calculateTransactionPreview]);

  const handleChange = (field: string, value: any) => {
    // Si la nature change, utiliser la fonction spécialisée
    if (field === 'natureId') {
      handleNatureChange(value);
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    
    // Marquer le libellé comme touché si l'utilisateur le modifie manuellement
    if (field === 'libelle') {
      setTouchedLabel(true);
    }
    
    // Effacer l'erreur du champ modifié
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    files.forEach(file => {
      const docFile: DocumentFile = {
        id: Math.random().toString(36).substr(2, 9),
        file,
        name: file.name,
        size: file.size,
        predictedTypeId: predictDocumentType(file)
      };
      setDocuments(prev => [...prev, docFile]);
    });
  };

  const predictDocumentType = (file: File): string | undefined => {
    // Logique de prédiction basée sur le nom, l'extension, etc.
    const fileName = file.name.toLowerCase();
    const extension = fileName.split('.').pop();
    
    // Vérifier que documentTypes est un array
    if (!Array.isArray(documentTypes)) {
      return undefined;
    }
    
    // Rechercher dans les types de documents compatibles
    const compatibleTypes = documentTypes.filter(dt => {
      try {
        const contexts = JSON.parse(dt.defaultContexts || '[]');
        return contexts.some((ctx: string) => 
          ['transaction', 'lease', 'property', 'tenant'].includes(ctx)
        );
      } catch {
        return false;
      }
    });
    
    // Logique de prédiction améliorée
    for (const dt of compatibleTypes) {
      if (dt.suggestionConfig) {
        try {
          const config = JSON.parse(dt.suggestionConfig);
          if (config.DocumentExtractionRule) {
            for (const rule of config.DocumentExtractionRule) {
              // Vérifier les patterns regex
              if (rule.pattern && new RegExp(rule.pattern, 'i').test(fileName)) {
                return dt.id;
              }
              // Vérifier les types MIME
              if (rule.mimeTypes && rule.mimeTypes.includes(file.type)) {
                return dt.id;
              }
            }
          }
        } catch (e) {
          console.error(`Error parsing suggestionConfig for ${dt.code}:`, e);
        }
      }
    }
    
    // Logique de fallback basée sur les mots-clés
    if (fileName.includes('quittance') || fileName.includes('receipt') || fileName.includes('paiement')) {
      return compatibleTypes.find(dt => dt.code === 'QUITTANCE')?.id;
    }
    if (fileName.includes('bail') || fileName.includes('lease') || fileName.includes('contrat')) {
      return compatibleTypes.find(dt => dt.code === 'SIGNED_LEASE')?.id;
    }
    if (fileName.includes('facture') || fileName.includes('invoice')) {
      return compatibleTypes.find(dt => dt.code === 'INVOICE')?.id;
    }
    if (fileName.includes('assurance') || fileName.includes('insurance')) {
      return compatibleTypes.find(dt => dt.code === 'INSURANCE')?.id;
    }
    
    // Par défaut, retourner le premier type compatible
    return compatibleTypes.length > 0 ? compatibleTypes[0].id : undefined;
  };

  const removeDocument = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  const updateDocumentType = (id: string, typeId: string) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === id ? { ...doc, typeId } : doc
    ));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validation des champs obligatoires de l'onglet 1
    if (!formData.bienId) newErrors.bienId = 'Le bien est obligatoire';
    if (!formData.libelle) newErrors.libelle = 'Le libellé est obligatoire';
    if (!formData.montant || formData.montant <= 0) newErrors.montant = 'Le montant doit être positif';
    if (!formData.date) newErrors.date = 'La date est obligatoire';
    if (!formData.natureId) newErrors.natureId = 'La nature est obligatoire';
    if (!formData.categorieId) newErrors.categorieId = 'La catégorie est obligatoire';

    // Si un bail est sélectionné, le locataire devient obligatoire
    if (formData.bailId && !formData.locataireId) {
      newErrors.locataireId = 'Le locataire est obligatoire quand un bail est sélectionné';
    }

    // Validation des périodes si multi-périodes
    if (formData.nbMois > 1 && !formData.debutPeriode) {
      newErrors.debutPeriode = 'Le début de période est obligatoire pour les multi-périodes';
    }
    
    // Validation du nombre de mois
    if (formData.nbMois < 1) {
      newErrors.nbMois = 'Le nombre de mois doit être supérieur à 0';
    }
    
    // Validation du format de début de période
    if (formData.debutPeriode && !/^\d{4}-\d{2}$/.test(formData.debutPeriode)) {
      newErrors.debutPeriode = 'Format invalide (attendu: YYYY-MM)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Déterminer si on doit créer une ou plusieurs transactions (seulement en mode création)
      if (!isEditMode && formData.nbMois > 1 && formData.debutPeriode) {
        // Création en bulk
        const bulkPayload = {
          base: {
            propertyId: formData.bienId,
            leaseId: formData.bailId || '',
            tenantId: formData.locataireId || '',
            nature: formData.natureId,
            categoryId: formData.categorieId,
            label: formData.libelle,
            reference: formData.reference || '',
            paidAt: formData.datePaiement || '',
            method: formData.modePaiement || '',
            notes: formData.notes || '',
            sendEmail: formData.envoyerEmail,
          },
          schedule: {
            startMonth: formData.debutPeriode,
            months: formData.nbMois,
            autoSplit: formData.repartitionAuto,
            amount: formData.montant,
          }
        };

        const response = await fetch('/api/transactions/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bulkPayload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erreur lors de la création des transactions');
        }

        const result = await response.json();
        console.log(`${result.count} transactions créées avec succès`);
        
      } else {
        // Création d'une seule transaction
        const payload = {
          // Mapping des champs du formulaire vers l'API
          label: formData.libelle,
          amount: formData.montant,
          date: formData.date,
          propertyId: formData.bienId,
          leaseId: formData.bailId || null,
          categoryId: formData.categorieId || null,
          nature: formData.natureId,
          reference: formData.reference || null,
          notes: formData.notes || null,
          // Champs de paiement - si une date est saisie, considérer comme payé
          paidAt: formData.datePaiement ? formData.datePaiement : null,
          method: formData.modePaiement || null,
          // Documents
          documents: documents.map(doc => ({
            file: doc.file,
            typeId: doc.typeId || doc.predictedTypeId
          }))
        };

        // Debug: Log des données de paiement avant envoi
        console.log('Données de paiement avant envoi:', {
          estPaye: formData.estPaye,
          datePaiement: formData.datePaiement,
          modePaiement: formData.modePaiement,
          paidAt: payload.paidAt,
          method: payload.method
        });
        
        // Inclure l'ID de la transaction en mode édition
        if (isEditMode && initialData?.id) {
          payload.id = initialData.id;
        }
        
        await onSubmit(payload);
      }
      
      onClose();
    } catch (error) {
      console.error('Error submitting transaction:', error);
      setErrors({ submit: 'Erreur lors de l\'enregistrement de la transaction' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderEssentielles = () => (
    <div className="space-y-6">
      {/* Layout 2 colonnes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Colonne gauche */}
        <div className="space-y-4">
          {/* Bien */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <span className="text-red-500">*</span> Bien
            </label>
            {(defaultBienId || defaultPropertyId || propertyId || (isEditMode && formData.bienId)) ? (
              <input
                type="text"
                value={Array.isArray(biens) ? biens.find(b => b.id === (defaultBienId || defaultPropertyId || propertyId || formData.bienId))?.name || '' : ''}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
              />
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un bien..."
                  value={searchBien}
                  onChange={(e) => setSearchBien(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            )}
            {errors.bienId && <p className="text-red-500 text-sm mt-1">{errors.bienId}</p>}
          </div>

          {/* Bail */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bail (optionnel)
            </label>
            <select
              value={formData.bailId}
              onChange={(e) => handleChange('bailId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Aucun bail</option>
              {Array.isArray(baux) && baux.map((bail) => (
                <option key={bail.id} value={bail.id}>
                  {bail.Tenant?.firstName} {bail.Tenant?.lastName} - {new Date(bail.startDate).toLocaleDateString('fr-FR')}
                </option>
              ))}
            </select>
          </div>

          {/* Locataire */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {formData.bailId ? (
                <span className="text-red-500">*</span>
              ) : null} Locataire
            </label>
            <select
              value={formData.locataireId}
              onChange={(e) => handleChange('locataireId', e.target.value)}
              disabled={formData.bailId ? true : false}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                formData.bailId ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
            >
              <option value="">Sélectionner un locataire</option>
              {Array.isArray(locataires) && locataires.map((locataire) => (
                <option key={locataire.id} value={locataire.id}>
                  {locataire.firstName} {locataire.lastName}
                </option>
              ))}
            </select>
            {errors.locataireId && <p className="text-red-500 text-sm mt-1">{errors.locataireId}</p>}
          </div>

          {/* Libellé */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <span className="text-red-500">*</span> Libellé
            </label>
            <input
              type="text"
              value={formData.libelle}
              onChange={(e) => handleChange('libelle', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.libelle ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Libellé automatique généré..."
            />
            {errors.libelle && <p className="text-red-500 text-sm mt-1">{errors.libelle}</p>}
          </div>

          {/* Montant */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <span className="text-red-500">*</span> Montant (€)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.montant}
              onChange={(e) => handleChange('montant', parseFloat(e.target.value) || 0)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.montant ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {formData.montant > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {formData.repartitionAuto 
                  ? 'Interprété comme montant total, réparti sur N mois.'
                  : 'Interprété comme montant mensuel.'
                }
              </p>
            )}
            {errors.montant && <p className="text-red-500 text-sm mt-1">{errors.montant}</p>}
          </div>
        </div>

        {/* Colonne droite */}
        <div className="space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <span className="text-red-500">*</span> Date
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => handleChange('date', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.date ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.date && <p className="text-red-500 text-sm mt-1">{errors.date}</p>}
          </div>

          {/* Nature */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <span className="text-red-500">*</span> Nature
            </label>
            <select
              value={formData.natureId}
              onChange={(e) => handleChange('natureId', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.natureId ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Sélectionner une nature</option>
              {Array.isArray(natures) && natures.map((nature) => (
                <option key={nature.code} value={nature.code}>
                  {nature.label}
                </option>
              ))}
            </select>
            {errors.natureId && <p className="text-red-500 text-sm mt-1">{errors.natureId}</p>}
          </div>

          {/* Catégorie */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <span className="text-red-500">*</span> Catégorie
            </label>
            {loadingCategories ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500">
                Chargement des catégories...
              </div>
            ) : (
              <select
                value={formData.categorieId}
                onChange={(e) => handleChange('categorieId', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  errors.categorieId ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Sélectionner une catégorie</option>
                {Array.isArray(compatibleCategories) && compatibleCategories.map((categorie) => (
                  <option key={categorie.id} value={categorie.id}>
                    {categorie.label}
                  </option>
                ))}
              </select>
            )}
            {errors.categorieId && <p className="text-red-500 text-sm mt-1">{errors.categorieId}</p>}
            {Array.isArray(compatibleCategories) && compatibleCategories.length === 0 && formData.natureId && !loadingCategories && (
              <p className="text-amber-600 text-sm mt-1">
                Aucune catégorie compatible trouvée pour cette nature
              </p>
            )}
          </div>

          {/* Référence */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Référence (optionnelle)
            </label>
            <input
              type="text"
              value={formData.reference}
              onChange={(e) => handleChange('reference', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Référence interne..."
            />
          </div>
        </div>
      </div>

      {/* Upload Documents */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Documents
        </label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-500 transition-colors">
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <div className="mt-2">
            <label htmlFor="file-upload" className="cursor-pointer">
              <span className="text-primary-600 hover:text-primary-500 font-medium">
                Cliquer pour uploader
              </span>
              <span className="text-gray-500"> ou glisser-déposer</span>
            </label>
            <input
              id="file-upload"
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            PDF, JPG, PNG, DOC, XLS (max 10MB)
          </p>
        </div>

        {/* Liste des documents uploadés */}
        {Array.isArray(documents) && documents.length > 0 && (
          <div className="mt-4 space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                    <p className="text-xs text-gray-500">{(doc.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {doc.predictedTypeId && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      Type détecté
                    </span>
                  )}
                  <button
                    onClick={() => removeDocument(doc.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Résumé fantôme */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Aperçu de la transaction
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Libellé:</span>
            <p className="font-medium">{formData.libelle || 'Non défini'}</p>
          </div>
          <div>
            <span className="text-gray-600">Nature:</span>
            <p className="font-medium">{Array.isArray(natures) ? natures.find(n => n.code === formData.natureId)?.label || 'Non sélectionnée' : 'Non sélectionnée'}</p>
          </div>
          <div>
            <span className="text-gray-600">Catégorie:</span>
            <p className="font-medium">{Array.isArray(compatibleCategories) ? compatibleCategories.find(c => c.id === formData.categorieId)?.label || 'Non sélectionnée' : 'Non sélectionnée'}</p>
          </div>
          <div>
            <span className="text-gray-600">Montant:</span>
            <p className="font-medium">{formData.montant ? `${formData.montant.toFixed(2)} €` : 'Non défini'}</p>
          </div>
        </div>
        {formData.nbMois > 1 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <span className="text-gray-600 text-sm">Périodes:</span>
            <p className="font-medium text-sm">{formData.nbMois} mois à partir de {formData.debutPeriode || 'Non défini'}</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderPaiement = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Date de paiement */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date de paiement
          </label>
          <input
            type="date"
            value={formData.datePaiement}
            onChange={(e) => handleChange('datePaiement', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {/* Mode de paiement */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mode de paiement
          </label>
          <select
            value={formData.modePaiement}
            onChange={(e) => handleChange('modePaiement', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Sélectionner un mode</option>
            <option value="VIREMENT">Virement</option>
            <option value="CHEQUE">Chèque</option>
            <option value="ESPECES">Espèces</option>
            <option value="CARTE">Carte bancaire</option>
            <option value="PRELEVEMENT">Prélèvement</option>
          </select>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="Notes additionnelles..."
        />
      </div>

      {/* Envoyer email */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="envoyerEmail"
          checked={formData.envoyerEmail}
          onChange={(e) => handleChange('envoyerEmail', e.target.checked)}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
        <label htmlFor="envoyerEmail" className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Envoyer un email de confirmation
        </label>
      </div>
    </div>
  );

  const renderPeriode = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Début de période - Picker Mois/Année */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {formData.nbMois > 1 ? (
              <span className="text-red-500">*</span>
            ) : null} Début de période
          </label>
          <input
            type="month"
            value={formData.debutPeriode}
            onChange={(e) => handleChange('debutPeriode', e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
              errors.debutPeriode ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.debutPeriode && <p className="text-red-500 text-sm mt-1">{errors.debutPeriode}</p>}
        </div>

        {/* Nombre de mois */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre de mois couverts
          </label>
          <input
            type="number"
            min="1"
            value={formData.nbMois}
            onChange={(e) => handleChange('nbMois', parseInt(e.target.value) || 1)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
              errors.nbMois ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.nbMois && <p className="text-red-500 text-sm mt-1">{errors.nbMois}</p>}
        </div>
      </div>

      {/* Répartition automatique */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="repartitionAuto"
          checked={formData.repartitionAuto}
          onChange={(e) => handleChange('repartitionAuto', e.target.checked)}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
        <label htmlFor="repartitionAuto" className="text-sm font-medium text-gray-700">
          Répartition automatique
        </label>
      </div>

      {/* Aperçu des transactions */}
      {transactionPreview.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Aperçu des transactions
          </h4>
          <div className="space-y-2">
            {transactionPreview.map((tx, index) => (
              <div key={index} className="flex justify-between items-center py-2 px-3 bg-white rounded border">
                <span className="text-sm font-medium text-gray-700">{tx.month}</span>
                <span className="text-sm font-medium text-gray-900">{tx.amount.toFixed(2)} €</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Total:</span>
              <span className="text-sm font-bold text-gray-900">
                {transactionPreview.reduce((sum, tx) => sum + tx.amount, 0).toFixed(2)} €
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {formData.repartitionAuto 
                ? `Montant total réparti sur ${formData.nbMois} mois`
                : `Montant mensuel × ${formData.nbMois} mois`
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'essentielles': return renderEssentielles();
      case 'paiement': return renderPaiement();
      case 'periode': return renderPeriode();
      default: return null;
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-5xl md:max-w-7xl bg-white rounded-2xl shadow-2xl border border-gray-200">
        {/* Header fixe */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation des onglets */}
        <div className="border-b border-gray-200 px-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {tab.required && <span className="text-red-500">*</span>}
              </button>
            ))}
          </nav>
        </div>

        {/* Corps scrollable */}
        <div className="max-h-[70vh] overflow-y-auto p-6">
          {renderTabContent()}
        </div>

        {/* Footer sticky */}
        <div className="sticky bottom-0 bg-white/80 backdrop-blur border-t border-gray-200 p-6">
          {/* Audit trail en mode édition */}
          {isEditMode && initialData && (
            <div className="text-xs text-gray-500 mb-4 pb-3 border-b border-gray-100">
              Créé le {new Date(initialData.createdAt).toLocaleDateString('fr-FR')} 
              {initialData.updatedAt && initialData.updatedAt !== initialData.createdAt && (
                <> • Modifié le {new Date(initialData.updatedAt).toLocaleDateString('fr-FR')}</>
              )}
            </div>
          )}
          
          <div className="flex justify-between items-center">
            {/* Actions de gauche en mode édition */}
            {isEditMode && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Logique de duplication
                    const duplicatedData = { ...formData, id: undefined, label: `${formData.libelle} (copie)` };
                    setFormData(duplicatedData);
                  }}
                  disabled={isSubmitting}
                >
                  Dupliquer
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm('Êtes-vous sûr de vouloir supprimer cette transaction ?')) {
                      // Logique de suppression - sera gérée par le parent
                      console.log('Suppression demandée pour transaction:', initialData?.id);
                    }
                  }}
                  disabled={isSubmitting}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Supprimer
                </Button>
              </div>
            )}
            
            {/* Actions de droite */}
            <div className="flex gap-3 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.bienId || !formData.libelle || !formData.montant || !formData.date || !formData.natureId || !formData.categorieId}
              >
                {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

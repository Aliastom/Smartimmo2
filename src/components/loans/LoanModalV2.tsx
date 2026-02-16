'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Upload, FileText, Eye, Link, Plus, Edit, Trash2, UserPlus, Info } from 'lucide-react';
import { notify2 } from '@/lib/notify2';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { SmartSelect, SmartSelectOption } from '@/components/ui/SmartSelect';
import { SmartDatePicker } from '@/components/ui/SmartDatePicker';
import { useUploadStaging } from '@/hooks/useUploadStaging';
import { UploadReviewModal } from '@/components/documents/UploadReviewModal';
import { DuplicateDetectedModal } from '@/components/documents/DuplicateDetectedModal';
import { ConfirmDeleteDocumentModal } from '@/components/documents/ConfirmDeleteDocumentModal';
import { LinkExistingDocumentModal } from '@/components/documents/LinkExistingDocumentModal';
import { buildSchedule, crdAtDate } from '@/lib/finance/amortization';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { useLoanDocuments } from '@/hooks/offline/useLoanDocuments';
import { getLocalDB } from '@/lib/offline/db';
import { createDocumentServiceWithMode } from '@/domain/services/documentServiceFactory';

// Schéma de validation pour le formulaire de prêt
const loanFormSchema = z.object({
  propertyId: z.string().min(1, 'Veuillez sélectionner un bien'),
  label: z.string().min(1, 'Le libellé est requis'),
  principal: z.number().positive('Le capital doit être positif'),
  annualRatePct: z.number().min(0, 'Le taux doit être positif ou nul'),
  durationMonths: z.number().int().positive('La durée doit être positive'),
  defermentMonths: z.number().int().min(0, 'Le différé ne peut pas être négatif').default(0),
  insurancePct: z.number().min(0, 'L\'assurance doit être positive').optional().nullable(),
  feesUpfront: z.number().min(0, 'Les frais doivent être positifs').optional().nullable(),
  startDate: z.string().min(1, 'La date de début est requise'),
  paymentDay: z.number().int().min(1).max(31, 'Le jour de paiement doit être entre 1 et 31').optional().nullable(),
  loanType: z.string().optional().nullable(),
  repaymentType: z.string().optional().nullable(),
  amortizationProfile: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

type LoanFormData = z.infer<typeof loanFormSchema>;

// Schéma pour les co-emprunteurs
const borrowerSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  birthDate: z.string().optional().nullable(),
  email: z.string().email('Email invalide').optional().nullable(),
  phone: z.string().optional().nullable(),
  responsibilityPct: z.number().min(0).max(100).optional().nullable(),
});

type BorrowerFormData = z.infer<typeof borrowerSchema>;

interface Property {
  id: string;
  name: string;
}

interface LoanBorrower {
  id?: string;
  firstName: string;
  lastName: string;
  birthDate?: string | null;
  email?: string | null;
  phone?: string | null;
  responsibilityPct?: number | null;
}

interface LoanModalV2Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: LoanFormData & { 
    id?: string;
    stagedDocumentIds?: string[];
    stagedLinkItemIds?: string[];
    borrowers?: LoanBorrower[];
  }) => Promise<void>;
  properties: Property[];
  initialData?: Partial<LoanFormData> & { 
    id?: string;
    borrowers?: LoanBorrower[];
  };
  mode?: 'create' | 'edit';
  title?: string;
  lockPropertyId?: boolean; // Si true, le champ "Bien" est verrouillé (désactivé)
}

export const LoanModalV2: React.FC<LoanModalV2Props> = ({
  isOpen,
  onClose,
  onSubmit,
  properties,
  initialData,
  mode = 'create',
  title,
  lockPropertyId = false,
}) => {
  const { organizationId } = useCurrentOrganization();
  const [activeTab, setActiveTab] = useState('informations');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // États pour les co-emprunteurs
  const [borrowers, setBorrowers] = useState<LoanBorrower[]>(initialData?.borrowers || []);
  const [showBorrowerModal, setShowBorrowerModal] = useState(false);
  const [editingBorrower, setEditingBorrower] = useState<LoanBorrower | null>(null);
  const [borrowerFormData, setBorrowerFormData] = useState<BorrowerFormData>({
    firstName: '',
    lastName: '',
    birthDate: null,
    email: null,
    phone: null,
    responsibilityPct: null,
  });

  // Hook pour le staging des documents
  const {
    uploadSessionId,
    stagedDocuments,
    setStagedDocuments,
    loading: stagingLoading,
    createUploadSession,
    loadStagedDocuments,
    addStagedDocument,
    removeStagedDocument,
    clearStaging
  } = useUploadStaging();

  // ✅ Détecter si on est en mode app-shell
  const isAppShellMode = typeof window !== 'undefined' && window.location.pathname.startsWith('/app');
  
  // En mode app-shell, utiliser le hook pour charger les documents depuis IndexedDB
  const { 
    documents: hookLinkedDocuments, 
    loading: documentsLoading,
    hasMissingDocuments 
  } = useLoanDocuments(
    isAppShellMode && mode === 'edit' ? initialData?.id : null,
    isAppShellMode && mode === 'edit' && isOpen
  );
  
  // ⚠️ CORRECTION: Filtrer les stagedDocuments pour exclure ceux qui sont déjà finalisés ou liés au prêt
  // Cela évite d'afficher les brouillons des documents déjà validés lors de la réouverture de la modal
  // ⚠️ IMPORTANT: Ce useMemo doit être APRÈS la déclaration de stagedDocuments ET linkedDocuments
  const filteredStagedDocuments = React.useMemo(() => {
    if (!stagedDocuments || stagedDocuments.length === 0) {
      return [];
    }

    // Filtrer les stagedDocuments
    // ⚠️ CORRECTION: Afficher TOUS les brouillons (status === 'draft'), même s'ils sont déjà liés
    // Les brouillons doivent être visibles pour permettre leur modification/suppression
    return stagedDocuments.filter(doc => {
      // Exclure UNIQUEMENT les documents qui ne sont plus en brouillon (déjà finalisés)
      // Ne PAS exclure les brouillons même s'ils sont liés au prêt
      if (doc.status && doc.status !== 'draft') {
        return false;
      }
      return true;
    });
  }, [stagedDocuments]);
  
  // États pour les documents
  const [linkedDocuments, setLinkedDocuments] = useState<any[]>([]);
  const [stagedLinks, setStagedLinks] = useState<any[]>([]);
  const [showReviewDraftModal, setShowReviewDraftModal] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [showDeleteDocModal, setShowDeleteDocModal] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<any>(null);
  const [isDeletingDocument, setIsDeletingDocument] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateData, setDuplicateData] = useState<any>(null);
  const [showDocumentSelectorModal, setShowDocumentSelectorModal] = useState(false);
  
  // ✅ Synchroniser les documents du hook avec l'état local en mode app-shell
  useEffect(() => {
    if (isAppShellMode && mode === 'edit' && hookLinkedDocuments) {
      // Convertir le format du hook (LinkedDocument[]) au format attendu par la modal
      const formattedDocuments = hookLinkedDocuments.map(doc => ({
        id: doc.id,
        fileName: doc.fileName || doc.filenameOriginal,
        filenameOriginal: doc.filenameOriginal,
        DocumentType: doc.documentTypeLabel ? { label: doc.documentTypeLabel } : null,
        documentTypeLabel: doc.documentTypeLabel,
        uploadedAt: doc.uploadedAt,
        createdAt: doc.createdAt,
        status: doc.status,
        url: doc.url,
        mime: doc.mime,
        size: doc.size,
      }));
      setLinkedDocuments(formattedDocuments);
    }
  }, [isAppShellMode, mode, hookLinkedDocuments]);

  // État pour stocker les DocumentLink de chaque document (en mode app-shell)
  const [documentLinksMap, setDocumentLinksMap] = useState<Map<string, any[]>>(new Map());

  // Charger les DocumentLink pour tous les documents liés (en mode app-shell)
  useEffect(() => {
    if (!isAppShellMode || !organizationId || !isOpen) return;
    
    const loadDocumentLinks = async () => {
      try {
        const db = await getLocalDB();
        const allDocuments = isAppShellMode ? hookLinkedDocuments : linkedDocuments;
        
        if (allDocuments.length === 0) {
          setDocumentLinksMap(new Map());
          return;
        }
        
        // Charger tous les DocumentLink pour ces documents
        const documentIds = allDocuments.map(doc => doc.id);
        const allLinks = await db.DocumentLink.toArray();
        
        // Filtrer les liens pour ces documents
        const linksMap = new Map<string, any[]>();
        for (const docId of documentIds) {
          const docLinks = allLinks.filter(link => link.documentId === docId);
          if (docLinks.length > 0) {
            linksMap.set(docId, docLinks);
          }
        }
        
        setDocumentLinksMap(linksMap);
      } catch (error) {
        console.error('Erreur lors du chargement des DocumentLink:', error);
      }
    };
    
    loadDocumentLinks();
  }, [isAppShellMode, organizationId, isOpen, hookLinkedDocuments, linkedDocuments]);
  
  // Fonction pour formater les liaisons d'un document de manière compacte
  const formatDocumentLinks = (doc: any) => {
    let links: any[] = [];
    
    if (isAppShellMode) {
      // En mode app-shell, utiliser documentLinksMap
      links = documentLinksMap.get(doc.id) || [];
    } else {
      // En mode normal, utiliser doc.DocumentLink
      links = doc.DocumentLink || [];
    }
    
    if (links.length === 0) {
      return null;
    }
    
    // Filtrer la liaison vers le prêt courant pour ne pas l'afficher
    const otherLinks = links.filter((link: any) => {
      const linkedType = (link.linkedType || '').toLowerCase();
      const linkedId = link.linkedId || '';
      return !(linkedType === 'loan' && linkedId === initialData?.id);
    });
    
    if (otherLinks.length === 0) {
      return null;
    }
    
    // Utiliser entityInfo si disponible, sinon utiliser les types bruts
    const linkLabels = otherLinks.map((link: any) => {
      if (link.entityInfo) {
        const label = link.entityInfo.type === 'Transaction' || link.entityInfo.type === 'Bien' || link.entityInfo.type === 'Bail' 
          ? link.entityInfo.name 
          : link.entityInfo.type;
        return label;
      } else {
        const typeMap: Record<string, string> = {
          'property': 'Bien',
          'lease': 'Bail',
          'transaction': 'Transaction',
          'loan': 'Prêt',
          'global': 'Global',
        };
        return typeMap[link.linkedType?.toLowerCase()] || link.linkedType || 'Inconnu';
      }
    });
    
    return linkLabels.join(', ');
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<LoanFormData>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: {
      propertyId: initialData?.propertyId || '',
      label: initialData?.label || '',
      principal: initialData?.principal || 0,
      annualRatePct: initialData?.annualRatePct || 0,
      durationMonths: initialData?.durationMonths || 240,
      defermentMonths: initialData?.defermentMonths || 0,
      insurancePct: initialData?.insurancePct || null,
      feesUpfront: initialData?.feesUpfront || null,
      startDate: initialData?.startDate
        ? new Date(initialData.startDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      paymentDay: (initialData as any)?.paymentDay || null,
      loanType: (initialData as any)?.loanType || null,
      repaymentType: (initialData as any)?.repaymentType || null,
      amortizationProfile: (initialData as any)?.amortizationProfile || null,
      notes: (initialData as any)?.notes || null,
      isActive: initialData?.isActive !== undefined ? initialData.isActive : true,
    },
  });

  // Réinitialiser le formulaire quand initialData change (mode édition)
  useEffect(() => {
    if (isOpen && initialData) {
      reset({
        propertyId: initialData.propertyId || '',
        label: initialData.label || '',
        principal: initialData.principal || 0,
        annualRatePct: initialData.annualRatePct || 0,
        durationMonths: initialData.durationMonths || 240,
        defermentMonths: initialData.defermentMonths || 0,
        insurancePct: initialData.insurancePct || null,
        feesUpfront: initialData.feesUpfront || null,
        startDate: initialData.startDate
          ? new Date(initialData.startDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        paymentDay: (initialData as any)?.paymentDay || null,
        loanType: (initialData as any)?.loanType || null,
        repaymentType: (initialData as any)?.repaymentType || null,
        amortizationProfile: (initialData as any)?.amortizationProfile || null,
        notes: (initialData as any)?.notes || null,
        isActive: initialData.isActive !== undefined ? initialData.isActive : true,
      });
      
      // Réinitialiser les co-emprunteurs
      if (initialData.borrowers) {
        setBorrowers(initialData.borrowers);
      } else {
        setBorrowers([]);
      }
    } else if (isOpen && !initialData) {
      // Mode création : réinitialiser le formulaire
      reset({
        propertyId: '',
        label: '',
        principal: 0,
        annualRatePct: 0,
        durationMonths: 240,
        defermentMonths: 0,
        insurancePct: null,
        feesUpfront: null,
        startDate: new Date().toISOString().split('T')[0],
        paymentDay: null,
        loanType: null,
        repaymentType: null,
        amortizationProfile: null,
        notes: null,
        isActive: true,
      });
      setBorrowers([]);
    }
  }, [isOpen, initialData, reset]);

  // Initialiser la session d'upload à l'ouverture
  useEffect(() => {
    if (isOpen && !uploadSessionId) {
      createUploadSession('loan').then((sessionId) => {
        if (sessionId) {
          // Charger les documents et liens existants de la session
          loadStagedDocuments(sessionId).then(() => {
            // Charger aussi les liens vers documents existants
            fetch(`/api/upload-session/${sessionId}`)
              .then(res => res.json())
              .then(data => {
                if (data.success) {
                  setStagedLinks(data.DocumentLink || []);
                }
              })
              .catch(err => console.error('Erreur chargement liens:', err));
          });
        }
      });
    } else if (isOpen && uploadSessionId) {
      // Recharger les documents et liens si la session existe déjà
      loadStagedDocuments(uploadSessionId).then(() => {
        fetch(`/api/upload-session/${uploadSessionId}`)
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              setStagedLinks(data.DocumentLink || []);
            }
          })
          .catch(err => console.error('Erreur chargement liens:', err));
      });
    }
  }, [isOpen, uploadSessionId, createUploadSession, loadStagedDocuments]);

  // Charger les documents liés en mode édition
  useEffect(() => {
    if (isOpen && mode === 'edit' && initialData?.id) {
      loadLinkedDocuments(initialData.id);
      loadBorrowers(initialData.id);
    }
  }, [isOpen, mode, initialData?.id]);

  // ✅ Écouter l'événement documents:refresh pour recharger les documents après sync
  useEffect(() => {
    if (!isOpen || mode !== 'edit' || !initialData?.id) return;

    const handleDocumentsRefresh = () => {
      loadLinkedDocuments(initialData.id);
    };

    window.addEventListener('documents:refresh', handleDocumentsRefresh);
    return () => {
      window.removeEventListener('documents:refresh', handleDocumentsRefresh);
    };
  }, [isOpen, mode, initialData?.id]);

  // Charger les co-emprunteurs
  const loadBorrowers = async (loanId: string) => {
    try {
      // ✅ APP-SHELL: Charger depuis IndexedDB si on est en mode app-shell
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/app') && organizationId) {
        const { getLocalDB } = await import('@/lib/offline/db');
        const db = await getLocalDB();
        const borrowers = await db.LoanBorrower
          .where('[organizationId+loanId]')
          .equals([organizationId, loanId])
          .toArray();
        
        setBorrowers(borrowers.map(b => ({
          id: b.id,
          firstName: b.firstName,
          lastName: b.lastName,
          birthDate: b.birthDate || null,
          email: b.email || null,
          phone: b.phone || null,
          responsibilityPct: b.responsibilityPct || null,
        })));
        return;
      }
      
      // Mode normal : charger depuis l'API
      const response = await fetch(`/api/loans/${loanId}/borrowers`);
      if (response.ok) {
        const data = await response.json();
        setBorrowers(data.borrowers || []);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des co-emprunteurs:', error);
    }
  };

  // Charger les documents liés
  const loadLinkedDocuments = async (loanId: string) => {
    try {
      // ✅ APP-SHELL: Charger depuis IndexedDB si on est en mode app-shell
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/app') && organizationId) {
        const { getLocalDB } = await import('@/lib/offline/db');
        const db = await getLocalDB();
        
        // Charger les documents liés au prêt de deux façons :
        // 1. Documents avec loanId direct
        const documentsWithLoanId = await db.Document
          .where('organizationId')
          .equals(organizationId)
          .and(doc => doc.loanId === loanId && !doc.deletedAt)
          .toArray();
        
        // 2. Documents liés via DocumentLink
        const documentLinks = await db.DocumentLink
          .where('[linkedType+linkedId]')
          .equals(['loan', loanId])
          .toArray();
        
        const linkedDocumentIds = new Set<string>();
        documentsWithLoanId.forEach(doc => linkedDocumentIds.add(doc.id));
        documentLinks.forEach(link => linkedDocumentIds.add(link.documentId));
        
        // Charger les documents complets avec leurs types
        const allLinkedDocuments = [];
        for (const docId of linkedDocumentIds) {
          const doc = await db.Document.get(docId);
          if (doc && doc.organizationId === organizationId && !doc.deletedAt) {
            // Charger le type de document
            let docType = null;
            if (doc.documentTypeId) {
              docType = await db.DocumentType.get(doc.documentTypeId);
            }
            
            allLinkedDocuments.push({
              ...doc,
              DocumentType: docType ? { label: docType.label } : null,
              documentTypeLabel: docType?.label || 'Non classé',
            });
          }
        }
        
        setLinkedDocuments(allLinkedDocuments);
      } else {
        // Mode normal : charger depuis l'API
        const response = await fetch(`/api/loans/${loanId}/documents`);
        if (response.ok) {
          const data = await response.json();
          setLinkedDocuments(data.documents || []);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des documents:', error);
    }
  };

  // Gestion des co-emprunteurs
  const handleAddBorrower = () => {
    setEditingBorrower(null);
    setBorrowerFormData({
      firstName: '',
      lastName: '',
      birthDate: null,
      email: null,
      phone: null,
      responsibilityPct: null,
    });
    setShowBorrowerModal(true);
  };

  const handleEditBorrower = (borrower: LoanBorrower) => {
    setEditingBorrower(borrower);
    setBorrowerFormData({
      firstName: borrower.firstName,
      lastName: borrower.lastName,
      birthDate: borrower.birthDate || null,
      email: borrower.email || null,
      phone: borrower.phone || null,
      responsibilityPct: borrower.responsibilityPct || null,
    });
    setShowBorrowerModal(true);
  };

  const handleSaveBorrower = () => {
    if (!borrowerFormData.firstName || !borrowerFormData.lastName) {
      notify2.error('Le prénom et le nom sont requis');
      return;
    }

    if (editingBorrower) {
      // Modifier
      setBorrowers(prev => prev.map(b => 
        b.id === editingBorrower.id 
          ? { ...b, ...borrowerFormData }
          : b
      ));
    } else {
      // Ajouter
      setBorrowers(prev => [...prev, borrowerFormData as LoanBorrower]);
    }
    setShowBorrowerModal(false);
    setEditingBorrower(null);
  };

  const handleDeleteBorrower = async (borrower: LoanBorrower) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce co-emprunteur ?')) {
      return;
    }

    // ✅ APP-SHELL: Supprimer en localDB et créer une pendingOp
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/app') && organizationId && borrower.id) {
      try {
        const { getLocalDB } = await import('@/lib/offline/db');
        const db = await getLocalDB();
        const now = new Date().toISOString();

        // Supprimer de IndexedDB
        await db.LoanBorrower.delete(borrower.id);

        // ✅ Vérifier si une pendingOp de suppression existe déjà pour éviter les doublons
        const existingDeletePendingOp = await db.pendingOperations
          .where('[entity+entityId+operation]')
          .equals(['loanBorrower', borrower.id, 'delete'])
          .first();

        // Créer une pendingOp pour la suppression seulement si elle n'existe pas déjà
        if (!existingDeletePendingOp) {
          await db.pendingOperations.add({
            id: crypto.randomUUID(),
            entity: 'loanBorrower',
            entityId: borrower.id,
            operation: 'delete',
            payload: null,
            organizationId,
            status: 'pending',
            error: null,
            createdAt: now,
            updatedAt: now,
          });
        }

        // Mettre à jour l'UI
        setBorrowers(prev => prev.filter(b => b.id !== borrower.id));
        notify2.success('Co-emprunteur supprimé');
      } catch (error: any) {
        console.error('Erreur lors de la suppression du co-emprunteur:', error);
        notify2.error('Erreur lors de la suppression');
      }
    } else if (borrower.id) {
      // Mode normal : supprimer via API
      try {
        const response = await fetch(`/api/loans/borrowers/${borrower.id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          setBorrowers(prev => prev.filter(b => b.id !== borrower.id));
          notify2.success('Co-emprunteur supprimé');
        } else {
          throw new Error('Erreur lors de la suppression');
        }
      } catch (error: any) {
        console.error('Erreur lors de la suppression du co-emprunteur:', error);
        notify2.error('Erreur lors de la suppression');
      }
    } else {
      // Co-emprunteur non sauvegardé : supprimer de la liste locale
      setBorrowers(prev => prev.filter(b => b !== borrower));
    }
  };

  // Gestion de l'upload de fichiers (identique à TransactionModalV2)
  const handleFileUpload = async (files: File[]) => {
    if (!uploadSessionId) {
      await createUploadSession('loan');
      return;
    }

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploadSessionId', uploadSessionId);
      formData.append('intendedContextType', 'loan');
      formData.append('intendedContextTempKey', mode === 'create' ? 'loan:new' : (initialData?.id || 'loan:edit'));

      try {
        const response = await fetch('/api/upload-staged', {
          method: 'POST',
          body: formData,
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
          if (result.success && result.document) {
            // ✅ APP-SHELL: Ajouter le document dans IndexedDB localement
            // (identique à TransactionModalV2)
            if (typeof window !== 'undefined' && window.location.pathname.startsWith('/app') && organizationId) {
              try {
                const { getLocalDB } = await import('@/lib/offline/db');
                const db = await getLocalDB();
                const docData = result.document;
                
                // Construire l'objet document pour IndexedDB
                const fileName = docData.fileName || docData.filenameOriginal || file.name;
                const localDoc: any = {
                  id: docData.id,
                  organizationId,
                  propertyId: docData.propertyId || null,
                  leaseId: docData.leaseId || null,
                  tenantId: docData.tenantId || null,
                  transactionId: docData.transactionId || null,
                  loanId: docData.loanId || null,
                  filenameOriginal: fileName,
                  fileName: fileName,
                  mime: docData.mime || file.type,
                  size: docData.size || file.size,
                  bucketKey: docData.bucketKey || null,
                  url: docData.url || '',
                  status: docData.status || 'draft',
                  source: docData.source || 'staged-upload',
                  documentTypeId: docData.documentTypeId || docData.DocumentType?.id || null,
                  uploadSessionId: docData.uploadSessionId || uploadSessionId,
                  intendedContextType: docData.intendedContextType || 'loan',
                  intendedContextTempKey: docData.intendedContextTempKey || (mode === 'create' ? 'loan:new' : (initialData?.id || 'loan:edit')),
                  ocrStatus: docData.ocrStatus || 'pending',
                  ocrVendor: docData.ocrVendor || null,
                  ocrConfidence: docData.ocrConfidence || null,
                  ocrError: docData.ocrError || null,
                  extractedText: docData.extractedText || null,
                  textSha256: docData.textSha256 || null,
                  fileSha256: docData.fileSha256 || null,
                  deletedAt: null,
                  createdAt: docData.createdAt || new Date().toISOString(),
                  updatedAt: docData.updatedAt || new Date().toISOString(),
                  version: docData.version || 1,
                  // ⚠️ GARDE-FOU: Document existe côté serveur → ne pas purger comme orphelin
                  _remoteReady: true,
                };
                
                await db.Document.put(localDoc);
                console.log(`[LoanModalV2] ✅ Document ajouté dans IndexedDB: docId=${docData.id}, status=${localDoc.status}, documentTypeId=${localDoc.documentTypeId || 'null'}`);
              } catch (dbError) {
                console.error('[LoanModalV2] ❌ Erreur lors de l\'ajout du document dans IndexedDB:', dbError);
                // Ne pas bloquer, le document existe côté serveur et sera récupéré lors du pull
              }
            }
            
            // Recharger la liste des documents et liens
            await loadStagedDocuments(uploadSessionId);
            
            // Recharger aussi les liens vers documents existants
            try {
              const sessionResponse = await fetch(`/api/upload-session/${uploadSessionId}`);
              if (sessionResponse.ok) {
                const sessionData = await sessionResponse.json();
                if (sessionData.success) {
                  setStagedLinks(sessionData.DocumentLink || []);
                }
              }
            } catch (error) {
              console.error('Erreur lors du rechargement des liens:', error);
            }
            
            notify2.success(`Document "${file.name}" ajouté en brouillon`);
          }
        } else {
          let errorMessage = `Erreur lors de l'upload de "${file.name}"`;
          try {
            const errorData = await response.json();
            if (errorData?.error) {
              errorMessage = errorData.error;
            }
          } catch (err) {
            console.warn('Impossible de parser la réponse d\'erreur', err);
          }
          notify2.error(errorMessage);
        }
      } catch (error) {
        console.error('Erreur lors de l\'upload:', error);
        notify2.error(`Erreur lors de l'upload de "${file.name}"`);
      }
    }
  };

  // Fonction pour lier un document existant (doublon)
  const handleLinkExisting = async () => {
    if (!duplicateData || !uploadSessionId) return;

    try {
      const response = await fetch('/api/upload-staged/link-existing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uploadSessionId,
          existingDocumentId: duplicateData.id,
          context: {
            type: 'loan',
            tempKey: mode === 'create' ? 'loan:new' : (initialData?.id || 'loan:edit'),
            refId: mode === 'edit' ? initialData?.id : undefined
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Recharger la liste des documents et liens
          await loadStagedDocuments(uploadSessionId);
          
          try {
            const sessionResponse = await fetch(`/api/upload-session/${uploadSessionId}`);
            if (sessionResponse.ok) {
              const sessionData = await sessionResponse.json();
              if (sessionData.success) {
                setStagedLinks(sessionData.DocumentLink || []);
              }
            }
          } catch (error) {
            console.error('Erreur lors du rechargement des liens:', error);
          }
          
          notify2.success('Document lié avec succès');
          setShowDuplicateModal(false);
          setDuplicateData(null);
        }
      } else {
        notify2.error('Erreur lors de la liaison du document');
      }
    } catch (error) {
      console.error('Erreur lors de la liaison:', error);
      notify2.error('Erreur lors de la liaison du document');
    }
  };

  // Soumission du formulaire
  const onSubmitForm = async (data: LoanFormData) => {
    setIsSubmitting(true);
    try {
      // ✅ Utiliser filteredStagedDocuments pour éviter d'envoyer les documents déjà finalisés
      const stagedDocumentIds = filteredStagedDocuments.map(doc => doc.id);
      // ✅ Utiliser existingDocument.id pour les liens (comme dans TransactionModalV2)
      const stagedLinkItemIds = stagedLinks.map(link => link.existingDocument?.id || link.id);

      await onSubmit({
        ...data,
        id: initialData?.id,
        stagedDocumentIds,
        stagedLinkItemIds,
        borrowers,
      });

      // ✅ Recharger les documents liés si on est en mode édition
      // (les documents viennent d'être liés dans IndexedDB)
      if (mode === 'edit' && initialData?.id) {
        await loadLinkedDocuments(initialData.id);
      }

      // Nettoyer après succès
      reset();
      setBorrowers([]);
      clearStaging();
      setStagedLinks([]);
      onClose();
    } catch (error: any) {
      console.error('Erreur lors de la soumission:', error);
      notify2.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPropertyId = watch('propertyId');
  
  // Calculs automatiques (mensualité, date de fin, CRD)
  const principal = watch('principal') || 0;
  const annualRatePct = watch('annualRatePct') || 0;
  const durationMonths = watch('durationMonths') || 0;
  const defermentMonths = watch('defermentMonths') || 0;
  const insurancePct = watch('insurancePct') || 0;
  const startDate = watch('startDate');
  const paymentDay = watch('paymentDay');
  
  // Calculer la mensualité et la date de fin
  const [calculatedMonthlyPayment, setCalculatedMonthlyPayment] = useState<number | null>(null);
  const [calculatedEndDate, setCalculatedEndDate] = useState<string | null>(null);
  const [calculatedCRD, setCalculatedCRD] = useState<number | null>(null);
  
  useEffect(() => {
    if (principal > 0 && durationMonths > 0 && startDate) {
      try {
        const schedule = buildSchedule({
          principal,
          annualRatePct,
          durationMonths,
          defermentMonths,
          insurancePct,
          startDate: new Date(startDate),
          paymentDay: paymentDay || undefined,
        });
        
        if (schedule.length > 0) {
          // Mensualité (hors période de différé)
          const firstPaymentAfterDeferment = schedule.find(row => row.month > defermentMonths) || schedule[schedule.length - 1];
          setCalculatedMonthlyPayment(firstPaymentAfterDeferment.paymentTotal);
          
          // Date de fin
          const endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + durationMonths);
          // Si paymentDay est défini, ajuster le jour de la date de fin
          if (paymentDay) {
            const lastDayOfMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
            const adjustedDay = Math.min(paymentDay, lastDayOfMonth);
            endDate.setDate(adjustedDay);
          }
          setCalculatedEndDate(endDate.toLocaleDateString('fr-FR'));
          
          // CRD actuel (aujourd'hui)
          const today = new Date();
          const todayStr = paymentDay 
            ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
            : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
          const crd = crdAtDate(schedule, todayStr);
          setCalculatedCRD(crd);
        }
      } catch (error) {
        console.error('Erreur lors du calcul:', error);
        setCalculatedMonthlyPayment(null);
        setCalculatedEndDate(null);
        setCalculatedCRD(null);
      }
    } else {
      setCalculatedMonthlyPayment(null);
      setCalculatedEndDate(null);
      setCalculatedCRD(null);
    }
  }, [principal, annualRatePct, durationMonths, defermentMonths, insurancePct, startDate, paymentDay]);

  // Footer avec boutons
  const modalFooter = (
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 w-full">
      <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="w-full sm:w-auto">
        Annuler
      </Button>
      <Button type="submit" form="loan-form" disabled={isSubmitting} className="w-full sm:w-auto">
        {isSubmitting ? 'Enregistrement...' : mode === 'edit' ? 'Mettre à jour' : 'Créer'}
      </Button>
    </div>
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={title || (mode === 'edit' ? 'Modifier le prêt' : 'Nouveau prêt')}
        size="xl"
        className="md:max-w-[1000px]"
        footer={modalFooter}
      >
        {/* Structure sticky : header (dans Modal) + tabs sticky + content scrollable + footer (dans Modal) */}
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          {/* Description (optionnelle, affichée uniquement si nécessaire) */}
          {mode === 'create' && (
            <p className="text-sm text-gray-600 mb-4">
              Ajoutez un nouveau prêt immobilier à votre patrimoine
            </p>
          )}

          {/* Navigation des onglets - Sticky */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 -mx-4 md:-mx-6 px-4 md:px-6 overflow-x-hidden">
            <nav 
              className="flex space-x-4 md:space-x-8 overflow-x-auto -mb-px [&::-webkit-scrollbar]:hidden" 
              style={{ 
                scrollbarWidth: 'none', 
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab('informations')}
                className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'informations'
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Informations
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('co-emprunteurs')}
                className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'co-emprunteurs'
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Co-emprunteurs
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('documents')}
                className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'documents'
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Documents
              </button>
            </nav>
          </div>

          {/* Contenu scrollable */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden -mx-4 md:-mx-6 px-4 md:px-6">
            <form id="loan-form" onSubmit={handleSubmit(onSubmitForm)} className="space-y-6 pb-4">
              {activeTab === 'informations' && (
                <div className="space-y-4 md:space-y-6">
                  {/* Ligne 1 : Bien / Nom du prêt (2 colonnes) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Bien */}
                    <div className="space-y-2">
                      <Label htmlFor="propertyId">Bien *</Label>
                      <SmartSelect
                        value={selectedPropertyId}
                        onChange={(value) => setValue('propertyId', value)}
                        options={[
                          { value: '', label: 'Sélectionner un bien' },
                          ...properties.map((property): SmartSelectOption => ({
                            value: property.id,
                            label: property.name,
                          })),
                        ]}
                        placeholder="Sélectionner un bien"
                        error={!!errors.propertyId}
                        disabled={lockPropertyId}
                      />
                      {errors.propertyId && (
                        <p className="text-sm text-red-500">{errors.propertyId.message}</p>
                      )}
                    </div>

                    {/* Libellé */}
                    <div className="space-y-2">
                      <Label htmlFor="label">Nom du prêt *</Label>
                      <Input
                        id="label"
                        {...register('label')}
                        placeholder="Ex: Prêt immobilier principal"
                      />
                      {errors.label && (
                        <p className="text-sm text-red-500">{errors.label.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Ligne 2 : Type de prêt (plein) */}
                  <div className="space-y-2">
                    <Label htmlFor="loanType">Type de prêt</Label>
                    <SmartSelect
                      value={watch('loanType') || ''}
                      onChange={(value) => setValue('loanType', value)}
                      options={[
                        { value: '', label: 'Sélectionner un type' },
                        { value: 'IMMOBILIER', label: 'Prêt immobilier' },
                        { value: 'TRAVAUX', label: 'Prêt travaux' },
                        { value: 'PERSONNEL', label: 'Prêt personnel' },
                        { value: 'AUTRE', label: 'Autre' },
                      ]}
                      placeholder="Sélectionner un type"
                    />
                  </div>

                  {/* Ligne 3 : Type de remboursement / Profil d'amortissement (2 colonnes) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Type de remboursement */}
                    <div className="space-y-2">
                      <Label htmlFor="repaymentType">Type de remboursement</Label>
                      <SmartSelect
                        value={watch('repaymentType') || ''}
                        onChange={(value) => setValue('repaymentType', value)}
                        options={[
                          { value: '', label: 'Sélectionner un type' },
                          { value: 'CLASSIC', label: 'Prêt classique (remboursement progressif)' },
                          { value: 'IN_FINE', label: 'Prêt in fine' },
                        ]}
                        placeholder="Sélectionner un type"
                      />
                    </div>

                    {/* Profil d'amortissement */}
                    <div className="space-y-2">
                      <Label htmlFor="amortizationProfile">Profil d'amortissement</Label>
                      <SmartSelect
                        value={watch('amortizationProfile') || ''}
                        onChange={(value) => setValue('amortizationProfile', value)}
                        options={[
                          { value: '', label: 'Sélectionner un profil' },
                          { value: 'CONSTANT_PAYMENT', label: 'Mensualités constantes (annuité classique)' },
                          { value: 'CONSTANT_AMORTIZATION', label: 'Amortissement constant (mensualités dégressives)' },
                        ]}
                        placeholder="Sélectionner un profil"
                      />
                    </div>
                  </div>

                  {/* Ligne 4 : Capital / Taux (2 colonnes) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Capital */}
                    <div className="space-y-2">
                      <Label htmlFor="principal">Capital emprunté (€) *</Label>
                      <Input
                        id="principal"
                        type="number"
                        step="0.01"
                        {...register('principal', { valueAsNumber: true })}
                        placeholder="200000"
                      />
                      {errors.principal && (
                        <p className="text-sm text-red-500">{errors.principal.message}</p>
                      )}
                    </div>

                    {/* Taux annuel */}
                    <div className="space-y-2">
                      <Label htmlFor="annualRatePct">Taux annuel (%) *</Label>
                      <Input
                        id="annualRatePct"
                        type="number"
                        step="0.001"
                        {...register('annualRatePct', { valueAsNumber: true })}
                        placeholder="1.5"
                      />
                      {errors.annualRatePct && (
                        <p className="text-sm text-red-500">{errors.annualRatePct.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Ligne 5 : Durée / Différé (2 colonnes) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Durée */}
                    <div className="space-y-2">
                      <Label htmlFor="durationMonths">Durée (mois) *</Label>
                      <Input
                        id="durationMonths"
                        type="number"
                        {...register('durationMonths', { valueAsNumber: true })}
                        placeholder="240"
                      />
                      {errors.durationMonths && (
                        <p className="text-sm text-red-500">{errors.durationMonths.message}</p>
                      )}
                    </div>

                    {/* Différé */}
                    <div className="space-y-2">
                      <Label htmlFor="defermentMonths">Différé (mois)</Label>
                      <Input
                        id="defermentMonths"
                        type="number"
                        {...register('defermentMonths', { valueAsNumber: true })}
                        placeholder="0"
                      />
                      {errors.defermentMonths && (
                        <p className="text-sm text-red-500">{errors.defermentMonths.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Ligne 6 : Assurance / Frais de dossier (2 colonnes) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Assurance */}
                    <div className="space-y-2">
                      <Label htmlFor="insurancePct">Assurance (%/an)</Label>
                      <Input
                        id="insurancePct"
                        type="number"
                        step="0.001"
                        {...register('insurancePct', { 
                          setValueAs: (v) => v === '' || v === null ? null : parseFloat(v),
                        })}
                        placeholder="0.35"
                      />
                      {errors.insurancePct && (
                        <p className="text-sm text-red-500">{errors.insurancePct.message}</p>
                      )}
                    </div>

                    {/* Frais de dossier */}
                    <div className="space-y-2">
                      <Label htmlFor="feesUpfront">Frais de dossier (€)</Label>
                      <Input
                        id="feesUpfront"
                        type="number"
                        step="0.01"
                        {...register('feesUpfront', { 
                          setValueAs: (v) => v === '' || v === null ? null : parseFloat(v),
                        })}
                        placeholder="1000"
                      />
                      {errors.feesUpfront && (
                        <p className="text-sm text-red-500">{errors.feesUpfront.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Ligne 7 : Date de début / Jour paiement (2 colonnes) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Date de début */}
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Date de début *</Label>
                      <SmartDatePicker
                        id="startDate"
                        value={watch('startDate') || ''}
                        onChange={(value) => setValue('startDate', value)}
                        placeholder="Sélectionner une date"
                        error={!!errors.startDate}
                        aria-label="Date de début"
                      />
                      {errors.startDate && (
                        <p className="text-sm text-red-500">{errors.startDate.message}</p>
                      )}
                    </div>

                    {/* Jour de paiement */}
                    <div className="space-y-2">
                      <Label htmlFor="paymentDay">Jour de paiement du mois</Label>
                      <Input
                        id="paymentDay"
                        type="number"
                        min="1"
                        max="31"
                        {...register('paymentDay', { 
                          setValueAs: (v) => v === '' || v === null ? null : parseInt(v),
                        })}
                        placeholder="5"
                      />
                      {errors.paymentDay && (
                        <p className="text-sm text-red-500">{errors.paymentDay.message}</p>
                      )}
                      <p className="text-xs text-gray-500">Si non renseigné, le jour de la date de début sera utilisé</p>
                    </div>
                  </div>

                  {/* Calculs automatiques - Badges informatifs */}
                  {(calculatedMonthlyPayment !== null || calculatedEndDate !== null || calculatedCRD !== null) && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Info className="h-5 w-5 text-orange-600" />
                        <h4 className="text-sm font-medium text-orange-900">Calculs automatiques</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {calculatedMonthlyPayment !== null && (
                          <div className="bg-white rounded-md p-3 border border-orange-200">
                            <p className="text-xs text-orange-700 mb-1">Mensualité</p>
                            <p className="text-lg font-semibold text-orange-900">
                              {calculatedMonthlyPayment.toFixed(2)} €
                            </p>
                          </div>
                        )}
                        {calculatedEndDate !== null && (
                          <div className="bg-white rounded-md p-3 border border-orange-200">
                            <p className="text-xs text-orange-700 mb-1">Date de fin</p>
                            <p className="text-lg font-semibold text-orange-900">
                              {calculatedEndDate}
                            </p>
                          </div>
                        )}
                        {calculatedCRD !== null && (
                          <div className="bg-white rounded-md p-3 border border-orange-200">
                            <p className="text-xs text-orange-700 mb-1">Capital restant dû</p>
                            <p className="text-lg font-semibold text-orange-900">
                              {calculatedCRD.toFixed(2)} €
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes : pleine largeur */}
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <textarea
                      id="notes"
                      {...register('notes')}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none focus:ring-0 focus:border-orange-500 transition-colors overflow-x-hidden"
                      placeholder="Notes additionnelles sur ce prêt..."
                    />
                  </div>

                  {/* Actif */}
                  <div className="flex items-center space-x-2">
                    <input
                      id="isActive"
                      type="checkbox"
                      {...register('isActive')}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="isActive" className="font-normal">
                      Prêt actif
                    </Label>
                  </div>
                </div>
              )}

              {activeTab === 'co-emprunteurs' && (
                <div className="space-y-4 md:space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="mt-4">
                      <h3 className="text-lg font-medium text-gray-900">Co-emprunteurs</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Gérez les co-emprunteurs associés à ce prêt
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddBorrower}
                      className="h-10 w-10 p-0 flex items-center justify-center rounded-md"
                      title="Ajouter un co-emprunteur"
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>

                  {borrowers.length > 0 ? (
                    <div className="space-y-3">
                      {borrowers.map((borrower, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg overflow-x-hidden">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900 truncate">
                              {borrower.firstName} {borrower.lastName}
                            </p>
                            <div className="text-sm text-gray-500 mt-1 truncate">
                              {borrower.email && <span>{borrower.email}</span>}
                              {borrower.phone && <span className="ml-2">{borrower.phone}</span>}
                              {borrower.responsibilityPct && (
                                <span className="ml-2">• {borrower.responsibilityPct}%</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditBorrower(borrower)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteBorrower(borrower)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 md:py-16 text-gray-500">
                      <UserPlus className="h-12 w-12 mb-4 text-gray-300" />
                      <p className="text-sm font-medium">Aucun co-emprunteur</p>
                      <p className="text-xs mt-1 text-center max-w-xs">Cliquez sur le bouton ci-dessous pour en ajouter</p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddBorrower}
                        className="h-10 w-10 p-0 flex items-center justify-center rounded-md mt-4"
                        title="Ajouter un co-emprunteur"
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'documents' && (
                <div className="space-y-4 md:space-y-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Documents liés</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Ajoutez des documents justificatifs à ce prêt
                      </p>
                    </div>
                    {/* Boutons - Mobile: empilés verticalement, Desktop: en ligne */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                      {/* Bouton secondaire - Lier un document existant */}
                      <button
                        type="button"
                        onClick={() => {
                          if (!organizationId) {
                            notify2.error('Organisation non disponible');
                            return;
                          }
                          setShowDocumentSelectorModal(true);
                        }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 h-10 text-xs sm:text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none w-full sm:w-auto"
                        disabled={stagingLoading || !organizationId}
                      >
                        <Link className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="font-medium">Lier</span>
                        <span className="hidden sm:inline">un document existant</span>
                      </button>
                      
                      {/* Bouton principal - Ajouter des documents */}
                      <button
                        type="button"
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
                        className="relative flex items-center justify-center gap-1.5 px-3 py-2 h-10 text-xs sm:text-sm bg-orange-600 text-white rounded-lg transition-all duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none overflow-hidden group w-full sm:w-auto"
                        disabled={stagingLoading}
                      >
                        <span className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out"></span>
                        <Upload className="h-3.5 w-3.5 relative z-10 flex-shrink-0" />
                        <span className="relative z-10 font-medium">
                          {stagingLoading ? 'Chargement...' : (
                            <>
                              <span>Ajouter</span>
                              <span className="hidden sm:inline"> des documents</span>
                            </>
                          )}
                        </span>
                      </button>
                    </div>
                  </div>

                  {(filteredStagedDocuments.length > 0 || stagedLinks.length > 0 || linkedDocuments.length > 0) ? (
                    <div className="space-y-3">
                      {/* Documents en staging (brouillon) */}
                      {filteredStagedDocuments.map((doc) => {
                        const documentType = String(doc.type || 'Type inconnu');
                        const isUnclassified = documentType === 'Non classé' || documentType === 'Type inconnu';
                        
                        return (
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
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(`/api/documents/${doc.id}/file`, '_blank')}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  await removeStagedDocument(doc.id);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}

                      {/* Liens vers documents existants */}
                      {stagedLinks.map((link) => (
                        <div key={link.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Link className="h-5 w-5 text-gray-600" />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-gray-900">{link.existingDocument?.fileName || link.existingDocument?.filename}</p>
                                <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700">
                                  Lien existant
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-500">
                                {link.existingDocument?.typeLabel || 'Type inconnu'} • {new Date(link.existingDocument?.uploadedAt || link.createdAt).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                window.open(`/api/documents/${link.existingDocument?.id}/file`, '_blank');
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
                                    const response = await fetch(`/api/upload-staged-item/${link.id}`, {
                                      method: 'DELETE'
                                    });
                                    
                                    if (response.ok) {
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
                      {linkedDocuments.map((doc) => {
                        // Support des deux formats : API (DocumentType.label) et App Shell (documentTypeLabel)
                        const documentType = String(
                          doc.DocumentType?.label || 
                          doc.documentTypeLabel || 
                          'Type inconnu'
                        );
                        const isUnclassified = documentType === 'Non classé' || documentType === 'Type inconnu';
                        const isDraft = doc.status === 'draft';
                        
                        return (
                          <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-gray-500" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">{doc.fileName || doc.filename || doc.filenameOriginal}</p>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
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
                                </div>
                                {/* Affichage des liaisons */}
                                {(() => {
                                  const links = formatDocumentLinks(doc);
                                  return links ? (
                                    <div className="mt-1 flex items-center gap-1">
                                      <Link className="h-3 w-3 text-gray-500" />
                                      <span className="text-xs text-gray-600 font-medium">
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
                                onClick={() => window.open(`/api/documents/${doc.id}/file`, '_blank')}
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
                    <div className="flex flex-col items-center justify-center py-12 md:py-16 text-gray-500">
                      <FileText className="h-12 w-12 mb-4 text-gray-300" />
                      <p className="text-sm font-medium">Aucun document lié à ce prêt</p>
                      <p className="text-xs mt-1 text-center max-w-xs">Cliquez sur "Ajouter des documents" pour en associer</p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
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
                        className="flex items-center gap-2 mt-4"
                        disabled={stagingLoading}
                      >
                        <Upload className="h-4 w-4" />
                        {stagingLoading ? 'Chargement...' : 'Ajouter des documents'}
                      </Button>
                    </div>
                  )}

                  {/* Information sur le contexte */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-gray-600 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-900 font-medium">
                          Contexte de liaison automatique
                        </p>
                        <p className="text-xs text-gray-700 mt-1">
                          Les documents uploadés seront automatiquement liés à ce prêt.
                          Ils seront également associés au bien sélectionné.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      </Modal>

      {/* Modal pour ajouter/modifier un co-emprunteur */}
      <Modal
        isOpen={showBorrowerModal}
        onClose={() => setShowBorrowerModal(false)}
        title={editingBorrower ? 'Modifier le co-emprunteur' : 'Ajouter un co-emprunteur'}
        size="md"
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 w-full">
            <Button type="button" variant="outline" onClick={() => setShowBorrowerModal(false)} className="w-full sm:w-auto">
              Annuler
            </Button>
            <Button type="button" onClick={handleSaveBorrower} className="w-full sm:w-auto">
              {editingBorrower ? 'Modifier' : 'Ajouter'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 overflow-x-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="borrowerFirstName">Prénom *</Label>
              <Input
                id="borrowerFirstName"
                value={borrowerFormData.firstName}
                onChange={(e) => setBorrowerFormData(prev => ({ ...prev, firstName: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="borrowerLastName">Nom *</Label>
              <Input
                id="borrowerLastName"
                value={borrowerFormData.lastName}
                onChange={(e) => setBorrowerFormData(prev => ({ ...prev, lastName: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="borrowerBirthDate">Date de naissance</Label>
            <SmartDatePicker
              id="borrowerBirthDate"
              value={borrowerFormData.birthDate || ''}
              onChange={(value) => setBorrowerFormData(prev => ({ ...prev, birthDate: value || null }))}
              placeholder="Sélectionner une date"
              aria-label="Date de naissance"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="borrowerEmail">Email</Label>
              <Input
                id="borrowerEmail"
                type="email"
                value={borrowerFormData.email || ''}
                onChange={(e) => setBorrowerFormData(prev => ({ ...prev, email: e.target.value || null }))}
              />
            </div>
            <div>
              <Label htmlFor="borrowerPhone">Téléphone</Label>
              <Input
                id="borrowerPhone"
                type="tel"
                value={borrowerFormData.phone || ''}
                onChange={(e) => setBorrowerFormData(prev => ({ ...prev, phone: e.target.value || null }))}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="borrowerResponsibilityPct">Part de responsabilité (%)</Label>
            <Input
              id="borrowerResponsibilityPct"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={borrowerFormData.responsibilityPct || ''}
              onChange={(e) => setBorrowerFormData(prev => ({ ...prev, responsibilityPct: e.target.value ? parseFloat(e.target.value) : null }))}
            />
          </div>
        </div>
      </Modal>

      {/* Modals pour les documents */}
      {/* Modale de review-draft pour modifier les documents en brouillon */}
      <UploadReviewModal
        isOpen={showReviewDraftModal}
        onClose={() => {
          setShowReviewDraftModal(false);
          setSelectedDraftId(null);
        }}
        files={[]} // Pas de fichiers pour le mode review-draft
        scope="global"
        mode="transaction"
        strategy={{
          mode: 'review-draft',
          draftId: selectedDraftId || undefined,
          onStagedUpdate: async () => {
            // Recharger la liste des documents en staging
            if (uploadSessionId) {
              await loadStagedDocuments(uploadSessionId);
            }
          }
        }}
      />

      {duplicateData && (
        <DuplicateDetectedModal
          isOpen={showDuplicateModal}
          onClose={() => {
            setShowDuplicateModal(false);
            setDuplicateData(null);
          }}
          existing={duplicateData}
          onLink={handleLinkExisting}
        />
      )}

      {/* Modal de confirmation de suppression de document */}
      {documentToDelete && (
        <ConfirmDeleteDocumentModal
          isOpen={showDeleteDocModal}
          onClose={() => {
            if (!isDeletingDocument) {
              setShowDeleteDocModal(false);
              setDocumentToDelete(null);
            }
          }}
          onConfirm={async (deleteMode: 'all' | 'transaction-links-only') => {
            if (!documentToDelete || !organizationId) return;
            
            setIsDeletingDocument(true);
            
            try {
              // Vérifier si c'est un document en staging (brouillon) ou un document lié
              const isStagedDocument = filteredStagedDocuments.some(doc => doc.id === documentToDelete.id);
              const isLinkedDocument = (isAppShellMode ? hookLinkedDocuments : linkedDocuments).some(doc => doc.id === documentToDelete.id);
              
              if (isStagedDocument) {
                // Supprimer un document en staging
                // ⚠️ CRITIQUE: En mode app-shell, supprimer aussi le document de IndexedDB et créer une pendingOp
                if (isAppShellMode && organizationId) {
                  try {
                    const { IndexedDBDocumentRepository } = await import('@/domain/repositories/adapters/IndexedDBDocumentRepository');
                    const documentRepo = new IndexedDBDocumentRepository();
                    
                    // Vérifier si le document existe dans IndexedDB
                    const db = await getLocalDB();
                    const existingDoc = await db.Document.get(documentToDelete.id);
                    
                    if (existingDoc) {
                      // ⚠️ CRITIQUE: Supprimer d'abord tous les DocumentLink associés au document
                      const allLinks = await db.DocumentLink
                        .where('documentId')
                        .equals(documentToDelete.id)
                        .toArray();
                      
                      // Supprimer chaque lien de IndexedDB et créer une pendingOp
                      const now = new Date().toISOString();
                      for (const link of allLinks) {
                        await db.DocumentLink.delete([link.documentId, link.linkedType, link.linkedId]);
                        
                        // Créer une pendingOp pour chaque lien supprimé
                        const linkEntityId = `${link.documentId}-${link.linkedType}-${link.linkedId}`;
                        const existingLinkPendingOp = await db.pendingOperations
                          .where('[entity+entityId+operation]')
                          .equals(['documentLink', linkEntityId, 'delete'])
                          .first();
                        
                        if (!existingLinkPendingOp) {
                          await db.pendingOperations.add({
                            id: crypto.randomUUID(),
                            organizationId,
                            entity: 'documentLink',
                            entityId: linkEntityId,
                            operation: 'delete',
                            payload: {
                              documentId: link.documentId,
                              linkedType: link.linkedType,
                              linkedId: link.linkedId,
                            },
                            status: 'pending',
                            error: null,
                            createdAt: now,
                            updatedAt: now,
                          });
                        }
                      }
                      
                      // Supprimer de IndexedDB (créera automatiquement une pendingOp)
                      await documentRepo.delete(documentToDelete.id, organizationId);
                      console.log(`[LoanModalV2] ✅ Document supprimé de IndexedDB: docId=${documentToDelete.id}, pendingOp créée`);
                      
                      // Déclencher un refresh de la page Documents si elle est ouverte
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('documents:refresh'));
                        window.dispatchEvent(new CustomEvent('loans:refresh'));
                      }
                    }
                  } catch (dbError) {
                    console.error(`[LoanModalV2] ❌ Erreur lors de la suppression du document dans IndexedDB: ${dbError}`);
                    // Continuer quand même avec la suppression du staging
                  }
                }
                
                // Supprimer du staging (état React + API si online)
                const success = await removeStagedDocument(documentToDelete.id);
                if (success) {
                  console.log(`[LoanModalV2] ✅ Document supprimé du staging: docId=${documentToDelete.id}`);
                  
                  // Rafraîchir les stagedDocuments
                  if (uploadSessionId) {
                    try {
                      await loadStagedDocuments(uploadSessionId);
                    } catch (error) {
                      // Erreur silencieuse lors du rechargement
                    }
                  }
                  
                  notify2.success('Document supprimé');
                  
                  // Fermer la modal après la suppression réussie
                  setShowDeleteDocModal(false);
                  setDocumentToDelete(null);
                } else {
                  notify2.error('Erreur lors de la suppression du document');
                }
              } else if (isLinkedDocument) {
                // Supprimer un document lié (déjà finalisé)
                if (deleteMode === 'transaction-links-only' && initialData?.id) {
                  // ⚠️ NOTE: Pour les prêts, on utilise 'loan-links-only' mais la modal utilise 'transaction-links-only'
                  // On adapte pour les prêts
                  // Supprimer uniquement les liaisons avec ce prêt
                  if (isAppShellMode && organizationId) {
                    // Mode app-shell : supprimer les DocumentLink depuis IndexedDB
                    const db = await getLocalDB();
                    const linksToDelete = await db.DocumentLink
                      .where('documentId')
                      .equals(documentToDelete.id)
                      .filter(link => {
                        const linkedType = (link.linkedType || '').toLowerCase();
                        return linkedType === 'loan' && link.linkedId === initialData.id;
                      })
                      .toArray();
                    
                    // Supprimer chaque lien
                    for (const link of linksToDelete) {
                      await db.DocumentLink.delete([link.documentId, link.linkedType, link.linkedId]);
                    }
                    
                    // Créer une pendingOp pour chaque lien supprimé
                    const now = new Date().toISOString();
                    for (const link of linksToDelete) {
                      await db.pendingOperations.add({
                        id: crypto.randomUUID(),
                        organizationId,
                        entity: 'documentLink',
                        entityId: `${link.documentId}-${link.linkedType}-${link.linkedId}`,
                        operation: 'delete',
                        payload: {
                          documentId: link.documentId,
                          linkedType: link.linkedType,
                          linkedId: link.linkedId,
                        },
                        status: 'pending',
                        error: null,
                        createdAt: now,
                        updatedAt: now,
                      });
                    }
                    
                    // Rafraîchir les documents liés
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('documents:refresh'));
                      window.dispatchEvent(new CustomEvent('loans:refresh'));
                    }
                    
                    notify2.success('Liaisons avec ce prêt supprimées. La suppression sera synchronisée avec le serveur lors de la prochaine synchronisation.');
                  } else {
                    // Mode normal : utiliser l'API pour supprimer chaque lien
                    // L'API utilise le format /api/documents/{documentId}/links/{linkedType}:{linkedId}
                    const linkId = `loan:${initialData.id}`;
                    const response = await fetch(`/api/documents/${documentToDelete.id}/links/${linkId}`, {
                      method: 'DELETE'
                    });
                    
                    if (!response.ok) {
                      const errorData = await response.json().catch(() => ({}));
                      throw new Error(errorData.error || 'Erreur lors de la suppression des liaisons');
                    }
                    
                    // Recharger les documents liés
                    if (initialData.id) {
                      await loadLinkedDocuments(initialData.id);
                    }
                    
                    notify2.success('Liaisons avec ce prêt supprimées avec succès');
                  }
                } else {
                  // Supprimer le document et toutes ses liaisons
                  if (isAppShellMode && organizationId) {
                    // Mode app-shell : utiliser DocumentService
                    const documentService = createDocumentServiceWithMode('app-shell');
                    
                    // ⚠️ CRITIQUE: Supprimer d'abord tous les DocumentLink associés au document
                    const db = await getLocalDB();
                    const allLinks = await db.DocumentLink
                      .where('documentId')
                      .equals(documentToDelete.id)
                      .toArray();
                    
                    // Supprimer chaque lien de IndexedDB et créer une pendingOp
                    const now = new Date().toISOString();
                    for (const link of allLinks) {
                      await db.DocumentLink.delete([link.documentId, link.linkedType, link.linkedId]);
                      
                      // Créer une pendingOp pour chaque lien supprimé
                      const pendingOp = {
                        id: crypto.randomUUID(),
                        organizationId,
                        entity: 'documentLink',
                        entityId: `${link.documentId}-${link.linkedType}-${link.linkedId}`,
                        operation: 'delete',
                        payload: {
                          documentId: link.documentId,
                          linkedType: link.linkedType,
                          linkedId: link.linkedId,
                        },
                        status: 'pending',
                        error: null,
                        createdAt: now,
                        updatedAt: now,
                      };
                      await db.pendingOperations.add(pendingOp);
                    }
                    
                    // Supprimer le document (créera automatiquement une pendingOp)
                    await documentService.deleteDocument(documentToDelete.id, organizationId);
                    
                    // ⚠️ En mode app-shell online : push → pull → refresh (comme DocumentsPageCore)
                    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
                    if (isOnline) {
                      try {
                        const { getGlobalSyncService } = await import('@/lib/offline/syncGlobal');
                        const syncService = getGlobalSyncService();
                        await syncService.syncAllPendingToRemote(organizationId);
                        // Pull immédiat pour mettre à jour IndexedDB
                        await syncService.syncEntityFromRemoteByName('document', organizationId);
                        await syncService.syncEntityFromRemoteByName('documentLink', organizationId);
                        window.dispatchEvent(new CustomEvent('sync:refresh'));
                      } catch (syncError) {
                        console.warn('[LoanModalV2] Erreur lors du sync après suppression:', syncError);
                        // Ne pas bloquer l'opération si la sync échoue
                      }
                    }
                    
                    // Rafraîchir les documents liés
                    // En mode app-shell, le hook useLoanDocuments se rafraîchira automatiquement via les événements
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('documents:refresh'));
                      window.dispatchEvent(new CustomEvent('loans:refresh'));
                    }
                    
                    notify2.success(
                      isOnline 
                        ? 'Document supprimé avec succès'
                        : 'Document supprimé localement. La suppression sera synchronisée avec le serveur lors de la prochaine synchronisation.'
                    );
                  } else {
                    // Mode normal : utiliser l'API
                    const response = await fetch(`/api/documents/${documentToDelete.id}`, {
                      method: 'DELETE'
                    });
                    
                    if (!response.ok) {
                      const errorData = await response.json().catch(() => ({}));
                      throw new Error(errorData.error || 'Erreur lors de la suppression du document');
                    }
                    
                    // Recharger les documents liés
                    if (initialData?.id) {
                      await loadLinkedDocuments(initialData.id);
                    }
                    
                    notify2.success('Document supprimé avec succès');
                  }
                }
              }
              
              // Fermer la modal et réinitialiser
              setShowDeleteDocModal(false);
              setDocumentToDelete(null);
            } catch (error: any) {
              console.error('[LoanModalV2] Erreur lors de la suppression du document:', error);
              notify2.error(error.message || 'Erreur lors de la suppression du document');
            } finally {
              setIsDeletingDocument(false);
            }
          }}
          documentId={documentToDelete.id}
          documentName={documentToDelete.fileName || documentToDelete.filenameOriginal || documentToDelete.name}
          mode={isAppShellMode ? 'app-shell' : 'normal'}
          organizationId={organizationId}
          isDeleting={isDeletingDocument}
          loanId={initialData?.id} // ✅ Passer loanId pour identifier les liaisons à supprimer
        />
      )}

      <LinkExistingDocumentModal
        isOpen={showDocumentSelectorModal}
        onClose={() => setShowDocumentSelectorModal(false)}
        onSelect={(doc) => {
          const newLink = {
            id: doc.id,
            existingDocument: {
              id: doc.id,
              fileName: doc.fileName || doc.filenameOriginal,
              filenameOriginal: doc.filenameOriginal,
              typeLabel: doc.typeLabel,
              uploadedAt: doc.uploadedAt,
              type: doc.typeLabel,
            },
          };
          setStagedLinks((prev) => [...prev, newLink]);
          notify2.success('Document ajouté');
          setShowDocumentSelectorModal(false);
        }}
        excludeDocumentIds={stagedLinks.map((link) => link.existingDocument?.id).filter(Boolean) as string[]}
        mode={isAppShellMode ? 'app-shell' : 'normal'}
      />
    </>
  );
};


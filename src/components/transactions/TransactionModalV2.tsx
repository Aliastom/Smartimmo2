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
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';
import { getLeaseRepositoryOffline } from '@/lib/offline/repositories/LeaseRepositoryOffline';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';
import { getLocalDB } from '@/lib/offline/db';
import { useTransactionDocuments } from '@/hooks/offline/useTransactionDocuments';
import { createDocumentServiceWithMode } from '@/domain/services/documentServiceFactory';
import { useUploadReviewModal } from '@/contexts/UploadReviewModalContext';
import { useUploadStaging } from '@/hooks/useUploadStaging';
import { useGestionDelegueStatus } from '@/hooks/useGestionDelegueStatus';
import { useGestionCodes } from '@/hooks/useGestionCodes';
import { logToServer } from '@/lib/utils/logger';
import { StagedUploadModal } from '@/components/documents/StagedUploadModal';
import { UploadReviewModal } from '@/components/documents/UploadReviewModal';
import { DuplicateDetectedModal } from '@/components/documents/DuplicateDetectedModal';
import { ConfirmDeleteDocumentModal } from '@/components/documents/ConfirmDeleteDocumentModal';
import { UnclassifiedDocumentsModal } from './UnclassifiedDocumentsModal';
import { TransactionSuggestionConfirmModal } from './TransactionSuggestionConfirmModal';
import { LinkExistingDocumentModal } from '@/components/documents/LinkExistingDocumentModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { SearchableSelect } from '@/components/forms/SearchableSelect';
import { SmartSelect, SmartSelectOption } from '@/components/ui/SmartSelect';
import { SmartDatePicker } from '@/components/ui/SmartDatePicker';
import { SmartSelectAdvanced } from '@/components/ui/SmartSelectAdvanced';
import { Switch } from '@/components/ui/Switch';
import { Accordion } from '@/components/ui/Accordion';
import { ModalSubmitOverlay } from '@/components/ui/ModalSubmitOverlay';
import { useModalSubmitFlow } from '@/hooks/useModalSubmitFlow';

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
  const {
    submitStep,
    submitError,
    startValidation,
    startSaving,
    markDone,
    markError,
    reset: resetSubmitFlow,
  } = useModalSubmitFlow();
  const lastSubmitPayloadRef = React.useRef<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  // ⚠️ PROBLÈME 1: État pour suivre les fichiers en cours d'upload
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  
  // États pour les données
  const [properties, setProperties] = useState<any[]>([]);
  const [leases, setLeases] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [natures, setNatures] = useState<any[]>([]);
  
  // État local pour gérer le mode auto du montant
  const [isAutoAmount, setIsAutoAmount] = useState(true);
  
  // État pour la nature (simplifié avec SmartSelectAdvanced)
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
  
  // État pour la modal de sélection de document existant
  const [showDocumentSelectorModal, setShowDocumentSelectorModal] = useState(false);

  // Hook pour récupérer les libellés personnalisés des natures
  const { getNatureLabel, loading: natureLabelsLoading } = useNatureLabels();
  
  // Hook pour récupérer l'organisation (nécessaire pour mode app-shell)
  const { organizationId } = useCurrentOrganization();
  
  // ✅ Détecter si on est en mode app-shell : soit via context.type === 'property', soit via l'URL
  // (UploadReviewModal passe context.type='global' mais on est bien en app-shell)
  const isAppShellMode = context.type === 'property' || 
    (typeof window !== 'undefined' && window.location.pathname.startsWith('/app'));
  
  // ✅ OFFLINE-FIRST: Détecter explicitement offline
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const shouldDisableUpload = isAppShellMode && isOffline;
  
  // 🔍 Diagnostic : logger pour vérifier la détection du mode
  useEffect(() => {
    if (isOpen) {
      logToServer(`[TransactionModal] 🔍 Mode detection: isAppShellMode=${isAppShellMode}, contextType=${context.type}, mode=${mode}`).catch(console.error);
    }
  }, [isOpen, isAppShellMode, context.type, context.propertyId, organizationId, mode, transactionId]);
  
  // En mode app-shell, utiliser le hook pour charger les documents depuis IndexedDB
  const { 
    documents: hookLinkedDocuments, 
    loading: documentsLoading,
    hasMissingDocuments 
  } = useTransactionDocuments(
    isAppShellMode && mode === 'edit' ? transactionId : null,
    isAppShellMode && mode === 'edit' && isOpen
  );
  
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

  // ⚠️ IMPORTANT: État pour les documents liés à la transaction (en mode édition)
  // Doit être déclaré AVANT le useMemo qui l'utilise
  const [linkedDocuments, setLinkedDocuments] = useState<any[]>([]);
  
  // Hook pour vérifier le statut de la gestion déléguée (depuis settings)
  const { isEnabled: isGestionEnabled, isLoading: isGestionLoading } = useGestionDelegueStatus();
  
  // Hook pour récupérer les codes système de la gestion déléguée
  const { codes: gestionCodes, isLoading: isGestionCodesLoading } = useGestionCodes();

  // ⚠️ CORRECTION: Filtrer les stagedDocuments pour exclure ceux qui sont déjà finalisés ou liés à la transaction
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
      // Ne PAS exclure les brouillons même s'ils sont liés à la transaction
      if (doc.status && doc.status !== 'draft') {
        return false;
      }
      return true;
    });
  }, [stagedDocuments]);
  
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
  const [isDeletingDocument, setIsDeletingDocument] = useState(false);
  
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
  // En édition : éviter que le recalcul auto écrase le montant persisté au premier rendu
  const editInitialLoadDoneRef = React.useRef(false);
  
  // États pour indiquer qu'un document existe déjà en brouillon
  const [showDraftExistsModal, setShowDraftExistsModal] = useState(false);
  const [draftExistsData, setDraftExistsData] = useState<{
    documentId: string;
    fileName: string;
  } | null>(null);
  
  // Fonction pour gérer l'upload avec détection de doublons
  const handleFileUpload = async (files: File[]) => {
    await logToServer(`[TransactionModal] handleFileUpload appelé avec: ${files.length} fichier(s)`);
    
    if (!uploadSessionId) {
      notify2.error('Session d\'upload non disponible');
      return;
    }

    // ⚠️ PROBLÈME 1: Marquer tous les fichiers comme en cours d'upload
    const fileIds = files.map(f => `${f.name}-${f.size}-${f.lastModified}`);
    setUploadingFiles(prev => new Set([...prev, ...fileIds]));

    for (const file of files) {
      const fileId = `${file.name}-${file.size}-${file.lastModified}`;
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('uploadSessionId', uploadSessionId);
        formData.append('intendedContextType', 'transaction');
        formData.append('intendedContextTempKey', mode === 'create' ? 'transaction:new' : 'transaction:edit');

        // ⚠️ GARDE-FOU 2 : Upload de documents = ONLINE-ONLY (pas de placeholder offline)
        // Si offline : bloquer l'upload pour éviter de créer des données non syncables
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          await logToServer('[TransactionModal] ⚠️ GARDE-FOU 2: Hors ligne : upload de documents bloqué (ONLINE-ONLY)');
          notify2.info('Upload de documents disponible uniquement en mode connecté');
          setUploadingFiles(prev => {
            const next = new Set(prev);
            fileIds.forEach(id => next.delete(id));
            return next;
          });
          return;
        }

        const response = await fetch('/api/upload-staged', {
          method: 'POST',
          body: formData
        });

        if (response.status === 409) {
          // Doublon détecté
          const duplicateInfo = await response.json();
          // ⚠️ CORRECTION: Retirer le fichier de uploadingFiles car il n'y a pas d'upload réellement en cours (doublon détecté)
          setUploadingFiles(prev => {
            const next = new Set(prev);
            next.delete(fileId);
            return next;
          });
          setDuplicateData(duplicateInfo);
          setShowDuplicateModal(true);
          return; // Arrêter l'upload des autres fichiers
        } else if (response.ok) {
          // Upload réussi
          const result = await response.json();
          if (result.success) {
            // ⚠️ PROBLÈME 1: Retirer le fichier de la liste des fichiers en upload
            setUploadingFiles(prev => {
              const next = new Set(prev);
              next.delete(fileId);
              return next;
            });
            
            // ⚠️ IMPORTANT: En mode app-shell, ajouter le document dans IndexedDB pour qu'il soit disponible lors de la création de la transaction
            if (isAppShellMode && result.document && organizationId) {
              try {
                const db = await getLocalDB();
                const docData = result.document;
                
                // Créer le document local dans IndexedDB au format LocalDocument
                // ⚠️ GARDE-FOU 1: Marquer _remoteReady=true car le document existe déjà côté serveur
                // Ce flag empêche la purge involontaire comme brouillon orphelin
                // ⚠️ PROBLÈME 4: S'assurer que le nom du document est défini (peut être manquant si upload trop rapide)
                const fileName = docData.fileName || docData.filenameOriginal || docData.name || `document_${docData.id}`;
                const filenameOriginal = docData.filenameOriginal || docData.fileName || docData.name || fileName;
                const localDoc: any = {
                  id: docData.id,
                  organizationId: organizationId,
                  ownerId: docData.ownerId || 'default',
                  bucketKey: docData.bucketKey || docData.id,
                  filenameOriginal: filenameOriginal,
                  fileName: fileName,
                  mime: docData.mime || 'application/pdf',
                  size: docData.size || 0,
                  url: docData.url || `/api/documents/${docData.id}/file`,
                  fileSha256: docData.fileSha256 || null,
                  textSha256: docData.textSha256 || null,
                  // ⚠️ CRITIQUE: Utiliser les champs retournés par l'API (documentTypeId peut être auto-assigné)
                  documentTypeId: docData.documentTypeId || null,
                  detectedTypeId: docData.detectedTypeId || null,
                  // ⚠️ CRITIQUE: Utiliser ocrStatus de l'API (peut être 'success' si OCR traité, pas toujours 'pending')
                  ocrStatus: docData.ocrStatus || 'pending',
                  ocrError: docData.ocrError || null,
                  ocrVendor: docData.ocrVendor || null,
                  ocrConfidence: docData.ocrConfidence || null,
                  extractedText: docData.extractedText || null,
                  indexed: docData.indexed || false,
                  status: docData.status || 'draft',
                  source: docData.source || 'staged-upload',
                  uploadedBy: docData.uploadedBy || null,
                  uploadedAt: docData.uploadedAt || new Date().toISOString(),
                  uploadSessionId: docData.uploadSessionId || uploadSessionId,
                  intendedContextType: docData.intendedContextType || null,
                  intendedContextTempKey: docData.intendedContextTempKey || null,
                  createdAt: docData.createdAt || new Date().toISOString(),
                  updatedAt: docData.updatedAt || new Date().toISOString(),
                  version: docData.version || 1,
                  // ⚠️ GARDE-FOU 1: Document existe côté serveur → ne pas purger comme orphelin
                  _remoteReady: true,
                };
                
                await db.Document.put(localDoc);
                await logToServer(`[TransactionModal] ✅ Document ajouté dans IndexedDB: docId=${docData.id}, status=${localDoc.status}, documentTypeId=${localDoc.documentTypeId || 'null'}, ocrStatus=${localDoc.ocrStatus}, _remoteReady=true`);
              } catch (dbError) {
                await logToServer(`[TransactionModal] ❌ Erreur lors de l'ajout du document dans IndexedDB: ${dbError}`, 'error');
                // Ne pas bloquer, le document existe côté serveur et sera récupéré lors du pull
              }
            }
            
            // Recharger la liste des documents et liens
            const reloadedDocs = await loadStagedDocuments(uploadSessionId);
            await logToServer(`[TransactionModal] ✅ Document uploadé avec succès, result.document.id: ${result.document?.id || 'N/A'}`);
            await logToServer(`[TransactionModal] 📎 loadStagedDocuments retourné: ${reloadedDocs?.length || 0} document(s) - IDs: ${reloadedDocs?.map(d => d.id).join(', ') || 'aucun'}`);
            
            // Recharger aussi les liens vers documents existants (mode normal uniquement)
            if (!isAppShellMode) {
              try {
                const sessionResponse = await fetch(`/api/upload-session/${uploadSessionId}`);
                if (sessionResponse.ok) {
                  const sessionData = await sessionResponse.json();
                  if (sessionData.success) {
                    setStagedLinks(sessionData.DocumentLink || []);
                    await logToServer(`[TransactionModal] Liens rechargés: ${sessionData.DocumentLink?.length || 0}`);
                  }
                }
              } catch (error) {
                await logToServer(`[TransactionModal] Erreur lors du rechargement des liens: ${error}`, 'error');
              }
            }
            notify2.success(`Document "${file.name}" ajouté en brouillon`);
          }
        } else {
          // ⚠️ PROBLÈME 1: Retirer le fichier en cas d'erreur
          setUploadingFiles(prev => {
            const next = new Set(prev);
            next.delete(fileId);
            return next;
          });
          
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
            await logToServer(`[TransactionModal] Impossible de parser la réponse d'erreur: ${err}`, 'warn');
          }
          notify2.error(errorMessage);
        }
      } catch (error) {
        // ⚠️ PROBLÈME 1: Retirer le fichier en cas d'exception
        setUploadingFiles(prev => {
          const next = new Set(prev);
          next.delete(fileId);
          return next;
        });
        
        await logToServer(`Erreur lors de l'upload: ${error}`, 'error');
        notify2.error(`Erreur lors de l'upload de "${file.name}"`);
      }
    }
    
    // ⚠️ PROBLÈME 1: Nettoyer les fichiers restants (sécurité)
    setTimeout(() => {
      setUploadingFiles(prev => {
        const next = new Set(prev);
        fileIds.forEach(id => next.delete(id));
        return next;
      });
    }, 1000);
  };
  
  // Fonction pour lier un document existant
  const handleLinkExisting = async () => {
    if (!duplicateData || !uploadSessionId) return;

    // ⚠️ Bloquer la liaison uniquement si hors ligne (pas seulement en mode app-shell)
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await logToServer('[TransactionModal] Hors ligne : liaison de document non disponible');
      notify2.info('Liaison de documents disponible uniquement en mode connecté');
      return;
    }

    try {
      const response = await fetch('/api/upload-staged/link-existing', {
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
      await logToServer(`Erreur lors de la liaison: ${error}`, 'error');
      notify2.error('Erreur lors de la liaison du document');
    }
  };
  
  // Fonction pour charger les documents liés à la transaction (mode normal uniquement)
  const loadLinkedDocuments = React.useCallback(async () => {
    if (!transactionId || isAppShellMode) return; // En app-shell, on utilise le hook
    
    try {
      // Mode normal : charger depuis l'API
      const response = await fetch(`/api/transactions/${transactionId}/documents`);
      if (response.ok) {
        const data = await response.json();
        await logToServer(`[TransactionModal] 📄 Documents chargés depuis API: ${data.documents?.length || 0}`);
        
        const documentsToSet = data.documents || [];
        setLinkedDocuments(documentsToSet);
      } else {
        await logToServer(`[TransactionModal] ❌ Erreur API documents: ${response.status} ${response.statusText}`, 'error');
      }
    } catch (error) {
      await logToServer(`[TransactionModal] ❌ Erreur lors du chargement des documents: ${error}`, 'error');
    }
  }, [transactionId, isAppShellMode]);

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
    
    // Filtrer la liaison vers la transaction courante pour ne pas l'afficher
    const otherLinks = links.filter((link: any) => {
      const linkedType = (link.linkedType || '').toLowerCase();
      const linkedId = link.linkedId || '';
      return !(linkedType === 'transaction' && linkedId === transactionId);
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
          'transaction': 'Txn',
          'property': 'Bien',
          'lease': 'Bail',
          'tenant': 'Locataire',
          'global': 'Global'
        };
        
        const linkedType = (link.linkedType || '').toLowerCase();
        const label = typeMap[linkedType] || link.linkedType || 'Inconnu';
        return label;
      }
    });

    const result = linkLabels.join(', ');
    return result;
  };
  
  // ❌ SUPPRIMÉ : Les documents sont chargés dans loadData() pour éviter les doubles appels

  // Préparer les groupes de natures pour SmartSelectAdvanced
  const natureGroups = React.useMemo(() => {
    const incomeNatures = natures.filter(nature => nature.key.startsWith('RECETTE_'));
    const expenseNatures = natures.filter(nature => nature.key.startsWith('DEPENSE_'));
    
    return [
      {
        group: 'Recettes',
        icon: '⬆️',
        options: incomeNatures.map(nature => ({
          value: nature.key,
          label: nature.label,
          description: `Code: ${nature.key}`
        }))
      },
      {
        group: 'Dépenses',
        icon: '⬇️',
        options: expenseNatures.map(nature => ({
          value: nature.key,
          label: nature.label,
          description: `Code: ${nature.key}`
        }))
      }
    ];
  }, [natures]);

  const handleNatureSelect = (value: string) => {
    setValue('nature', value);
    setSelectedNature(value);
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
    const accountingMonth = watch('accountingMonth');
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

    // 2. Période - depuis accountingMonth (YYYY-MM) ou periodMonth/periodYear
    if (mode === 'edit' || !monthsCovered || monthsCovered === 1) {
      const monthNames = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
      ];
      if (accountingMonth && /^\d{4}-\d{2}$/.test(accountingMonth)) {
        const [, y, m] = accountingMonth.match(/^(\d{4})-(\d{2})$/) || [];
        if (y && m) {
          const monthName = monthNames[parseInt(m, 10) - 1] || m;
          labelParts.push(`${monthName} ${y}`);
        }
      } else if (periodMonth && periodYear) {
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

  // Synchroniser les états locaux avec les valeurs du formulaire
  useEffect(() => {
    const natureValue = watch('nature');
    const categoryValue = watch('categoryId');
    
    if (natureValue && natureValue !== selectedNature) {
      setSelectedNature(natureValue);
    }
    
    if (categoryValue && categoryValue !== selectedCategory) {
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
    natures: isAppShellMode && natures && natures.length > 0 ? natures : undefined, // Passer les natures UNIQUEMENT en mode app-shell si disponibles
    mode: mode, // Passer le mode pour désactiver les automatismes en édition
    selectedNature: selectedNature // Passer la nature sélectionnée pour le filtrage
  });

  // Mise à jour automatique du libellé (uniquement si libellé en mode auto) — après useAutoFillTransaction
  useEffect(() => {
    const subscription = watch((value, { name }) => {
      const isLabelAuto = !autoFillState.isManual.label;
      if (!isLabelAuto) return;
      if (name === 'nature' || name === 'categoryId' || name === 'periodMonth' || name === 'periodYear' || name === 'accountingMonth' || name === 'propertyId') {
        const newLabel = generateLabel();
        if (newLabel) {
          setValue('label', newLabel);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, setValue, generateLabel, autoFillState.isManual.label]);

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
        }
      }
    }
  }, [selectedLease?.id, isAutoAmount, autoAmountValue, setValue, isGestionEnabled, gestionCodes]); 
  // 🎯 Note : selectedNature et selectedCategory ne sont PAS dans les dépendances
  // Le pré-remplissage au changement de nature/catégorie est géré par l'autre useEffect

  // Initialisation de isAutoAmount en CRÉATION uniquement
  useEffect(() => {
    if (mode === 'create') {
      editInitialLoadDoneRef.current = false;
    }
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
      
      // useEffect isAutoAmount (création) - log supprimé
      
      // En création : Auto ON par défaut si codes loyer correspondent
      if (matchesCodes) {
        setIsAutoAmount(true);
        // isAutoAmount défini: true - log supprimé
      } else {
        setIsAutoAmount(false);
        // isAutoAmount défini: false - log supprimé
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
    // En édition : ne pas écraser le montant persisté au chargement initial
    if (mode === 'edit' && editInitialLoadDoneRef.current) {
      editInitialLoadDoneRef.current = false;
      return;
    }
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

  // Note: SmartSelectAdvanced gère son propre état d'ouverture/fermeture

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
        // Nettoyage des champs breakdown
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
        
        // Pré-remplissage breakdown (retour à loyer)
      }
    }
  }, [selectedNature, selectedCategory, isGestionEnabled, gestionCodes, categories, watch, setValue, selectedLease, isAutoAmount]);

  // Chargement des données initiales
  useEffect(() => {
    if (!isOpen) return;
    
    // ⚠️ En mode app-shell, attendre que organizationId soit chargé
    if (isAppShellMode && !organizationId) {
      return;
    }

    const loadData = async () => {
      // TOUJOURS nettoyer l'état au début, peu importe le mode
      await clearStaging();
      
      // VIDER COMPLÈTEMENT l'état local du composant
      // ⚠️ En mode app-shell, ne pas vider linkedDocuments car ils sont gérés par le hook
      if (!isAppShellMode) {
        setLinkedDocuments([]);
      }
      setShowStagedUploadModal(false);
      
      setIsLoading(true);
      try {
        // ✅ Mode app-shell : charger depuis IndexedDB (offline-first)
        if (isAppShellMode && organizationId) {
          const db = await getLocalDB();
          const propRepo = getPropertyRepositoryOffline();
          const leaseRepo = getLeaseRepositoryOffline();
          
          // ⚡ OPTIMISATION : Si on a un propertyId, charger uniquement les baux de ce bien
          // (on charge quand même toutes les propriétés pour le dropdown si nécessaire)
          const leasesPromise = context.propertyId
            ? leaseRepo.getAll(organizationId, { propertyId: context.propertyId })
            : leaseRepo.getAll(organizationId, {});
          
          // ⚡ OPTIMISATION : Charger les propriétés en parallèle avec les autres données
          // Si on a un propertyId dans le contexte (depuis property page), on peut charger uniquement cette propriété
          // mais on garde toutes les propriétés pour le dropdown (sauf si vraiment besoin d'optimiser)
          const propertiesPromise = propRepo.getAll(organizationId, { includeArchived: false });
          
          // Charger en parallèle depuis IndexedDB
          const [propertiesData, leasesData, categoriesData, naturesData] = await Promise.all([
            propertiesPromise,
            leasesPromise,
            db.Category.toArray(),
            db.NatureEntity.toArray(),
          ]);
          
          // Données chargées depuis IndexedDB
          
          setProperties(propertiesData);
          setLeases(leasesData);
          setCategories(categoriesData || []);
          setNatures(naturesData || []);
        } else {
          // Mode normal : charger depuis l'API
          // Charger les propriétés avec une limite élevée pour récupérer tous les biens
          const propertiesResponse = await fetch('/api/properties?limit=10000');
          const propertiesData = await propertiesResponse.json();
          // L'API retourne { data: [...], pagination: {...} }
          const propertiesList = propertiesData.data || propertiesData.properties || propertiesData.items || (Array.isArray(propertiesData) ? propertiesData : []);
          const finalList = Array.isArray(propertiesList) ? propertiesList : [];
          // Propriétés chargées - log supprimé
          setProperties(finalList);

          // Charger les baux
          const leasesResponse = await fetch('/api/leases');
          const leasesData = await leasesResponse.json();
          const leasesArray = leasesData.items || leasesData.data || leasesData || [];
          setLeases(leasesArray);

          // Charger les catégories
          const categoriesResponse = await fetch('/api/accounting/categories');
          const categoriesData = await categoriesResponse.json();
          setCategories(categoriesData || []);

          // Charger les natures depuis l'API admin
          const naturesResponse = await fetch('/api/admin/natures');
          const naturesData = await naturesResponse.json();
          const naturesArray = naturesData.data || [];
          // Natures loaded (log supprimé)
          setNatures(naturesArray);
        }

        // Si mode édition, charger la transaction + initialiser session + charger drafts
        if (mode === 'edit' && transactionId) {
          editInitialLoadDoneRef.current = false;
          let transactionData: any;
          let sessionId: string | null = null; // Déclarer sessionId dans la portée correcte
          
          // ✅ Mode app-shell : charger depuis IndexedDB
          if (isAppShellMode && organizationId) {
            const transRepo = getTransactionRepositoryOffline();
            transactionData = await transRepo.getById(transactionId, organizationId);
            if (!transactionData) {
              throw new Error('Transaction non trouvée');
            }
            
            await logToServer(`[TransactionModal] 📦 Transaction chargée depuis IndexedDB: id=${transactionData.id}, method="${transactionData.method}", paidAt="${transactionData.paidAt}", paidAt type=${typeof transactionData.paidAt}, keys disponibles: ${JSON.stringify(Object.keys(transactionData).slice(0, 20))}`);
            
            // ⚠️ CORRECTION: En mode app-shell, créer aussi une session d'upload pour pouvoir uploader des documents
            // La session est nécessaire même en mode app-shell pour gérer les uploads de documents
            try {
              sessionId = await createUploadSession({ scope: 'transaction:edit', transactionId });
              await logToServer(`[TransactionModal] ✅ Session d'upload créée en mode app-shell: ${sessionId}`);
            } catch (error) {
              await logToServer(`[TransactionModal] ⚠️ Erreur lors de la création de la session d'upload en mode app-shell: ${error}`, 'error');
              // Ne pas bloquer si la création de session échoue, mais l'utilisateur ne pourra pas uploader de documents
            }
          } else {
            // Mode normal : charger depuis l'API
            const [transactionResponse, sessionIdFromApi] = await Promise.all([
              fetch(`/api/transactions/${transactionId}`),
              createUploadSession({ scope: 'transaction:edit', transactionId })
            ]);
            
            transactionData = await transactionResponse.json();
            sessionId = sessionIdFromApi;
          }
          await logToServer(`[TransactionModal] Données chargées: nature=${transactionData.nature}, categoryId=${transactionData.categoryId}, amount=${transactionData.amount}`);
          
          // ⚙️ CORRECTION: Convertir les montants négatifs (dépenses) en positifs pour l'affichage
          // Dans le formulaire, on saisit toujours en positif, le signe est déterminé par la nature
          const displayAmount = Math.abs(transactionData.amount || 0);
          // Display Amount - log supprimé
          
          // Charger le bail lié si bailId existe - AVANT de pré-remplir le formulaire
          // ⚠️ En mode app-shell, on n'a pas accès à transactionData.bail (objet complet)
          // Mais on peut charger le bail depuis IndexedDB si on a le leaseId
          const leaseIdForBail = transactionData.leaseId || transactionData.bailId;
          if (leaseIdForBail && !isAppShellMode && transactionData.bail) {
            setLinkedBail(transactionData.bail);
          } else if (leaseIdForBail && isAppShellMode && organizationId) {
            // En mode app-shell, charger le bail depuis IndexedDB
            try {
              const leaseRepo = getLeaseRepositoryOffline();
              const lease = await leaseRepo.getById(leaseIdForBail, organizationId);
              if (lease) {
                setLinkedBail(lease);
                // Bail chargé depuis IndexedDB - log supprimé
              }
            } catch (err) {
              // Impossible de charger le bail depuis IndexedDB - log supprimé
            }
          }
          
          // ⚠️ IMPORTANT: Vérifier à la fois leaseId et bailId (certaines transactions peuvent avoir l'un ou l'autre)
          const leaseIdValue = transactionData.leaseId || transactionData.bailId || null;
          
          // Charger le bail lié si bailId/leaseId existe - AVANT de pré-remplir le formulaire
          // ⚠️ En mode app-shell, on n'a pas accès à transactionData.bail (objet complet)
          // Mais on peut charger le bail depuis IndexedDB si on a le leaseId
          if (leaseIdValue) {
            if (!isAppShellMode && transactionData.bail) {
              setLinkedBail(transactionData.bail);
            } else if (isAppShellMode && organizationId) {
              // En mode app-shell, charger le bail depuis IndexedDB
              try {
                const leaseRepo = getLeaseRepositoryOffline();
                const lease = await leaseRepo.getById(leaseIdValue, organizationId);
                if (lease) {
                  setLinkedBail(lease);
                  // Bail chargé depuis IndexedDB - log supprimé
                }
              } catch (err) {
                // Impossible de charger le bail depuis IndexedDB - log supprimé
              }
            }
          }
          
          // Pré-remplir le formulaire avec TOUS les champs
          // Pré-remplissage des champs - log supprimé

          if (transactionData.propertyId) setValue('propertyId', transactionData.propertyId);
          if (leaseIdValue) {
            // Pré-remplissage du bail - log supprimé
            setValue('leaseId', leaseIdValue);
          }
          // ⚠️ CRITIQUE: Le formulaire <Input type="date"> attend un format "YYYY-MM-DD"
          // mais date dans IndexedDB est au format ISO "2025-12-22T00:00:00.000Z"
          // Il faut convertir : "2025-12-22T00:00:00.000Z" → "2025-12-22"
          if (transactionData.date) {
            let dateForForm = transactionData.date;
            // Si c'est un format ISO avec 'T', extraire juste la date
            if (typeof dateForForm === 'string' && dateForForm.includes('T')) {
              dateForForm = dateForForm.split('T')[0]; // "2025-12-22T00:00:00.000Z" → "2025-12-22"
            }
            setValue('date', dateForForm);
            await logToServer(`[TransactionModal] ✅ date rempli depuis transactionData.date: "${transactionData.date}" → "${dateForForm}"`);
          }
          if (transactionData.nature) {
            // Extraire la nature (peut être un objet en mode normal, string en mode app-shell)
            const natureValue = typeof transactionData.nature === 'object' 
              ? transactionData.nature.id || transactionData.nature.key
              : transactionData.nature;
            // Définition de la nature - log supprimé
            setSelectedNature(natureValue);
            setValue('nature', natureValue);
            // Forcer la mise à jour de la combobox nature
            setTimeout(() => {
              const currentNature = getValues('nature');
              // Nature après setValue - log supprimé
            }, 50);
          }
          if (transactionData.categoryId) {
            // Définition de la catégorie - log supprimé
            setSelectedCategory(transactionData.categoryId);
            setValue('categoryId', transactionData.categoryId);
            // Forcer la mise à jour de la combobox catégorie
            setTimeout(() => {
              const currentCategory = getValues('categoryId');
              // Catégorie après setValue - log supprimé
            }, 50);
          }
          if (displayAmount) setValue('amount', displayAmount);
          if (transactionData.label) setValue('label', transactionData.label);
          if (transactionData.reference) setValue('reference', transactionData.reference);
          // Champs de paiement
          // ⚙️ NORMALISATION: Dans IndexedDB/Supabase:
          // - Le champ s'appelle "paidAt" (pas "paymentDate")
          // - Le champ s'appelle "method" (pas "paymentMethod")
          // Le formulaire utilise "paymentDate" et "paymentMethod", donc on mappe:
          // - paidAt → paymentDate
          // - method → paymentMethod
          // ⚠️ CRITIQUE: Le formulaire <Input type="date"> attend un format "YYYY-MM-DD"
          // mais paidAt dans IndexedDB est au format ISO "2025-12-22T00:00:00.000Z"
          // Il faut convertir : "2025-12-22T00:00:00.000Z" → "2025-12-22"
          if (transactionData.paidAt) {
            let dateForForm = transactionData.paidAt;
            // Si c'est un format ISO avec 'T', extraire juste la date
            if (typeof dateForForm === 'string' && dateForForm.includes('T')) {
              dateForForm = dateForForm.split('T')[0]; // "2025-12-22T00:00:00.000Z" → "2025-12-22"
            }
            setValue('paymentDate', dateForForm);
            await logToServer(`[TransactionModal] ✅ paymentDate rempli depuis transactionData.paidAt: "${transactionData.paidAt}" → "${dateForForm}"`);
          }
          // ⚠️ IMPORTANT: transactionData.method (depuis IndexedDB) → paymentMethod (champ formulaire)
          if (transactionData.method) {
            setValue('paymentMethod', transactionData.method);
            await logToServer(`[TransactionModal] ✅ paymentMethod rempli depuis transactionData.method: "${transactionData.method}"`);
          }
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
          
          // Charger les champs de breakdown loyer (gestion déléguée) — accepter 0 (sinon 0 n'est pas restauré)
          if (transactionData.montantLoyer != null && transactionData.montantLoyer !== '') setValue('montantLoyer', Number(transactionData.montantLoyer));
          if (transactionData.chargesRecup != null && transactionData.chargesRecup !== '') setValue('chargesRecup', Number(transactionData.chargesRecup));
          if (transactionData.chargesNonRecup != null && transactionData.chargesNonRecup !== '') setValue('chargesNonRecup', Number(transactionData.chargesNonRecup));
          
          // Restaurer l'état du toggle Auto en édition
          // Restauration isAutoAmount - log supprimé
          
          // Fallback intelligent selon le type de transaction
          const isCommission = transactionData.parentTransactionId && transactionData.autoSource === 'gestion';
          
          if (transactionData.isAutoAmount !== undefined && transactionData.isAutoAmount !== null) {
            setIsAutoAmount(transactionData.isAutoAmount);
            // isAutoAmount restauré - log supprimé
          } else if (isCommission) {
            // Commission legacy (données anciennes) : forcer à false
            setIsAutoAmount(false);
            // Commission legacy, isAutoAmount forcé: false - log supprimé
          } else {
            // Transaction normale sans isAutoAmount défini : true par défaut
            setIsAutoAmount(true);
            // isAutoAmount non défini, fallback: true - log supprimé
          }

          // Forcer la mise à jour du formulaire avec reset
          // ⚠️ IMPORTANT: Utiliser leaseId ou bailId selon ce qui est disponible
          const leaseIdForForm = transactionData.leaseId || transactionData.bailId || '';
          
          // ⚙️ NORMALISATION: Dans IndexedDB/Supabase:
          // - Le champ s'appelle "paidAt" (pas "paymentDate")
          // - Le champ s'appelle "method" (pas "paymentMethod")
          // Le formulaire utilise "paymentDate" et "paymentMethod", donc on mappe:
          // - paidAt → paymentDate
          // - method → paymentMethod
          // ⚠️ CRITIQUE: Le formulaire <Input type="date"> attend un format "YYYY-MM-DD"
          // mais paidAt dans IndexedDB est au format ISO "2025-12-22T00:00:00.000Z"
          // Il faut convertir : "2025-12-22T00:00:00.000Z" → "2025-12-22"
          const normalizedPaymentMethod = transactionData.method || ''; // IndexedDB stocke dans "method"
          let normalizedPaymentDate = transactionData.paidAt || ''; // IndexedDB stocke dans "paidAt"
          if (normalizedPaymentDate && typeof normalizedPaymentDate === 'string' && normalizedPaymentDate.includes('T')) {
            normalizedPaymentDate = normalizedPaymentDate.split('T')[0]; // Extraire juste la date "YYYY-MM-DD"
          }
          
          // ⚠️ CRITIQUE: Le formulaire <Input type="date"> attend un format "YYYY-MM-DD"
          // mais date dans IndexedDB est au format ISO "2025-12-22T00:00:00.000Z"
          // Il faut convertir : "2025-12-22T00:00:00.000Z" → "2025-12-22"
          let normalizedDate = transactionData.date || '';
          if (normalizedDate && typeof normalizedDate === 'string' && normalizedDate.includes('T')) {
            normalizedDate = normalizedDate.split('T')[0]; // Extraire juste la date "YYYY-MM-DD"
          }
          
          const formData = {
            propertyId: transactionData.propertyId || '',
            leaseId: leaseIdForForm,
            date: normalizedDate,
            nature: typeof transactionData.nature === 'object' ? transactionData.nature.id : (transactionData.nature || ''),
            categoryId: transactionData.categoryId || '',
            amount: displayAmount || 0,
            label: transactionData.label || '',
            reference: transactionData.reference || '',
            paymentDate: normalizedPaymentDate, // Mapper "paidAt" → "paymentDate" pour le formulaire
            paymentMethod: normalizedPaymentMethod, // Mapper "method" → "paymentMethod" pour le formulaire
            paidAt: transactionData.paidAt || '',
            method: transactionData.method || '', // Garder aussi "method" pour compatibilité
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
          
          // Reset du formulaire - log supprimé
          
          // Utiliser setValue pour chaque champ au lieu de reset
          Object.entries(formData).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              setValue(key as any, value);
              // setValue - log supprimé
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
          editInitialLoadDoneRef.current = true;
          
          // Vérifier les valeurs après reset - log supprimé
          
          // ✅ isAutoAmount est déjà restauré depuis transactionData.isAutoAmount (ligne 787-793)
          // Pas besoin de l'écraser ici !
          
          // Charger les documents liés avec leurs liaisons détaillées
          // (uniquement après avoir chargé toutes les autres données pour éviter les conflits)
          // En mode app-shell, les documents sont chargés via le hook useTransactionDocuments
          if (!isAppShellMode) {
            await loadLinkedDocuments();
          }

          // Charger les drafts et liens de la session
          // ⚠️ CORRECTION: En mode app-shell, charger aussi les stagedDocuments (brouillons) de la session
          if (sessionId) {
            try {
              const allStagedDocs = await loadStagedDocuments(sessionId);
              
              // ⚠️ CORRECTION: Filtrer les stagedDocuments pour exclure ceux qui sont déjà finalisés (status !== 'draft')
              // ou qui sont déjà liés à la transaction (pour éviter d'afficher les brouillons des documents déjà validés)
              const linkedDocumentIds = new Set(
                (isAppShellMode ? hookLinkedDocuments : linkedDocuments).map(doc => doc.id)
              );
              
              const filteredStagedDocs = allStagedDocs.filter(doc => {
                // Exclure les documents qui ne sont plus en brouillon (déjà finalisés)
                if (doc.status && doc.status !== 'draft') {
                  return false;
                }
                // Exclure les documents qui sont déjà liés à la transaction
                if (linkedDocumentIds.has(doc.id)) {
                  return false;
                }
                return true;
              });
              
              // Mettre à jour uniquement avec les documents filtrés
              if (filteredStagedDocs.length !== allStagedDocs.length) {
                // Utiliser setStagedDocuments directement si disponible, sinon le hook le gère
                if (setStagedDocuments) {
                  setStagedDocuments(filteredStagedDocs);
                }
                await logToServer(`[TransactionModal] ✅ StagedDocuments filtrés: ${filteredStagedDocs.length}/${allStagedDocs.length} (exclus les finalisés/déjà liés)`);
              } else {
                await logToServer(`[TransactionModal] ✅ StagedDocuments chargés pour session ${sessionId}: ${allStagedDocs.length} document(s)`);
              }
            } catch (error) {
              await logToServer(`[TransactionModal] ⚠️ Erreur lors du chargement des stagedDocuments: ${error}`, 'error');
            }
            
            // Charger aussi les liens vers documents existants (mode normal uniquement)
            // En mode app-shell, les documents liés sont déjà chargés via useTransactionDocuments
            if (!isAppShellMode) {
              try {
                const sessionResponse = await fetch(`/api/upload-session/${sessionId}`);
                if (sessionResponse.ok) {
                  const sessionData = await sessionResponse.json();
                  if (sessionData.success) {
                    setStagedLinks(sessionData.DocumentLink || []);
                    // Liens vers documents existants chargés - log supprimé
                  }
                }
              } catch (error) {
                // Erreur lors du chargement des liens - log supprimé
              }
            }
            
            // Session chargée et drafts récupérés - log supprimé
          }
        } 
        // Si mode création, initialiser session pour nouveau
        else if (mode === 'create') {
          // Empêcher la double initialisation (React Strict Mode déclenche 2x le useEffect en dev)
          if (sessionInitializedRef.current) {
            // Session déjà initialisée, skip - log supprimé
            return;
          }
          
          sessionInitializedRef.current = true;
          
              let sessionIdToUse: string | null = null;

              // DEBUG - suggestionMeta reçu - log supprimé
          
          // Si pas de session existante, créer une nouvelle
          if (!sessionIdToUse) {
            // FORCER le nettoyage complet pour une nouvelle transaction AVANT de charger le document suggéré
            await clearStaging();
            // ⚠️ En mode app-shell, ne pas vider linkedDocuments car ils sont gérés par le hook
            if (!isAppShellMode) {
              setLinkedDocuments([]);
            }
            setStagedDocuments([]);
            // ⚠️ IMPORTANT : Ne pas vider stagedLinks ici, on va le charger juste après
            // setStagedLinks([]); // ← Retiré pour éviter de supprimer le document suggéré
            
            sessionIdToUse = await createUploadSession({ scope: 'transaction:new' });
            
            // ⚠️ MAINTENANT charger le document suggéré APRÈS clearStaging et création session
            // Variable pour stocker le document suggéré à charger après clearStaging
            let suggestedDocumentLinkItem: any = null;
            
            if (suggestionMeta?.documentId) {
              if (isAppShellMode) {
                // En mode app-shell, charger le document depuis IndexedDB
                try {
                  // Mode app-shell : Chargement du document suggéré - log supprimé
                  const db = await getLocalDB();
                  const doc = await db.Document.get(suggestionMeta.documentId);
                  
                  if (doc && doc.organizationId === organizationId) {
                    // Récupérer le type de document pour afficher le label
                    let typeLabel = 'Non classé';
                    if (doc.documentTypeId) {
                      const docType = await db.DocumentType.get(doc.documentTypeId);
                      if (docType) {
                        typeLabel = docType.label;
                      }
                    }
                    
                    // Construire le format attendu par stagedLinks (comme le format de l'API)
                    suggestedDocumentLinkItem = {
                      id: doc.id, // Utiliser l'ID du document comme ID du lien (pour compatibilité avec le code existant)
                      existingDocument: {
                        id: doc.id,
                        fileName: doc.fileName || doc.filenameOriginal || 'Document',
                        filenameOriginal: doc.filenameOriginal,
                        mime: doc.mime,
                        size: doc.size,
                        status: doc.status,
                        uploadedAt: doc.uploadedAt || doc.createdAt || new Date().toISOString(),
                        typeLabel: typeLabel,
                      },
                    };
                    
                    // Document suggéré préparé pour stagedLinks - log supprimé
                  } else {
                    // Document suggéré non trouvé dans IndexedDB - log supprimé
                  }
                } catch (error) {
                  // Erreur lors du chargement du document suggéré - log supprimé
                }
              } else {
                // Mode normal : logique existante
              try {
                // Récupération de la session du document uploadé - log supprimé
                
                // D'abord, essayer de récupérer le document en staging
                const docResponse = await fetch(`/api/upload-staged/${suggestionMeta.documentId}`);
                if (docResponse.ok) {
                const docData = await docResponse.json();
                if (docData.uploadSessionId) {
                  sessionIdToUse = docData.uploadSessionId;
                  // Session du document récupérée - log supprimé
                  
                  // Charger les documents de la session existante
                  await loadStagedDocuments(sessionIdToUse);
                  
                  // Charger aussi les liens vers documents existants
                  try {
                    const sessionResponse = await fetch(`/api/upload-session/${sessionIdToUse}`);
                    if (sessionResponse.ok) {
                      const sessionData = await sessionResponse.json();
                      if (sessionData.success) {
                        setStagedLinks(sessionData.links || []);
                        // Liens vers documents existants chargés - log supprimé
                      }
                    }
                  } catch (error) {
                    // Erreur lors du chargement des liens - log supprimé
                  }
                }
              } else if (docResponse.status === 404) {
                // Le document n'est pas en staging, c'est un document finalisé
                // Créer une nouvelle session et lier le document finalisé
                // Document finalisé détecté, création d'un lien - log supprimé
                
                // Créer une nouvelle session d'abord
                if (!sessionIdToUse) {
                  sessionIdToUse = await createUploadSession({ scope: 'transaction:new' });
                }
                
                // Créer un lien vers le document finalisé dans la session
                try {
                  const linkResponse = await fetch('/api/upload-staged/link-existing', {
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
                    // Lien vers document finalisé créé - log supprimé
                    
                    // Charger les liens de la session
                    const sessionResponse = await fetch(`/api/upload-session/${sessionIdToUse}`);
                    if (sessionResponse.ok) {
                      const sessionData = await sessionResponse.json();
                      if (sessionData.success) {
                        setStagedLinks(sessionData.links || []);
                        // Liens vers documents existants chargés - log supprimé
                      }
                    }
                  } else {
                    // Erreur lors de la création du lien - log supprimé
                  }
                } catch (error) {
                  // Erreur lors de la création du lien vers document finalisé - log supprimé
                }
              }
            } catch (error) {
              // Erreur lors de la récupération de la session du document - log supprimé
            }
            }
            }
            
            // ⚠️ Si on a un document suggéré préparé en mode app-shell, l'ajouter APRÈS la création de la session
            if (suggestedDocumentLinkItem) {
              await logToServer(`[TransactionModal] 🔄 Ajout du document suggéré à stagedLinks: docId=${suggestedDocumentLinkItem.existingDocument?.id || 'N/A'}`);
              // ⚠️ IMPORTANT : S'assurer que stagedLinks est bien vidé avant d'ajouter le document suggéré
              setStagedLinks([]); // D'abord vider pour éviter les doublons
              // Utiliser une fonction de callback pour garantir que le state est bien mis à jour
              setStagedLinks(prev => {
                const newLinks = [suggestedDocumentLinkItem];
                logToServer(`[TransactionModal] ✅ Document suggéré ajouté à stagedLinks - total: ${newLinks.length}`).catch(console.error);
                return newLinks;
              });
            } else {
              // Si pas de document suggéré, vider stagedLinks maintenant
              setStagedLinks([]);
              await logToServer(`[TransactionModal] ⚠️ Aucun document suggéré à ajouter - suggestionMeta.documentId: ${suggestionMeta?.documentId || 'undefined'}`);
            }
          }
          
          // Stocker l'ID pour la liaison du document
          (window as any).__currentUploadSessionId = sessionIdToUse;
          
          // En mode création, le montant est en mode auto par défaut
          setIsAutoAmount(true);
          // Mode création - isAutoAmount initialisé - log supprimé
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
          
          // ⚠️ IMPORTANT : Pré-remplir le propertyId depuis le context si disponible
          if (context.type === 'property' && context.propertyId) {
            // Pré-remplissage propertyId depuis context - log supprimé
            setValue('propertyId', context.propertyId);
            
            // Charger les baux du bien
            try {
              // ✅ Charger les baux depuis IndexedDB si app-shell, sinon API
              let leasesArray: any[] = [];
              if (isAppShellMode && organizationId) {
                const leaseRepo = getLeaseRepositoryOffline();
                leasesArray = await leaseRepo.getAll(organizationId, { propertyId: context.propertyId });
                setLeases(leasesArray);
              } else {
                const leasesResponse = await fetch(`/api/leases?propertyId=${context.propertyId}`);
                const leasesData = await leasesResponse.json();
                leasesArray = leasesData.items || leasesData.data || leasesData || [];
                setLeases(leasesArray);
              }
              
              // Auto-sélectionner le bail si un seul bail actif
              if (leasesArray.length === 1 && leasesArray[0].status === 'ACTIF') {
                setValue('leaseId', leasesArray[0].id);
                // Auto-sélection du bail unique - log supprimé
              }
            } catch (error) {
              // Erreur chargement baux - log supprimé
            }
          }
        }

        // ✨ Appliquer le pré-remplissage OCR si disponible (mode création uniquement)
        if (mode === 'create' && prefill) {
          // Application du pré-remplissage OCR - log supprimé
          
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
            // Applique paymentDate depuis prefill - log supprimé
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
          
          // Pré-remplissage OCR appliqué - log supprimé
          
          // Lier automatiquement le document suggéré
          if (suggestionMeta?.documentId && !isAppShellMode) {
            // Vérifier si ce document n'est pas déjà lié
            if (linkedDocumentIds.current.has(suggestionMeta.documentId)) {
              // Document déjà lié, skip - log supprimé
            } else {
              // Récupérer l'ID de session (depuis window ou uploadSessionId)
              const sessionId = (window as any).__currentUploadSessionId || uploadSessionId;
              
              if (!sessionId) {
                // Pas de session ID disponible pour lier le document - log supprimé
              } else {
                // Liaison automatique du document - log supprimé
                try {
                  // Créer un lien vers le document suggéré
                  const linkResponse = await fetch('/api/upload-staged/link-existing', {
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
                      // Document suggéré lié automatiquement - log supprimé
                    }
                  }
                } catch (linkError) {
                  // Erreur liaison document suggéré - log supprimé
                  // Non-bloquant : continuer même si la liaison échoue
                }
              }
            }
          }
        }

      } catch (error: any) {
        // Erreur lors du chargement des données - log supprimé
        // Ne pas afficher l'erreur si c'est juste un problème de données manquantes en mode app-shell
        // (le hook useTransactionDocuments gère son propre état de chargement)
        if (!isAppShellMode || !organizationId) {
          notify2.error('Erreur lors du chargement des données');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, transactionId, context.type, context.propertyId, organizationId, isAppShellMode]);

  // Réinitialiser le tracking des documents liés et de session quand la modale se ferme
  useEffect(() => {
    if (!isOpen) {
      linkedDocumentIds.current.clear();
      sessionInitializedRef.current = false;
      processedDocIds.current.clear();
      isApplyingOcrSuggestion.current = false; // Réinitialiser le flag OCR
      // Reset tracking documents liés et session - log supprimé
    }
  }, [isOpen]);

  // 🤖 Surveiller les nouveaux documents uploadés pour détecter les types avec openTransaction
  // ⚠️ PROBLÈME 1: DÉSACTIVÉ dans TransactionModal - on est dans une transaction, pas dans un upload standalone
  // Le message "transaction IA sera ouverte" et l'ouverture automatique ne doivent PAS se produire ici
  // Quand on ajoute un document dans une modal de transaction, on ne doit ni afficher le message d'avertissement
  // ni ouvrir automatiquement une modal de transaction IA, car on est déjà dans le contexte d'une transaction.
  // useEffect(() => {
  //   ... (code désactivé)
  // }, [stagedDocuments, isOpen, uploadSessionId, loadStagedDocuments]);

  // 🤖 Fonction pour appliquer les suggestions de transaction depuis un document
  const handleConfirmSuggestion = async () => {
    if (!pendingSuggestion) return;
    
    setShowSuggestionModal(false);
    // Début extraction données depuis document - log supprimé
    
    // ⚠️ Activer le flag pour éviter l'écrasement par le pré-remplissage du bail
    isApplyingOcrSuggestion.current = true;
    
    try {
      // Appeler l'API de suggestion
      // ⚠️ En mode app-shell, ne pas faire de fetch
      if (isAppShellMode) {
        // Mode app-shell : suggestion de transaction non disponible - log supprimé
        return;
      }

      const response = await fetch(
        `/api/documents/${pendingSuggestion.documentId}/suggest-transaction`
      );
      
      if (!response.ok) {
        throw new Error('Erreur lors de l\'extraction des données');
      }
      
      const responseData = await response.json();
      // Réponse complète - log supprimé
      
      // L'API retourne { success: true, data: { confidence, suggestions: {...}, meta } }
      const suggestionPayload = responseData.data || responseData;
      
      if (!suggestionPayload || !suggestionPayload.suggestions) {
        // Pas de suggestions dans la réponse - log supprimé
        notify2.warning('Aucune donnée exploitable trouvée dans le document');
        isApplyingOcrSuggestion.current = false; // Réinitialiser le flag
        return;
      }
      
      const suggestion = suggestionPayload.suggestions;
      // Suggestions extraites - log supprimé
      
      // Appliquer les suggestions au formulaire
      // ⚠️ IMPORTANT: Appliquer propertyId et leaseId EN DERNIER pour éviter que le useEffect du bail ne s'exécute avant
      if (suggestion.date) {
        // Applique date - log supprimé
        setValue('date', suggestion.date);
      }
      if (suggestion.nature) {
        // Applique nature - log supprimé
        setSelectedNature(suggestion.nature);
        setValue('nature', suggestion.nature);
      }
      if (suggestion.categoryId) {
        // Applique categoryId - log supprimé
        setSelectedCategory(suggestion.categoryId);
        setValue('categoryId', suggestion.categoryId);
      }
      if (suggestion.montantLoyer) {
        // Applique montantLoyer - log supprimé
        setValue('montantLoyer', suggestion.montantLoyer);
      }
      if (suggestion.chargesRecup) {
        // Applique chargesRecup - log supprimé
        setValue('chargesRecup', suggestion.chargesRecup);
      }
      if (suggestion.chargesNonRecup) {
        // Applique chargesNonRecup - log supprimé
        setValue('chargesNonRecup', suggestion.chargesNonRecup);
      }
      if (suggestion.periodMonth) {
        // Applique periodMonth - log supprimé
        setValue('periodMonth', suggestion.periodMonth);
        setLocalFormData(prev => ({ ...prev, periodMonth: suggestion.periodMonth }));
      }
      if (suggestion.periodYear) {
        // Applique periodYear - log supprimé
        setValue('periodYear', suggestion.periodYear);
        setLocalFormData(prev => ({ ...prev, periodYear: suggestion.periodYear }));
      }
      if (suggestion.accountingMonth) {
        // Applique accountingMonth - log supprimé
        setValue('accountingMonth', suggestion.accountingMonth);
        // Extraire mois et année
        const [year, month] = suggestion.accountingMonth.split('-');
        setValue('periodMonth', month);
        setValue('periodYear', parseInt(year));
        setLocalFormData(prev => ({ ...prev, periodMonth: month, periodYear: parseInt(year, 10) }));
      }
      if (suggestion.label) {
        // Applique label - log supprimé
        setValue('label', suggestion.label);
        setLocalFormData(prev => ({ ...prev, label: suggestion.label }));
          }
          // Vérification paymentDate - log supprimé
          if ((suggestion as any).paymentDate) {
        setValue('paymentDate', (suggestion as any).paymentDate);
        // paymentDate appliqué - log supprimé
      } else {
        // paymentDate non trouvé dans les suggestions - log supprimé
      }
      
      // Activer le mode auto-calcul si montants détaillés présents
      if (suggestion.montantLoyer || suggestion.chargesRecup) {
        // Active isAutoAmount - log supprimé
        setIsAutoAmount(true);
      }
      
      // Appliquer propertyId et leaseId EN DERNIER (déclenche le useEffect du bail)
      if (suggestion.propertyId) {
        // Applique propertyId - log supprimé
        setValue('propertyId', suggestion.propertyId);
      }
      if (suggestion.leaseId) {
        // Applique leaseId - log supprimé
        setValue('leaseId', suggestion.leaseId);
      }
      if (suggestion.amount) {
        // Applique amount - log supprimé
        setValue('amount', suggestion.amount);
      }
      
      // Attendre un peu pour que tous les useEffect se déclenchent, puis désactiver le flag
      setTimeout(() => {
        isApplyingOcrSuggestion.current = false;
        // Flag OCR suggestion désactivé - log supprimé
      }, 500);
      
      // Basculer sur l'onglet "Information essentielle"
      setActiveTab('essentielles');
      
      notify2.success('Transaction pré-remplie avec succès !');
      // Suggestion appliquée avec succès - log supprimé
      
    } catch (error) {
      // Erreur lors de l'extraction - log supprimé
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

  /**
   * Exécute la soumission avec le payload exact (appel onSubmit + effets de succès).
   * Utilisé pour le premier envoi et pour le retry (même payload via lastSubmitPayloadRef).
   */
  const runSubmitWithPayload = useCallback(
    async (payload: any) => {
      startSaving();
      lastSubmitPayloadRef.current = payload;
      setIsSubmitting(true);
      try {
        const result = await onSubmit(payload);
        markDone();

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

        if (mode === 'create') {
          await clearStaging();
        }
        onClose();
        reset();

        if (mode === 'edit' && transactionId && !isAppShellMode) {
          await loadLinkedDocuments();
        }
      } catch (error: any) {
        markError(error);
        notify2.error('Erreur lors de la sauvegarde');
      } finally {
        setIsSubmitting(false);
      }
    },
    [startSaving, markDone, markError, onSubmit, mode, transactionId, isAppShellMode, clearStaging, onClose, reset, loadLinkedDocuments]
  );

  /** Soumission directe : validation réelle → construction payload → runSubmitWithPayload. */
  const submitFormDirectly = async (data: TransactionFormData) => {
    startValidation();
    setIsSubmitting(true);
    try {
      const stagedDocumentIds = filteredStagedDocuments.map(doc => doc.id);
      const stagedLinkItemIds = stagedLinks.map(link => link.existingDocument?.id || link.id);

      await logToServer(`[TransactionModalV2] 📎 onSubmitForm - filteredStagedDocuments: ${filteredStagedDocuments.length}, stagedDocumentIds: ${stagedDocumentIds.length} - IDs: ${stagedDocumentIds.join(', ') || 'aucun'}`);
      await logToServer(`[TransactionModalV2] 📎 onSubmitForm - stagedLinks: ${stagedLinks.length}, stagedLinkItemIds: ${stagedLinkItemIds.length} - IDs: ${stagedLinkItemIds.join(', ') || 'aucun'}`);

      const periodMonth = localFormData.periodMonth || data.periodMonth;
      const periodYear = localFormData.periodYear || data.periodYear;
      const accountingMonth = periodMonth && periodYear ? `${periodYear}-${periodMonth.padStart(2, '0')}` : data.accountingMonth;
      const normalizedPaidAt = (data as any).paymentDate !== undefined ? ((data as any).paymentDate || null) : ((data as any).paidAt !== undefined ? (data as any).paidAt : undefined);
      const normalizedMethod = (data as any).paymentMethod !== undefined ? ((data as any).paymentMethod || null) : ((data as any).method !== undefined ? (data as any).method : undefined);

      const dataWithLocalStates = {
        ...data,
        nature: selectedNature || data.nature,
        categoryId: selectedCategory || data.categoryId,
        label: localFormData.label || data.label,
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
        bailId: mode === 'create' ? data.leaseId : undefined,
        montantLoyer: (data as any).montantLoyer ?? undefined,
        chargesRecup: (data as any).chargesRecup !== undefined && (data as any).chargesRecup !== null ? Number((data as any).chargesRecup) : undefined,
        chargesNonRecup: (data as any).chargesNonRecup !== undefined && (data as any).chargesNonRecup !== null ? Number((data as any).chargesNonRecup) : undefined,
        isAutoAmount: isAutoAmount,
        factures: (prefill as any)?.factures || undefined
      };

      await logToServer(`[TransactionModalV2] 📎 Données envoyées à onSubmit - stagedDocumentIds: ${dataWithStagedDocuments.stagedDocumentIds?.length || 0} - IDs: ${dataWithStagedDocuments.stagedDocumentIds?.join(', ') || 'aucun'}`);
      await runSubmitWithPayload(dataWithStagedDocuments);
    } catch (error: any) {
      markError(error);
      setIsSubmitting(false);
    }
  };

  // Gestion de la soumission
  const onSubmitForm = async (data: TransactionFormData) => {
    // onSubmitForm appelé - log supprimé (déjà loggé via logToServer)
    
    // Vérifier que le bien est sélectionné (sauf en mode property où il est pré-rempli)
    if (context.type === 'global' && (!data.propertyId || data.propertyId.trim() === '')) {
      setShowMissingPropertyModal(true);
      return; // Arrêter la soumission pour afficher la modal
    }
    
    // Vérifier les documents non classés avant la soumission
    const unclassifiedDocs = filteredStagedDocuments.filter(doc => 
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

  useEffect(() => {
    if (isOpen) {
      resetSubmitFlow();
      lastSubmitPayloadRef.current = null;
    }
  }, [isOpen, resetSubmitFlow]);

  // Retourner null si la modal n'est pas ouverte
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 overflow-y-auto">
      {/* Overlay - fixed inset-0 pour couvrir 100% du viewport */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      {/* Modal - Mobile: quasi plein écran avec cadre (marges + radius + ombre), Desktop: centré avec max-width */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 md:border-base-200 w-[calc(100vw-24px)] h-[calc(100dvh-24px)] max-w-[560px] md:max-w-4xl md:h-auto md:max-h-[85vh] flex flex-col md:shadow-xl md:ring-1 md:ring-black/5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0 sticky top-0 bg-white z-20 rounded-t-2xl overflow-hidden">
          <h2 className="text-lg lg:text-xl font-semibold text-gray-900">
            {title || (mode === 'create' ? 'Nouvelle transaction' : 'Modifier la transaction')}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs - Mobile: scrollable horizontalement, Desktop: normal */}
        <div className="border-b flex-shrink-0 sticky top-[73px] lg:relative lg:top-auto bg-white z-10">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex overflow-x-auto scrollbar-hide lg:overflow-x-visible">
              <button
                className={`px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'essentielles'
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('essentielles')}
              >
                Essentiel
              </button>
              <button
                className={`px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'calcul'
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('calcul')}
              >
                Calcul
              </button>
              <button
                className={`px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'paiement'
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('paiement')}
              >
                Paiement
              </button>
              <button
                className={`px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'documents'
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('documents')}
              >
                Documents
              </button>
            </div>
          </Tabs>
        </div>

        {/* Contenu du formulaire - Scrollable avec safe areas iOS */}
        <form onSubmit={handleSubmit((data) => {
          // handleSubmit appelé - log supprimé
          onSubmitForm(data);
        })} className="p-4 md:p-4 relative overflow-y-auto flex-1 min-h-0 pb-24 md:pb-4 bg-white">
          {/* Overlay de chargement */}
          {isLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
                <p className="text-gray-600 font-medium">Chargement en cours...</p>
              </div>
            </div>
          )}

          {/* Overlay d'enregistrement (étapes réelles : validating → saving → done ou error) */}
          <ModalSubmitOverlay
            step={submitStep}
            errorMessage={submitError}
            onRetry={() => {
              if (lastSubmitPayloadRef.current) {
                resetSubmitFlow();
                runSubmitWithPayload(lastSubmitPayloadRef.current);
              }
            }}
            onDismissError={resetSubmitFlow}
          />

          {activeTab === 'essentielles' && (
            <div className="space-y-4">
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
                          value={(() => {
                            const propertyIdValue = watch('propertyId');
                            const property = propertyIdValue ? properties.find(p => p.id === propertyIdValue) : null;
                            if (property) {
                              return `${property.name}${property.address ? ' - ' + property.address : ''}`;
                            }
                            return propertyIdValue ? 'Bien sélectionné' : 'Chargement...';
                          })()}
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
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
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
                          className="text-xs text-gray-600 hover:text-gray-800 underline"
                        >
                          Lier un bail
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Mode création - sélecteur normal
                    <SmartSelect
                      value={watch('leaseId') || ''}
                      onChange={(value) => setValue('leaseId', value)}
                      options={[
                        { value: '', label: 'Aucun bail' },
                        ...(filteredLeases || []).map((lease): SmartSelectOption => ({
                          value: lease.id,
                          label: `${lease.Tenant?.firstName || ''} ${lease.Tenant?.lastName || ''} - ${lease.rentAmount || lease.rent || 0}€`,
                        })),
                      ]}
                      placeholder="Aucun bail"
                    />
                  )}
                </div>
              </div>

              {/* Date et Nature */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date" className="text-sm font-medium text-gray-700">
                    Date *
                  </Label>
                  <SmartDatePicker
                    value={watch('date') || ''}
                    onChange={(value) => setValue('date', value)}
                    placeholder="Sélectionner une date"
                    error={!!errors.date}
                    id="date"
                    name="date"
                  />
                  {errors.date && (
                    <p className="text-red-500 text-sm mt-1">{errors.date.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="nature" className="text-sm font-medium text-gray-700">
                    Nature *
                  </Label>
                  <SmartSelectAdvanced
                    value={watch('nature') || ''}
                    onChange={handleNatureSelect}
                    groups={natureGroups}
                    placeholder="Sélectionner une nature"
                    searchPlaceholder="Rechercher une nature..."
                    error={!!errors.nature}
                    id="nature"
                    name="nature"
                  />
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
                  <SmartSelect
                    value={selectedCategory || watch('categoryId') || ''}
                    onChange={(value) => {
                      setValue('categoryId', value);
                      setSelectedCategory(value);
                    }}
                    options={[
                      { value: '', label: 'Sélectionner une catégorie' },
                      ...(filteredCategories || []).map((category): SmartSelectOption => ({
                        value: category.id,
                        label: String(category.label || 'Catégorie sans nom'),
                      })),
                    ]}
                    placeholder="Sélectionner une catégorie"
                    error={!!errors.categoryId}
                    disabled={filteredCategories.length === 0 && (selectedNature || watch('nature'))}
                  />
                  {filteredCategories.length === 0 && (selectedNature || watch('nature')) && (
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                      <p className="text-amber-800 text-sm mb-2">
                        ⚠️ Aucune catégorie compatible pour cette nature
                      </p>
                      <div className="flex gap-2">
                        <a 
                          href="/admin/nature-mapping" 
                          target="_blank"
                          className="text-xs text-gray-600 hover:text-gray-800 underline"
                        >
                          🔧 Configurer le mapping
                        </a>
                        <span className="text-xs text-gray-500">•</span>
                        <button
                          type="button"
                          onClick={() => window.location.reload()}
                          className="text-xs text-gray-600 hover:text-gray-800 underline"
                        >
                          🔄 Recharger les catégories
                        </button>
                      </div>
                    </div>
                  )}
                  {mappingLoading && (
                    <div className="absolute right-2 top-2 flex items-center gap-1">
                      <div className="loading loading-spinner loading-xs text-orange-500"></div>
                    </div>
                  )}
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
                      className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
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

          {activeTab === 'calcul' && (
            <div className="space-y-4">
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
                
                if (!shouldShow) {
                  // Message informatif si les conditions ne sont pas remplies
                  return (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                      <Info className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-900 mb-2">
                        Détail du loyer non disponible
                      </p>
                      <p className="text-xs text-gray-600">
                        Le détail du loyer (loyer hors charges, charges récupérables, etc.) est disponible uniquement pour les transactions de type loyer avec gestion déléguée activée.
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Sélectionnez une nature "Loyer" et une catégorie correspondante dans l'onglet "Essentiel" pour activer cette section.
                      </p>
                    </div>
                  );
                }
                
                return (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-900">
                        Détail du loyer (optionnel)
                      </h4>
                      
                      {/* Toggle Auto pour calcul automatique du Montant */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">Calcul auto du montant</span>
                        <Switch
                          checked={isAutoAmount}
                          onCheckedChange={setIsAutoAmount}
                        />
                      </div>
                    </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                  <div className="bg-white rounded p-2 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        Total payé par le locataire:
                      </span>
                      <span className="text-lg font-bold text-gray-900">
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
                  <Accordion title="Commission de gestion estimée" defaultOpen={false}>
                    <div className="p-3">
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
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
                          <span className="font-bold text-orange-700 text-right text-lg">
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
                    </div>
                  </Accordion>
                );
              })()}
            </div>
          )}

          {activeTab === 'paiement' && (
            <div className="space-y-4">
              {/* Section Période */}
              <div className="border-b pb-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Période</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="periodMonth" className="text-sm font-medium text-gray-700">
                      Mois
                    </Label>
                    <SmartSelect
                      value={localFormData.periodMonth || watch('periodMonth') || ''}
                      onChange={(value) => {
                        setValue('periodMonth', value);
                        setLocalFormData(prev => ({ ...prev, periodMonth: value }));
                      }}
                      options={[
                        { value: '', label: 'Sélectionner un mois' },
                        { value: '01', label: 'Janvier' },
                        { value: '02', label: 'Février' },
                        { value: '03', label: 'Mars' },
                        { value: '04', label: 'Avril' },
                        { value: '05', label: 'Mai' },
                        { value: '06', label: 'Juin' },
                        { value: '07', label: 'Juillet' },
                        { value: '08', label: 'Août' },
                        { value: '09', label: 'Septembre' },
                        { value: '10', label: 'Octobre' },
                        { value: '11', label: 'Novembre' },
                        { value: '12', label: 'Décembre' },
                      ]}
                      placeholder="Sélectionner un mois"
                    />
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
                  <div className="mt-4">
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
                  
                  if (mode === 'edit' && moisTotal && moisIndex) {
                    return (
                      <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <Info className="h-5 w-5 text-gray-600 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-900 font-medium flex items-center gap-2">
                              Transaction multi-mois
                              <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                                Série ({moisTotal}) — {moisIndex}/{moisTotal}
                              </Badge>
                            </p>
                            <p className="text-xs text-gray-700 mt-1">
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

              {/* Section Paiement */}
              <div className="pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Paiement</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="paymentDate" className="text-sm font-medium text-gray-700">
                      Date de paiement
                    </Label>
                    <SmartDatePicker
                      value={watch('paymentDate') || ''}
                      onChange={(value) => setValue('paymentDate', value)}
                      placeholder="Sélectionner une date"
                    />
                  </div>
                  <div>
                    <Label htmlFor="paymentMethod" className="text-sm font-medium text-gray-700">
                      Mode de paiement
                    </Label>
                    <SmartSelect
                      value={watch('paymentMethod') || ''}
                      onChange={(value) => setValue('paymentMethod', value)}
                      options={[
                        { value: '', label: 'Sélectionner un mode' },
                        { value: 'VIREMENT', label: 'Virement' },
                        { value: 'CHEQUE', label: 'Chèque' },
                        { value: 'ESPECES', label: 'Espèces' },
                        { value: 'CARTE', label: 'Carte bancaire' },
                      ]}
                      placeholder="Sélectionner un mode"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <Label htmlFor="notes" className="text-sm font-medium text-gray-700">
                    Notes
                  </Label>
                  <textarea
                    {...register('notes')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white outline-none focus:ring-0 focus:border-orange-500 transition-colors"
                    rows={3}
                    placeholder="Notes additionnelles..."
                  />
                </div>

                {/* Rapprochement bancaire */}
                <div className="mt-4 border-t pt-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">
                      Rapprochée
                    </span>
                    <Switch
                      checked={watch('rapprochementStatus') === 'rapprochee'}
                      onCheckedChange={(checked) => {
                        setValue('rapprochementStatus', checked ? 'rapprochee' : 'non_rapprochee');
                      }}
                    />
                  </div>
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
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Documents liés</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Ajoutez des documents justificatifs à cette transaction
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
                      // ✅ OFFLINE-FIRST: Vérifier si on est offline avant d'ouvrir le sélecteur de fichiers
                      if (shouldDisableUpload) {
                        notify2.error('Action indisponible', 'L\'ajout de documents nécessite une connexion internet.');
                        return;
                      }
                      
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
                    disabled={stagingLoading || shouldDisableUpload}
                    title={shouldDisableUpload ? 'L\'ajout de documents nécessite une connexion internet' : undefined}
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out"></span>
                    <Upload className={`h-3.5 w-3.5 relative z-10 flex-shrink-0 ${shouldDisableUpload ? 'opacity-50' : ''}`} />
                    <span className="relative z-10 font-medium">
                      {stagingLoading ? 'Chargement...' : shouldDisableUpload ? (
                        <>
                          <span className="text-gray-300">Ajouter</span>
                          <span className="hidden sm:inline text-gray-300"> des documents</span>
                          <span className="text-xs text-red-200 ml-1">(hors ligne)</span>
                        </>
                      ) : (
                        <>
                          <span>Ajouter</span>
                          <span className="hidden sm:inline"> des documents</span>
                        </>
                      )}
                    </span>
                  </button>
                </div>
              </div>

              {/* ⚠️ PROBLÈME 1: Indicateur de chargement pendant l'upload */}
              {uploadingFiles.size > 0 && (
                <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-600"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      Analyse du document en cours...
                    </p>
                    <p className="text-xs text-gray-700">
                      OCR et classification en cours, veuillez patienter
                    </p>
                  </div>
                </div>
              )}
              
              {/* Liste des documents */}
              {(() => {
                // Affichage documents - logs supprimés
                return null;
              })()}
              {(filteredStagedDocuments.length > 0 || stagedLinks.length > 0 || (isAppShellMode ? hookLinkedDocuments : linkedDocuments).length > 0) ? (
                <div className="space-y-3">
                  {/* Documents en staging (brouillon) */}
                  {filteredStagedDocuments.map((doc) => (
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
                            // ⚠️ CRITIQUE: En mode app-shell, supprimer aussi le document de IndexedDB et créer une pendingOp
                            if (isAppShellMode && organizationId) {
                              try {
                                const { IndexedDBDocumentRepository } = await import('@/domain/repositories/adapters/IndexedDBDocumentRepository');
                                const documentRepo = new IndexedDBDocumentRepository();
                                
                                // Vérifier si le document existe dans IndexedDB
                                const db = await getLocalDB();
                                const existingDoc = await db.Document.get(doc.id);
                                
                                if (existingDoc) {
                                  // Supprimer de IndexedDB (créera automatiquement une pendingOp)
                                  await documentRepo.delete(doc.id, organizationId);
                                  await logToServer(`[TransactionModal] ✅ Document supprimé de IndexedDB: docId=${doc.id}, pendingOp créée`);
                                  
                                  // Déclencher un refresh de la page Documents si elle est ouverte
                                  if (typeof window !== 'undefined') {
                                    window.dispatchEvent(new CustomEvent('documents:refresh'));
                                  }
                                }
                              } catch (dbError) {
                                await logToServer(`[TransactionModal] ❌ Erreur lors de la suppression du document dans IndexedDB: ${dbError}`, 'error');
                                // Continuer quand même avec la suppression du staging
                              }
                            }
                            
                            // Supprimer du staging (état React + API si online)
                            const success = await removeStagedDocument(doc.id);
                            if (success) {
                              await logToServer(`[TransactionModal] ✅ Document supprimé du staging: docId=${doc.id}`);
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
                    <div key={link.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Link className="h-5 w-5 text-gray-600" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">{link.existingDocument.fileName}</p>
                            <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700">
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
                              // ⚠️ En mode app-shell, supprimer uniquement localement
                              if (isAppShellMode) {
                                setStagedLinks(prev => prev.filter(l => l.id !== link.id));
                                notify2.success('Lien supprimé');
                                return;
                              }
                              try {
                                const response = await fetch(`/api/upload-staged-item/${link.id}`, {
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
                                // Erreur lors de la suppression du lien - log supprimé
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
                    // Rendu linkedDocuments - logs supprimés
                    return null;
                  })()}
                  {linkedDocuments.map((doc) => {
                    // Rendu document individuel - log supprimé
                    return (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-gray-500" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{doc.fileName || doc.filename || doc.filenameOriginal}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            {(() => {
                              // Support des deux formats : API (DocumentType.label) et App Shell (documentTypeLabel)
                              const documentType = String(
                                doc.DocumentType?.label || 
                                doc.documentTypeLabel || 
                                'Type inconnu'
                              );
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
                            const links = formatDocumentLinks(doc);
                            // Document pour affichage des liaisons - logs supprimés
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
                  {hasMissingDocuments && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800 flex items-center justify-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      <span>Certains documents liés ne sont pas encore synchronisés</span>
                    </div>
                  )}
                  <p className="text-xs mt-1">Cliquez sur "Ajouter des documents" pour en associer</p>
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
                      Les documents uploadés seront automatiquement liés à cette transaction.
                      {context.type === 'property' && ' Ils seront également associés au bien sélectionné.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Boutons d'action - Mobile: sticky en bas avec safe areas, Desktop: normal */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 mt-4 pt-4 border-t flex-shrink-0 fixed bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto bg-white md:bg-transparent p-4 md:p-0 border-t md:border-t shadow-lg md:shadow-none z-20 md:rounded-b-2xl md:overflow-hidden" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isLoading}
              onClick={(e) => {
                // Bouton cliqué - log supprimé
                e.preventDefault();
                const formData = getValues();
                // Données du formulaire - log supprimé
                onSubmitForm(formData);
              }}
              className="w-full sm:w-auto"
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
                <SmartSelect
                  value=""
                  onChange={(value) => {
                    if (value) {
                      // Lier le bail via l'API
                      // ⚠️ En mode app-shell, cette opération sera gérée via pendingOps
                      if (isAppShellMode) {
                        // Mode app-shell : liaison bail sera synchronisée plus tard - log supprimé
                        // TODO: Créer une pendingOp pour la mise à jour
                      } else {
                        fetch(`/api/transactions/${transactionId}/link-bail`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ bailId: value })
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
                          // Erreur - log supprimé
                          notify2.error('Erreur lors de la liaison');
                        });
                      }
                    }
                  }}
                  options={[
                    { value: '', label: 'Sélectionner un bail' },
                    ...(leases || []).map((lease): SmartSelectOption => ({
                      value: lease.id,
                      label: `${lease.Tenant?.firstName || ''} ${lease.Tenant?.lastName || ''} - ${lease.rentAmount || lease.rent || 0}€`,
                    })),
                  ]}
                  placeholder="Sélectionner un bail"
                />
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
          // Documents ajoutés en staging - log supprimé
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
        hideOpenTransactionWarning={true} // ⚠️ PROBLÈME 1: Désactiver le message car on est dans le contexte d'une transaction
        mode="transaction"
        strategy={{
          mode: 'review-draft',
          draftId: selectedDraftId || undefined,
          onStagedUpdate: async () => {
            // Recharger la liste des documents en staging
            // Document brouillon modifié, rechargement - log supprimé
            if (uploadSessionId) {
              await loadStagedDocuments(uploadSessionId);
              // Documents de la session rechargés - log supprimé
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
          // ⚠️ CORRECTION: S'assurer que uploadingFiles est vide quand on ferme la modal
          // (le fichier devrait déjà avoir été retiré lors de la détection du doublon, mais sécurité)
          setUploadingFiles(prev => new Set());
        }}
        onLinkExisting={handleLinkExisting}
        onCancel={() => {
          setShowDuplicateModal(false);
          setDuplicateData(null);
          // ⚠️ CORRECTION: S'assurer que uploadingFiles est vide quand on annule
          setUploadingFiles(prev => new Set());
        }}
        duplicateData={duplicateData}
      />
      
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
                      // Supprimer de IndexedDB (créera automatiquement une pendingOp)
                      await documentRepo.delete(documentToDelete.id, organizationId);
                      await logToServer(`[TransactionModal] ✅ Document supprimé de IndexedDB: docId=${documentToDelete.id}, pendingOp créée`);
                      
                      // Déclencher un refresh de la page Documents si elle est ouverte
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('documents:refresh'));
                      }
                    }
                  } catch (dbError) {
                    await logToServer(`[TransactionModal] ❌ Erreur lors de la suppression du document dans IndexedDB: ${dbError}`, 'error');
                    // Continuer quand même avec la suppression du staging
                  }
                }
                
                // Supprimer du staging (état React + API si online)
                const success = await removeStagedDocument(documentToDelete.id);
                if (success) {
                  await logToServer(`[TransactionModal] ✅ Document supprimé du staging: docId=${documentToDelete.id}`);
                  
                  // Rafraîchir les stagedDocuments
                  if (uploadSessionId) {
                    try {
                      await loadStagedDocuments(uploadSessionId);
                    } catch (error) {
                      // Erreur silencieuse lors du rechargement
                    }
                  }
                  
                  notify2.success('Document supprimé');
                } else {
                  notify2.error('Erreur lors de la suppression du document');
                }
              } else if (isLinkedDocument) {
                // Supprimer un document lié (déjà finalisé)
                if (deleteMode === 'transaction-links-only' && transactionId) {
                  // Supprimer uniquement les liaisons avec cette transaction
                  if (isAppShellMode && organizationId) {
                    // Mode app-shell : supprimer les DocumentLink depuis IndexedDB
                    const db = await getLocalDB();
                    const linksToDelete = await db.DocumentLink
                      .where('documentId')
                      .equals(documentToDelete.id)
                      .filter(link => {
                        const linkedType = (link.linkedType || '').toLowerCase();
                        return linkedType === 'transaction' && link.linkedId === transactionId;
                      })
                      .toArray();
                    
                    // Supprimer chaque lien
                    for (const link of linksToDelete) {
                      await db.DocumentLink.delete([link.documentId, link.linkedType, link.linkedId]);
                    }
                    
                    // Créer une pendingOp pour chaque lien supprimé
                    for (const link of linksToDelete) {
                      await db.pendingOperations.add({
                        id: `pending-${Date.now()}-${Math.random()}`,
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
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                      });
                    }
                    
                    // Rafraîchir les documents liés
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('documents:refresh'));
                      window.dispatchEvent(new CustomEvent('transactions:refresh'));
                    }
                    
                    notify2.success('Liaisons avec cette transaction supprimées. La suppression sera synchronisée avec le serveur lors de la prochaine synchronisation.');
                  } else {
                    // Mode normal : utiliser l'API pour supprimer chaque lien
                    // L'API utilise le format /api/documents/{documentId}/links/{linkedType}:{linkedId}
                    const linkId = `transaction:${transactionId}`;
                    const response = await fetch(`/api/documents/${documentToDelete.id}/links/${linkId}`, {
                      method: 'DELETE'
                    });
                    
                    if (!response.ok) {
                      const errorData = await response.json().catch(() => ({}));
                      throw new Error(errorData.error || 'Erreur lors de la suppression des liaisons');
                    }
                    
                    // Recharger les documents liés
                    await loadLinkedDocuments();
                    
                    notify2.success('Liaisons avec cette transaction supprimées avec succès');
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
                    for (const link of allLinks) {
                      await db.DocumentLink.delete([link.documentId, link.linkedType, link.linkedId]);
                      
                      // Créer une pendingOp pour chaque lien supprimé
                      const now = new Date().toISOString();
                      const pendingOp = {
                        id: `pending-${Date.now()}-${Math.random()}`,
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
                        console.warn('[TransactionModal] Erreur lors du sync après suppression:', syncError);
                        // Ne pas bloquer l'opération si la sync échoue
                      }
                    }
                    
                    // Rafraîchir les documents liés
                    // En mode app-shell, le hook useTransactionDocuments se rafraîchira automatiquement via les événements
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('documents:refresh'));
                      window.dispatchEvent(new CustomEvent('transactions:refresh'));
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
                      throw new Error('Erreur lors de la suppression du document');
                    }
                    
                    // Recharger les documents liés
                    await loadLinkedDocuments();
                    
                    notify2.success('Document supprimé avec succès');
                  }
                }
              } else {
                // Document non trouvé dans stagedDocuments ni linkedDocuments
                notify2.error('Document non trouvé');
              }
              
              // Fermer la modal après la suppression
              setShowDeleteDocModal(false);
              setDocumentToDelete(null);
            } catch (error: any) {
              console.error('Erreur lors de la suppression du document:', error);
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
          transactionId={transactionId}
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

      {/* Modal "Lier document existant" - recherche, filtre type, pagination, aperçu */}
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
          logToServer(`[TransactionModal] ✅ Document existant ajouté: docId=${doc.id}`).catch(console.error);
          notify2.success('Document ajouté');
          setShowDocumentSelectorModal(false);
        }}
        excludeDocumentIds={stagedLinks.map((link) => link.existingDocument?.id).filter(Boolean) as string[]}
        mode={isAppShellMode ? 'app-shell' : 'normal'}
      />
    </div>
  );
};

export default TransactionModal;

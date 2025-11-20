'use client';

import React, { useState, useEffect, useId } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Loader2, AlertTriangle, CheckCircle2, X, Eye, RefreshCw, Upload, FileText, Image as ImageIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
// import { DocumentPreview } from '@/components/documents/DocumentPreview'; // Temporairement commenté
// import { DuplicateDetectionModal } from '@/components/DuplicateDetectionModal'; // Supprimé - Remplacé par DedupFlow
import { DedupFlowModal } from '@/components/DedupFlowModal';
import { useDedupFlow } from '@/hooks/useDedupFlow';
import { DedupFlowInput, DedupFlowContext } from '@/types/dedup-flow';
import { TransactionSuggestionPayload } from '@/services/TransactionSuggestionService';
import { TransactionModal as TransactionModalV2 } from '@/components/transactions/TransactionModalV2';
import { SearchableSelect } from '@/components/forms/SearchableSelect';
// Note: Les descriptions de liaison sont maintenant générées côté client

type UploadSaveMode = 'immediate' | 'staged' | 'review-draft';

interface UploadStrategy {
  mode: UploadSaveMode;
  uploadSessionId?: string;
  linkContext?: { 
    type: 'transaction' | 'lease' | 'property' | 'global'; 
    id?: string; 
    tempKey?: string;
  };
  draftId?: string; // si mode review-draft
  onStaged?: (drafts: any[]) => void;
  onFinalized?: (docs: any[]) => void;
  onStagedUpdate?: () => void; // callback pour recharger la liste après modif
}

interface UploadReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: File[];
  scope: 'global' | 'property';
  propertyId?: string;
  leaseId?: string;
  tenantId?: string;
  onSuccess?: () => void;
  // Props pour la liaison automatique
  autoLinkingContext?: {
    leaseId?: string;
    propertyId?: string;
    tenantsIds?: string[];
    transactionId?: string;
  };
  autoLinkingDocumentType?: string;
  // Contrôle si le type de document est modifiable
  documentTypeEditable?: boolean;
  // Props pour le mode staging
  strategy?: UploadStrategy;
  // Props pour le mode review-draft
  draftDocument?: any; // Document brouillon à modifier
  // Callback pour ouvrir la modale de transaction
  onOpenTransactionModal?: (suggestion: TransactionSuggestionPayload, documentId: string) => void;
}

interface UploadPreview {
  file: File;
  tempId?: string;
  filename: string;
  sha256?: string;
  mime: string;
  size: number;
  predictions: Array<{
    typeCode: string;
    label: string;
    score: number;
    threshold: number;
  }>;
  autoAssigned: boolean;
  assignedTypeCode: string | null;
  duplicate: {
    isDuplicate: boolean;
    ofDocumentId?: string;
    documentName?: string;
    documentType?: string;
    uploadedAt?: string;
    reason?: string;
  };
  extractedPreview: {
    textSnippet: string;
    textLength: number;
    source: string;
    fields: Record<string, string>;
  };
  // 1) Métadonnées OCR de /api/ocr
  ocrMeta?: {
    sha256: string;
    length: number;
    preview: string; // Texte brut (premiers 300 chars)
    source: 'pdf-parse' | 'tesseract' | 'pdf-ocr';
    pagesOcred?: number;
  };
  duplicateAction?: 'replace' | 'keep' | null; // Action sur le doublon
  dedupResult?: any; // Résultats de l'agent Dedup
  status: 'uploading' | 'analyzing' | 'ready' | 'error' | 'confirmed' | 'duplicate_detected';
  error?: string;
}

// 4) Seuil de pré-sélection automatique - maintenant dynamique depuis la DB

export function UploadReviewModal({
  isOpen,
  onClose,
  files,
  scope,
  propertyId,
  leaseId,
  tenantId,
  onSuccess,
  autoLinkingContext,
  autoLinkingDocumentType,
  documentTypeEditable = true,
  strategy,
  draftDocument,
  onOpenTransactionModal
}: UploadReviewModalProps) {
  const [previews, setPreviews] = useState<UploadPreview[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [documentTypes, setDocumentTypes] = useState<Array<{code: string, label: string}>>([]);
  const [selectedType, setSelectedType] = useState<string>('');
  const [customName, setCustomName] = useState('');
  const [keepDuplicate, setKeepDuplicate] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [linkingDescription, setLinkingDescription] = useState<string[]>([]);
  
  // États pour le mode review-draft
  const [isReviewDraftMode, setIsReviewDraftMode] = useState(false);
  const [draftData, setDraftData] = useState<any>(null);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  
  // États pour la modale de déduplication (supprimés - remplacés par DedupFlow)
  // const [showDedupModal, setShowDedupModal] = useState(false);
  // const [dedupResult, setDedupResult] = useState<any>(null);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  
  // États pour DedupFlow
  const { flowOutput, isProcessing: isDedupFlowProcessing, orchestrateFlow, processApiResult, reset: resetDedupFlow } = useDedupFlow();
  const [showDedupFlowModal, setShowDedupFlowModal] = useState(false);

  // États pour la suggestion de transaction
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionSuggestion, setTransactionSuggestion] = useState<TransactionSuggestionPayload | null>(null);
  const [suggestedDocumentId, setSuggestedDocumentId] = useState<string | null>(null);

  const currentPreview = previews[currentIndex];

  // Charger les types de documents
  useEffect(() => {
    fetch('/api/admin/document-types?includeInactive=false')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setDocumentTypes(data.data.map((t: any) => ({
            code: t.code,
            label: t.label
          })));
        }
      })
      .catch(console.error);
  }, []);

  // Détecter le mode review-draft et charger les données
  useEffect(() => {
    if (strategy?.mode === 'review-draft' && strategy.draftId) {
      setIsReviewDraftMode(true);
      loadDraftDocument(strategy.draftId);
    } else {
      setIsReviewDraftMode(false);
      setDraftData(null);
    }
  }, [strategy?.mode, strategy?.draftId]);

  // Charger un document brouillon
  const loadDraftDocument = async (draftId: string) => {
    console.log('[UploadReview] Chargement du document brouillon:', draftId);
    setIsLoadingDraft(true);
    try {
      const response = await fetch(`/api/uploads/staged/${draftId}`);
      console.log('[UploadReview] Réponse API:', response.status, response.statusText);
      
      const data = await response.json();
      console.log('[UploadReview] Données reçues:', data);
      
      if (response.ok) {
        setDraftData(data);
        setCustomName(data.name);
        // Utiliser le code du type au lieu de l'ID
        setSelectedType(data.type?.code || '');
        console.log('[UploadReview] Document chargé avec succès:', data);
      } else {
        console.error('[UploadReview] Erreur lors du chargement du brouillon:', data.error);
      }
    } catch (error) {
      console.error('[UploadReview] Erreur lors du chargement du brouillon:', error);
    } finally {
      setIsLoadingDraft(false);
    }
  };

  // 🤖 Fonction helper pour analyser et suggérer une transaction depuis un document
  const tryTransactionSuggestion = async (documentId: string, finalTypeCode: string) => {
    try {
      console.log('[UploadReview] 🤖 Tentative de suggestion de transaction pour document:', documentId);
      
      // Appeler l'API côté serveur
      const response = await fetch(`/api/documents/${documentId}/suggest-transaction`);
      const result = await response.json();
      
      if (!result.success || !result.data) {
        console.log('[UploadReview] ⚠️ Pas de suggestion:', result.message || 'Aucune donnée');
        return false;
      }
      
      const suggestion = result.data;
      
      if (suggestion && suggestion.confidence > 0.5) {
        console.log('[UploadReview] ✨ Suggestion générée avec confiance:', suggestion.confidence);
        console.log('[UploadReview] 📋 Champs suggérés:', suggestion.suggestions);
        
        // Option 1 : Utiliser le callback externe (si fourni)
        if (onOpenTransactionModal) {
          console.log('[UploadReview] 🚀 Délégation au composant parent');
          onOpenTransactionModal(suggestion, documentId);
          onClose(); // Fermer UploadReviewModal
          return true;
        }
        
        // Option 2 : Gérer localement (fallback)
        setTransactionSuggestion(suggestion);
        setSuggestedDocumentId(documentId);
        setShowTransactionModal(true);
        
        console.log('[UploadReview] 🎯 Modale de transaction ouverte, UploadReviewModal masquée');
        
        return true; // Suggestion affichée
      } else {
        console.log('[UploadReview] ⚠️ Confiance insuffisante ou pas de suggestion:', suggestion?.confidence || 0);
        return false; // Pas de suggestion
      }
    } catch (error) {
      console.error('[UploadReview] ❌ Erreur lors de la suggestion:', error);
      return false; // Erreur, pas de suggestion
    }
  };

  // Sauvegarder les modifications d'un brouillon
  const saveDraftDocument = async () => {
    if (!strategy?.draftId || !draftData) return;
    
    setIsSavingDraft(true);
    try {
      const requestData = {
        name: customName,
        typeId: selectedType || null, // Le backend attend un typeId (code)
        fields: draftData.fieldsExtracted
      };

      console.log('[UploadReview] Envoi de la requête PATCH:', requestData);

      const response = await fetch(`/api/uploads/staged/${strategy.draftId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      const data = await response.json();
      console.log('[UploadReview] Réponse de la sauvegarde:', data);
      
      if (response.ok) {
        // Mettre à jour les données locales avec la réponse du serveur
        setDraftData((prev: any) => ({
          ...prev,
          name: data.document.name,
          typeId: data.document.typeId,
          type: data.document.type
        }));
        
        // Mettre à jour le type sélectionné avec la réponse du serveur
        if (data.document.type) {
          setSelectedType(data.document.type.code);
        }
        
        console.log('[UploadReview] Brouillon sauvegardé avec succès:', data.document);
        
        // Appeler le callback de mise à jour
        if (strategy.onStagedUpdate) {
          strategy.onStagedUpdate();
        }
        
        // Fermer la modale
        onClose();
      } else {
        console.error('Erreur lors de la sauvegarde du brouillon:', data.error);
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du brouillon:', error);
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Pré-remplir le type de document si fourni
  useEffect(() => {
    if (autoLinkingDocumentType && documentTypes.length > 0) {
      console.log('[UploadReview] Pré-sélection du type:', autoLinkingDocumentType);
      setSelectedType(autoLinkingDocumentType);
    }
  }, [autoLinkingDocumentType, documentTypes]);

  // Forcer le type "Bail signé" dans les contextes de bail signé
  useEffect(() => {
    if (autoLinkingDocumentType === 'BAIL_SIGNE' && documentTypes.length > 0) {
      console.log('[UploadReview] Forçage du type BAIL_SIGNE dans le contexte bail signé');
      setSelectedType('BAIL_SIGNE');
    }
  }, [autoLinkingDocumentType, documentTypes]);

  // Générer les liaisons prévues si le contexte de liaison automatique est fourni
  useEffect(() => {
    
    // Déterminer le type de document à utiliser pour les liaisons
    let typeToUse = autoLinkingDocumentType || selectedType;
    
    // Éviter les appels inutiles si le type n'est pas encore défini
    if (!typeToUse) {
      setLinkingDescription([]);
      return;
    }
    
    // Générer les descriptions de liaison côté client pour l'affichage
    const generateLinkingDescription = (documentType: string, context: any) => {
      const descriptions: string[] = [];
      
      // Vérifier que le contexte existe
      if (!context) {
        context = {};
      }
      
      // Règles de liaison basées sur le type de document
      switch (documentType) {
        case 'QUITTANCE':
        case 'QUITTANCE_LOYER':
          descriptions.push('📄 Liaison globale (tous les documents)');
          if (context.propertyId) {
            descriptions.push('🏠 Liaison avec la propriété');
          }
          if (context.leaseId) {
            descriptions.push('📋 Liaison avec le bail');
          }
          if (context.tenantsIds?.length > 0) {
            descriptions.push('👥 Liaison avec les locataires');
          }
          break;
          
        case 'BAIL_SIGNE':
          descriptions.push('📄 Liaison globale (tous les documents)');
          descriptions.push('📋 Liaison avec le bail (document principal)');
          if (context.propertyId) {
            descriptions.push('🏠 Liaison avec la propriété');
          }
          if (context.tenantsIds?.length > 0) {
            descriptions.push('👥 Liaison avec les locataires');
          }
          break;
          
        case 'ETAT_LIEUX_ENTRANT':
        case 'ETAT_LIEUX_SORTANT':
          descriptions.push('📄 Liaison globale (tous les documents)');
          if (context.propertyId) {
            descriptions.push('🏠 Liaison avec la propriété (document principal)');
          }
          if (context.leaseId) {
            descriptions.push('📋 Liaison avec le bail');
          }
          if (context.tenantsIds?.length > 0) {
            descriptions.push('👥 Liaison avec les locataires');
          }
          break;
          
        case 'ASSURANCE_LOCATAIRE':
        case 'DEPOT_GARANTIE':
          descriptions.push('📄 Liaison globale (tous les documents)');
          if (context.tenantsIds?.length > 0) {
            descriptions.push('👥 Liaison avec les locataires (document principal)');
          }
          if (context.propertyId) {
            descriptions.push('🏠 Liaison avec la propriété');
          }
          if (context.leaseId) {
            descriptions.push('📋 Liaison avec le bail');
          }
          break;
          
        default:
          descriptions.push('📄 Liaison globale (tous les documents)');
          // Même en défaut, afficher la liaison au bien/le bail si le contexte le permet
          if (context.propertyId) {
            descriptions.push('🏠 Liaison avec la propriété');
          }
          if (context.leaseId) {
            descriptions.push('📋 Liaison avec le bail');
          }
      }
      
      return descriptions;
    };
    
    // Contexte effectif: fusionner autoLinkingContext avec les props (scope/propertyId/leaseId)
    const effectiveContext = {
      ...(autoLinkingContext || {}),
      propertyId: autoLinkingContext?.propertyId ?? propertyId,
      leaseId: autoLinkingContext?.leaseId ?? leaseId,
      tenantsIds: autoLinkingContext?.tenantsIds,
      transactionId: autoLinkingContext?.transactionId
    };

    const descriptions = generateLinkingDescription(typeToUse, effectiveContext);
    setLinkingDescription(descriptions);
  }, [autoLinkingContext, autoLinkingDocumentType, selectedType, scope, propertyId, leaseId]);

  // 1) Réinitialiser et uploader les fichiers quand la modale s'ouvre
  useEffect(() => {
    console.log('[UploadReviewModal] useEffect triggered:', { isOpen, filesCount: files.length, filesNames: files.map(f => f.name) });
    if (isOpen && files.length > 0) {
      console.log('[UploadReviewModal] Opening modal with files, starting upload...');
      // Vider les anciens previews et relancer l'analyse
      setPreviews([]);
      setCurrentIndex(0);
      setSelectedType('');
      setCustomName('');
      uploadFiles();
    }
  }, [isOpen, files]);

  // Réinitialiser l'état quand la modal se ferme
  useEffect(() => {
    if (!isOpen) {
      setPreviews([]);
      setCurrentIndex(0);
      setSelectedType('');
      setCustomName('');
      setKeepDuplicate(false);
      setIsConfirming(false);
      setShowDedupFlowModal(false);
      resetDedupFlow();
    }
  }, [isOpen, resetDedupFlow]);

  // Mettre à jour le type sélectionné quand on change de fichier
  useEffect(() => {
    if (currentPreview) {
      // Si on est dans un contexte de bail signé, forcer le type BAIL_SIGNE
      if (autoLinkingDocumentType === 'BAIL_SIGNE') {
        console.log('[UploadReview] Forçage du type BAIL_SIGNE lors du changement de fichier');
        setSelectedType('BAIL_SIGNE');
      } else {
        setSelectedType(currentPreview.assignedTypeCode || '');
      }
      setCustomName(currentPreview.filename);
    }
  }, [currentIndex, currentPreview?.assignedTypeCode, autoLinkingDocumentType]);

  const uploadFiles = async () => {
    console.log('[UploadReviewModal] uploadFiles called with', files.length, 'files:', files.map(f => ({ name: f.name, type: f.type, size: f.size })));
    
    const initialPreviews: UploadPreview[] = files.map(file => ({
      file,
      filename: file.name,
      mime: file.type,
      size: file.size,
      predictions: [],
      autoAssigned: false,
      assignedTypeCode: null,
      duplicate: { isDuplicate: false },
      extractedPreview: {
        textSnippet: '',
        textLength: 0,
        source: '',
        fields: {}
      },
      status: 'uploading' as const
    }));

    setPreviews(initialPreviews);

    // Upload et analyse de chaque fichier
    for (let i = 0; i < files.length; i++) {
      try {
        const file = files[i];
        console.log(`[UploadReviewModal] Uploading file ${i + 1}/${files.length}:`, file.name, file.type, file.size, 'bytes');
        const formData = new FormData();
        formData.append('file', file);

        console.log('[UploadReviewModal] Calling /api/documents/upload...');
        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        console.log('[UploadReviewModal] Response status:', response.status, response.statusText);

        const result = await response.json();
        console.log('[UploadReviewModal] Upload result:', {
          success: result.success,
          hasData: !!result.data,
          hasPredictions: !!result.data?.predictions,
          predictionsCount: result.data?.predictions?.length || 0,
          hasExtractedPreview: !!result.data?.extractedPreview,
          extractedTextLength: result.data?.extractedPreview?.textLength || 0
        });

        if (result.success && result.data) {
          // Validation robuste des données reçues
          const data = result.data;
          
          // 3) Les prédictions proviennent du service de classification
          const predictions = Array.isArray(data.predictions) ? data.predictions : [];
          
          // 4) Si la meilleure prédiction >= seuil configuré, pré-sélectionner
          let preselectedType = '';
          
          // Forcer le type BAIL_SIGNE si on est dans ce contexte
          if (autoLinkingDocumentType === 'BAIL_SIGNE') {
            preselectedType = 'BAIL_SIGNE';
            console.log('[Upload] Forçage du type BAIL_SIGNE dans le contexte bail signé');
          } else if (predictions.length > 0) {
            const bestPrediction = predictions[0];
            const threshold = bestPrediction.threshold; // Seuil depuis la BDD (DocumentType.autoAssignThreshold)
            
            if (bestPrediction.score >= threshold) {
              preselectedType = bestPrediction.typeCode;
              console.log(`[Upload] Auto-suggest type: ${bestPrediction.label} (score: ${(bestPrediction.score * 100).toFixed(0)}% >= seuil ${(threshold * 100).toFixed(0)}%)`);
            } else {
              console.log(`[Upload] Pas de pré-sélection: score ${(bestPrediction.score * 100).toFixed(0)}% < seuil configuré ${(threshold * 100).toFixed(0)}% pour ${bestPrediction.label}`);
            }
          }
          
          setPreviews(prev => prev.map((p, idx) => idx === i ? {
            ...p,
            tempId: data.tempId ?? p.tempId,
            filename: data.filename ?? p.filename,
            sha256: data.sha256 ?? '',
            mime: data.mime ?? p.mime,
            size: data.size ?? p.size,
            // Prédictions avec validation
            predictions,
            autoAssigned: data.autoAssigned ?? false,
            assignedTypeCode: preselectedType || data.assignedTypeCode || null,
            // Duplicate avec validation
            duplicate: {
              isDuplicate: !!data.dedupResult && data.dedupResult.duplicateType !== 'none',
              ofDocumentId: data.dedupResult?.matchedDocument?.id ?? undefined,
              documentName: data.dedupResult?.matchedDocument?.name ?? undefined,
              documentType: data.dedupResult?.matchedDocument?.type ?? undefined,
              uploadedAt: data.dedupResult?.matchedDocument?.uploadedAt ?? undefined,
              reason: data.dedupResult?.ui?.recommendation ?? undefined,
            },
            // Preview avec validation stricte
            extractedPreview: {
              textSnippet: typeof data.extractedPreview?.textSnippet === 'string' 
                ? data.extractedPreview.textSnippet 
                : '',
              textLength: typeof data.extractedPreview?.textLength === 'number'
                ? data.extractedPreview.textLength
                : 0,
              source: data.extractedPreview?.source ?? 'pdf-text',
              fields: data.extractedPreview?.DocumentField ?? {},
            },
            // 1) Stocker les métadonnées OCR
            ocrMeta: data.ocrMeta ? {
              sha256: data.ocrMeta.sha256 || data.sha256 || '',
              length: data.ocrMeta.length || data.textLength || 0,
              preview: data.ocrMeta.preview || data.textPreview || '',
              source: data.ocrMeta.source || data.extractedPreview?.source || 'pdf-text',
              pagesOcred: data.ocrMeta.pagesOcred,
            } : undefined,
            status: 'ready' as const,
          } : p));
          
          // 4) Pré-sélectionner le type si au-dessus du seuil
          if (i === currentIndex && preselectedType) {
            setSelectedType(preselectedType);
          }

          // 5) Vérifier les résultats de l'agent Dedup et orchestrer avec DedupFlow
          if (data.dedupResult && data.dedupResult.duplicateType !== 'none') {
            console.log('[UploadReview] Doublon détecté par agent Dedup:', data.dedupResult);
            
            // Orchestrer le flux avec DedupFlow
            const dedupFlowInput: DedupFlowInput = {
              duplicateType: data.dedupResult.duplicateType === 'exact_duplicate' ? 'exact_duplicate' : 'probable_duplicate',
              existingFile: data.dedupResult.matchedDocument ? {
                id: data.dedupResult.matchedDocument.id,
                name: data.dedupResult.matchedDocument.name,
                uploadedAt: data.dedupResult.matchedDocument.uploadedAt,
                size: data.dedupResult.matchedDocument.size || 0,
                mime: data.dedupResult.matchedDocument.mime || 'application/octet-stream'
              } : undefined,
              tempFile: {
                tempId: data.tempId,
                originalName: file.name,
                size: file.size,
                mime: file.type || 'application/octet-stream',
                checksum: data.sha256
              },
              userDecision: 'pending' // D'abord afficher la modale de détection
            };

            const dedupFlowContext: DedupFlowContext = {
              scope: scope === 'property' ? 'property' : 'global',
              scopeId: propertyId || leaseId || tenantId,
              metadata: {
                documentType: data.assignedTypeCode,
                extractedFields: data.extractedPreview?.DocumentField,
                predictions: data.predictions
              }
            };

            // Orchestrer le flux
            const flowResult = await orchestrateFlow(dedupFlowInput, dedupFlowContext);
            console.log('[UploadReview] Résultat orchestration DedupFlow:', flowResult);
            
            // Afficher la modale DedupFlow
            setCurrentFileIndex(i);
            setShowDedupFlowModal(true);
            console.log('[UploadReview] showDedupFlowModal défini à true');
            
            // Marquer le fichier comme en attente de décision
            setPreviews(prev => prev.map((p, idx) => idx === i ? {
              ...p,
              status: 'duplicate_detected' as const,
              dedupResult: data.dedupResult
            } : p));
          }
        } else {
          // Gérer les erreurs d'upload
          setPreviews(prev => prev.map((p, idx) => idx === i ? {
            ...p,
            status: 'error' as const,
            error: result.error || 'Erreur d\'upload'
          } : p));
        }
      } catch (error) {
        console.error(`Erreur upload fichier ${i}:`, error);
        setPreviews(prev => prev.map((p, idx) => idx === i ? {
          ...p,
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'Erreur d\'upload'
        } : p));
      }
    }
  };

  // Ancien gestionnaire handleDedupAction supprimé - Remplacé par handleDedupFlowAction

  // Gestionnaire pour les actions de DedupFlow
  const handleDedupFlowAction = async (action: 'confirm' | 'replace' | 'cancel' | 'keep_both', data?: any) => {
    if (!flowOutput || currentFileIndex < 0) return;

    console.log('[UploadReview] Action DedupFlow:', action, data);

    try {
      if (action === 'cancel') {
        // Annuler l'upload de ce fichier
        setPreviews(prev => prev.map((p, idx) => idx === currentFileIndex ? {
          ...p,
          status: 'error' as const,
          error: 'Upload annulé - doublon détecté'
        } : p));
        
        // Appeler l'API pour supprimer le fichier temporaire
        if (data?.api?.endpoint) {
          await fetch(data.api.endpoint, { method: data.api.method });
        }
        
        // Fermer complètement les modales
        setShowDedupFlowModal(false);
        resetDedupFlow();
        onClose(); // Fermer la modal d'upload principale
        return;
      } else if (action === 'keep_both') {
        // Déclencher la 2ème modale (revue de l'upload)
        console.log('[UploadReview] Déclenchement de la 2ème modale pour "Conserver les deux"');
        
        // Créer un nouveau flux pour la 2ème modale
        const secondFlowInput: DedupFlowInput = {
          duplicateType: 'exact_duplicate',
          existingFile: data.existingFile,
          tempFile: data.tempFile,
          userDecision: 'keep_both'
        };
        
        // Récupérer le contexte depuis les données ou le recréer
        const context: DedupFlowContext = {
          scope: scope === 'property' ? 'property' : 'global',
          scopeId: propertyId || leaseId || tenantId,
          metadata: {
            documentType: currentPreview.assignedTypeCode,
            extractedFields: currentPreview.extractedPreview?.DocumentField,
            predictions: currentPreview.predictions
          }
        };
        
        // Orchestrer la 2ème modale
        await orchestrateFlow(secondFlowInput, context);
        
        // S'assurer que la modal reste affichée avec le nouveau contenu
        setShowDedupFlowModal(true);
        
        // La modale DedupFlow restera ouverte avec le nouveau contenu
        return; // Ne pas fermer la modale
        
      } else if (action === 'confirm') {
        // Enregistrer directement le fichier avec les flags de doublon
        console.log('[UploadReview] Enregistrement direct du fichier avec doublon conservé manuellement');
        
        // Marquer le fichier comme en cours d'enregistrement
        setPreviews(prev => prev.map((p, idx) => idx === currentFileIndex ? {
          ...p,
          status: 'ready' as const,
          duplicateAction: 'keep' as const,
          dedupResult: { 
            ...(p.dedupResult || {}), 
            action: 'keep_both',
            userForcesDuplicate: true,
            skipDuplicateCheck: true,
            userReason: 'doublon_conserve_manuellement'
          }
        } : p));
        
        // Enregistrer directement le fichier avec les flags de doublon
        await handleConfirmWithFlags({
          userForcesDuplicate: true,
          skipDuplicateCheck: true,
          userReason: 'doublon_conserve_manuellement'
        });
        return; // Ne pas fermer la modale DedupFlow ici, handleConfirm s'en charge
      }

      // Fermer la modale DedupFlow
      setShowDedupFlowModal(false);
      resetDedupFlow();
      
    } catch (error) {
      console.error('[UploadReview] Erreur action DedupFlow:', error);
      alert(`Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  const handleConfirmWithFlags = async (flags: { userForcesDuplicate: boolean; skipDuplicateCheck: boolean; userReason: string }) => {
    if (!currentPreview) {
      alert('Aucun fichier à traiter');
      return;
    }
    
    // Pour les doublons conservés, ne pas exiger de type car l'API va hériter du type de l'original
    const isDuplicateKept = flags.userForcesDuplicate || flags.skipDuplicateCheck;
    
    console.log('[UploadReview] Validation type avec flags:', {
      selectedType,
      isDuplicateKept,
      flags
    });
    
    if (!selectedType && !isDuplicateKept) {
      alert('Veuillez sélectionner un type de document');
      return;
    }

    // 6) Vérifier si une action sur le doublon est nécessaire
    // Utiliser les flags passés en paramètre au lieu de currentPreview.dedupResult
    const { userForcesDuplicate, skipDuplicateCheck } = flags;
    
    console.log('[UploadReview] Validation doublon avec flags:', {
      isDuplicate: currentPreview.duplicate.isDuplicate,
      duplicateAction: currentPreview.duplicateAction,
      userForcesDuplicate,
      skipDuplicateCheck,
      flags
    });
    
    if (currentPreview.duplicate.isDuplicate && !currentPreview.duplicateAction && !userForcesDuplicate && !skipDuplicateCheck) {
      alert('Ce fichier est un doublon. Veuillez choisir une action (Voir, Remplacer ou Uploader quand même)');
      return;
    }

    setIsConfirming(true);

    try {
      // Déterminer le type de document à utiliser (comme dans handleConfirm)
      const finalTypeCode = autoLinkingDocumentType || selectedType;
      
      const response = await fetch('/api/documents/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tempId: currentPreview.tempId,
          typeCode: finalTypeCode, // Utiliser le nouveau champ typeCode
          chosenTypeId: finalTypeCode || undefined, // Rétrocompatibilité
          predictions: currentPreview.predictions || [],
          ocrText: '', // Le texte complet est maintenant dans le meta.json
          context: (() => {
            // Déterminer le contexte de liaison (comme dans handleConfirm)
            if (autoLinkingContext && (autoLinkingContext.leaseId || autoLinkingContext.propertyId || autoLinkingContext.tenantsIds?.length)) {
              if (autoLinkingContext.leaseId) {
                return {
                  entityType: 'LEASE' as const,
                  entityId: autoLinkingContext.leaseId
                };
              } else if (autoLinkingContext.propertyId) {
                return {
                  entityType: 'PROPERTY' as const,
                  entityId: autoLinkingContext.propertyId
                };
              } else if (autoLinkingContext.tenantsIds?.length) {
                return {
                  entityType: 'TENANT' as const,
                  entityId: autoLinkingContext.tenantsIds[0]
                };
              }
            }
            // Fallback sur le contexte manuel
            return {
              entityType: (scope === 'property' ? 'PROPERTY' : scope === 'lease' ? 'LEASE' : scope === 'tenant' ? 'TENANT' : 'GLOBAL') as const,
              entityId: propertyId || leaseId || tenantId || undefined,
            };
          })(),
          customName: customName !== currentPreview.filename ? customName : undefined,
          // Actions sur doublons
          replaceDuplicateId: currentPreview.duplicateAction === 'replace' 
            ? currentPreview.dedupResult?.matchedDocument?.id 
            : undefined,
          keepDespiteDuplicate: flags.userForcesDuplicate || currentPreview.duplicateAction === 'keep',
          // Raison utilisateur pour les doublons conservés manuellement
          userReason: flags.userReason || undefined,
        }),
      });

      const result = await response.json();

      // 2) Gérer l'erreur 410 TEMP_EXPIRED
      if (!result.success && response.status === 410 && result.error === 'TEMP_EXPIRED') {
        alert('⏱️ Le fichier temporaire a expiré\n\nVeuillez recharger le fichier pour continuer.');
        
        // Marquer le preview comme expiré
        setPreviews(prev => prev.map((p, idx) => idx === currentIndex ? {
          ...p,
          status: 'error' as const,
          error: 'Fichier temporaire expiré - Rechargez le fichier'
        } : p));
        
        return;
      }

      if (result.success) {
        // 3) Succès - Toast et fermeture
        console.log('✅ Document enregistré:', result.documentId);
        
        // Fermer la modale DedupFlow si elle est ouverte
        if (showDedupFlowModal) {
          setShowDedupFlowModal(false);
          resetDedupFlow();
        }
        
        // Marquer comme confirmé
        setPreviews(prev => prev.map((p, idx) => idx === currentIndex ? {
          ...p,
          status: 'confirmed' as const
        } : p));

        // 🤖 Essayer de suggérer une transaction depuis le document
        const suggestionShown = await tryTransactionSuggestion(result.documentId, finalTypeCode);
        
        // Si pas de suggestion affichée, continuer le flux normal
        if (!suggestionShown) {
          // Passer au suivant ou fermer
          if (currentIndex < previews.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setKeepDuplicate(false);
          } else {
            // 3) Tous les fichiers traités - Toast succès
            alert('✅ Document(s) enregistré(s) avec succès !');
            
            // 3) Invalider/refetch la liste
            if (onSuccess) {
              onSuccess();
            }
            onClose();
          }
        }
      } else {
        alert(`Erreur: ${result.error || 'Erreur lors de l\'enregistrement'}`);
      }
    } catch (error) {
      console.error('Erreur confirmation:', error);
      alert('Erreur lors de la confirmation');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleConfirm = async () => {
    if (!currentPreview) {
      alert('Aucun fichier à traiter');
      return;
    }
    
    // Pour les doublons conservés, ne pas exiger de type car l'API va hériter du type de l'original
    const isDuplicateKept = currentPreview.dedupResult?.userForcesDuplicate || 
                           currentPreview.dedupResult?.skipDuplicateCheck ||
                           currentPreview.duplicateAction === 'keep_both';
    
    console.log('[UploadReview] Validation type:', {
      selectedType,
      isDuplicateKept,
      dedupResult: currentPreview.dedupResult,
      duplicateAction: currentPreview.duplicateAction,
      userForcesDuplicate: currentPreview.dedupResult?.userForcesDuplicate,
      skipDuplicateCheck: currentPreview.dedupResult?.skipDuplicateCheck
    });
    
    // Désactiver temporairement la validation pour déboguer
    if (!selectedType && !isDuplicateKept) {
      console.log('[UploadReview] Validation échouée - selectedType:', selectedType, 'isDuplicateKept:', isDuplicateKept);
      alert('Veuillez sélectionner un type de document');
      return;
    }
    
    console.log('[UploadReview] Validation réussie - selectedType:', selectedType, 'isDuplicateKept:', isDuplicateKept);

    // 6) Vérifier si une action sur le doublon est nécessaire
    // Ignorer la validation si l'utilisateur a forcé la conservation via DedupFlow
    const userForcesDuplicate = currentPreview.dedupResult?.userForcesDuplicate || false;
    const skipDuplicateCheck = currentPreview.dedupResult?.skipDuplicateCheck || false;
    
    console.log('[UploadReview] Validation doublon:', {
      isDuplicate: currentPreview.duplicate.isDuplicate,
      duplicateAction: currentPreview.duplicateAction,
      userForcesDuplicate,
      skipDuplicateCheck,
      dedupResult: currentPreview.dedupResult
    });
    
    if (currentPreview.duplicate.isDuplicate && !currentPreview.duplicateAction && !userForcesDuplicate && !skipDuplicateCheck) {
      alert('Ce fichier est un doublon. Veuillez choisir une action (Voir, Remplacer ou Uploader quand même)');
      return;
    }

    // Éviter les appels multiples
    if (isConfirming) {
      console.log('[UploadReview] Confirmation déjà en cours, ignoré');
      return;
    }
    
    setIsConfirming(true);

    try {
      // Déterminer le type de document à utiliser
      const finalTypeCode = autoLinkingDocumentType || selectedType;
      
      // Déterminer le contexte de liaison
      let finalContext;
      if (autoLinkingContext && (autoLinkingContext.leaseId || autoLinkingContext.propertyId || autoLinkingContext.tenantsIds?.length)) {
        // Utiliser le contexte de liaison automatique seulement s'il contient des données
        if (autoLinkingContext.leaseId) {
          finalContext = {
            entityType: 'LEASE' as const,
            entityId: autoLinkingContext.leaseId
          };
        } else if (autoLinkingContext.propertyId) {
          finalContext = {
            entityType: 'PROPERTY' as const,
            entityId: autoLinkingContext.propertyId
          };
        } else if (autoLinkingContext.tenantsIds?.length) {
          finalContext = {
            entityType: 'TENANT' as const,
            entityId: autoLinkingContext.tenantsIds[0]
          };
        } else {
          // Contexte vide, utiliser GLOBAL
          finalContext = {
            entityType: 'GLOBAL' as const,
            entityId: undefined,
          };
        }
      } else {
        // Utiliser le contexte standard
        finalContext = {
          entityType: scope === 'property' ? 'PROPERTY' : 'GLOBAL',
          entityId: propertyId || leaseId || tenantId || undefined,
        };
      }

      console.log('[UploadReview] 🔧 Appel de l\'API de finalisation...');
      console.log('[UploadReview] 🔧 finalTypeCode:', finalTypeCode);
      console.log('[UploadReview] 🔧 finalContext:', JSON.stringify(finalContext, null, 2));
      console.log('[UploadReview] 🔧 tempId:', currentPreview.tempId);
      console.log('[UploadReview] 🔧 strategy:', strategy);

      let response;
      
      // Mode staging : uploader en mode draft
      if (strategy?.mode === 'staged' && strategy.uploadSessionId) {
        console.log('[UploadReview] 🔧 Mode staging activé');
        
        const formData = new FormData();
        formData.append('file', currentPreview.file);
        formData.append('uploadSessionId', strategy.uploadSessionId);
        formData.append('typeId', finalTypeCode);
        if (strategy.linkContext) {
          formData.append('intendedContextType', strategy.linkContext.type);
          if (strategy.linkContext.tempKey) {
            formData.append('intendedContextTempKey', strategy.linkContext.tempKey);
          }
        }

        response = await fetch('/api/uploads/staged', {
          method: 'POST',
          body: formData,
        });
      } else {
        // Mode normal : finalisation immédiate
        console.log('[UploadReview] 🔧 Mode normal (finalisation immédiate)');
        
        response = await fetch('/api/documents/finalize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tempId: currentPreview.tempId,
            typeCode: finalTypeCode, // Utiliser le nouveau champ typeCode
            chosenTypeId: finalTypeCode, // Rétrocompatibilité
            predictions: currentPreview.predictions || [],
            ocrText: '', // Le texte complet est maintenant dans le meta.json
            context: finalContext,
            customName: customName !== currentPreview.filename ? customName : undefined,
            // Actions sur doublons
            replaceDuplicateId: currentPreview.duplicateAction === 'replace' 
              ? currentPreview.dedupResult?.matchedDocument?.id 
              : undefined,
            keepDespiteDuplicate: currentPreview.duplicateAction === 'keep',
            // Raison utilisateur pour les doublons conservés manuellement
            userReason: currentPreview.dedupResult?.userReason || undefined,
          }),
        });
      }

      console.log('[UploadReview] 🔧 Réponse de l\'API:', response.status, response.statusText);

      const result = await response.json();

      // 2) Gérer l'erreur 410 TEMP_EXPIRED
      if (!result.success && response.status === 410 && result.error === 'TEMP_EXPIRED') {
        alert('⏱️ Le fichier temporaire a expiré\n\nVeuillez recharger le fichier pour continuer.');
        
        // Marquer le preview comme expiré
        setPreviews(prev => prev.map((p, idx) => idx === currentIndex ? {
          ...p,
          status: 'error' as const,
          error: 'Fichier temporaire expiré - Rechargez le fichier'
        } : p));
        
        return;
      }

      if (result.success) {
        // 3) Succès - Toast et fermeture
        console.log('✅ Document enregistré:', result.documentId);
        
        // Fermer la modale DedupFlow si elle est ouverte
        if (showDedupFlowModal) {
          setShowDedupFlowModal(false);
          resetDedupFlow();
        }
        
        // Marquer comme confirmé
        setPreviews(prev => prev.map((p, idx) => idx === currentIndex ? {
          ...p,
          status: 'confirmed' as const
        } : p));

        // 🤖 Essayer de suggérer une transaction depuis le document
        const suggestionShown = await tryTransactionSuggestion(result.documentId, finalTypeCode);
        
        // Si pas de suggestion affichée, continuer le flux normal
        if (!suggestionShown) {
          // Passer au suivant ou fermer
          if (currentIndex < previews.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setKeepDuplicate(false);
          } else {
            // 3) Tous les fichiers traités - Toast succès
            alert('✅ Document(s) enregistré(s) avec succès !');
            
            // 3) Invalider/refetch la liste
            if (onSuccess) {
              onSuccess();
            }
            onClose();
          }
        }
      } else {
        alert(`Erreur: ${result.error || 'Erreur lors de l\'enregistrement'}`);
      }
    } catch (error) {
      console.error('Erreur confirmation:', error);
      alert('Erreur lors de la confirmation');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleViewExisting = () => {
    if (currentPreview?.dedupResult?.matchedDocument?.id) {
      window.open(`/documents/${currentPreview.dedupResult.matchedDocument.id}`, '_blank');
    }
  };

  // 6) Gérer l'action "Remplacer (versioning)"
  const handleReplace = () => {
    if (!currentPreview?.dedupResult?.matchedDocument?.id) return;
    
    // Marquer l'action de remplacement
    setPreviews(prev => prev.map((p, idx) => idx === currentIndex ? {
      ...p,
      duplicateAction: 'replace' as const
    } : p));
    
    console.log('[Upload] Action doublon: Remplacer (versioning)');
  };

  // 6) Gérer l'action "Uploader quand même"
  const handleKeepDuplicate = () => {
    // Marquer l'action de conservation (force nouveau doc)
    setPreviews(prev => prev.map((p, idx) => idx === currentIndex ? {
      ...p,
      duplicateAction: 'keep' as const
    } : p));
    
    console.warn('[Upload] Action doublon: Uploader quand même (déconseillé - même SHA)');
  };

  const isPDF = currentPreview?.mime === 'application/pdf';
  const isImage = currentPreview?.mime.startsWith('image/');
  
  // ID unique pour l'accessibilité
  const modalDescId = useId();
  
  // 2) Référence pour l'input file (changer de fichier)
  const changeFileInputRef = React.useRef<HTMLInputElement>(null);
  
  // 2) Handler pour changer le fichier analysé
  const handleChangeFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFile = event.target.files?.[0];
    if (newFile) {
      // Remplacer le fichier actuel et relancer l'analyse
      const newFiles = [...files];
      newFiles[currentIndex] = newFile;
      
      // Réinitialiser le preview actuel
      setPreviews(prev => prev.map((p, idx) => idx === currentIndex ? {
        file: newFile,
        filename: newFile.name,
        mime: newFile.type,
        size: newFile.size,
        predictions: [],
        autoAssigned: false,
        assignedTypeCode: null,
        // Réinitialiser complètement les données de doublons
        duplicate: { isDuplicate: false },
        dedupResult: {
          duplicateType: 'none',
          suggestedAction: 'proceed',
          isDuplicate: false
        },
        extractedPreview: {
          textSnippet: '',
          textLength: 0,
          source: '',
          fields: {}
        },
        status: 'uploading' as const
      } : p));
      
      setCustomName(newFile.name);
      setSelectedType('');
      
      // Fermer la modale DedupFlow si elle est ouverte
      setShowDedupFlowModal(false);
      resetDedupFlow();
      
      // Relancer l'upload pour ce fichier
      uploadSingleFile(newFile, currentIndex);
    }
    
    // Reset input
    if (event.target) {
      event.target.value = '';
    }
  };
  
  // Fonction pour uploader un seul fichier
  const uploadSingleFile = async (file: File, index: number) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success && result.data) {
        const data = result.data;
        const predictions = Array.isArray(data.predictions) ? data.predictions : [];
        
        let preselectedType = '';
        
        // Forcer le type BAIL_SIGNE si on est dans ce contexte
        if (autoLinkingDocumentType === 'BAIL_SIGNE') {
          preselectedType = 'BAIL_SIGNE';
          console.log('[Upload] Forçage du type BAIL_SIGNE lors du changement de fichier');
        } else if (predictions.length > 0 && predictions[0].score >= predictions[0].threshold) {
          preselectedType = predictions[0].typeCode;
        }
        
        setPreviews(prev => prev.map((p, idx) => idx === index ? {
          ...p,
          tempId: data.tempId ?? p.tempId,
          filename: data.filename ?? p.filename,
          sha256: data.sha256 ?? '',
          mime: data.mime ?? p.mime,
          size: data.size ?? p.size,
          predictions,
          autoAssigned: data.autoAssigned ?? false,
          assignedTypeCode: preselectedType || data.assignedTypeCode || null,
          // Mettre à jour le nouveau système de détection de doublons
          dedupResult: data.dedupResult ? {
            duplicateType: data.dedupResult.duplicateType,
            suggestedAction: data.dedupResult.suggestedAction,
            matchedDocument: data.dedupResult.matchedDocument,
            signals: data.dedupResult.signals,
            ui: data.dedupResult.ui,
            isDuplicate: data.dedupResult.duplicateType !== 'none'
          } : {
            duplicateType: 'none',
            suggestedAction: 'proceed',
            isDuplicate: false
          },
          // Maintenir la compatibilité avec l'ancien système
          duplicate: {
            isDuplicate: !!data.dedupResult && data.dedupResult.duplicateType !== 'none',
            ofDocumentId: data.dedupResult?.matchedDocument?.id ?? undefined,
            documentName: data.dedupResult?.matchedDocument?.name ?? undefined,
            documentType: data.dedupResult?.matchedDocument?.type ?? undefined,
            uploadedAt: data.dedupResult?.matchedDocument?.uploadedAt ?? undefined,
            reason: data.dedupResult?.ui?.recommendation ?? undefined,
          },
          extractedPreview: {
            textSnippet: typeof data.extractedPreview?.textSnippet === 'string' 
              ? data.extractedPreview.textSnippet 
              : '',
            textLength: typeof data.extractedPreview?.textLength === 'number'
              ? data.extractedPreview.textLength
              : 0,
            source: data.extractedPreview?.source ?? 'pdf-text',
            fields: data.extractedPreview?.DocumentField ?? {},
          },
          ocrMeta: data.ocrMeta ? {
            sha256: data.ocrMeta.sha256 || data.sha256 || '',
            length: data.ocrMeta.length || data.textLength || 0,
            preview: data.ocrMeta.preview || data.textPreview || '',
            source: data.ocrMeta.source || data.extractedPreview?.source || 'pdf-text',
            pagesOcred: data.ocrMeta.pagesOcred,
          } : undefined,
          status: (data.dedupResult && data.dedupResult.duplicateType !== 'none') ? 'duplicate_detected' as const : 'ready' as const,
        } : p));
        
        if (index === currentIndex && preselectedType) {
          setSelectedType(preselectedType);
        }
        
        // Orchestrer DedupFlow si un doublon est détecté
        if (data.dedupResult && data.dedupResult.duplicateType !== 'none') {
          console.log('[UploadReview] Doublon détecté lors du changement de fichier, orchestration DedupFlow...');
          
          // Utiliser la même structure que dans uploadFiles
          const dedupFlowInput: DedupFlowInput = {
            duplicateType: data.dedupResult.duplicateType === 'exact_duplicate' ? 'exact_duplicate' : 'probable_duplicate',
            existingFile: data.dedupResult.matchedDocument ? {
              id: data.dedupResult.matchedDocument.id,
              name: data.dedupResult.matchedDocument.name,
              uploadedAt: data.dedupResult.matchedDocument.uploadedAt,
              size: data.dedupResult.matchedDocument.size || 0,
              mime: data.dedupResult.matchedDocument.mime || 'application/octet-stream'
            } : undefined,
            tempFile: {
              tempId: data.tempId,
              originalName: file.name,
              size: file.size,
              mime: file.type || 'application/octet-stream',
              checksum: data.sha256
            },
            userDecision: 'pending' // D'abord afficher la modale de détection
          };

          const dedupFlowContext: DedupFlowContext = {
            scope: scope === 'property' ? 'property' : 'global',
            scopeId: propertyId || leaseId || tenantId,
            metadata: {
              documentType: data.assignedTypeCode,
              extractedFields: data.extractedPreview?.DocumentField,
              predictions: predictions
            }
          };
          
          // Orchestrer le flux
          const flowResult = await orchestrateFlow(dedupFlowInput, dedupFlowContext);
          console.log('[UploadReview] Résultat orchestration DedupFlow (changement fichier):', flowResult);
          
          // Afficher la modale DedupFlow
          setCurrentFileIndex(index);
          setShowDedupFlowModal(true);
          console.log('[UploadReview] showDedupFlowModal défini à true (changement fichier)');
        }
      } else {
        setPreviews(prev => prev.map((p, idx) => idx === index ? {
          ...p,
          status: 'error' as const,
          error: result.error || 'Erreur d\'upload'
        } : p));
      }
    } catch (error) {
      console.error(`Erreur upload fichier ${index}:`, error);
      setPreviews(prev => prev.map((p, idx) => idx === index ? {
        ...p,
        status: 'error' as const,
        error: error instanceof Error ? error.message : 'Erreur d\'upload'
      } : p));
    }
  };

  // Mode review-draft - interface simplifiée
  if (isReviewDraftMode) {
    return (
      <>
      <Dialog open={isOpen && !showTransactionModal} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Modifier le document brouillon
            </DialogTitle>
            <DialogDescription>
              Modifiez le nom et le type de ce document en brouillon.
            </DialogDescription>
          </DialogHeader>

          {/* Bandeau jaune pour le mode brouillon */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-900 font-medium">
                  Mode brouillon activé
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Ce document est en brouillon et sera finalisé lors de la création de la transaction.
                </p>
              </div>
            </div>
          </div>

          {isLoadingDraft ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-3">Chargement du document...</span>
            </div>
          ) : draftData ? (
            <div className="space-y-6">
              {/* Nom du document */}
              <div className="space-y-2">
                <Label htmlFor="draft-name">Nom du document</Label>
                <Input
                  id="draft-name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Nom du document"
                />
              </div>

              {/* Type de document */}
              <div className="space-y-2">
                {autoLinkingDocumentType && !documentTypeEditable ? (
                  // Mode verrouillé : affichage en lecture seule
                  <div>
                    <Label htmlFor="draft-type">Type de document</Label>
                    <input
                      type="text"
                      value={documentTypes.find(t => t.code === autoLinkingDocumentType)?.label || autoLinkingDocumentType}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        <FileText className="h-4 w-4 mr-1" />
                        Type pré-rempli: {documentTypes.find(t => t.code === autoLinkingDocumentType)?.label || autoLinkingDocumentType}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        Non modifiable
                      </span>
                    </div>
                  </div>
                ) : (
                  // Mode création/édition : SearchableSelect
                  <div>
                    <SearchableSelect
                      options={documentTypes.map(type => ({
                        id: type.code,
                        value: type.code,
                        label: type.label
                      }))}
                      value={selectedType || ''}
                      onChange={(value) => {
                        console.log('[UploadReview] Changement de type sélectionné:', value);
                        setSelectedType(value);
                      }}
                      placeholder="Rechercher un type de document..."
                      required
                      label="Type de document"
                      className=""
                    />
                  </div>
                )}
              </div>

              {/* Prédictions - Afficher seulement le meilleur score */}
              {draftData.predictions && draftData.predictions.length > 0 && (() => {
                const bestPrediction = draftData.predictions[0];
                const isTypeLocked = autoLinkingDocumentType && !documentTypeEditable;
                return (
                  <div className="space-y-2">
                    <Label>Prédiction suggérée</Label>
                    {autoLinkingDocumentType && !documentTypeEditable && (
                      <p className="text-xs text-gray-500 mt-1">
                        Les prédictions sont désactivées car le type de document est verrouillé
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Badge
                        variant="default"
                        className={
                          isTypeLocked 
                            ? 'opacity-50 cursor-not-allowed' 
                            : 'cursor-pointer hover:bg-blue-50'
                        }
                        onClick={() => {
                          if (isTypeLocked) return;
                          
                          console.log('[UploadReview] Clic sur prédiction:', bestPrediction);
                          if (bestPrediction.typeCode) {
                            setSelectedType(bestPrediction.typeCode);
                            console.log('[UploadReview] Type sélectionné:', bestPrediction.typeCode);
                          } else {
                            console.log('[UploadReview] Aucun typeCode disponible pour cette prédiction');
                          }
                        }}
                      >
                        {bestPrediction.label} ({Math.round(bestPrediction.score * 100)}%)
                      </Badge>
                    </div>
                  </div>
                );
              })()}

              {/* Champs extraits */}
              {draftData.fieldsExtracted && Object.keys(draftData.fieldsExtracted).length > 0 && (
                <div className="space-y-2">
                  <Label>Champs extraits</Label>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <pre className="text-xs text-gray-600">
                      {JSON.stringify(draftData.fieldsExtracted, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Boutons d'action */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={isSavingDraft}
                >
                  Annuler
                </Button>
                <Button
                  onClick={saveDraftDocument}
                  disabled={isSavingDraft}
                  className="flex items-center gap-2"
                >
                  {isSavingDraft ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Enregistrer le brouillon
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">Erreur lors du chargement du document</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
    );
  }

  return (
    <>
    <Dialog open={isOpen && !showTransactionModal} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0" aria-describedby={modalDescId}>
        {/* Header fixe */}
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b">
          <DialogTitle>
            Revuess de l'upload - {currentIndex + 1} / {previews.length}
          </DialogTitle>
          <DialogDescription id={modalDescId}>
            Vérifiez le type de document et les champs extraits avant d'enregistrer.
          </DialogDescription>
        </DialogHeader>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {!currentPreview ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-3">Chargement...</span>
            </div>
          ) : (
            <div className="space-y-6">
            {/* Statut */}
            <div className="flex items-center gap-2">
              {currentPreview.status === 'uploading' && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="text-sm text-gray-600">Upload en cours...</span>
                </>
              )}
              {currentPreview.status === 'analyzing' && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                  <span className="text-sm text-gray-600">Analyse en cours...</span>
                </>
              )}
              {currentPreview.status === 'ready' && (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-gray-600">Prêt à enregistrer</span>
                </>
              )}
              {currentPreview.status === 'error' && (
                <>
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-red-600">{currentPreview.error}</span>
                </>
              )}
              {currentPreview.status === 'duplicate_detected' && !showDedupFlowModal && (
                <>
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <span className="text-sm text-orange-600">Doublon détecté - En attente de décision</span>
                </>
              )}
              {currentPreview.status === 'confirmed' && (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600">Enregistré</span>
                </>
              )}
            </div>

            {/* Bandeau doublon - Désactivé quand DedupFlow est actif */}
            {currentPreview.status === 'duplicate_detected' && !showDedupFlowModal && (
              <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 mr-3" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-orange-900">Document en doublon détecté</h3>
                    <p className="text-sm text-orange-800 mt-1">
                      Un document identique existe déjà:{' '}
                      <strong>{currentPreview.dedupResult?.matchedDocument?.name || 'Document existant'}</strong>
                      {' '}({currentPreview.dedupResult?.matchedDocument?.type || 'Type détecté'})
                      {currentPreview.dedupResult?.matchedDocument?.uploadedAt && (
                        <span className="text-xs">
                          {' '}- Uploadé le {new Date(currentPreview.dedupResult.matchedDocument.uploadedAt).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleViewExisting}
                        className="text-orange-700 border-orange-300 hover:bg-orange-100"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Voir l'existant
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleReplace}
                        disabled={isConfirming}
                        className="text-orange-700 border-orange-300 hover:bg-orange-100"
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Remplacer (versioning)
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleKeepDuplicate}
                        className="text-orange-700 border-orange-300 hover:bg-orange-100"
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Uploader quand même (déconseillé)
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Formulaire */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="docName">Nom du document</Label>
                <div className="flex gap-2">
                  <Input
                    id="docName"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Nom du fichier"
                    className="flex-1"
                  />
                  {/* 2) Bouton pour changer de fichier */}
                  <input
                    ref={changeFileInputRef}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/jpg"
                    onChange={handleChangeFile}
                    style={{ display: 'none' }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => changeFileInputRef.current?.click()}
                    title="Changer de fichier"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                {autoLinkingDocumentType && !documentTypeEditable ? (
                  // Mode verrouillé : affichage en lecture seule
                  <div className="space-y-2">
                    <Label htmlFor="docType">Type de document *</Label>
                    <input
                      type="text"
                      value={documentTypes.find(t => t.code === autoLinkingDocumentType)?.label || autoLinkingDocumentType}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        <FileText className="h-4 w-4 mr-1" />
                        Type pré-rempli: {documentTypes.find(t => t.code === autoLinkingDocumentType)?.label || autoLinkingDocumentType}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        Non modifiable
                      </span>
                    </div>
                  </div>
                ) : (
                  // Mode création/édition : SearchableSelect
                  <div className="space-y-2">
                    <SearchableSelect
                      options={documentTypes.map(type => ({
                        id: type.code,
                        value: type.code,
                        label: type.label
                      }))}
                      value={selectedType || ''}
                      onChange={(value) => setSelectedType(value)}
                      placeholder="Rechercher un type de document..."
                      required
                      label="Type de document *"
                      className=""
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Liaisons prévues (si contexte de liaison automatique) */}
            {linkingDescription.length > 0 && (
              <div>
                <Label>Liaisons automatiques</Label>
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700 mb-2">
                    Ce document sera automatiquement lié aux entités suivantes :
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {linkingDescription.map((desc, index) => (
                      <Badge key={index} variant="secondary" className="text-sm">
                        {desc}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Prédictions - Afficher seulement le meilleur score */}
            {(() => {
              // Validation robuste des prédictions
              const predictions = Array.isArray(currentPreview.predictions) 
                ? currentPreview.predictions 
                : [];
              
              // Vérifier si le type est verrouillé
              const isTypeLocked = autoLinkingDocumentType && !documentTypeEditable;
              
              // Prendre seulement la meilleure prédiction
              const bestPrediction = predictions.length > 0 ? predictions[0] : null;
              
              return bestPrediction && (
                <div>
                  <Label>Prédiction suggérée</Label>
                  {isTypeLocked && (
                    <p className="text-xs text-gray-500 mt-1">
                      Les prédictions sont désactivées car le type de document est verrouillé
                    </p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Badge
                      key={bestPrediction.typeCode || 'pred-0'}
                      variant="default"
                      className={
                        isTypeLocked 
                          ? 'opacity-50 cursor-not-allowed' 
                          : 'cursor-pointer hover:bg-blue-600'
                      }
                      onClick={() => {
                        if (!isTypeLocked) {
                          setSelectedType(bestPrediction.typeCode);
                        }
                      }}
                    >
                      {bestPrediction.label}: {Math.round((bestPrediction.score || 0) * 100)}%
                    </Badge>
                  </div>
                </div>
              );
            })()}

            {/* Tabs: Aperçu / Champs extraits */}
            <Tabs defaultValue="preview" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="preview">Aperçu</TabsTrigger>
                <TabsTrigger value="fields">Champs extraits</TabsTrigger>
              </TabsList>

              <TabsContent value="preview" className="mt-4">
                <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-auto">
                  {isPDF && currentPreview.tempId && (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                      <FileText className="h-12 w-12 mb-2 text-red-500" />
                      <p className="font-medium">Fichier PDF</p>
                      <p className="text-sm mt-1">
                        {currentPreview.filename}
                      </p>
                      <p className="text-xs mt-2 text-gray-400">
                        {(() => {
                          const textLength = typeof currentPreview.extractedPreview?.textLength === 'number'
                            ? currentPreview.extractedPreview.textLength
                            : 0;
                          return textLength > 0
                            ? `${textLength} caractères extraits`
                            : 'Aucun texte extrait';
                        })()}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => window.open(`/api/uploads/${currentPreview.tempId}`, '_blank')}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ouvrir le PDF
                      </Button>
                    </div>
                  )}
                  {isImage && currentPreview.tempId && (
                    <img
                      src={`/api/uploads/${currentPreview.tempId}`}
                      alt="Aperçu"
                      className="max-w-full h-auto rounded"
                    />
                  )}
                  {!isPDF && !isImage && (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                      <FileText className="h-12 w-12 mb-2" />
                      <p>Aperçu non disponible pour ce type de fichier</p>
                      <p className="text-xs mt-1">
                        {(() => {
                          const textLength = typeof currentPreview.extractedPreview?.textLength === 'number'
                            ? currentPreview.extractedPreview.textLength
                            : 0;
                          return textLength > 0
                            ? `${textLength} caractères extraits`
                            : 'Aucun texte extrait';
                        })()}
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="fields" className="mt-4">
                <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                  {(() => {
                    // Validation robuste des champs extraits
                    const fields = currentPreview.extractedPreview?.DocumentField ?? {};
                    const hasFields = Object.keys(fields).length > 0;
                    const source = typeof currentPreview.extractedPreview?.source === 'string'
                      ? currentPreview.extractedPreview.source
                      : 'Extraction automatique';
                    const textLength = typeof currentPreview.extractedPreview?.textLength === 'number'
                      ? currentPreview.extractedPreview.textLength
                      : 0;
                    
                    return hasFields ? (
                      <>
                        {Object.entries(fields).map(([key, value]) => (
                          <div key={key} className="flex items-start gap-2">
                            <span className="text-sm font-medium text-gray-700 min-w-32 capitalize">
                              {key.replace(/_/g, ' ')}:
                            </span>
                            <span className="text-sm text-gray-900 font-medium">{value}</span>
                          </div>
                        ))}
                        <div className="pt-3 border-t mt-4">
                          <p className="text-xs text-gray-500">
                            Source: {source}
                            {' • '}
                            {textLength} caractères
                          </p>
                        </div>
                      </>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-8">
                      Aucun champ extrait automatiquement
                    </p>
                  );
                  })()}
                  {(() => {
                    // 2) Afficher le preview de l'OCR (300 chars max)
                    const preview = currentPreview.ocrMeta?.preview 
                      || currentPreview.extractedPreview?.textSnippet 
                      || '';
                    const length = currentPreview.ocrMeta?.length 
                      || currentPreview.extractedPreview?.textLength 
                      || 0;
                    const source = currentPreview.ocrMeta?.source 
                      || currentPreview.extractedPreview?.source 
                      || '';
                    
                    return preview && (
                      <div className="mt-4 pt-4 border-t">
                        <Label className="text-xs text-gray-600 flex items-center gap-2">
                          Aperçu du texte brut ({length} caractères)
                          {source && (
                            <Badge className={
                              source === 'pdf-parse' ? 'bg-green-500 text-white text-xs' :
                              source === 'tesseract' || source === 'pdf-ocr' ? 'bg-blue-500 text-white text-xs' :
                              'bg-gray-500 text-white text-xs'
                            }>
                              {source === 'pdf-parse' ? '📄 PDF natif' :
                               source === 'tesseract' ? '🔍 OCR' :
                               source === 'pdf-ocr' ? '📄🔍 PDF OCR' :
                               source}
                            </Badge>
                          )}
                        </Label>
                        <p className="text-xs text-gray-700 mt-1 font-mono bg-white p-2 rounded max-h-32 overflow-y-auto whitespace-pre-wrap">
                          {preview}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </TabsContent>
            </Tabs>

            </div>
          )}
        </div>

        {/* Footer fixe */}
        {currentPreview && (
          <div className="flex justify-between items-center px-6 py-4 border-t flex-shrink-0 bg-white">
            <Button
              variant="outline"
              onClick={() => {
                if (currentIndex > 0) {
                  setCurrentIndex(currentIndex - 1);
                  setKeepDuplicate(false);
                }
              }}
              disabled={currentIndex === 0}
            >
              Précédent
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onClose}
              >
                <X className="h-4 w-4 mr-1" />
                Annuler
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={
                  !selectedType ||
                  (currentPreview.status !== 'ready' && currentPreview.status !== 'duplicate_detected') ||
                  isConfirming ||
                  (currentPreview.duplicate.isDuplicate && !keepDuplicate)
                }
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    {currentIndex < previews.length - 1 ? 'Enregistrer et suivant' : 'Enregistrer'}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Ancienne modale de déduplication supprimée - Remplacée par DedupFlow */}

      {/* Modale DedupFlow */}
      {flowOutput && (
        <DedupFlowModal
          isOpen={showDedupFlowModal}
          onClose={() => {
            setShowDedupFlowModal(false);
            resetDedupFlow();
          }}
          flowOutput={flowOutput}
          onAction={handleDedupFlowAction}
          isProcessing={isDedupFlowProcessing}
        />
      )}

    </Dialog>

    {/* 🤖 Modale de suggestion de transaction depuis OCR - HORS du Dialog principal */}
    {showTransactionModal && transactionSuggestion && (
      <TransactionModalV2
        isOpen={showTransactionModal}
        onClose={() => {
          setShowTransactionModal(false);
          setTransactionSuggestion(null);
          setSuggestedDocumentId(null);
          
          // Continuer le flux normal après fermeture de la modale
          if (currentIndex < previews.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setKeepDuplicate(false);
          } else {
            if (onSuccess) onSuccess();
          }
        }}
        onSubmit={async (data) => {
          console.log('[UploadReview] 🎯 Création de la transaction depuis suggestion OCR:', data);
          
          try {
            // Créer la transaction via l'API
            const response = await fetch('/api/transactions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });

            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || 'Erreur lors de la création de la transaction');
            }

            const result = await response.json();
            console.log('[UploadReview] ✅ Transaction créée avec succès:', result);

            // Fermer après succès
            setShowTransactionModal(false);
            setTransactionSuggestion(null);
            if (onSuccess) onSuccess();
          } catch (error: any) {
            console.error('[UploadReview] ❌ Erreur création transaction:', error);
            throw error; // Laisser TransactionModalV2 gérer l'erreur
          }
        }}
        context={{
          type: transactionSuggestion.suggestions.propertyId ? 'property' : 'global',
          propertyId: transactionSuggestion.suggestions.propertyId
        }}
        mode="create"
        title="💡 Nouvelle transaction (suggérée par IA)"
        prefill={transactionSuggestion.suggestions}
        suggestionMeta={{
          documentId: suggestedDocumentId || undefined,
          confidence: transactionSuggestion.confidence,
          highlightedFields: Object.keys(transactionSuggestion.suggestions)
        }}
      />
    )}
  </>
  );
}


import React, { useState, useCallback } from 'react';
import { DocumentType } from '@/types/document';
import { DocumentTypeSelect } from '@/ui/shared/DocumentTypeSelect';
import { Button } from '@/ui/shared/button';
import { Input } from '@/ui/shared/input';
import { Label } from '@/ui/shared/label';
import { Textarea } from '@/ui/shared/textarea';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, FileText, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { useClassifyDocument, DocumentClassification } from '@/hooks/useDocuments';
import { suggestTypeGlobal, SuggestionResult } from '@/services/documentSuggestion';
import { getIcon } from '@/utils/icons';
import { Badge } from '@/ui/shared/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/shared/card';

interface TransactionAttachment {
  id?: string;
  name: string;
  size: number;
  mime: string;
  base64: string;
  documentTypeId?: string;
  documentType?: DocumentType;
  classification?: DocumentClassification;
  isClassifying?: boolean;
}

interface ExistingAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  documentType?: DocumentType;
}

interface TransactionDocumentUploadProps {
  attachments: TransactionAttachment[];
  onAttachmentsChange: (attachments: TransactionAttachment[]) => void;
  documentTypes: DocumentType[];
  propertyId?: string;
  leaseId?: string;
  tenantId?: string;
  loanId?: string;
  disabled?: boolean;
  existingAttachments?: ExistingAttachment[];
  onRemoveExisting?: (id: string) => void;
}

export function TransactionDocumentUpload({
  attachments,
  onAttachmentsChange,
  documentTypes,
  propertyId,
  leaseId,
  tenantId,
  loanId,
  disabled = false,
  existingAttachments = [],
  onRemoveExisting,
}: TransactionDocumentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [suggestionResult, setSuggestionResult] = useState<SuggestionResult | null>(null);
  const { toast } = useToast();
  const classifyDocument = useClassifyDocument();

  // Fonction pour déterminer la couleur du badge selon la confiance
  const getConfidenceBadgeVariant = (confidence: number) => {
    if (confidence >= 0.8) return "bg-success text-base-100"; // Vert - Très sûr
    if (confidence >= 0.6) return "bg-primary text-base-100"; // Bleu - Assez sûr
    if (confidence >= 0.4) return "bg-orange-500 text-base-100"; // Orange - Moyen
    return "bg-error text-base-100"; // Rouge - Faible
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return "Très sûr";
    if (confidence >= 0.6) return "Assez sûr";
    if (confidence >= 0.4) return "Moyen";
    return "Faible";
  };

  // Construire le contexte pour la classification
  const buildContext = () => {
    const parts = [];
    if (propertyId) parts.push('property');
    if (leaseId) parts.push('lease');
    if (tenantId) parts.push('tenant');
    if (loanId) parts.push('loan');
    return parts.length > 0 ? `from=transaction; entities=${parts.join(',')}` : 'from=transaction';
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    console.log('[TransactionDocumentUpload] Starting file upload, files:', files.length);
    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Vérifier la taille (10 Mo max)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Erreur",
          description: `Fichier trop volumineux: ${file.name} (max 10 Mo)`,
          variant: "destructive",
        });
        continue;
      }

      // Vérifier le type MIME
      const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedMimes.includes(file.type)) {
        toast({
          title: "Erreur",
          description: `Type de fichier non supporté: ${file.name}`,
          variant: "destructive",
        });
        continue;
      }

      // Convertir en base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        const base64Data = base64.split(',')[1];
        
        console.log('[TransactionDocumentUpload] File converted to base64:', file.name);
        
        const newAttachment: TransactionAttachment = {
          name: file.name,
          size: file.size,
          mime: file.type,
          base64: base64Data,
          isClassifying: true,
        };

        console.log('[TransactionDocumentUpload] Adding new attachment:', newAttachment.name);
        
        // Ajouter l'attachment d'abord, puis faire la classification
        console.log('[TransactionDocumentUpload] Adding attachment first:', newAttachment.name);
        onAttachmentsChange([...attachments, newAttachment]);
        
        // Faire la classification en arrière-plan sans affecter l'attachment
        setTimeout(async () => {
          try {
            // Classification automatique
            const context = buildContext();
            console.log('[TransactionDocumentUpload] Starting classification with context:', context);
            
            const classification = await classifyDocument.mutateAsync({
              context,
              filename: file.name,
              mime: file.type,
              ocr_excerpt: '', // Pas d'OCR pour les uploads directs
            });
            
            console.log('[TransactionDocumentUpload] Classification result:', classification);

            // Trouver le type de document correspondant
            const suggestedType = documentTypes.find(dt => dt.code === classification.type_code);
            
            // Mettre à jour l'attachment avec la classification
            const updatedAttachment: TransactionAttachment = {
              ...newAttachment,
              documentTypeId: suggestedType?.id || '',
              documentType: suggestedType,
              classification,
              isClassifying: false,
            };

            // Récupérer la liste actuelle des attachments et mettre à jour celui-ci
            const currentAttachments = [...attachments, newAttachment];
            const attachmentIndex = currentAttachments.findIndex(att => 
              att.name === newAttachment.name && att.size === newAttachment.size
            );
            
            if (attachmentIndex !== -1) {
              currentAttachments[attachmentIndex] = updatedAttachment;
              onAttachmentsChange(currentAttachments);
              console.log('[TransactionDocumentUpload] Updated attachment with classification:', updatedAttachment.name);
              
              if (classification.confidence >= 0.8) {
                toast({
                  title: "Type détecté automatiquement",
                  description: `${suggestedType?.label || classification.type_code} (${Math.round(classification.confidence * 100)}%)`,
                });
              }
            }

          } catch (error) {
            console.error('[TransactionDocumentUpload] Classification error:', error);
            
            // En cas d'erreur, juste marquer comme non-classifié
            const errorAttachment: TransactionAttachment = {
              ...newAttachment,
              isClassifying: false,
            };
            
            const currentAttachments = [...attachments, newAttachment];
            const attachmentIndex = currentAttachments.findIndex(att => 
              att.name === newAttachment.name && att.size === newAttachment.size
            );
            
            if (attachmentIndex !== -1) {
              currentAttachments[attachmentIndex] = errorAttachment;
              onAttachmentsChange(currentAttachments);
              console.log('[TransactionDocumentUpload] Marked attachment as non-classified:', errorAttachment.name);
            }
          }
        }, 100); // Petit délai pour éviter les conflits
      };
      
      reader.readAsDataURL(file);
    }

    // Reset input
    e.target.value = '';
    setIsUploading(false);
  }, [attachments, onAttachmentsChange, documentTypes, classifyDocument, toast, buildContext]);

  const updateAttachmentType = (index: number, documentTypeId: string) => {
    const documentType = documentTypes.find(dt => dt.id === documentTypeId);
    const updatedAttachments = [...attachments];
    updatedAttachments[index] = {
      ...updatedAttachments[index],
      documentTypeId,
      documentType,
    };
    onAttachmentsChange(updatedAttachments);
  };

  const removeAttachment = (index: number) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  console.log('[TransactionDocumentUpload] Rendering with:', { 
    attachmentsCount: attachments.length, 
    documentTypesCount: documentTypes.length,
    disabled,
    isUploading 
  });

  return (
    <div className="space-y-4">
      {/* Zone d'upload */}
      <div className="space-y-2">
        <Label>Documents joints</Label>
        <div className="border-2 border-dashed border-base-300 rounded-lg p-6 text-center hover:border-primary transition-colors">
          <input
            type="file"
            multiple
            onChange={(e) => {
              console.log('[TransactionDocumentUpload] File input changed!', e.target.files);
              handleFileUpload(e);
            }}
            className="hidden"
            id="transaction-document-upload"
            accept=".pdf,.jpg,.jpeg,.png"
            disabled={disabled || isUploading}
          />
          <label 
            htmlFor="transaction-document-upload" 
            className={`cursor-pointer ${(disabled || isUploading) ? 'opacity-50' : ''}`}
            onClick={() => console.log('[TransactionDocumentUpload] Label clicked!')}
          >
            <Upload className="h-8 w-8 mx-auto text-base-content opacity-60 mb-2" />
            <p className="text-sm font-medium text-base-content">
              {isUploading ? 'Analyse en cours...' : 'Déposer des documents ici'}
            </p>
            <p className="text-xs text-base-content opacity-70">
              PDF, JPG, PNG (max 10 MB)
            </p>
            <p className="text-xs text-primary mt-2">
              DEBUG: Composant actif ({attachments.length} fichiers)
            </p>
          </label>
        </div>
      </div>

      {/* Attachments existants */}
      {existingAttachments.length > 0 && (
        <div className="space-y-2">
          <Label>Documents existants</Label>
          <div className="space-y-2">
            {existingAttachments.map((existingAtt) => {
              const DocumentTypeIcon = existingAtt.DocumentType ? getIcon(existingAtt.DocumentType.icon) : FileText;
              
              return (
                <div key={existingAtt.id} className="flex items-center justify-between p-3 bg-base-200 rounded-lg border">
                  <div className="flex items-center space-x-3">
                    <DocumentTypeIcon className="h-5 w-5 text-base-content opacity-70" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-base-content truncate">
                        {existingAtt.filename}
                      </p>
                      <p className="text-xs text-base-content opacity-70">
                        {formatFileSize(existingAtt.size)} • {existingAtt.mimeType}
                        {existingAtt.DocumentType && (
                          <span className="ml-2 px-2 py-0.5 bg-blue-50 text-primary text-xs rounded-full inline-flex items-center gap-1">
                            <DocumentTypeIcon className="h-3 w-3" />
                            {existingAtt.DocumentType.label}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                <div className="flex items-center space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(existingAtt.url, '_blank')}
                    disabled={disabled}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {onRemoveExisting && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onRemoveExisting(existingAtt.id)}
                      disabled={disabled}
                      className="text-error hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Liste des documents uploadés */}
      {attachments.length > 0 && (
        <div className="space-y-3">
          {attachments.map((attachment, index) => (
            <div key={index} className="border rounded-lg p-4 bg-base-200">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-base-content opacity-70" />
                  <div>
                    <p className="text-sm font-medium text-base-content">{attachment.name}</p>
                    <p className="text-xs text-base-content opacity-70">{formatFileSize(attachment.size)}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAttachment(index)}
                  disabled={disabled}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Classification automatique */}
              {attachment.isClassifying && (
                <div className="flex items-center space-x-2 text-primary text-sm mb-3">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  <span>Classification automatique...</span>
                </div>
              )}
              
              {!attachment.isClassifying && !attachment.classification && (
                <div className="flex items-center space-x-2 text-base-content opacity-70 text-sm mb-3">
                  <span>Classification en cours...</span>
                </div>
              )}

              {attachment.classification && !attachment.isClassifying && (
                <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                  <div className="flex items-center space-x-1 mb-1">
                    {attachment.classification.confidence >= 0.8 ? (
                      <CheckCircle className="h-3 w-3 text-success" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-warning" />
                    )}
                    <span className="font-medium text-blue-900">
                      Suggestion: {attachment.DocumentType?.label || attachment.classification.type_code}
                    </span>
                    <span className="text-primary">
                      ({Math.round(attachment.classification.confidence * 100)}%)
                    </span>
                  </div>
                  {attachment.classification.evidence.length > 0 && (
                    <p className="text-primary">
                      Indices: {attachment.classification.evidence.join(', ')}
                    </p>
                  )}
                </div>
              )}

              {/* Sélection du type de document */}
              <div className="space-y-2">
                <Label htmlFor={`document-type-${index}`} className="text-xs">
                  Type de document
                </Label>
                <DocumentTypeSelect
                  value={attachment.documentTypeId || ''}
                  onValueChange={(value) => updateAttachmentType(index, value)}
                  documentTypes={documentTypes}
                  placeholder="Sélectionner un type"
                  disabled={disabled}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

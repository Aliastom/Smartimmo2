'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { 
  Upload, 
  X, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Download,
  Eye,
  EyeOff,
  Lock,
  AlertTriangle
} from 'lucide-react';
import { suggestTypeGlobal, getDocumentTypeByCode } from '@/services/documentSuggestion';

interface DocumentAttachment {
  id?: string;
  name: string;
  size: number;
  mime: string;
  base64: string;
  documentTypeId?: string;
  documentType?: any;
  classification?: any;
  isClassifying?: boolean;
}

interface DocumentUploadManagerProps {
  attachments: DocumentAttachment[];
  onAttachmentsChange: (attachments: DocumentAttachment[]) => void;
  documentTypes: any[];
  propertyId?: string;
  leaseId?: string;
  tenantId?: string;
  loanId?: string;
  disabled?: boolean;
  existingAttachments?: any[];
  onRemoveExisting?: (id: string) => void;
}

export default function DocumentUploadManager({
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
}: DocumentUploadManagerProps) {
  
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const buildContext = () => {
    if (propertyId && leaseId) return 'lease';
    if (propertyId) return 'property';
    if (tenantId) return 'tenant';
    if (loanId) return 'loan';
    return 'transaction';
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setSelectedFiles(files);
    setIsUploading(true);

    try {
      const newAttachments: DocumentAttachment[] = [];

      for (const file of files) {
        // Vérifier la taille du fichier (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          alert(`Le fichier "${file.name}" est trop volumineux (max 10MB)`);
          continue;
        }

        // Convertir en base64
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        // Classification automatique du type de document
        const context = buildContext();
        const suggestion = suggestTypeGlobal({
          context,
          filename: file.name,
          mime: file.type,
        }, documentTypes);

        const suggestedType = getDocumentTypeByCode(suggestion.type_code, documentTypes);
        
        const attachment: DocumentAttachment = {
          name: file.name,
          size: file.size,
          mime: file.type,
          base64,
          documentTypeId: suggestedType?.id || documentTypes[0]?.id,
          documentType: suggestedType || documentTypes[0],
          classification: {
            type_code: suggestion.type_code,
            confidence: suggestion.confidence,
            alternatives: suggestion.alternatives,
            evidence: suggestion.evidence,
          },
          isClassifying: false,
        };

        newAttachments.push(attachment);
      }

      // Ajouter les nouveaux attachments
      onAttachmentsChange([...attachments, ...newAttachments]);
      setIsUploading(false);

    } catch (error) {
      console.error('Error uploading files:', error);
      setIsUploading(false);
    }
  }, [attachments, documentTypes, propertyId, leaseId, tenantId, loanId, onAttachmentsChange]);

  const removeAttachment = (index: number) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== index));
  };

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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getConfidenceBadgeVariant = (confidence: number) => {
    if (confidence >= 0.8) return "success";
    if (confidence >= 0.6) return "primary";
    if (confidence >= 0.4) return "warning";
    return "error";
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return "Très sûr";
    if (confidence >= 0.6) return "Assez sûr";
    if (confidence >= 0.4) return "Moyen";
    return "Faible";
  };

  return (
    <div className="space-y-4">
      {/* Zone d'upload */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors">
        <input
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
          onChange={handleFileUpload}
          className="hidden"
          id="document-upload"
          disabled={disabled || isUploading}
        />
        <label htmlFor="document-upload" className={`cursor-pointer ${disabled || isUploading ? 'cursor-not-allowed opacity-50' : ''}`}>
          <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-600">
            {isUploading ? 'Upload en cours...' : 'Cliquez pour uploader des documents'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            PDF, JPG, PNG, DOC, XLS (max 10MB par fichier)
          </p>
        </label>
      </div>

      {/* Liste des documents existants */}
      {existingAttachments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Documents existants</h4>
          {existingAttachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900">{attachment.filename}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-700">{formatFileSize(attachment.size)}</span>
                    {attachment.DocumentType && (
                      <Badge variant="primary" size="sm">{attachment.DocumentType.label}</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(`/api/documents/${attachment.id}/download`, '_blank')}
                >
                  <Download className="h-4 w-4" />
                </Button>
                {onRemoveExisting && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveExisting(attachment.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Liste des nouveaux documents uploadés */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Nouveaux documents</h4>
          {attachments.map((attachment, index) => (
            <Card key={index} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <FileText className="h-5 w-5 text-gray-400 mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-sm font-medium">{attachment.name}</p>
                      {attachment.isClassifying ? (
                        <Badge variant="warning" size="sm">Classification...</Badge>
                      ) : attachment.classification ? (
                        <Badge 
                          variant={getConfidenceBadgeVariant(attachment.classification.confidence)} 
                          size="sm"
                        >
                          {getConfidenceLabel(attachment.classification.confidence)}
                        </Badge>
                      ) : null}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Taille: {formatFileSize(attachment.size)}</p>
                        <p className="text-xs text-gray-500">Type: {attachment.mime}</p>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Type de document
                        </label>
                        <select
                          value={attachment.documentTypeId || ''}
                          onChange={(e) => updateAttachmentType(index, e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                          disabled={disabled}
                        >
                          <option value="">Sélectionner un type</option>
                          {documentTypes.map((docType) => (
                            <option key={docType.id} value={docType.id}>
                              {docType.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Informations de classification */}
                    {attachment.classification && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                        <p className="text-gray-600 mb-1">
                          <strong>Suggestion:</strong> {attachment.DocumentType?.label || attachment.classification.type_code}
                        </p>
                        <p className="text-gray-500">
                          {attachment.classification.evidence}
                        </p>
                        
                        {/* Alternatives */}
                        {attachment.classification.alternatives && attachment.classification.alternatives.length > 0 && (
                          <div className="mt-2">
                            <p className="text-gray-600 mb-1">Autres suggestions:</p>
                            <div className="flex flex-wrap gap-1">
                              {attachment.classification.alternatives.slice(0, 3).map((alt, altIndex) => {
                                const altType = getDocumentTypeByCode(alt.type_code, documentTypes);
                                return (
                                  <Badge 
                                    key={altIndex} 
                                    variant="gray" 
                                    size="sm"
                                    className="cursor-pointer"
                                    onClick={() => updateAttachmentType(index, altType?.id || '')}
                                  >
                                    {altType?.label || alt.type_code} ({Math.round(alt.confidence * 100)}%)
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
            </Card>
          ))}
        </div>
      )}

      {/* Résumé */}
      {attachments.length > 0 && (
        <div className="text-center text-sm text-gray-500">
          {attachments.length} document(s) prêt(s) à être attaché(s)
        </div>
      )}
    </div>
  );
}

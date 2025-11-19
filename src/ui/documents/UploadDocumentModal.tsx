import React, { useState, useCallback, useEffect } from 'react';
import { DocumentType, DocumentMetadataSchema } from '@/types/document';
import { DocumentTypeSelect } from '@/ui/shared/DocumentTypeSelect';
import { Button } from '@/ui/shared/button';
import { Input } from '@/ui/shared/input';
import { Label } from '@/ui/shared/label';
import { Textarea } from '@/ui/shared/textarea';
import { Badge } from '@/ui/shared/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/shared/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, FileText, Eye, EyeOff, Lock, AlertTriangle } from 'lucide-react';
import { useUploadDocument, useClassifyDocument, DocumentClassification } from '@/hooks/useDocuments';
import { suggestTypeGlobal, SuggestionInput, SuggestionResult } from '@/services/documentSuggestion';
import { DynamicMetadataForm } from '@/ui/shared/DynamicMetadataForm';
import { MobileUploadOptions } from '@/components/documents/MobileUploadOptions';

interface UploadDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTypes: DocumentType[];
  propertyId?: string;
  leaseId?: string;
  tenantId?: string;
  loanId?: string;
  onSuccess?: () => void;
}

export function UploadDocumentModal({
  isOpen,
  onClose,
  documentTypes,
  propertyId,
  leaseId,
  tenantId,
  loanId,
  onSuccess,
}: UploadDocumentModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentTypeId, setDocumentTypeId] = useState<string>('');
  const [metadata, setMetadata] = useState<Record<string, any>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [classification, setClassification] = useState<DocumentClassification | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [suggestionResult, setSuggestionResult] = useState<SuggestionResult | null>(null);
  const [isTypeLocked, setIsTypeLocked] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType | null>(null);
  const [showMetadataForm, setShowMetadataForm] = useState(false);
  const { toast } = useToast();
  const uploadDocument = useUploadDocument();
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

  // Détecter le type de document sélectionné et ses propriétés
  useEffect(() => {
    const docType = documentTypes.find(dt => dt.id === documentTypeId);
    setSelectedDocumentType(docType || null);
    
    if (docType) {
      // Vérifier si le type est verrouillé dans le contexte actuel
      const context = [];
      if (propertyId) context.push('property');
      if (leaseId) context.push('lease');
      if (tenantId) context.push('tenant');
      if (loanId) context.push('loan');
      
      const isLocked = docType.lockInFlows?.some(flow => {
        // Vérifier si le flux actuel correspond à un verrou
        return context.some(ctx => flow.includes(ctx));
      }) || false;
      
      setIsTypeLocked(isLocked);
      
      // Afficher le formulaire de métadonnées si un schéma est défini
      setShowMetadataForm(!!docType.metadataSchema);
      
      // Réinitialiser les métadonnées si le type change
      setMetadata({});
    } else {
      setIsTypeLocked(false);
      setShowMetadataForm(false);
      setMetadata({});
    }
  }, [documentTypeId, documentTypes, propertyId, leaseId, tenantId, loanId]);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setClassification(null);
      
      // Classification automatique avec le nouveau service global
      setIsClassifying(true);
      try {
        const context = [];
        if (propertyId) context.push('property');
        if (leaseId) context.push('lease');
        if (tenantId) context.push('tenant');
        if (loanId) context.push('loan');
        
        const input: SuggestionInput = {
          context: context.length > 0 ? context[0] : 'global',
          filename: file.name,
          mime: file.type,
        };
        
        // Utiliser le service de suggestion global
        const result = suggestTypeGlobal(input, documentTypes);
        setSuggestionResult(result);
        
        // Toujours suggérer le type le plus probable
        if (result.confidence > 0 && !isTypeLocked) {
          const suggestedType = documentTypes.find(dt => dt.code === result.type_code);
          if (suggestedType) {
            // Auto-sélection seulement si confiance élevée (70%+)
            if (result.confidence >= 0.7) {
              setDocumentTypeId(suggestedType.id);
              toast({
                title: "Type suggéré",
                description: `Type "${suggestedType.label}" suggéré automatiquement (confiance: ${Math.round(result.confidence * 100)}%)`,
              });
            } else {
              // Sinon, juste pré-sélectionner dans le dropdown sans auto-sélection
              setDocumentTypeId(suggestedType.id);
            }
          }
        }
        
        // Garder la compatibilité avec l'ancien système
        setClassification({
          type_code: result.type_code,
          confidence: result.confidence,
          alternatives: result.alternatives,
          evidence: result.evidence,
        });
      } catch (error) {
        console.error('Erreur lors de la classification:', error);
        // Pas de toast d'erreur pour ne pas perturber l'utilisateur
      } finally {
        setIsClassifying(false);
      }
    }
  }, [propertyId, leaseId, tenantId, loanId, documentTypes, classifyDocument, toast]);

  const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      setClassification(null);
      
      // Classification automatique (même logique que handleFileSelect)
      setIsClassifying(true);
      try {
        const context = [];
        if (propertyId) context.push('property');
        if (leaseId) context.push('lease');
        if (tenantId) context.push('tenant');
        if (loanId) context.push('loan');
        
        const classificationResult = await classifyDocument.mutateAsync({
          context: context.length > 0 ? `from=upload; entities=${context.join(',')}` : undefined,
          filename: file.name,
          mime: file.type,
        });
        
        setClassification(classificationResult);
        
        if (classificationResult.confidence >= 0.7) {
          const suggestedType = documentTypes.find(dt => dt.code === classificationResult.type_code);
          if (suggestedType) {
            setDocumentTypeId(suggestedType.id);
            toast({
              title: "Type suggéré",
              description: `Type "${suggestedType.label}" suggéré automatiquement (confiance: ${Math.round(classificationResult.confidence * 100)}%)`,
            });
          }
        }
      } catch (error) {
        console.error('Erreur lors de la classification:', error);
      } finally {
        setIsClassifying(false);
      }
    }
  }, [propertyId, leaseId, tenantId, loanId, documentTypes, classifyDocument, toast]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!selectedFile) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un fichier",
        variant: "destructive",
      });
      return;
    }

    if (!documentTypeId) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un type de document",
        variant: "destructive",
      });
      return;
    }


    setIsUploading(true);

    try {
      // Convertir le fichier en base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Supprimer le préfixe data:mime;base64,
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      await uploadDocument.mutateAsync({
        propertyId,
        leaseId,
        tenantId,
        loanId,
        documentTypeId,
        file: {
          name: selectedFile.name,
          mime: selectedFile.type,
          size: selectedFile.size,
          base64,
        },
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });

      toast({
        title: "Succès",
        description: "Document uploadé avec succès",
      });

      // Reset form
      setSelectedFile(null);
      setDocumentTypeId('');
      setMetadata({});
      
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de l'upload du document",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setSelectedFile(null);
      setDocumentTypeId('');
      setMetadata({});
      setClassification(null);
      setIsClassifying(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-base-content bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Uploader un document</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={isUploading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Zone de sélection de fichier */}
          <div className="space-y-2">
            <Label>Fichier *</Label>
            
            {selectedFile ? (
              <div className="border-2 border-success bg-success/10 rounded-lg p-6 text-center">
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-8 w-8 text-success" />
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-base-content opacity-70">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                    className="ml-auto"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Options mobile : 3 boutons séparés */}
                <MobileUploadOptions
                  onFilesSelected={(files) => {
                    if (files.length > 0) {
                      const event = {
                        target: { files: files as any },
                      } as React.ChangeEvent<HTMLInputElement>;
                      handleFileSelect(event);
                    }
                  }}
                  acceptedTypes={['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']}
                  maxFiles={1}
                  disabled={isUploading}
                />

                {/* Zone de drop desktop : glisser-déposer */}
                <div
                  className={`hidden md:block border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    'border-base-300 hover:border-primary'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-base-content opacity-60" />
                    <p className="text-base-content opacity-80">
                      Glissez-déposez un fichier ici ou
                    </p>
                    <Input
                      type="file"
                      onChange={handleFileSelect}
                      className="w-auto"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                      disabled={isUploading}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Sélection du type de document */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="documentType">Type de document *</Label>
              <div className="flex items-center gap-2">
                {selectedDocumentType?.isSensitive && (
                  <Badge variant="outline" className="text-xs">
                    <EyeOff className="mr-1 h-3 w-3" />
                    Sensible
                  </Badge>
                )}
                {isTypeLocked && (
                  <Badge variant="secondary" className="text-xs">
                    <Lock className="mr-1 h-3 w-3" />
                    Verrouillé
                  </Badge>
                )}
              </div>
            </div>
            
            <DocumentTypeSelect
              value={documentTypeId}
              onValueChange={setDocumentTypeId}
              documentTypes={documentTypes}
              placeholder="Sélectionner un type"
              required
              disabled={isUploading || isTypeLocked}
            />
            
            {isTypeLocked && (
              <div className="text-sm text-amber-600 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Le type de document est verrouillé dans ce contexte
              </div>
            )}
            
            {/* Affichage de la classification automatique */}
            {isClassifying && (
              <div className="text-sm text-primary flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                Classification automatique en cours...
              </div>
            )}
            
            {suggestionResult && !isClassifying && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    💡 Suggestion automatique
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">
                      Type suggéré: <strong>{documentTypes.find(dt => dt.code === suggestionResult.type_code)?.label || suggestionResult.type_code}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge className={`${getConfidenceBadgeVariant(suggestionResult.confidence)} border-0`}>
                        {Math.round(suggestionResult.confidence * 100)}%
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {getConfidenceLabel(suggestionResult.confidence)}
                      </Badge>
                    </div>
                  </div>
                  
                  {suggestionResult.evidence.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <strong>Évidence:</strong> {suggestionResult.evidence.join(', ')}
                    </div>
                  )}
                  
                  {suggestionResult.alternatives.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <strong>Alternatives:</strong> {suggestionResult.alternatives.map(alt => 
                        `${documentTypes.find(dt => dt.code === alt.type_code)?.label || alt.type_code} (${Math.round(alt.confidence * 100)}%)`
                      ).join(', ')}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Métadonnées optionnelles */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optionnel)</Label>
            <Textarea
              id="description"
              value={metadata.description || ''}
              onChange={(e) => setMetadata(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Description du document..."
              disabled={isUploading}
              rows={3}
            />
          </div>

          {/* Formulaire de métadonnées dynamiques */}
          {showMetadataForm && selectedDocumentType?.metadataSchema && (
            <DynamicMetadataForm
              schema={selectedDocumentType.metadataSchema}
              metadata={metadata}
              onChange={setMetadata}
            />
          )}

          {/* Boutons d'action */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={!selectedFile || !documentTypeId || isUploading}
            >
              {isUploading ? 'Upload...' : 'Uploader'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

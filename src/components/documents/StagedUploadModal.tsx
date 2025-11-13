'use client';

import React, { useState, useEffect } from 'react';
import { useUploadStaging } from '@/hooks/useUploadStaging';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { FileText, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { notify2 } from '@/lib/notify2';

interface StagedUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: File[];
  onStagedDocuments: (documents: any[]) => void;
  context?: {
    type: 'transaction' | 'lease' | 'property' | 'global';
    tempKey?: string;
  };
}

export const StagedUploadModal: React.FC<StagedUploadModalProps> = ({
  isOpen,
  onClose,
  files,
  onStagedDocuments,
  context
}) => {
  const { uploadSessionId, createUploadSession } = useUploadStaging();
  const [sessionReady, setSessionReady] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);

  // Créer une session d'upload si nécessaire
  useEffect(() => {
    if (isOpen && !uploadSessionId) {
      createUploadSession().then(() => {
        setSessionReady(true);
      }).catch(console.error);
    } else if (uploadSessionId) {
      setSessionReady(true);
    }
  }, [isOpen, uploadSessionId, createUploadSession]);

  // Uploader les fichiers en mode staging
  const uploadFiles = async () => {
    if (!uploadSessionId || !sessionReady) return;

    setUploading(true);
    const uploadedDocs: any[] = [];

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('uploadSessionId', uploadSessionId);
        // Pas de type par défaut - sera null
        if (context) {
          formData.append('intendedContextType', context.type);
          if (context.tempKey) {
            formData.append('intendedContextTempKey', context.tempKey);
          }
        }

        const response = await fetch('/api/uploads/staged', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (result.success) {
          uploadedDocs.push(result.Document);
          setUploadedFiles(prev => [...prev, result.Document]);
        } else {
          console.error('Erreur upload:', result.error);
          notify2.error(`Erreur lors de l'upload de ${file.name}: ${result.error}`);
        }
      }

      if (uploadedDocs.length > 0) {
        onStagedDocuments(uploadedDocs);
        notify2.success(`${uploadedDocs.length} document(s) ajouté(s) en brouillon`);
        onClose();
      }
    } catch (error) {
      console.error('Erreur lors de l\'upload:', error);
      notify2.error('Erreur lors de l\'upload des fichiers');
    } finally {
      setUploading(false);
    }
  };

  if (!sessionReady || !uploadSessionId) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Préparation...</DialogTitle>
            <DialogDescription>Préparation de la session d'upload...</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 p-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>Préparation de la session d'upload...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Ajouter des documents en brouillon
          </DialogTitle>
          <DialogDescription>
            Les documents seront ajoutés en brouillon et finalisés lors de la création de la transaction.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Liste des fichiers à uploader */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">
              Fichiers sélectionnés ({files.length})
            </h3>
            {files.map((file, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <FileText className="h-5 w-5 text-gray-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  Brouillon
                </Badge>
              </div>
            ))}
          </div>

          {/* Information sur le mode staging */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-900 font-medium">
                  Mode brouillon activé
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Les documents seront ajoutés en brouillon et finalisés lors de la création de la transaction.
                </p>
              </div>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={uploading}
            >
              Annuler
            </Button>
            <Button
              onClick={uploadFiles}
              disabled={uploading}
              className="flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Upload en cours...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Ajouter en brouillon
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

'use client';

import React, { useCallback } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { useDocumentUploadWithConversion } from '@/hooks/useDocumentUploadWithConversion';
import ConversionWarningModal from './ConversionWarningModal';
import ConversionLoader from './ConversionLoader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface DocumentUploadWithConversionProps {
  propertyId?: string;
  leaseId?: string;
  tenantId?: string;
  transactionId?: string;
  loanId?: string;
  tags?: string[];
  onSuccess?: (documentIds: string[]) => void;
  onError?: (error: string) => void;
  className?: string;
  title?: string;
  description?: string;
}

export default function DocumentUploadWithConversion({
  propertyId,
  leaseId,
  tenantId,
  transactionId,
  loanId,
  tags,
  onSuccess,
  onError,
  className = '',
  title = 'Upload de documents',
  description = 'Glissez-déposez vos fichiers ou cliquez pour les sélectionner'
}: DocumentUploadWithConversionProps) {
  
  const {
    uploads,
    isUploading,
    showConversionModal,
    conversionFiles,
    showConversionLoader,
    conversionProgress,
    upload,
    confirmConversion,
    cancelConversion,
    reset
  } = useDocumentUploadWithConversion({
    propertyId,
    leaseId,
    tenantId,
    transactionId,
    loanId,
    tags,
    onSuccess,
    onError,
    onConversionStart: (files) => {
      console.log('Conversion démarrée pour', files.length, 'fichiers');
    },
    onConversionProgress: (progress) => {
      console.log('Progression conversion:', progress.overallProgress + '%');
    },
    onConversionComplete: () => {
      console.log('Conversion terminée');
    }
  });

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      upload(files);
    }
    // Reset l'input pour permettre de re-sélectionner les mêmes fichiers
    event.target.value = '';
  }, [upload]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      upload(files);
    }
  }, [upload]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'processing':
        return '⏳';
      case 'uploading':
        return '📤';
      default:
        return '📄';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return 'Terminé';
      case 'error':
        return 'Erreur';
      case 'processing':
        return 'Traitement...';
      case 'uploading':
        return 'Upload...';
      case 'pending':
        return 'En attente';
      default:
        return status;
    }
  };

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {title}
          </CardTitle>
          <p className="text-sm text-gray-600">{description}</p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Zone de drop */}
          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${isUploading ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}
              ${isUploading ? 'cursor-not-allowed' : 'cursor-pointer'}
            `}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => !isUploading && document.getElementById('file-input')?.click()}
          >
            <Upload className={`h-12 w-12 mx-auto mb-4 ${isUploading ? 'text-blue-400' : 'text-gray-400'}`} />
            <p className="text-lg font-medium mb-2">
              {isUploading ? 'Upload en cours...' : 'Glissez vos fichiers ici'}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              ou cliquez pour parcourir vos fichiers
            </p>
            <p className="text-xs text-gray-400">
              Formats supportés : PDF, Images (JPG/PNG), Documents Office (DOC, DOCX, XLS, XLSX, PPT, PPTX)
            </p>
          </div>

          {/* Input fichier caché */}
          <input
            id="file-input"
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.rtf,.txt"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />

          {/* Liste des uploads */}
          {uploads.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Fichiers</h4>
              {uploads.map((upload, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="text-xl">
                    {getStatusIcon(upload.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{upload.filename}</p>
                    <p className="text-xs text-gray-500">
                      {getStatusText(upload.status)}
                      {upload.progress > 0 && ` • ${upload.progress}%`}
                    </p>
                    {upload.error && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {upload.error}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bouton de reset */}
          {uploads.length > 0 && !isUploading && (
            <Button 
              variant="outline" 
              onClick={reset}
              size="sm"
            >
              Nouveau upload
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Modal de prévention de conversion */}
      <ConversionWarningModal
        isOpen={showConversionModal}
        files={conversionFiles}
        onConfirm={confirmConversion}
        onCancel={cancelConversion}
      />

      {/* Loader de conversion */}
      <ConversionLoader
        isVisible={showConversionLoader}
        progress={conversionProgress}
      />
    </>
  );
}


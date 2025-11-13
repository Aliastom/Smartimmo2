'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';
// Utilisation de DaisyUI au lieu de shadcn

interface UploadDropzoneProps {
  propertyId?: string;
  leaseId?: string;
  tenantId?: string;
  transactionId?: string;
  loanId?: string;
  tags?: string[];
  onSuccess?: (documentIds: string[]) => void;
  onError?: (error: string) => void;
  maxFiles?: number;
  acceptedFormats?: string[];
}

export function UploadDropzone({
  propertyId,
  leaseId,
  tenantId,
  transactionId,
  loanId,
  tags = [],
  onSuccess,
  onError,
  maxFiles = 10,
  acceptedFormats = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
}: UploadDropzoneProps) {
  const { upload, uploads, isUploading, reset } = useDocumentUpload({
    propertyId,
    leaseId,
    tenantId,
    transactionId,
    loanId,
    tags,
    onSuccess,
    onError,
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > maxFiles) {
        onError?.(`Maximum ${maxFiles} fichiers autorisés`);
        return;
      }

      upload(acceptedFiles);
    },
    [upload, maxFiles, onError]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFormats.reduce((acc, format) => ({ ...acc, [format]: [] }), {}),
    maxFiles,
    disabled: isUploading,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <File className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'uploading':
        return 'Upload en cours...';
      case 'processing':
        return 'Traitement (OCR & Classification)...';
      case 'success':
        return 'Terminé';
      case 'error':
        return 'Erreur';
      default:
        return 'En attente';
    }
  };

  return (
    <div className="w-full space-y-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
          ${isDragActive ? 'border-primary bg-primary/10' : 'border-base-300 hover:border-base-content/30'}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        {isDragActive ? (
          <p className="text-lg font-medium text-primary">Déposez les fichiers ici...</p>
        ) : (
          <>
            <p className="text-lg font-medium text-base-content mb-2">
              Glissez-déposez vos documents ici
            </p>
            <p className="text-sm text-base-content/70 mb-4">
              ou cliquez pour sélectionner ({maxFiles} fichiers max)
            </p>
            <p className="text-xs text-base-content/50">
              Formats acceptés: PDF, JPEG, PNG
            </p>
          </>
        )}
      </div>

      {uploads.length > 0 && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-medium text-gray-900">
              Fichiers ({uploads.length})
            </h3>
            {!isUploading && (
              <button className="btn btn-ghost btn-sm" onClick={reset}>
                Effacer
              </button>
            )}
          </div>

          <div className="space-y-2">
            {uploads.map((upload, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                {getStatusIcon(upload.status)}
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {upload.filename}
                  </p>
                  <p className="text-xs text-gray-500">
                    {getStatusText(upload.status)}
                  </p>
                  
                  {upload.error && (
                    <p className="text-xs text-red-600 mt-1">{upload.error}</p>
                  )}
                </div>

                {(upload.status === 'uploading' || upload.status === 'processing') && (
                  <div className="w-24">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


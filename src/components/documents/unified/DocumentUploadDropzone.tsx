'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, Image, File, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useUploadReviewModal } from '@/contexts/UploadReviewModalContext';

interface DocumentUploadDropzoneProps {
  onSuccess?: (documents: any[]) => void;
  onError?: (error: string) => void;
  linkedTo?: 'global' | 'property' | 'lease' | 'transaction' | 'loan' | 'tenant';
  linkedId?: string;
  hintedTypeKey?: string;
  tags?: string[];
  maxFiles?: number;
  maxSize?: number; // en MB
  acceptedTypes?: string[];
}

export function DocumentUploadDropzone({
  onSuccess,
  onError,
  linkedTo = 'global',
  linkedId,
  hintedTypeKey,
  tags = [],
  maxFiles = 10,
  maxSize = 50, // 50MB par défaut
  acceptedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
}: DocumentUploadDropzoneProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { openModal } = useUploadReviewModal();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      // Vérifier le nombre de fichiers
      if (acceptedFiles.length > maxFiles) {
        onError?.(`Maximum ${maxFiles} fichiers autorisés`);
        return;
      }

      // Vérifier la taille des fichiers
      const maxSizeBytes = maxSize * 1024 * 1024;
      const oversizedFiles = acceptedFiles.filter((file) => file.size > maxSizeBytes);
      if (oversizedFiles.length > 0) {
        onError?.(`Fichiers trop volumineux (max ${maxSize}MB): ${oversizedFiles.map(f => f.name).join(', ')}`);
        return;
      }

      // Ouvrir la modal de revue avec les fichiers sélectionnés
      setSelectedFiles(acceptedFiles);
      
      // Déterminer le scope et les IDs
      const modalScope = linkedTo === 'property' ? 'property' : 'global';
      const propertyId = linkedTo === 'property' ? linkedId : undefined;
      const leaseId = linkedTo === 'lease' ? linkedId : undefined;
      const tenantId = linkedTo === 'tenant' ? linkedId : undefined;
      
      openModal(acceptedFiles, {
        scope: modalScope,
        propertyId,
        leaseId,
        tenantId,
        autoLinkingDocumentType: hintedTypeKey,
        onSuccess: () => {
          setSelectedFiles([]);
          onSuccess?.([]);
        }
      });
    },
    [maxFiles, maxSize, onError]
  );


  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedTypes.reduce((acc, type) => {
      acc[type] = [];
      return acc;
    }, {} as Record<string, string[]>),
    maxFiles,
    maxSize: maxSize * 1024 * 1024,
  });

  const getFileIcon = (file: File) => {
    if (file.type.includes('pdf')) return <FileText className="h-8 w-8 text-red-500" />;
    if (file.type.includes('image')) return <Image className="h-8 w-8 text-blue-500" />;
    return <File className="h-8 w-8 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };


  return (
    <>
      <div className="space-y-4">
        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400'}
          `}
        >
          <input {...getInputProps()} />
          <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          {isDragActive ? (
            <p className="text-primary-600 font-medium">Déposez les fichiers ici...</p>
          ) : (
            <>
              <p className="text-gray-700 font-medium mb-2">
                Glissez-déposez des fichiers ici, ou cliquez pour sélectionner
              </p>
              <p className="text-sm text-gray-500">
                Maximum {maxFiles} fichiers, {maxSize}MB par fichier
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Formats acceptés: PDF, JPG, PNG
              </p>
            </>
          )}
        </div>
      </div>

    </>
  );
}


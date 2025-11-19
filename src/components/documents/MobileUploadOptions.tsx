'use client';

import React, { useRef, useCallback } from 'react';
import { Camera, Image, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface MobileUploadOptionsProps {
  onFilesSelected: (files: File[]) => void;
  acceptedTypes?: string[];
  maxFiles?: number;
  disabled?: boolean;
}

export function MobileUploadOptions({
  onFilesSelected,
  acceptedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
  maxFiles = 10,
  disabled = false,
}: MobileUploadOptionsProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        onFilesSelected(files.slice(0, maxFiles));
      }
      // Réinitialiser l'input pour permettre de sélectionner le même fichier
      if (e.target) {
        e.target.value = '';
      }
    },
    [onFilesSelected, maxFiles]
  );

  return (
    <div className="grid grid-cols-1 gap-3 md:hidden">
      {/* Bouton Prendre une photo */}
      <Button
        type="button"
        variant="outline"
        className="flex items-center justify-center gap-3 h-14"
        onClick={() => cameraInputRef.current?.click()}
        disabled={disabled}
      >
        <Camera className="h-5 w-5" />
        <span>Prendre une photo</span>
      </Button>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        multiple={maxFiles > 1}
        disabled={disabled}
      />

      {/* Bouton Rechercher une photo */}
      <Button
        type="button"
        variant="outline"
        className="flex items-center justify-center gap-3 h-14"
        onClick={() => imageInputRef.current?.click()}
        disabled={disabled}
      >
        <Image className="h-5 w-5" />
        <span>Rechercher une photo</span>
      </Button>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        multiple={maxFiles > 1}
        disabled={disabled}
      />

      {/* Bouton Rechercher un fichier */}
      <Button
        type="button"
        variant="outline"
        className="flex items-center justify-center gap-3 h-14"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
      >
        <FileText className="h-5 w-5" />
        <span>Rechercher un fichier</span>
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes.join(',')}
        onChange={handleFileChange}
        className="hidden"
        multiple={maxFiles > 1}
        disabled={disabled}
      />
    </div>
  );
}


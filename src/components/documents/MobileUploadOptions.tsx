'use client';

import React, { useRef, useCallback } from 'react';
import { Camera, Image, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { notify2 } from '@/lib/notify2';

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
    (e: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
      const target = e.target as HTMLInputElement;
      const inputSource = target === cameraInputRef.current ? 'camera' : target === imageInputRef.current ? 'phototheque' : 'fichier';
      
      console.log(`[MobileUploadOptions] handleFileChange called (${inputSource})`, target.files);
      
      // Toast visible pour debug sur mobile
      notify2.info(`📸 ${inputSource === 'camera' ? 'Photo prise' : inputSource === 'phototheque' ? 'Photo sélectionnée' : 'Fichier sélectionné'}`);
      
      const files = Array.from(target.files || []);
      console.log('[MobileUploadOptions] Files selected:', files.length, files.map(f => ({ name: f.name, size: f.size, type: f.type })));
      
      if (files.length > 0) {
        // Vérifier que le fichier a une taille valide (important pour la caméra iOS)
        const validFiles = files.filter(f => f.size > 0);
        
        if (validFiles.length === 0) {
          console.error('[MobileUploadOptions] Aucun fichier valide (taille 0)');
          notify2.error('Erreur', 'Le fichier est vide. Réessayez.');
          return;
        }
        
        const filesToSend = validFiles.slice(0, maxFiles);
        console.log('[MobileUploadOptions] Calling onFilesSelected with:', filesToSend.length, 'files');
        
        // Délai plus long pour la caméra (iOS peut prendre du temps)
        const delay = inputSource === 'camera' ? 800 : 300;
        
        notify2.info(`⏳ Traitement en cours...`);
        
        setTimeout(() => {
          try {
            onFilesSelected(filesToSend);
            notify2.success('✅ Fichier prêt', `${filesToSend.length} fichier(s) traité(s)`);
          } catch (error) {
            console.error('[MobileUploadOptions] Error calling onFilesSelected:', error);
            notify2.error('Erreur', 'Impossible de traiter le fichier');
          }
        }, delay);
      } else {
        console.log('[MobileUploadOptions] No files to send');
        notify2.warning('Aucun fichier sélectionné');
      }
      
      // Réinitialiser l'input pour permettre de sélectionner le même fichier
      // Attendre plus longtemps pour la caméra qui peut prendre du temps
      const resetDelay = inputSource === 'camera' ? 1000 : 500;
      setTimeout(() => {
        if (target) {
          target.value = '';
        }
      }, resetDelay);
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
        onInput={handleFileChange}
        className="hidden"
        multiple={false}
        disabled={disabled}
        // iOS: forcer le re-render si nécessaire
        key="camera-input"
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
        onInput={handleFileChange}
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
        onInput={handleFileChange}
        className="hidden"
        multiple={maxFiles > 1}
        disabled={disabled}
      />
    </div>
  );
}


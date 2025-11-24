'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Upload, Loader2 } from 'lucide-react';
import { useAlert } from '@/hooks/useAlert';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';
import { AirbnbImportPreviewModal, PreviewResult } from './AirbnbImportPreviewModal';

interface AirbnbImportButtonProps {
  propertyId: string;
  propertyName: string;
  onImportSuccess?: () => void;
}

export function AirbnbImportButton({ propertyId, propertyName, onImportSuccess }: AirbnbImportButtonProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showAlert } = useAlert();
  const router = useRouter();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Vérifier que c'est un CSV
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      await showAlert({
        type: 'error',
        title: 'Format invalide',
        message: 'Veuillez sélectionner un fichier CSV.',
      });
      return;
    }

    // Stocker le fichier pour l'import final
    setSelectedFile(file);

    // Prévisualiser le fichier
    setIsPreviewLoading(true);
    setPreviewError(null);
    setShowPreviewModal(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/properties/${propertyId}/airbnb/preview`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPreview(data.preview);
      } else {
        setPreviewError(data.error || 'Erreur lors de l\'analyse du fichier CSV.');
        setPreview(null);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      setPreviewError(`Erreur lors de l'analyse: ${errorMessage}`);
      setPreview(null);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`/api/properties/${propertyId}/airbnb/import`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        await showAlert({
          type: 'success',
          title: 'Import réussi',
          message: data.message || 'Les réservations Airbnb ont été importées avec succès.',
        });

        // Fermer la modal et reset
        setShowPreviewModal(false);
        setPreview(null);
        setSelectedFile(null);
        setPreviewError(null);

        // Appeler le callback de rafraîchissement si fourni
        if (onImportSuccess) {
          onImportSuccess();
        }

        // Rafraîchir la page pour afficher les nouvelles transactions
        router.refresh();
      } else {
        await showAlert({
          type: 'error',
          title: 'Erreur d\'import',
          message: data.error || 'Une erreur est survenue lors de l\'import du fichier CSV.',
          details: data.details ? `Détails: ${data.details.join(', ')}` : undefined,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      await showAlert({
        type: 'error',
        title: 'Erreur',
        message: `Erreur lors de l'import: ${errorMessage}`,
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClosePreview = () => {
    if (!isImporting) {
      setShowPreviewModal(false);
      setPreview(null);
      setSelectedFile(null);
      setPreviewError(null);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={handleClick}
              disabled={isImporting || isPreviewLoading}
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0"
              aria-label="Importer un CSV Airbnb"
            >
              {isImporting || isPreviewLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Importer un CSV Airbnb</p>
        </TooltipContent>
      </Tooltip>

      <AirbnbImportPreviewModal
        isOpen={showPreviewModal}
        onClose={handleClosePreview}
        preview={preview}
        isPreviewLoading={isPreviewLoading}
        previewError={previewError}
        onConfirm={handleConfirmImport}
        isImporting={isImporting}
      />
    </>
  );
}



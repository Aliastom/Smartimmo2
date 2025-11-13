'use client';

import React, { useState, useRef } from 'react';
import { FileText, Upload, Receipt } from 'lucide-react';
import ActionButtons from '../components/ActionButtons';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { type Lease } from '../hooks/useLeases';
import LeaseCompletionModal from './LeaseCompletionModal';
import RentReceiptModal from './RentReceiptModal';
import LeasePdfModal from './LeasePdfModal';

interface LeaseRowActionsProps {
  lease: Lease;
  onEdit: (lease: Lease) => void;
  onDelete: (lease: Lease) => void;
}

export default function LeaseRowActions({ lease, onEdit, onDelete }: LeaseRowActionsProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isUploadingSignedPdf, setIsUploadingSignedPdf] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [missingFields, setMissingFields] = useState<any[]>([]);
  const [leaseData, setLeaseData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleGeneratePdf = () => {
    setShowPdfModal(true);
  };

  const generatePdf = async (overrides: any) => {
    setIsGeneratingPdf(true);
    try {
      const response = await fetch(`/api/leases/${lease.id}/generate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Erreur lors de la génération du PDF';
        try {
          const error = JSON.parse(errorText);
          errorMessage = error.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Invalider les queries pour mettre à jour la liste des documents
      await queryClient.invalidateQueries({ queryKey: ['documents'] });

      // Afficher un toast de succès avec possibilité de télécharger
      toast.success('PDF généré avec succès !', {
        description: `Le document "${data.fileName}" a été créé.`,
        action: {
          label: 'Télécharger',
          onClick: () => {
            window.open(data.downloadUrl, '_blank');
          },
        },
        duration: 5000,
      });

      setShowCompletionModal(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la génération du PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleUploadSignedPdf = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Le fichier doit être un PDF');
      return;
    }

    setIsUploadingSignedPdf(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/leases/${lease.id}/signed-pdf`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de l\'upload');
      }

      const result = await response.json();
      
      toast.success(result.message || 'PDF signé enregistré avec succès !', {
        description: lease.signedPdfUrl ? 'Le PDF signé a été remplacé' : 'Le bail a été mis à jour',
      });
      
      // Invalider les queries pour rafraîchir les données
      await queryClient.invalidateQueries({ queryKey: ['leases'] });
      await queryClient.invalidateQueries({ queryKey: ['documents'] });
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'upload du PDF signé');
    } finally {
      setIsUploadingSignedPdf(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Bouton de génération de PDF */}
        <button
          onClick={handleGeneratePdf}
          disabled={isGeneratingPdf}
          className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-neutral-300 bg-base-100 hover:bg-neutral-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          title="Générer le bail PDF"
        >
          {isGeneratingPdf ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          ) : (
            <FileText className="h-4 w-4 text-neutral-600" />
          )}
        </button>

        {/* Bouton d'upload du PDF signé (visible uniquement si pas encore signé) */}
        {lease.status !== 'SIGNÉ' && lease.status !== 'ACTIF' && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleUploadSignedPdf}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingSignedPdf}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-green-300 bg-base-100 hover:bg-green-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Uploader le bail signé"
            >
              {isUploadingSignedPdf ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
              ) : (
                <Upload className="h-4 w-4 text-success" />
              )}
            </button>
          </>
        )}

        {/* Boutons pour les baux SIGNÉ/ACTIF avec PDF */}
        {(lease.status === 'SIGNÉ' || lease.status === 'ACTIF') && lease.signedPdfUrl && (
          <>
            {/* Télécharger le PDF signé */}
            <a
              href={lease.signedPdfUrl}
              download
              className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-blue-300 bg-base-100 hover:bg-blue-50 transition"
              title="Télécharger le PDF signé"
            >
              <FileText className="h-4 w-4 text-primary" />
            </a>

            {/* Remplacer le PDF signé */}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleUploadSignedPdf}
              className="hidden"
            />
            <button
              onClick={() => {
                if (window.confirm('Êtes-vous sûr de vouloir remplacer le PDF signé actuel ?')) {
                  fileInputRef.current?.click();
                }
              }}
              disabled={isUploadingSignedPdf}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-orange-300 bg-base-100 hover:bg-orange-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Remplacer le PDF signé"
            >
              {isUploadingSignedPdf ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
              ) : (
                <Upload className="h-4 w-4 text-orange-600" />
              )}
            </button>
          </>
        )}

        {/* Bouton de génération de quittance (visible pour les baux actifs) */}
        {(lease.status === 'ACTIF' || lease.status === 'SIGNÉ') && (
          <>
            <button
              onClick={() => setShowReceiptModal(true)}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-purple-300 bg-base-100 hover:bg-purple-50 transition"
              title="Générer une quittance de loyer"
            >
              <Receipt className="h-4 w-4 text-purple-600" />
            </button>
            
          </>
        )}

        {/* Boutons d'édition et suppression */}
        <ActionButtons
          onEdit={() => onEdit(lease)}
          onDelete={() => onDelete(lease)}
        />
      </div>

      {/* Modale de complétion */}
      {showCompletionModal && (
        <LeaseCompletionModal
          isOpen={showCompletionModal}
          onClose={() => {
            setShowCompletionModal(false);
            setIsGeneratingPdf(false);
          }}
          onComplete={generatePdf}
          missingFields={missingFields}
          currentData={leaseData}
        />
      )}

      {/* Modale de génération de quittance */}
      {showReceiptModal && (
        <RentReceiptModal
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          lease={lease}
        />
      )}

      {/* Modale de génération de bail PDF */}
      {showPdfModal && (
        <LeasePdfModal
          isOpen={showPdfModal}
          onClose={() => setShowPdfModal(false)}
          lease={lease}
        />
      )}

    </>
  );
}


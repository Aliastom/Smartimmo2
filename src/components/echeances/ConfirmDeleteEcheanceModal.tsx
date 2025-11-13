'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { notify2 } from '@/lib/notify2';

interface ConfirmDeleteEcheanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  echeanceId: string;
  echeanceLabel?: string;
}

export function ConfirmDeleteEcheanceModal({
  isOpen,
  onClose,
  onConfirm,
  echeanceId,
  echeanceLabel
}: ConfirmDeleteEcheanceModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteType, setDeleteType] = useState<'soft' | 'hard'>('soft');

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      const url = deleteType === 'hard'
        ? `/api/echeances/${echeanceId}?hard=1`
        : `/api/echeances/${echeanceId}`;
      
      const response = await fetch(url, { method: 'DELETE' });

      if (!response.ok) {
        throw new Error('Erreur lors de la suppression');
      }

      notify2.success(
        deleteType === 'hard'
          ? 'Échéance supprimée définitivement'
          : 'Échéance archivée avec succès'
      );

      onConfirm();
      onClose();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      notify2.error('Erreur lors de la suppression de l\'échéance');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    if (!isDeleting) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={deleteType === 'soft' ? 'Archiver cette échéance ?' : 'Supprimer définitivement ?'}
      size="md"
      closeOnBackdropClick={!isDeleting}
      closeOnEscape={!isDeleting}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            {deleteType === 'soft' ? (
              <>
                <p className="font-medium text-yellow-900 mb-1">
                  Cette échéance sera désactivée et ne générera plus de projections à partir d'aujourd'hui.
                </p>
                <p className="text-yellow-800">
                  💡 Vous pourrez la réactiver plus tard si besoin.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-red-900 mb-1">
                  Cette action est IRRÉVERSIBLE et supprimera l'échéance de la base de données.
                </p>
                <p className="text-red-800">
                  ⚠️ Réservé aux erreurs de saisie uniquement.
                </p>
              </>
            )}
          </div>
        </div>

        {echeanceLabel && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">Échéance :</span> {echeanceLabel}
          </div>
        )}

        <div className="flex gap-2 p-3 bg-gray-50 rounded-lg">
          <Button
            variant={deleteType === 'soft' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDeleteType('soft')}
            disabled={isDeleting}
          >
            Archiver
          </Button>
          <Button
            variant={deleteType === 'hard' ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => setDeleteType('hard')}
            disabled={isDeleting}
          >
            Supprimer
          </Button>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
        <Button
          variant="ghost"
          onClick={handleCancel}
          disabled={isDeleting}
        >
          Annuler
        </Button>
        <Button
          variant={deleteType === 'hard' ? 'destructive' : 'default'}
          onClick={handleConfirm}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Suppression...
            </>
          ) : (
            deleteType === 'hard' ? 'Supprimer définitivement' : 'Archiver'
          )}
        </Button>
      </div>
    </Modal>
  );
}


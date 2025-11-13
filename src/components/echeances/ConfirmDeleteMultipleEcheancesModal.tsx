'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { notify2 } from '@/lib/notify2';

interface ConfirmDeleteMultipleEcheancesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  echeanceIds: string[];
}

export function ConfirmDeleteMultipleEcheancesModal({
  isOpen,
  onClose,
  onConfirm,
  echeanceIds
}: ConfirmDeleteMultipleEcheancesModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      // Supprimer (archiver) toutes les échéances sélectionnées
      const promises = echeanceIds.map(id =>
        fetch(`/api/echeances/${id}`, { method: 'DELETE' })
      );

      const results = await Promise.all(promises);
      const allSuccess = results.every(r => r.ok);

      if (!allSuccess) {
        throw new Error('Certaines échéances n\'ont pas pu être supprimées');
      }

      notify2.success(`${echeanceIds.length} échéance(s) archivée(s) avec succès`);

      onConfirm();
      onClose();
    } catch (error) {
      console.error('Erreur lors de la suppression multiple:', error);
      notify2.error('Erreur lors de la suppression des échéances');
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
      title={`Archiver ${echeanceIds.length} échéance(s) ?`}
      size="md"
      closeOnBackdropClick={!isDeleting}
      closeOnEscape={!isDeleting}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-yellow-900 mb-1">
              Ces échéances seront désactivées et ne généreront plus de projections.
            </p>
            <p className="text-yellow-800">
              💡 Vous pourrez les réactiver plus tard si besoin.
            </p>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          <span className="font-medium">{echeanceIds.length}</span> échéance(s) sélectionnée(s)
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
          variant="default"
          onClick={handleConfirm}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Archivage...
            </>
          ) : (
            'Archiver tout'
          )}
        </Button>
      </div>
    </Modal>
  );
}


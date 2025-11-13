'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AlertCircle } from 'lucide-react';
import { notify2 } from '@/lib/notify2';

interface ConfirmDeleteLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loanId: string;
  loanLabel?: string;
}

export function ConfirmDeleteLoanModal({
  isOpen,
  onClose,
  onConfirm,
  loanId,
  loanLabel,
}: ConfirmDeleteLoanModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/loans/${loanId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erreur lors de l\'archivage');
      }

      notify2.success('Prêt archivé avec succès');
      onConfirm();
      onClose();
    } catch (error) {
      console.error('Erreur:', error);
      notify2.error('Erreur lors de l\'archivage du prêt');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Archiver le prêt" size="xs">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-orange-900">
              Êtes-vous sûr de vouloir archiver ce prêt ?
            </p>
            {loanLabel && (
              <p className="text-sm font-medium text-orange-900 mt-1">
                {loanLabel}
              </p>
            )}
            <p className="text-xs text-orange-700 mt-2">
              Le prêt sera marqué comme inactif et n'apparaîtra plus dans les calculs.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isDeleting}>
            {isDeleting ? 'Archivage...' : 'Archiver'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}


'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { notify2 } from '@/lib/notify2';

interface ConfirmDeleteLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (action: 'deactivate' | 'delete') => void;
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionType, setActionType] = useState<'deactivate' | 'delete'>('deactivate');

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      onConfirm(actionType);
      onClose();
    } catch (error) {
      console.error('Erreur lors de l\'action:', error);
      notify2.error('Erreur lors de l\'opération');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    if (!isProcessing) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={actionType === 'delete' ? 'Supprimer ce prêt ?' : 'Désactiver ce prêt ?'}
      size="md"
      closeOnBackdropClick={!isProcessing}
      closeOnEscape={!isProcessing}
      footer={
        <>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isProcessing}
          >
            Annuler
          </Button>
          <Button
            variant={actionType === 'delete' ? 'danger' : 'primary'}
            onClick={handleConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {actionType === 'delete' ? 'Suppression...' : 'Désactivation...'}
              </>
            ) : (
              actionType === 'delete' ? 'Supprimer définitivement' : 'Désactiver'
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Icon d'alerte */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>

        {/* Nom du prêt */}
        {loanLabel && (
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Prêt : <span className="font-medium text-gray-900">{loanLabel}</span>
            </p>
          </div>
        )}

        {/* Message selon l'action */}
        {actionType === 'deactivate' ? (
          <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-yellow-900 mb-1">
                Ce prêt sera désactivé et n'apparaîtra plus dans les calculs à partir d'aujourd'hui.
              </p>
              <p className="text-yellow-800">
                💡 Vous pourrez le réactiver plus tard si besoin.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-red-900 mb-1">
                Cette action est IRRÉVERSIBLE et supprimera le prêt de la base de données.
              </p>
              <p className="text-red-800">
                ⚠️ Réservé aux erreurs de saisie uniquement.
              </p>
            </div>
          </div>
        )}

        {/* Choix de l'action */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-900">Que souhaitez-vous faire ?</p>
          
          <label className="flex items-start p-3 border-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-50">
            <input
              type="radio"
              name="action_type"
              value="deactivate"
              checked={actionType === 'deactivate'}
              onChange={() => setActionType('deactivate')}
              disabled={isProcessing}
              className="mt-1 h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
            />
            <div className="ml-3 flex-1">
              <span className="text-sm font-medium text-gray-900">
                Désactiver le prêt
              </span>
              <p className="text-xs text-gray-500 mt-1">
                Le prêt sera désactivé mais conservé dans la base de données
              </p>
            </div>
          </label>

          <label className="flex items-start p-3 border-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-50">
            <input
              type="radio"
              name="action_type"
              value="delete"
              checked={actionType === 'delete'}
              onChange={() => setActionType('delete')}
              disabled={isProcessing}
              className="mt-1 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
            />
            <div className="ml-3 flex-1">
              <span className="text-sm font-medium text-gray-900">
                Supprimer définitivement
              </span>
              <p className="text-xs text-red-600 mt-1">
                <strong>Action irréversible</strong> : le prêt sera définitivement supprimé
              </p>
            </div>
          </label>
        </div>
      </div>
    </Modal>
  );
}

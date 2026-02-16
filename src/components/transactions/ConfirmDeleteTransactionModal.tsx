'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { notify2 } from '@/lib/notify2';

export type DeleteMode = 'delete_docs' | 'keep_docs_globalize' | 'unlink_only';

interface ConfirmDeleteTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mode: DeleteMode) => void; // ✅ Modifié pour passer le mode
  transactionId: string;
  transactionLabel?: string;
  hasDocuments: boolean;
  isLoading?: boolean; // ⚠️ UX: Afficher un loader pendant la vérification des documents
}

/**
 * Modal de confirmation de suppression d'une transaction
 * Si la transaction contient des documents, propose 3 choix :
 * - Supprimer les documents et toutes leurs liaisons
 * - Ne supprimer que les liaisons avec cette transaction (documents et autres liaisons conservés)
 * - Conserver les documents en ne laissant que la liaison globale
 */
export function ConfirmDeleteTransactionModal({
  isOpen,
  onClose,
  onConfirm,
  transactionId,
  transactionLabel,
  hasDocuments,
  isLoading = false
}: ConfirmDeleteTransactionModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedMode, setSelectedMode] = useState<DeleteMode>('unlink_only');

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      // ✅ Appeler le callback avec le mode choisi - le parent gère la suppression via TransactionService
      await onConfirm(selectedMode);
      // Le parent gère la notification de succès et la fermeture
      onClose();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      notify2.error('Erreur lors de la suppression de la transaction');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    if (!isDeleting && !isLoading) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Supprimer cette transaction ?"
      size="md"
      closeOnBackdropClick={!isDeleting && !isLoading}
      closeOnEscape={!isDeleting && !isLoading}
    >
      <div className="space-y-4">
        {/* Icon d'alerte */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>

        {/* Nom de la transaction */}
        {transactionLabel && (
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Transaction : <span className="font-medium text-gray-900">{transactionLabel}</span>
            </p>
          </div>
        )}

        {/* Loader pendant la vérification des documents */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <p className="text-sm text-gray-600">Vérification des documents liés...</p>
          </div>
        ) : (
          <>
        {/* Message et choix si la transaction a des documents */}
        {hasDocuments ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              <strong>Attention :</strong> la transaction contient des documents, potentiellement liés à d'autres éléments.
            </p>

            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-900">Que souhaitez-vous faire ?</p>

              {/* Option 1 : Supprimer les documents */}
              <label className="flex items-start p-3 border-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-50">
                <input
                  type="radio"
                  name="delete_mode"
                  value="delete_docs"
                  checked={selectedMode === 'delete_docs'}
                  onChange={(e) => setSelectedMode(e.target.value as DeleteMode)}
                  disabled={isDeleting}
                  className="mt-1 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                />
                <div className="ml-3 flex-1">
                  <span className="text-sm font-medium text-gray-900">
                    Supprimer les documents et toutes leurs liaisons
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    <strong>Action irréversible</strong> : les fichiers seront définitivement supprimés
                  </p>
                </div>
              </label>

              {/* Option 2 : Ne supprimer que les liaisons avec cette transaction */}
              <label className="flex items-start p-3 border-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-50">
                <input
                  type="radio"
                  name="delete_mode"
                  value="unlink_only"
                  checked={selectedMode === 'unlink_only'}
                  onChange={(e) => setSelectedMode(e.target.value as DeleteMode)}
                  disabled={isDeleting}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <div className="ml-3 flex-1">
                  <span className="text-sm font-medium text-gray-900">
                    Ne supprimer que les liaisons avec cette transaction
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    Les documents sont conservés ; seuls les liens avec cette transaction sont retirés (les liaisons avec d'autres éléments restent intactes)
                  </p>
                </div>
              </label>

              {/* Option 3 : Conserver les documents en global */}
              <label className="flex items-start p-3 border-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-50">
                <input
                  type="radio"
                  name="delete_mode"
                  value="keep_docs_globalize"
                  checked={selectedMode === 'keep_docs_globalize'}
                  onChange={(e) => setSelectedMode(e.target.value as DeleteMode)}
                  disabled={isDeleting}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <div className="ml-3 flex-1">
                  <span className="text-sm font-medium text-gray-900">
                    Conserver les documents en ne laissant que la liaison globale
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    Les documents resteront visibles dans l'onglet Documents, toutes les autres liaisons seront retirées
                  </p>
                </div>
              </label>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-700 text-center">
            Êtes-vous sûr de vouloir supprimer cette transaction ?
          </p>
        )}

        {/* Actions - Mobile: empilées, Desktop: en ligne */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            variant="outline"
            onClick={handleCancel}
                disabled={isDeleting || isLoading}
            className="flex-1 w-full sm:w-auto"
          >
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
                disabled={isDeleting || isLoading}
            className="flex-1 w-full sm:w-auto"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Suppression...
              </>
            ) : (
              'Supprimer la transaction'
            )}
          </Button>
        </div>
          </>
        )}
      </div>
    </Modal>
  );
}


'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { notify2 } from '@/lib/notify2';

interface DocumentLink {
  type: string;
  id: string;
  displayName: string;
}

interface ConfirmDeleteDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  documentId: string;
  documentName?: string;
}

/**
 * Modal de confirmation de suppression d'un document
 * Affiche une alerte si le document a des liaisons non-globales
 */
export function ConfirmDeleteDocumentModal({
  isOpen,
  onClose,
  onConfirm,
  documentId,
  documentName
}: ConfirmDeleteDocumentModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [links, setLinks] = useState<DocumentLink[]>([]);

  useEffect(() => {
    if (isOpen && documentId) {
      loadLinks();
    }
  }, [isOpen, documentId]);

  const loadLinks = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/links/non-global`);
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des liaisons');
      }
      const data = await response.json();
      setLinks(data.data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des liaisons:', error);
      notify2.error('Erreur lors du chargement des liaisons');
      setLinks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/hard-delete`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la suppression');
      }

      notify2.success('Document supprimé définitivement');
      onConfirm();
      onClose();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      notify2.error('Erreur lors de la suppression du document');
    } finally {
      setIsDeleting(false);
    }
  };

  const getLinkedTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'property': 'Bien',
      'lease': 'Bail',
      'transaction': 'Transaction',
      'tenant': 'Locataire'
    };
    return labels[type] || type;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Supprimer ce document ?"
      size="md"
      closeOnBackdropClick={!isDeleting}
      closeOnEscape={!isDeleting}
    >
      <div className="space-y-4">
        {/* Icon d'alerte */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>

        {/* Nom du document */}
        {documentName && (
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Document : <span className="font-medium text-gray-900">{documentName}</span>
            </p>
          </div>
        )}

        {/* Chargement des liaisons */}
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-600">Vérification des liaisons...</span>
          </div>
        ) : (
          <>
            {/* Message d'alerte si des liaisons existent */}
            {links.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-700">
                  <strong>Attention :</strong> ce document est lié à :
                </p>
                
                {/* Liste des liaisons */}
                <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                  <ul className="space-y-2">
                    {links.map((link, index) => (
                      <li key={index} className="text-sm text-gray-700 flex items-start">
                        <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mt-1.5 mr-2 flex-shrink-0" />
                        <span>
                          <span className="font-medium">{getLinkedTypeLabel(link.type)}</span>
                          {' : '}
                          {link.displayName}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-sm text-gray-700">
                  La suppression entraînera la <strong>disparition définitive du fichier</strong> et de <strong>toutes ses liaisons</strong>. Êtes-vous sûr ?
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-700 text-center">
                La suppression entraînera la <strong>disparition définitive du fichier</strong>. Êtes-vous sûr ?
              </p>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1"
          >
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading || isDeleting}
            className="flex-1"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Suppression...
              </>
            ) : (
              'Supprimer définitivement'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}


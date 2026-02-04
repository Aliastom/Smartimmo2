'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { notify2 } from '@/lib/notify2';
import { getLocalDB } from '@/lib/offline/db';
import { createDocumentServiceWithMode } from '@/domain/services/documentServiceFactory';

interface DocumentLink {
  type: string;
  id: string;
  displayName: string;
}

interface ConfirmDeleteDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deleteMode: 'all' | 'transaction-links-only') => void;
  documentId: string;
  documentName?: string;
  mode?: 'normal' | 'app-shell';
  organizationId?: string;
  isDeleting?: boolean; // État pour afficher le loader pendant la suppression
  transactionId?: string; // ID de la transaction courante (pour identifier les liaisons à supprimer)
  loanId?: string; // ID du prêt courant (pour identifier les liaisons à supprimer)
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
  documentName,
  mode = 'normal',
  organizationId,
  isDeleting = false,
  transactionId,
  loanId
}: ConfirmDeleteDocumentModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [links, setLinks] = useState<DocumentLink[]>([]);
  const [transactionLinks, setTransactionLinks] = useState<DocumentLink[]>([]);
  const [hasOnlyTransactionCreatedLinks, setHasOnlyTransactionCreatedLinks] = useState(false);
  
  // ✅ Déterminer l'ID de l'entité courante (transaction ou prêt)
  const currentEntityId = transactionId || loanId;
  const currentEntityType = transactionId ? 'transaction' : (loanId ? 'loan' : null);

  useEffect(() => {
    if (isOpen && documentId) {
      loadLinks();
    }
  }, [isOpen, documentId, mode, organizationId, transactionId, loanId]);

  const loadLinks = async () => {
    setIsLoading(true);
    try {
      if (mode === 'app-shell' && organizationId) {
        // En mode app-shell : charger depuis IndexedDB
        const db = await getLocalDB();
        
        // Charger TOUTES les liaisons (y compris global) pour vérifier l'origine
        const allDocumentLinks = await db.DocumentLink
          .where('documentId')
          .equals(documentId)
          .toArray();
        
        // Filtrer les liaisons non-globales pour l'affichage
        const documentLinks = allDocumentLinks.filter(link => {
          const linkedType = (link.linkedType || '').toLowerCase();
          return linkedType !== 'global' && link.linkedId !== 'global';
        });
        
        // Convertir vers le format attendu par l'UI
        const formattedLinks: DocumentLink[] = documentLinks.map(link => ({
          type: link.linkedType.toLowerCase(),
          id: link.linkedId || '',
          displayName: link.entityName || link.linkedId || link.linkedType,
        }));
        
        setLinks(formattedLinks);
        
        // ✅ Séparer les liaisons de l'entité courante (transaction ou prêt)
        if (currentEntityId && currentEntityType) {
          const entityLinks = formattedLinks.filter(link => 
            link.type === currentEntityType && link.id === currentEntityId
          );
          setTransactionLinks(entityLinks); // Réutiliser transactionLinks pour l'entité courante
          
          // Vérifier si les liaisons restantes (hors entité courante) ont été créées avec l'entité
          // Si après suppression de la liaison entité, il ne reste que des liaisons globales,
          // cela signifie que toutes les autres liaisons ont été créées avec l'entité
          const otherLinks = formattedLinks.filter(link => 
            !(link.type === currentEntityType && link.id === currentEntityId)
          );
          const globalLinks = allDocumentLinks.filter(link => {
            const linkedType = (link.linkedType || '').toLowerCase();
            return linkedType === 'global' || link.linkedId === 'global';
          });
          
          // Si les autres liaisons + global = toutes les liaisons (hors entité courante),
          // alors toutes les autres liaisons ont été créées avec l'entité
          setHasOnlyTransactionCreatedLinks(
            otherLinks.length > 0 && 
            (otherLinks.length + globalLinks.length) === (allDocumentLinks.length - entityLinks.length)
          );
        }
      } else {
        // Mode normal : utiliser l'API
        const response = await fetch(`/api/documents/${documentId}/links/non-global`);
        if (!response.ok) {
          throw new Error('Erreur lors du chargement des liaisons');
        }
        const data = await response.json();
        const allLinks = data.data || [];
        setLinks(allLinks);
        
        // ✅ Séparer les liaisons de l'entité courante (transaction ou prêt)
        if (currentEntityId && currentEntityType) {
          const entityLinks = allLinks.filter((link: DocumentLink) => 
            link.type === currentEntityType && link.id === currentEntityId
          );
          setTransactionLinks(entityLinks); // Réutiliser transactionLinks pour l'entité courante
          
          // En mode normal, on ne peut pas facilement vérifier l'origine des liaisons
          // On suppose que si d'autres liaisons existent, elles n'ont pas été créées avec l'entité
          const otherLinks = allLinks.filter((link: DocumentLink) => 
            !(link.type === currentEntityType && link.id === currentEntityId)
          );
          setHasOnlyTransactionCreatedLinks(false); // Par défaut, on ne peut pas être sûr
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des liaisons:', error);
      notify2.error('Erreur lors du chargement des liaisons');
      setLinks([]);
      setTransactionLinks([]);
      setHasOnlyTransactionCreatedLinks(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAll = async () => {
    // ✅ La modale ne fait QUE appeler onConfirm - la suppression est gérée par le parent
    onConfirm('all');
  };

  const handleConfirmTransactionLinksOnly = async () => {
    // ✅ Supprimer uniquement les liaisons de la transaction
    onConfirm('transaction-links-only');
  };

  const getLinkedTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'property': 'Bien',
      'lease': 'Bail',
      'transaction': 'Transaction',
      'loan': 'Prêt',
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
      className="md:max-w-lg" // ⚠️ CORRECTION: Limiter la largeur en desktop (max-w-lg = 512px au lieu de max-w-full)
      closeOnBackdropClick={!isLoading && !isDeleting}
      closeOnEscape={!isLoading && !isDeleting}
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
                    {links.map((link, index) => {
                      const isCurrentEntityLink = currentEntityId && currentEntityType && link.type === currentEntityType && link.id === currentEntityId;
                      const entityLabel = currentEntityType === 'loan' ? 'ce prêt' : (currentEntityType === 'transaction' ? 'cette transaction' : 'cette entité');
                      return (
                        <li key={index} className="text-sm text-gray-700 flex items-start">
                          <span className={`inline-block w-2 h-2 rounded-full mt-1.5 mr-2 flex-shrink-0 ${isCurrentEntityLink ? 'bg-orange-500' : 'bg-blue-500'}`} />
                          <span>
                            <span className="font-medium">{getLinkedTypeLabel(link.type)}</span>
                            {' : '}
                            {link.displayName}
                            {isCurrentEntityLink && (
                              <span className="ml-2 text-xs text-orange-600 font-medium">({entityLabel})</span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Options de suppression si currentEntityId est fourni */}
                {currentEntityId && transactionLinks.length > 0 && links.length > transactionLinks.length ? (
                  <div className="space-y-3 border-t pt-3">
                    <p className="text-sm text-gray-700 font-medium">
                      Que souhaitez-vous faire ?
                    </p>
                    
                    {/* Message d'information si toutes les liaisons ont été créées avec l'entité */}
                    {hasOnlyTransactionCreatedLinks && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 overflow-hidden">
                        <p className="text-xs text-blue-800 font-medium">
                          ℹ️ Toutes les autres liaisons (bien, bail, etc.) ont été créées lors de la création de {currentEntityType === 'loan' ? 'ce prêt' : 'cette transaction'}.
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                          Si vous supprimez uniquement les liaisons avec {currentEntityType === 'loan' ? 'ce prêt' : 'cette transaction'}, le document n'aura plus que des liaisons globales.
                        </p>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 overflow-hidden">
                        <p className="text-sm text-gray-700 mb-2">
                          <strong>Option 1 :</strong> Supprimer uniquement les liaisons avec {currentEntityType === 'loan' ? 'ce prêt' : 'cette transaction'}
                        </p>
                        <p className="text-xs text-gray-600">
                          {hasOnlyTransactionCreatedLinks 
                            ? `Le document sera conservé mais n'aura plus que des liaisons globales (les autres liaisons seront également supprimées car créées avec ${currentEntityType === 'loan' ? 'ce prêt' : 'cette transaction'}).`
                            : "Le document sera conservé ainsi que ses autres liaisons (bien, bail, etc.)"
                          }
                        </p>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 overflow-hidden">
                        <p className="text-sm text-gray-700 mb-2">
                          <strong>Option 2 :</strong> Supprimer le document et toutes ses liaisons
                        </p>
                        <p className="text-xs text-gray-600">
                          Le fichier sera définitivement supprimé ainsi que toutes ses liaisons
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-700">
                    La suppression entraînera la <strong>disparition définitive du fichier</strong> et de <strong>toutes ses liaisons</strong>. Êtes-vous sûr ?
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-700 text-center">
                La suppression entraînera la <strong>disparition définitive du fichier</strong>. Êtes-vous sûr ?
              </p>
            )}
          </>
        )}

        {/* Loader pendant la suppression */}
        {isDeleting && (
          <div className="flex items-center justify-center gap-2 py-4 bg-gray-50 rounded-lg">
            <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
            <span className="text-sm text-gray-700 font-medium">Suppression en cours...</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading || isDeleting}
            className="flex-1"
          >
            Annuler
          </Button>
          {currentEntityId && transactionLinks.length > 0 && links.length > transactionLinks.length ? (
            <>
              <Button
                onClick={handleConfirmTransactionLinksOnly}
                disabled={isLoading || isDeleting}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white border-orange-600"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Suppression...
                  </>
                ) : (
                  'Liaisons uniquement'
                )}
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmAll}
                disabled={isLoading || isDeleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Suppression...
                  </>
                ) : (
                  'Tout supprimer'
                )}
              </Button>
            </>
          ) : (
            <Button
              variant="destructive"
              onClick={handleConfirmAll}
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
          )}
        </div>
      </div>
    </Modal>
  );
}


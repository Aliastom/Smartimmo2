'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { FileText, Link, AlertTriangle, X } from 'lucide-react';

interface DuplicateDetectedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLinkExisting: () => void;
  onCancel: () => void;
  onAddAnyway?: () => void;
  duplicateData: {
    code: string;
    policy: string;
    existing: {
      id: string;
      fileName: string;
      typeLabel: string;
      links: Array<{
        type: string;
        id: string;
        entityName?: string;
      }>;
    };
  } | null;
}

export const DuplicateDetectedModal: React.FC<DuplicateDetectedModalProps> = ({
  isOpen,
  onClose,
  onLinkExisting,
  onCancel,
  onAddAnyway,
  duplicateData
}) => {
  // Vérifier que duplicateData n'est pas null
  if (!duplicateData) {
    return null;
  }

  const { existing } = duplicateData;
  const isBlocked = duplicateData.policy === 'block';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Doublon détecté
          </DialogTitle>
          <DialogDescription>
            Un document identique existe déjà dans le système
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Document existant */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileText className="h-8 w-8 text-blue-500 mt-1" />
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">{existing.fileName}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary">{existing.typeLabel}</Badge>
                  <span className="text-sm text-gray-500">Document existant</span>
                </div>
              </div>
            </div>
          </div>

          {/* Liens existants */}
          {existing.DocumentLink.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Déjà lié à :</h4>
              <div className="space-y-2">
                {existing.DocumentLink.map((link, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="capitalize">
                      {link.type}
                    </Badge>
                    <span className="text-gray-600">
                      {link.entityName || link.id}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Message d'information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Link className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <p className="text-sm text-blue-800">
                  <strong>Recommandation :</strong> Lier ce document existant à votre transaction 
                  plutôt que de créer un doublon.
                </p>
                {isBlocked && (
                  <p className="text-sm text-blue-700 mt-1">
                    L'ajout de ce fichier est bloqué car il existe déjà.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onCancel}
            >
              Annuler
            </Button>
            
            {!isBlocked && onAddAnyway && (
              <Button
                variant="outline"
                onClick={onAddAnyway}
              >
                Ajouter quand même
              </Button>
            )}
            
            <Button
              onClick={onLinkExisting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Link className="h-4 w-4 mr-2" />
              Lier l'existant
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

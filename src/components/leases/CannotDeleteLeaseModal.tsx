'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, FileText, ArrowRight, Loader2 } from 'lucide-react';

interface ProtectedLease {
  id: string;
  propertyName: string;
  tenantName: string;
  reason: string;
}

interface CannotDeleteLeaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTerminateLeases?: (leaseIds: string[]) => Promise<void>;
  protectedLeases: ProtectedLease[];
}

export default function CannotDeleteLeaseModal({
  isOpen,
  onClose,
  onTerminateLeases,
  protectedLeases
}: CannotDeleteLeaseModalProps) {
  const [isTerminating, setIsTerminating] = useState(false);

  if (!isOpen) return null;

  const handleTerminate = async () => {
    if (!onTerminateLeases || protectedLeases.length === 0) return;
    
    setIsTerminating(true);
    try {
      const leaseIds = protectedLeases.map(l => l.id);
      await onTerminateLeases(leaseIds);
      onClose();
    } catch (error) {
      console.error('Erreur lors de la résiliation:', error);
    } finally {
      setIsTerminating(false);
    }
  };

  const isSingle = protectedLeases.length === 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-orange-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {isSingle 
                ? 'Impossible de supprimer ce bail' 
                : `Impossible de supprimer ${protectedLeases.length} baux`
              }
            </h3>
            <p className="text-sm text-gray-600">
              {isSingle 
                ? 'Ce bail contient des transactions'
                : 'Ces baux contiennent des transactions'
              }
            </p>
          </div>
        </div>

        {/* Liste des baux protégés */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <p className="text-sm font-semibold text-orange-900 mb-3">
            {isSingle ? 'Bail concerné :' : 'Baux concernés :'}
          </p>
          <div className="space-y-2">
            {protectedLeases.map((lease, index) => (
              <div 
                key={lease.id} 
                className="bg-white rounded p-3 border border-orange-100"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {lease.propertyName}
                    </p>
                    <p className="text-sm text-gray-600">
                      {lease.tenantName}
                    </p>
                  </div>
                  <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                    #{index + 1}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Raison */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-900">
            <strong>Raison :</strong> {isSingle ? 'Ce bail contient' : 'Ces baux contiennent'} des transactions et ne {isSingle ? 'peut' : 'peuvent'} pas être supprimé{isSingle ? '' : 's'} directement pour préserver l'intégrité comptable.
          </p>
        </div>

        {/* Explications */}
        <div className="space-y-3 mb-6">
          <h4 className="font-medium text-gray-900 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Solution automatique
          </h4>
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              Cliquez sur le bouton ci-dessous pour résilier automatiquement {isSingle ? 'ce bail' : 'ces baux'} :
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Le statut passera à <strong>"Résilié"</strong></li>
              <li>L'historique et les transactions seront conservés</li>
              <li>Vous pourrez ensuite supprimer {isSingle ? 'le bail' : 'les baux'} si nécessaire</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isTerminating}
          >
            Fermer
          </Button>
          {onTerminateLeases && (
            <Button
              variant="default"
              onClick={handleTerminate}
              disabled={isTerminating}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isTerminating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Résiliation en cours...
                </>
              ) : (
                <>
                  Résilier {isSingle ? 'ce bail' : `ces ${protectedLeases.length} baux`}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}


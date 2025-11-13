'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import { Trash2, AlertTriangle, FileText } from 'lucide-react';

interface LeaseToDelete {
  id: string;
  propertyName: string;
  tenantName: string;
}

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  leases: LeaseToDelete[];
}

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  leases
}: DeleteConfirmModalProps) {
  if (!isOpen || leases.length === 0) return null;

  const isSingle = leases.length === 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl border border-red-100 animate-in fade-in zoom-in duration-200">
        {/* Header avec icône */}
        <div className="flex items-start gap-4 mb-6">
          <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
            <Trash2 className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1 pt-1">
            <h3 className="text-xl font-bold text-gray-900 mb-1">
              Confirmer la suppression
            </h3>
            <p className="text-sm text-gray-600">
              {isSingle 
                ? 'Cette action est irréversible' 
                : `Vous allez supprimer ${leases.length} baux`
              }
            </p>
          </div>
        </div>

        {/* Message d'avertissement */}
        <div className="bg-red-50 border-l-4 border-red-500 rounded-r-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-900 mb-1">
                Attention
              </p>
              <p className="text-sm text-red-800">
                {isSingle 
                  ? 'Le bail sera définitivement supprimé. Si le bail contient des transactions, il sera automatiquement résilié à la place.'
                  : 'Les baux sélectionnés seront définitivement supprimés. Ceux contenant des transactions seront automatiquement résiliés.'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Liste des baux */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-gray-500" />
            <h4 className="text-sm font-semibold text-gray-700">
              {isSingle ? 'Bail concerné :' : 'Baux concernés :'}
            </h4>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto border border-gray-200">
            <div className="space-y-2">
              {leases.map((lease, index) => (
                <div 
                  key={lease.id} 
                  className="bg-white rounded-lg p-3 border border-gray-200 hover:border-red-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {lease.propertyName}
                      </p>
                      <p className="text-xs text-gray-600 truncate">
                        {lease.tenantName}
                      </p>
                    </div>
                    <Trash2 className="h-4 w-4 text-red-400 flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className="hover:bg-gray-100"
          >
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-200"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer {!isSingle && `(${leases.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
}


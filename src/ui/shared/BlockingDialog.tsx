'use client';

import React from 'react';
import { X, AlertTriangle, ExternalLink } from 'lucide-react';

export interface Blocker {
  type: 'lease' | 'loan' | 'document' | 'photo' | 'transaction' | 'payment';
  id: string;
  label: string;
  count?: number;
}

export interface BlockingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  blockers: Blocker[];
  onViewBlocker?: (blocker: Blocker) => void;
}

const getBlockerTypeLabel = (type: Blocker['type']): string => {
  switch (type) {
    case 'lease':
      return 'Bail';
    case 'loan':
      return 'Prêt';
    case 'document':
      return 'Document';
    case 'photo':
      return 'Photo';
    case 'transaction':
      return 'Transaction';
    case 'payment':
      return 'Paiement';
    default:
      return type;
  }
};

const getBlockerTypeIcon = (type: Blocker['type']): string => {
  switch (type) {
    case 'lease':
      return '📄';
    case 'loan':
      return '💰';
    case 'document':
      return '📁';
    case 'photo':
      return '📸';
    case 'transaction':
      return '💳';
    case 'payment':
      return '💸';
    default:
      return '⚠️';
  }
};

export default function BlockingDialog({
  isOpen,
  onClose,
  title,
  message,
  blockers,
  onViewBlocker,
}: BlockingDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-base-content bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-base-300">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-error" />
            </div>
            <h3 className="text-lg font-semibold text-base-content">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-base-content opacity-60 hover:text-base-content opacity-80 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-base-content opacity-80 mb-4">
            {message}
          </p>

          {/* Blockers List */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-base-content">
              Éléments bloquants ({blockers.length}) :
            </h4>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {blockers.map((blocker, index) => (
                <div
                  key={`${blocker.type}-${blocker.id}`}
                  className="flex items-center justify-between p-3 bg-base-200 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">
                      {getBlockerTypeIcon(blocker.type)}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-base-content">
                        {blocker.label}
                      </p>
                      <p className="text-xs text-base-content opacity-70">
                        {getBlockerTypeLabel(blocker.type)}
                        {blocker.count && ` (${blocker.count})`}
                      </p>
                    </div>
                  </div>
                  
                  {onViewBlocker && (
                    <button
                      onClick={() => onViewBlocker(blocker)}
                      className="flex items-center space-x-1 text-primary hover:text-blue-800 text-sm"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>Voir</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-base-300">
          <button
            onClick={onClose}
            className="px-4 py-2 text-base-content opacity-90 bg-base-200 rounded-md hover:bg-base-200 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}


'use client';

import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertCircle, X } from 'lucide-react';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  details?: Array<{ field: string; message: string }>;
  onRetry?: () => void;
}

export function ErrorModal({ 
  isOpen, 
  onClose, 
  title = "Erreur", 
  message, 
  details = [], 
  onRetry 
}: ErrorModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Message principal */}
        <div className="mb-4">
          <p className="text-gray-700">{message}</p>
        </div>

        {/* Détails des erreurs */}
        {details.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Détails des erreurs :
            </h4>
            <div className="space-y-2">
              {details.map((detail, index) => (
                <div key={index} className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-800">
                      {detail.field}
                    </p>
                    <p className="text-sm text-red-700">
                      {detail.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          {onRetry && (
            <Button
              variant="outline"
              onClick={onRetry}
            >
              Réessayer
            </Button>
          )}
          <Button
            variant="primary"
            onClick={onClose}
          >
            Fermer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
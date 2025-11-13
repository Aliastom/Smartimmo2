'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { AlertTriangle } from 'lucide-react';

interface TransactionSuggestionConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTypeName: string;
  onConfirm: () => void;
  hasExistingData: boolean;
}

export function TransactionSuggestionConfirmModal({
  isOpen,
  onClose,
  documentTypeName,
  onConfirm,
  hasExistingData
}: TransactionSuggestionConfirmModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <DialogTitle>Document reconnu</DialogTitle>
          </div>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-gray-700">
            Document reconnu en tant que <strong>"{documentTypeName}"</strong>.
          </p>
          
          <p className="text-sm text-gray-700">
            Ce type de document est associé aux transactions dans l'administration des documents.
          </p>
          
          {hasExistingData && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-sm text-orange-800">
                ⚠️ <strong>Attention :</strong> Cela écrasera les données présentes dans les onglets 
                <strong> Information essentielle</strong> et <strong>Période</strong>.
              </p>
            </div>
          )}
          
          <p className="text-sm text-gray-700">
            Voulez-vous pré-remplir automatiquement la transaction avec les données extraites du document ?
          </p>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Non, merci
          </Button>
          <Button onClick={onConfirm}>
            Oui, pré-remplir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


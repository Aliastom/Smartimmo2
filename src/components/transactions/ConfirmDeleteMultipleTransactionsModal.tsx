import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Transaction {
  id: string;
  label: string;
  hasDocument: boolean;
  documentsCount: number;
}

interface ConfirmDeleteMultipleTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mode: 'delete_docs' | 'keep_docs_globalize') => void;
  transactions: Transaction[];
}

export const ConfirmDeleteMultipleTransactionsModal: React.FC<ConfirmDeleteMultipleTransactionsModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  transactions,
}) => {
  const [selectedMode, setSelectedMode] = useState<'delete_docs' | 'keep_docs_globalize'>('keep_docs_globalize');
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const transactionsWithDocs = transactions.filter(t => t.hasDocument);
  const totalDocuments = transactions.reduce((sum, t) => sum + t.documentsCount, 0);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm(selectedMode);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50"
        style={{ zIndex: 9998 }}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="fixed inset-0 flex items-center justify-center"
        style={{ zIndex: 9999, pointerEvents: 'none' }}
      >
        <div 
          className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6"
          style={{ pointerEvents: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="btn btn-sm btn-circle absolute right-2 top-2"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
          
          <div className="flex flex-col items-center">
            <AlertTriangle className="h-16 w-16 text-red-500 mb-4" />
            <h3 className="font-bold text-lg text-center mb-4">
              Supprimer ces transactions ?
            </h3>
            
            <div className="text-center mb-6">
              <p className="text-gray-700 mb-2">
                Vous êtes sur le point de supprimer <strong>{transactions.length} transaction{transactions.length > 1 ? 's' : ''}</strong>.
              </p>
              
              {transactionsWithDocs.length > 0 && (
                <p className="text-gray-600">
                  {transactionsWithDocs.length} transaction{transactionsWithDocs.length > 1 ? 's' : ''} contiennent des documents 
                  ({totalDocuments} document{totalDocuments > 1 ? 's' : ''} au total).
                </p>
              )}
            </div>

            {transactionsWithDocs.length > 0 && (
              <div className="w-full mb-6">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  Que souhaitez-vous faire avec les documents ?
                </p>
                
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="deleteMode"
                      value="delete_docs"
                      checked={selectedMode === 'delete_docs'}
                      onChange={(e) => setSelectedMode(e.target.value as 'delete_docs')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        Supprimer les documents et toutes leurs liaisons
                      </div>
                      <div className="text-sm text-red-600">
                        Action irréversible : les fichiers seront définitivement supprimés
                      </div>
                    </div>
                  </label>
                  
                  <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="deleteMode"
                      value="keep_docs_globalize"
                      checked={selectedMode === 'keep_docs_globalize'}
                      onChange={(e) => setSelectedMode(e.target.value as 'keep_docs_globalize')}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        Conserver les documents en ne laissant que la liaison globale
                      </div>
                      <div className="text-sm text-gray-600">
                        Les documents resteront visibles dans l'onglet Documents, toutes les autres liaisons seront retirées
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={isDeleting}
              >
                Annuler
              </Button>
              <Button
                onClick={handleConfirm}
                className="flex-1 btn-error"
                disabled={isDeleting}
              >
                {isDeleting ? 'Suppression...' : 'Supprimer les transactions'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
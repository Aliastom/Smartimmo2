import React, { useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
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
  deletingProgress?: { current: number; total: number } | null;
}

export const ConfirmDeleteMultipleTransactionsModal: React.FC<ConfirmDeleteMultipleTransactionsModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  transactions,
  deletingProgress,
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
      // Ne pas fermer immédiatement, laisser onConfirm gérer la fermeture après la suppression
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
        onClick={isDeleting || deletingProgress !== null ? undefined : onClose}
      />
      
      {/* Modal - Mobile: quasi plein écran avec cadre, Desktop: centré */}
      <div 
        className="fixed inset-0 flex items-center justify-center p-3 md:p-4"
        style={{ zIndex: 9999, pointerEvents: 'none' }}
      >
        <div 
          className="bg-white rounded-2xl shadow-2xl border border-gray-200 md:border-base-200 max-w-[560px] md:max-w-2xl w-[calc(100vw-24px)] h-[calc(100dvh-24px)] md:h-auto md:max-h-[90vh] overflow-y-auto p-4 md:p-6"
          style={{ pointerEvents: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="btn btn-sm btn-circle absolute right-2 top-2"
            onClick={onClose}
            disabled={isDeleting || deletingProgress !== null}
          >
            <X className="h-4 w-4" />
          </button>
          
          <div className="flex flex-col items-center">
            <AlertTriangle className="h-16 w-16 text-red-500 mb-4" />
            <h3 className="font-bold text-lg text-center mb-4">
              Supprimer ces transactions ?
            </h3>
            
            <div className="text-center mb-6">
              {deletingProgress ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin sidebar-loader-orange" />
                    <p className="text-gray-700 font-medium">
                      Suppression en cours... {deletingProgress.current} / {deletingProgress.total}
                    </p>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(deletingProgress.current / deletingProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600">
                    {deletingProgress.total - deletingProgress.current} transaction{deletingProgress.total - deletingProgress.current > 1 ? 's' : ''} restante{deletingProgress.total - deletingProgress.current > 1 ? 's' : ''}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-gray-700 mb-2">
                    Vous êtes sur le point de supprimer <strong>{transactions.length} transaction{transactions.length > 1 ? 's' : ''}</strong>.
                  </p>
                  
                  {transactionsWithDocs.length > 0 && (
                    <p className="text-gray-600">
                      {transactionsWithDocs.length} transaction{transactionsWithDocs.length > 1 ? 's' : ''} contiennent des documents 
                      ({totalDocuments} document{totalDocuments > 1 ? 's' : ''} au total).
                    </p>
                  )}
                </>
              )}
            </div>

            {transactionsWithDocs.length > 0 && (
              <div className="w-full mb-6">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  Que souhaitez-vous faire avec les documents ?
                </p>
                
                <div className="space-y-3">
                  <label className={`flex items-start gap-3 p-3 border rounded-lg ${isDeleting || deletingProgress !== null ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="deleteMode"
                      value="delete_docs"
                      checked={selectedMode === 'delete_docs'}
                      onChange={(e) => setSelectedMode(e.target.value as 'delete_docs')}
                      disabled={isDeleting || deletingProgress !== null}
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
                  
                  <label className={`flex items-start gap-3 p-3 border rounded-lg ${isDeleting || deletingProgress !== null ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="deleteMode"
                      value="keep_docs_globalize"
                      checked={selectedMode === 'keep_docs_globalize'}
                      onChange={(e) => setSelectedMode(e.target.value as 'keep_docs_globalize')}
                      disabled={isDeleting || deletingProgress !== null}
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

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 w-full sm:w-auto"
                disabled={isDeleting || deletingProgress !== null}
              >
                Annuler
              </Button>
              <Button
                onClick={handleConfirm}
                className="flex-1 w-full sm:w-auto btn-error"
                disabled={isDeleting || deletingProgress !== null}
              >
                {isDeleting || deletingProgress !== null ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin sidebar-loader-orange" />
                    Suppression...
                  </>
                ) : (
                  'Supprimer les transactions'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
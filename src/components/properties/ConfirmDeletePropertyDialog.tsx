'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { 
  AlertTriangle, 
  Archive, 
  ArrowRight, 
  Trash2,
  FileText,
  CreditCard,
  Home,
  Calendar,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/utils/cn';

export type DeleteMode = 'archive' | 'reassign' | 'cascade';

interface PropertyStats {
  leases: number;
  transactions: number;
  documents: number;
  echeances: number;
  loans: number;
}

interface ConfirmDeletePropertyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mode: DeleteMode, targetPropertyId?: string) => Promise<void>;
  property: {
    id: string;
    name: string;
  };
  stats: PropertyStats;
  availableProperties?: Array<{ id: string; name: string }>;
}

export function ConfirmDeletePropertyDialog({
  isOpen,
  onClose,
  onConfirm,
  property,
  stats,
  availableProperties = [],
}: ConfirmDeletePropertyDialogProps) {
  const [mode, setMode] = useState<DeleteMode>('archive');
  const [targetPropertyId, setTargetPropertyId] = useState<string>('');
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const hasLinkedData = stats.leases > 0 || stats.transactions > 0 || stats.documents > 0 || stats.echeances > 0 || stats.loans > 0;
  const totalLinked = stats.leases + stats.transactions + stats.documents + stats.echeances + stats.loans;

  // Réinitialiser quand on ouvre/ferme
  useEffect(() => {
    if (isOpen) {
      setMode('archive');
      setTargetPropertyId('');
      setConfirmText('');
      setIsDeleting(false);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (mode === 'cascade' && confirmText !== 'SUPPRIMER') {
      return;
    }

    if (mode === 'reassign' && !targetPropertyId) {
      return;
    }

    setIsDeleting(true);
    try {
      await onConfirm(mode, targetPropertyId || undefined);
      onClose();
    } catch (error) {
      console.error('Error deleting property:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const canCascadeDelete = !hasLinkedData;

  return (
    <Modal
      isOpen={isOpen}
      onClose={isDeleting ? undefined : onClose}
      title="Supprimer le bien"
      size="lg"
      closeOnBackdropClick={!isDeleting}
      closeOnEscape={!isDeleting}
    >
      <div className="space-y-6">
        {/* Info sur le bien */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">{property.name}</h4>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              <Home className="h-3 w-3 mr-1" />
              {stats.leases} bail{stats.leases > 1 ? 'x' : ''}
            </Badge>
            <Badge variant="secondary">
              <CreditCard className="h-3 w-3 mr-1" />
              {stats.transactions} transaction{stats.transactions > 1 ? 's' : ''}
            </Badge>
            <Badge variant="secondary">
              <FileText className="h-3 w-3 mr-1" />
              {stats.documents} document{stats.documents > 1 ? 's' : ''}
            </Badge>
            <Badge variant="secondary">
              <Calendar className="h-3 w-3 mr-1" />
              {stats.echeances} échéance{stats.echeances > 1 ? 's' : ''}
            </Badge>
            <Badge variant="secondary">
              <CreditCard className="h-3 w-3 mr-1" />
              {stats.loans} prêt{stats.loans > 1 ? 's' : ''}
            </Badge>
          </div>
          {totalLinked > 0 && (
            <p className="text-sm text-gray-600 mt-2">
              <strong>{totalLinked}</strong> élément{totalLinked > 1 ? 's' : ''} lié{totalLinked > 1 ? 's' : ''} à ce bien
            </p>
          )}
        </div>

        {/* Options de suppression */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700 mb-3">
            Que souhaitez-vous faire ?
          </p>

          {/* Option A: Archiver */}
          <label
            className={cn(
              'flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all',
              mode === 'archive'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
            <input
              type="radio"
              name="deleteMode"
              value="archive"
              checked={mode === 'archive'}
              onChange={(e) => setMode(e.target.value as DeleteMode)}
              className="mt-1"
              disabled={isDeleting}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Archive className="h-4 w-4 text-blue-600" />
                <span className="font-semibold text-gray-900">Archiver le bien</span>
                <Badge variant="info" className="text-xs">Recommandé</Badge>
              </div>
              <p className="text-sm text-gray-600">
                Le bien et toutes ses données sont conservés. Les montants restent dans les dashboards.
                Le bien n'apparaîtra plus dans la liste principale (filtre disponible).
              </p>
              {hasLinkedData && (
                <div className="mt-2 text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded">
                  ✓ Les {totalLinked} éléments liés restent accessibles avec un badge "Bien archivé"
                </div>
              )}
            </div>
          </label>

          {/* Option B: Transférer */}
          <label
            className={cn(
              'flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all',
              mode === 'reassign'
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 hover:border-gray-300',
              availableProperties.length === 0 && 'opacity-50 cursor-not-allowed'
            )}
          >
            <input
              type="radio"
              name="deleteMode"
              value="reassign"
              checked={mode === 'reassign'}
              onChange={(e) => setMode(e.target.value as DeleteMode)}
              className="mt-1"
              disabled={isDeleting || availableProperties.length === 0}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <ArrowRight className="h-4 w-4 text-orange-600" />
                <span className="font-semibold text-gray-900">Transférer vers un autre bien</span>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Tous les éléments liés seront réassignés au bien cible. Le bien source sera supprimé.
              </p>
              
              {availableProperties.length > 0 ? (
                <select
                  value={targetPropertyId}
                  onChange={(e) => setTargetPropertyId(e.target.value)}
                  disabled={mode !== 'reassign' || isDeleting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Sélectionner le bien cible...</option>
                  {availableProperties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-gray-500 italic">
                  Aucun autre bien disponible pour le transfert
                </p>
              )}
            </div>
          </label>

          {/* Option C: Supprimer définitivement */}
          <label
            className={cn(
              'flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all',
              mode === 'cascade'
                ? 'border-red-500 bg-red-50'
                : 'border-gray-200 hover:border-gray-300',
              !canCascadeDelete && 'opacity-50 cursor-not-allowed'
            )}
          >
            <input
              type="radio"
              name="deleteMode"
              value="cascade"
              checked={mode === 'cascade'}
              onChange={(e) => setMode(e.target.value as DeleteMode)}
              className="mt-1"
              disabled={isDeleting || !canCascadeDelete}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Trash2 className="h-4 w-4 text-red-600" />
                <span className="font-semibold text-gray-900">Supprimer définitivement</span>
                <Badge variant="danger" className="text-xs">Irréversible</Badge>
              </div>
              <p className="text-sm text-gray-600">
                Le bien sera supprimé de la base de données. Cette action est irréversible.
              </p>
              
              {!canCascadeDelete && (
                <div className="mt-2 text-xs text-red-700 bg-red-100 px-2 py-1 rounded">
                  ⚠️ Impossible : {totalLinked} élément{totalLinked > 1 ? 's sont' : ' est'} encore lié{totalLinked > 1 ? 's' : ''} à ce bien
                </div>
              )}

              {canCascadeDelete && mode === 'cascade' && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-red-900">
                    Tapez <strong>SUPPRIMER</strong> pour confirmer :
                  </p>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="SUPPRIMER"
                    className="w-full px-3 py-2 border-2 border-red-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              )}
            </div>
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            Annuler
          </Button>
          <Button
            variant={mode === 'cascade' ? 'destructive' : mode === 'reassign' ? 'warning' : 'primary'}
            onClick={handleConfirm}
            disabled={
              isDeleting ||
              (mode === 'reassign' && !targetPropertyId) ||
              (mode === 'cascade' && (!canCascadeDelete || confirmText !== 'SUPPRIMER'))
            }
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {mode === 'archive' ? 'Archivage...' : mode === 'reassign' ? 'Transfert...' : 'Suppression...'}
              </>
            ) : (
              <>
                {mode === 'archive' ? (
                  <>
                    <Archive className="h-4 w-4 mr-2" />
                    Archiver
                  </>
                ) : mode === 'reassign' ? (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Transférer
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer définitivement
                  </>
                )}
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}


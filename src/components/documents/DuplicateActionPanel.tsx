/**
 * Panneau d'actions pour gérer les doublons de documents
 * Affiche les options: link_existing, replace, keep_both, cancel
 */

import { useState } from 'react';
import { DedupDecision } from '@/types/document-link';
import { Button } from '@/ui/shared/button';
import { Label } from '@/ui/shared/label';
import { AlertTriangle, Link2, RefreshCw, Copy, X, FileText, Calendar, HardDrive } from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DuplicateInfo {
  id: string;
  filename: string;
  uploadedAt: Date | string;
  typeCode?: string;
  typeLabel?: string;
  size?: number;
  sha256?: string;
}

interface DuplicateActionPanelProps {
  duplicateInfo: DuplicateInfo;
  onActionSelected: (decision: DedupDecision, setAsPrimary?: boolean) => void;
  onCancel: () => void;
}

export function DuplicateActionPanel({
  duplicateInfo,
  onActionSelected,
  onCancel,
}: DuplicateActionPanelProps) {
  const [selectedAction, setSelectedAction] = useState<DedupDecision | null>(null);
  const [setAsPrimary, setSetAsPrimary] = useState(false);

  const handleConfirm = () => {
    if (selectedAction) {
      onActionSelected(selectedAction, setAsPrimary);
    }
  };

  const uploadedDate = typeof duplicateInfo.uploadedAt === 'string' 
    ? new Date(duplicateInfo.uploadedAt) 
    : duplicateInfo.uploadedAt;

  return (
    <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 space-y-4">
      {/* En-tête */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-6 w-6 text-amber-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-amber-900">
            Doublon détecté
          </h3>
          <p className="text-sm text-amber-700 mt-1">
            Un document identique existe déjà dans le système. Que souhaitez-vous faire ?
          </p>
        </div>
      </div>

      {/* Informations sur le document existant */}
      <div className="bg-white border border-amber-200 rounded-md p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900">Document existant</span>
          {duplicateInfo.typeLabel && (
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
              {duplicateInfo.typeLabel}
            </span>
          )}
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FileText className="h-4 w-4" />
            <span className="truncate">{duplicateInfo.filename}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="h-4 w-4" />
            <span>
              {format(uploadedDate, "d MMMM yyyy 'à' HH:mm", { locale: fr })}
            </span>
          </div>
          
          {duplicateInfo.size && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <HardDrive className="h-4 w-4" />
              <span>{formatBytes(duplicateInfo.size)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions disponibles */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Choisir une action :
        </Label>

        {/* Action 1: Lier au document existant (recommandé) */}
        <button
          type="button"
          onClick={() => setSelectedAction('link_existing')}
          className={`w-full text-left border-2 rounded-md p-3 transition-colors ${
            selectedAction === 'link_existing'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-blue-300 bg-white'
          }`}
        >
          <div className="flex items-start gap-3">
            <Link2 className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
              selectedAction === 'link_existing' ? 'text-blue-600' : 'text-gray-400'
            }`} />
            <div className="flex-1">
              <div className="font-medium text-gray-900">
                Lier au document existant
                <span className="ml-2 text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                  Recommandé
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Associer l'entité actuelle au document déjà présent. Aucun nouveau fichier ne sera créé.
              </p>
            </div>
          </div>
        </button>

        {/* Action 2: Remplacer */}
        <button
          type="button"
          onClick={() => setSelectedAction('replace')}
          className={`w-full text-left border-2 rounded-md p-3 transition-colors ${
            selectedAction === 'replace'
              ? 'border-orange-500 bg-orange-50'
              : 'border-gray-200 hover:border-orange-300 bg-white'
          }`}
        >
          <div className="flex items-start gap-3">
            <RefreshCw className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
              selectedAction === 'replace' ? 'text-orange-600' : 'text-gray-400'
            }`} />
            <div className="flex-1">
              <div className="font-medium text-gray-900">
                Remplacer la version principale
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Créer un nouveau document et le définir comme version principale pour ce contexte.
              </p>
            </div>
          </div>
        </button>

        {/* Action 3: Conserver les deux */}
        <button
          type="button"
          onClick={() => setSelectedAction('keep_both')}
          className={`w-full text-left border-2 rounded-md p-3 transition-colors ${
            selectedAction === 'keep_both'
              ? 'border-purple-500 bg-purple-50'
              : 'border-gray-200 hover:border-purple-300 bg-white'
          }`}
        >
          <div className="flex items-start gap-3">
            <Copy className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
              selectedAction === 'keep_both' ? 'text-purple-600' : 'text-gray-400'
            }`} />
            <div className="flex-1">
              <div className="font-medium text-gray-900">
                Conserver les deux documents
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Créer un nouveau document en parallèle. Les deux versions coexisteront.
              </p>
              
              {selectedAction === 'keep_both' && (
                <label className="flex items-center gap-2 mt-2 text-sm">
                  <input
                    type="checkbox"
                    checked={setAsPrimary}
                    onChange={(e) => setSetAsPrimary(e.target.checked)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-gray-700">Définir comme document principal</span>
                </label>
              )}
            </div>
          </div>
        </button>

        {/* Action 4: Annuler */}
        <button
          type="button"
          onClick={() => setSelectedAction('cancel')}
          className={`w-full text-left border-2 rounded-md p-3 transition-colors ${
            selectedAction === 'cancel'
              ? 'border-red-500 bg-red-50'
              : 'border-gray-200 hover:border-red-300 bg-white'
          }`}
        >
          <div className="flex items-start gap-3">
            <X className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
              selectedAction === 'cancel' ? 'text-red-600' : 'text-gray-400'
            }`} />
            <div className="flex-1">
              <div className="font-medium text-gray-900">
                Annuler l'upload
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Ne rien enregistrer et fermer cette fenêtre.
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Boutons de validation */}
      <div className="flex justify-end gap-3 pt-2 border-t border-amber-200">
        <Button
          variant="ghost"
          onClick={onCancel}
        >
          Retour
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!selectedAction}
          className={`${
            selectedAction === 'link_existing' ? 'bg-blue-600 hover:bg-blue-700' :
            selectedAction === 'replace' ? 'bg-orange-600 hover:bg-orange-700' :
            selectedAction === 'keep_both' ? 'bg-purple-600 hover:bg-purple-700' :
            selectedAction === 'cancel' ? 'bg-red-600 hover:bg-red-700' :
            'bg-gray-400'
          }`}
        >
          Confirmer
        </Button>
      </div>
    </div>
  );
}

// Fonction utilitaire pour formater les octets
function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 octets';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['octets', 'Ko', 'Mo', 'Go', 'To'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}


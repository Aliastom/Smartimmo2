/**
 * Composant DedupFlowModal - Interface utilisateur pour le module DedupFlow
 * 
 * Affiche la modale de déduplication et orchestre le flux selon la décision de l'utilisateur
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { 
  FileCheck, 
  FileX, 
  AlertTriangle, 
  Info,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { DedupFlowOutput } from '@/types/dedup-flow';

interface DedupFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  flowOutput: DedupFlowOutput;
  onAction: (action: 'confirm' | 'replace' | 'cancel', data?: any) => void;
  isProcessing?: boolean;
}

export function DedupFlowModal({
  isOpen,
  onClose,
  flowOutput,
  onAction,
  isProcessing = false
}: DedupFlowModalProps) {

  const [isLoading, setIsLoading] = useState(false);

  // Icône selon le type de bannière
  const getBannerIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  // Couleurs selon le type de bannière
  const getBannerColors = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'warning':
        return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  // Gestionnaire d'action
  const handleAction = async (action: 'confirm' | 'replace' | 'cancel' | 'keep_both') => {
    setIsLoading(true);
    try {
      if (action === 'keep_both') {
        // Déclencher la 2ème modale (revue de l'upload)
        await onAction('keep_both', flowOutput);
      } else {
        await onAction(action, flowOutput);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Gestionnaire pour la fermeture avec la croix
  const handleClose = (open: boolean) => {
    if (!open) {
      // Quand on ferme avec la croix, déclencher l'action cancel
      handleAction('cancel');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl" aria-describedby="dedup-flow-description">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {flowOutput.duplicateStatus === 'exact_duplicate' && (
              <FileCheck className="h-6 w-6 text-orange-600" />
            )}
            {flowOutput.duplicateStatus === 'user_forced' && (
              <FileX className="h-6 w-6 text-blue-600" />
            )}
            <DialogTitle className="text-xl">{flowOutput.ui.title}</DialogTitle>
          </div>
          
          <DialogDescription id="dedup-flow-description">
            <span className="flex items-center gap-2">
              <Badge variant={
                flowOutput.duplicateStatus === 'exact_duplicate' ? 'destructive' :
                flowOutput.duplicateStatus === 'user_forced' ? 'default' : 'secondary'
              }>
                {flowOutput.duplicateStatus === 'exact_duplicate' && 'Doublon exact'}
                {flowOutput.duplicateStatus === 'user_forced' && 'Copie volontaire'}
                {flowOutput.duplicateStatus === 'not_duplicate' && 'Nouveau fichier'}
              </Badge>
              
              {flowOutput.flags.userForcesDuplicate && (
                <Badge variant="outline" className="text-blue-600 border-blue-300">
                  Forcé par l'utilisateur
                </Badge>
              )}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Bannière d'information */}
          {flowOutput.ui.banner && (
            <div className={`p-4 rounded-lg border ${getBannerColors(flowOutput.ui.banner.type)}`}>
              <div className="flex items-center gap-3">
                {getBannerIcon(flowOutput.ui.banner.type)}
                <p className="text-sm font-medium">{flowOutput.ui.banner.text}</p>
              </div>
            </div>
          )}

          {/* Nom de fichier suggéré */}
          {flowOutput.ui.suggestedFilename && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Nom de fichier suggéré :</p>
              <p className="font-mono text-sm bg-white p-2 rounded border">
                {flowOutput.ui.suggestedFilename}
              </p>
            </div>
          )}

          {/* Informations sur les flags */}
          {flowOutput.flags.skipDuplicateCheck && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-600" />
                <p className="text-sm text-blue-800">
                  La détection de doublon sera ignorée pour ce fichier.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            {flowOutput.ui.secondaryAction && (
              <Button
                variant="outline"
                onClick={() => handleAction(flowOutput.ui.secondaryAction.action)}
                disabled={isLoading || isProcessing}
              >
                {flowOutput.ui.secondaryAction.label}
              </Button>
            )}
            
            <Button
              variant={flowOutput.ui.primaryAction.action === 'replace' ? 'destructive' : 'default'}
              onClick={() => handleAction(flowOutput.ui.primaryAction.action)}
              disabled={isLoading || isProcessing}
              loading={isLoading}
            >
              {flowOutput.ui.primaryAction.label}
            </Button>
            
            {/* Bouton "Conserver les deux" si disponible */}
            {flowOutput.ui.tertiaryAction && (
              <Button
                variant="outline"
                onClick={() => handleAction(flowOutput.ui.tertiaryAction.action)}
                disabled={isLoading || isProcessing}
              >
                {flowOutput.ui.tertiaryAction.label}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

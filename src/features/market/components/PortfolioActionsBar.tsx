'use client';

import { Camera, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import { cn } from '@/utils/cn';

function formatSnapshotDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export interface PortfolioActionsBarProps {
  onAddOrder: () => void;
  onCaptureSnapshot: () => void;
  snapshotting: boolean;
  /** Dernier instantané automatique ou manuel (affichage silencieux). */
  lastSnapshotCapturedAt?: string | null;
  disabled?: boolean;
  className?: string;
}

/**
 * Barre d’actions sticky : le parent du panneau ne doit pas avoir overflow:hidden sur l’axe vertical,
 * sinon position:sticky ne colle pas au viewport (scrolling du document ok).
 */
export function PortfolioActionsBar({
  onAddOrder,
  onCaptureSnapshot,
  snapshotting,
  lastSnapshotCapturedAt = null,
  disabled,
  className,
}: PortfolioActionsBarProps) {
  return (
    <div
      className={cn(
        'sticky top-0 z-30 -mx-1 flex flex-col gap-3 border-b border-slate-200/90 bg-slate-50/98 px-2 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-slate-50/90 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2 sm:py-4',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-700">Portefeuille réel</p>
        <TooltipProvider delayDuration={250}>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="mt-0.5 cursor-help text-[11px] text-slate-500 underline decoration-dotted decoration-slate-400 underline-offset-2">
                Dernière mise à jour :{' '}
                {lastSnapshotCapturedAt ? formatSnapshotDate(lastSnapshotCapturedAt) : '—'}
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-sm text-xs leading-snug text-slate-800">
              Les instantanés de valorisation sont enregistrés automatiquement en arrière-plan après un ordre (achat / vente),
              une suppression d’ordre, ou un changement du cash stratégique déclaratif. Si aucun point n’existe depuis 12 h,
              un instantané est ajouté à l’ouverture de cet onglet. Optionnellement (variable d’environnement), un point
              supplémentaire peut être créé lorsque la valorisation totale varie de plus de 2 % par rapport au dernier
              instantané. Aucune fenêtre ni confirmation : vous pouvez toujours forcer un point avec « Capturer un instantané ».
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex w-full min-w-0 flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end sm:gap-2">
        <Button
          type="button"
          variant="primary"
          disabled={disabled}
          onClick={onAddOrder}
          className="min-h-[44px] w-full min-w-0 justify-center gap-2 sm:min-h-9 sm:w-auto"
        >
          <PlusCircle className="h-4 w-4 shrink-0" aria-hidden />
          Ajouter un ordre
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || snapshotting}
          onClick={() => void onCaptureSnapshot()}
          className="min-h-[44px] w-full min-w-0 justify-center gap-2 sm:min-h-9 sm:w-auto"
        >
          <Camera className="h-4 w-4 shrink-0" aria-hidden />
          {snapshotting ? 'Enregistrement…' : 'Capturer un instantané'}
        </Button>
      </div>
    </div>
  );
}

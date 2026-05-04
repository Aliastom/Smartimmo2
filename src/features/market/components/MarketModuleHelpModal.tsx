'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';

const STORAGE_KEY = 'smartimmo.market.moduleHelp.dismissed';

export function readMarketHelpDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function MarketModuleHelpModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [neverAgain, setNeverAgain] = useState(false);

  useEffect(() => {
    if (!open) setNeverAgain(false);
  }, [open]);

  const handleConfirm = () => {
    if (neverAgain && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, '1');
      } catch {
        /* ignore */
      }
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-20px)] max-w-lg overflow-y-auto rounded-3xl p-4 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Comment utiliser le module Marché</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm leading-relaxed text-slate-700">
          <section>
            <p className="font-semibold text-slate-900">1. Configurez votre stratégie</p>
            <p className="text-slate-600">
              DCA mensuel, cash disponible, seuils de renfort.
            </p>
          </section>
          <section>
            <p className="font-semibold text-slate-900">2. Consultez les recommandations</p>
            <p className="text-slate-600">
              Smartimmo analyse le prix, le drawdown et vos paramètres.
            </p>
          </section>
          <section>
            <p className="font-semibold text-slate-900">3. Validez une décision</p>
            <p className="text-slate-600">
              Une validation crée un ordre local dans votre portefeuille Smartimmo (aucun ordre bancaire).
            </p>
          </section>
          <section>
            <p className="font-semibold text-slate-900">4. Suivez votre performance</p>
            <p className="text-slate-600">
              Les ordres alimentent les positions, les KPI et les instantanés.
            </p>
          </section>
          <section className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="font-semibold text-amber-950">5. Important</p>
            <p className="text-amber-900">
              Smartimmo n’exécute aucun ordre bancaire. Vous devez passer l’ordre vous-même chez votre courtier si vous souhaitez investir réellement.
            </p>
          </section>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <Checkbox checked={neverAgain} onCheckedChange={(v) => setNeverAgain(Boolean(v))} />
          Ne plus afficher automatiquement
        </label>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button className="w-full sm:w-auto" onClick={handleConfirm}>
            J’ai compris
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

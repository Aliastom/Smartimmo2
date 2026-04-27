'use client';

import { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';

interface MarketInvestmentSettingsDialogV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
  children: ReactNode;
}

export function MarketInvestmentSettingsDialogV2({
  open,
  onOpenChange,
  onCancel,
  onSave,
  isSaving,
  children,
}: MarketInvestmentSettingsDialogV2Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-auto w-[calc(100vw-24px)] max-h-[calc(100dvh-24px)] max-w-md rounded-3xl p-0 overflow-hidden flex flex-col sm:max-w-3xl">
        <DialogHeader className="shrink-0 px-5 pt-5 pb-3 border-b border-slate-200 pr-12">
          <DialogTitle>Paramètres Marché & Investissement</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: 'calc(100dvh - 210px)' }}>
          {children}
        </div>

        <DialogFooter className="shrink-0 px-5 py-4 border-t border-slate-200 bg-white flex flex-col gap-2 sm:flex-row sm:items-center">
          <p className="w-full text-xs leading-5 text-slate-500 sm:mr-auto sm:w-auto">
            Ces paramètres sont déclaratifs, locaux à Smartimmo, et ne déclenchent aucun ordre bancaire.
          </p>
          <Button className="order-2 w-full sm:order-none sm:w-auto" variant="outline" onClick={onCancel} disabled={isSaving}>
            Annuler
          </Button>
          <Button className="order-1 w-full sm:order-none sm:w-auto" onClick={onSave} disabled={isSaving}>
            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


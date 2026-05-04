'use client';

import { PieChart } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export interface PortfolioEmptyStateProps {
  onAddFirstOrder: () => void;
  onImportData?: () => void;
  disabled?: boolean;
}

export function PortfolioEmptyState({ onAddFirstOrder, onImportData, disabled }: PortfolioEmptyStateProps) {
  return (
    <Card className="rounded-2xl border-dashed border-slate-200 bg-slate-50/50 shadow-sm">
      <CardContent className="flex flex-col items-center justify-center px-5 py-12 text-center sm:px-8 sm:py-14 md:px-10 md:py-16">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <PieChart className="h-8 w-8 text-slate-400" aria-hidden />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 md:text-xl">Aucun investissement pour le moment</h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">
          Ajoutez un ordre (achat, vente, dividende) ou importez vos données pour voir vos positions et la valorisation.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            variant="primary"
            disabled={disabled}
            onClick={onAddFirstOrder}
            className="min-h-[44px] w-full max-w-xs sm:min-h-9 sm:w-auto"
          >
            Ajouter un premier ordre
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || !onImportData}
            onClick={() => onImportData?.()}
            className="min-h-[44px] w-full max-w-xs sm:min-h-9 sm:w-auto"
            title={!onImportData ? 'Bientôt disponible' : undefined}
          >
            Importer mes données
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

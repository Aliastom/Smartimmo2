'use client';

import React from 'react';
import { Calendar, ChevronRight, Pencil, Power } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { EcheanceRecurrente } from '@/types/echeance';
import { getNatureBadgeClass } from '@/types/echeance';
import { resolveNatureCodeForEcheance } from '@/lib/echeances/echeanceTypeMigration';
import { getNatureLabelForEcheance } from '@/lib/echeances/echeanceDisplayHelpers';
import type { NextOccurrenceInfo } from '@/lib/echeances/echeanceCashflowHelpers';
import { temporalBadgeMeta, generationBadgeMeta, getStatutGeneration } from '@/lib/echeances/echeanceCashflowHelpers';
import type { CoverageResult } from '@/lib/echeances/echeanceCoverage';
import { COVERAGE_OVER_LINKED_RATIO_CRITICAL } from '@/lib/echeances/echeanceLinkConfig';
import { cn } from '@/utils/cn';

interface PropertyEcheancesHeroProps {
  echeance: EcheanceRecurrente;
  info: NextOccurrenceInfo;
  linkedCount?: number;
  /** S’il reste une occurrence à couvrir (sinon on masque « Créer la transaction » même avec d’anciens liens). */
  hasUncoveredOccurrence?: boolean;
  /** Résultat de couverture (phase 3+) pour statut génération précis */
  coverage?: CoverageResult | null;
  /** Libellé de la nature (référentiel) — si non fourni, calculé via getNatureLabelForEcheance */
  natureLabel?: string;
  /** Libellé de la catégorie — si fourni, affiché dans le hero */
  categoryLabel?: string;
  onViewDetail: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onCreateTransaction?: () => void;
  formatCurrency: (n: number) => string;
  formatDateShort: (d: string) => string;
}

export function PropertyEcheancesHero({
  echeance,
  info,
  linkedCount = 0,
  hasUncoveredOccurrence,
  coverage,
  natureLabel,
  categoryLabel,
  onViewDetail,
  onEdit,
  onToggleActive,
  onCreateTransaction,
  formatCurrency,
  formatDateShort,
}: PropertyEcheancesHeroProps) {
  const urg = temporalBadgeMeta(info.temporalStatus);
  const isCharge = echeance.sens === 'DEBIT';
  const genStatut = getStatutGeneration(linkedCount, coverage ?? undefined);
  const overRatio =
    coverage?.statut === 'montant_superieur' &&
    coverage.expectedAmount != null &&
    coverage.expectedAmount > 0
      ? coverage.totalLinked / coverage.expectedAmount
      : undefined;
  const gen = generationBadgeMeta(genStatut, {
    overRatio,
    overRatioCritical: COVERAGE_OVER_LINKED_RATIO_CRITICAL,
  });
  const showCreateTx =
    echeance.isActive &&
    onCreateTransaction &&
    (hasUncoveredOccurrence === undefined ? linkedCount === 0 : hasUncoveredOccurrence);

  return (
    <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50/80 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Prochaine échéance à piloter</p>
          <h2 className="text-lg font-semibold text-gray-900 mt-0.5 truncate">{echeance.label}</h2>
        </div>
        <span className={cn('shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border', urg.className)}>
          <span aria-hidden>{urg.emoji}</span>
          {info.message}
        </span>
      </div>
      <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 text-sm">
        <div>
          <p className="text-gray-500 text-xs mb-0.5">Montant</p>
          <p className={cn('font-semibold tabular-nums', isCharge ? 'text-gray-900' : 'text-emerald-700')}>
            {isCharge ? '' : '+'}{formatCurrency(echeance.montant)}
          </p>
        </div>
        <div>
          <p className="text-gray-500 text-xs mb-0.5">Nature</p>
          <Badge className={cn(getNatureBadgeClass(resolveNatureCodeForEcheance(echeance)), 'text-xs font-normal')}>
            {natureLabel ?? getNatureLabelForEcheance(echeance)}
          </Badge>
        </div>
        {categoryLabel && (
          <div>
            <p className="text-gray-500 text-xs mb-0.5">Catégorie</p>
            <p className="text-sm font-medium text-gray-900">{categoryLabel}</p>
          </div>
        )}
        <div>
          <p className="text-gray-500 text-xs mb-0.5">Date</p>
          <p className="font-medium text-gray-900 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-gray-400" />
            {info.displayDate ? formatDateShort(info.displayDate) : '—'}
          </p>
        </div>
        <div>
          <p className="text-gray-500 text-xs mb-0.5">Sens</p>
          <span
            className={cn(
              'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
              isCharge ? 'bg-red-50 text-red-800 border border-red-100' : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
            )}
          >
            {isCharge ? 'Charge' : 'Revenu'}
          </span>
        </div>
        <div>
          <p className="text-gray-500 text-xs mb-0.5">Statut</p>
          <span className={echeance.isActive ? 'text-emerald-700 font-medium' : 'text-gray-500'}>
            {echeance.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div>
          <p className="text-gray-500 text-xs mb-0.5">Génération</p>
          <span className={cn('text-xs font-medium rounded-md px-2 py-0.5 border inline-block', gen.className)}>
            {gen.label}
          </span>
        </div>
        {echeance.recuperable && isCharge ? (
          <div>
            <p className="text-gray-500 text-xs mb-0.5">Récupérable</p>
            <span className="text-xs text-gray-700">Oui (refacturable)</span>
          </div>
        ) : (
          <div className="hidden lg:block" />
        )}
      </div>
      <div className="px-5 py-3 bg-gray-50/80 border-t border-gray-100 flex flex-wrap gap-2">
        {showCreateTx && (
          <Button
            type="button"
            size="sm"
            className="gap-1 bg-orange-600 hover:bg-orange-700 text-white"
            onClick={onCreateTransaction}
          >
            Créer la transaction
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" onClick={onViewDetail} className="gap-1">
          Voir le détail
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onEdit} className="gap-1">
          <Pencil className="h-3.5 w-3.5" />
          Modifier
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onToggleActive} className="gap-1 text-gray-600">
          <Power className="h-3.5 w-3.5" />
          {echeance.isActive ? 'Désactiver' : 'Activer'}
        </Button>
      </div>
    </div>
  );
}

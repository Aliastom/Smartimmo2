'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { GLOBAL_ROW_DETAIL_LINK_CLASS } from '@/components/global-pilotage';
import type {
  DocumentPilotageCounts,
  DocumentPilotagePreviewItem,
} from '@/features/documents/utils/buildDocumentPilotagePreview';

interface DocumentsPriorityActionsCardProps {
  counts: DocumentPilotageCounts;
  items: DocumentPilotagePreviewItem[];
  isLoading?: boolean;
  onAjouter: (documentId: string) => void;
  onCorriger: (documentId: string) => void;
  onVoirDetail: (documentId: string) => void;
}

export function DocumentsPriorityActionsCard({
  counts,
  items,
  isLoading = false,
  onAjouter,
  onCorriger,
  onVoirDetail,
}: DocumentsPriorityActionsCardProps) {
  const badgeParts: string[] = [];
  if (counts.sansLiaison > 0) {
    badgeParts.push(`${counts.sansLiaison} sans document`);
  }
  if (counts.ocrEchoue > 0) {
    badgeParts.push(`${counts.ocrEchoue} OCR échoué`);
  }
  if (counts.sansPiece > 0) {
    badgeParts.push(`${counts.sansPiece} sans fichier`);
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 shadow-sm p-4">
        <div className="h-6 w-56 bg-amber-100/80 rounded animate-pulse mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-amber-100/60 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const hasAnyIssue =
    counts.sansLiaison > 0 ||
    counts.ocrEchoue > 0 ||
    counts.sansPiece > 0 ||
    counts.nonClasses > 0;

  if (!hasAnyIssue && items.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-sm p-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-emerald-600 shrink-0" />
          Actions à traiter
        </h2>
        <p className="text-sm text-emerald-900/90 mt-2">
          Aucune anomalie documentaire prioritaire sur votre périmètre.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 shadow-sm p-4 space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <AlertTriangle className="text-amber-700 shrink-0 h-5 w-5" />
          <h2 className="text-lg font-bold text-gray-900">Actions à traiter</h2>
        </div>
        <p className="text-sm text-amber-950/85 pl-0 sm:pl-7 mb-3">
          Améliorez la qualité des données : pièces jointes, OCR et classement.
        </p>
        {badgeParts.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-0 sm:pl-7">
            {badgeParts.map((label) => (
              <span
                key={label}
                className="inline-flex items-center rounded-full bg-amber-100/90 text-amber-950 px-2.5 py-1 text-xs font-semibold tabular-nums"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((row) => {
            const danger = row.badge === 'danger';
            return (
              <div
                key={row.documentId}
                className="rounded-lg border border-amber-100/90 bg-white/95 p-3 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="font-semibold text-gray-900 text-base leading-snug truncate">
                      {row.titleLine}
                    </p>
                    <p className="text-sm text-gray-600 truncate">{row.contextLine}</p>
                    <p className="text-sm text-gray-700">
                      <span className="text-gray-500">Problème :</span>{' '}
                      <span className="font-medium text-gray-900">{row.problemLine}</span>
                    </p>
                  </div>

                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 border-t border-amber-50 pt-3 sm:border-0 sm:pt-0">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                        danger ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'
                      )}
                    >
                      {danger ? 'À corriger' : 'À compléter'}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      className={cn(
                        'font-semibold min-w-[7.5rem]',
                        row.cta === 'ajouter'
                          ? 'bg-amber-700 hover:bg-amber-800 text-white'
                          : 'bg-orange-600 hover:bg-orange-700 text-white'
                      )}
                      onClick={() =>
                        row.cta === 'ajouter' ? onAjouter(row.documentId) : onCorriger(row.documentId)
                      }
                    >
                      {row.cta === 'ajouter' ? 'Ajouter document' : 'Corriger'}
                    </Button>
                    <button
                      type="button"
                      className={cn(
                        GLOBAL_ROW_DETAIL_LINK_CLASS,
                        'mt-0 pt-0 w-auto sm:text-right self-center sm:self-end'
                      )}
                      onClick={() => onVoirDetail(row.documentId)}
                    >
                      Voir détail
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

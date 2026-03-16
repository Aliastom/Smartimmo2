'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { FileText } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface ResumeMoisCardProps {
  /** Lignes à afficher (ex. "7 loyers en retard") */
  lines: string[];
  /** Suggestion principale (ex. "relancer les locataires en retard") */
  suggestionPrincipale?: string;
  /** Texte d'intro optionnel */
  intro?: string;
  className?: string;
}

export function ResumeMoisCard({
  lines,
  suggestionPrincipale,
  intro = 'Votre portefeuille nécessite votre attention.',
  className,
}: ResumeMoisCardProps) {
  return (
    <Card className={cn('border-slate-200 bg-white shadow-sm', className)}>
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-4 w-4 text-slate-600" aria-hidden />
          <h3 className="text-sm font-semibold text-slate-800">Résumé du mois</h3>
        </div>
        <p className="text-xs text-slate-600 mb-2">{intro}</p>
        {lines.length > 0 && (
          <ul className="text-sm text-slate-700 space-y-0.5 mb-3">
            {lines.map((line, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}
        {suggestionPrincipale && (
          <p className="text-xs font-medium text-slate-800 pt-2 border-t border-slate-100">
            Suggestion principale : {suggestionPrincipale}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

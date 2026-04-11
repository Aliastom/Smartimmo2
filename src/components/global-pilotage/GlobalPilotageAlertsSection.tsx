'use client';

import React from 'react';

export interface GlobalPilotageAlertsSectionProps {
  title?: string;
  children: React.ReactNode;
  /** Bandeau optionnel à droite du titre (ex. bouton « Voir tout »). */
  headerRight?: React.ReactNode;
}

/** Bloc Alertes — diagnostic, pas d’action principale (aligné Échéances). */
export function GlobalPilotageAlertsSection({
  title = 'Alertes',
  children,
  headerRight,
}: GlobalPilotageAlertsSectionProps) {
  return (
    <div className="bg-amber-50/70 rounded-xl border border-amber-200 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="text-base font-semibold text-amber-900">{title}</h3>
        {headerRight}
      </div>
      {children}
    </div>
  );
}

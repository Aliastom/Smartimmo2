/**
 * Barres comparatives pour la répartition des prélèvements estimés (PAS / acomptes / reste).
 * Aucune logique fiscale - uniquement présentation des données fournies.
 */

'use client';

import React from 'react';

function formatEuro(amount: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export interface WithholdingBreakdownBarsProps {
  impotTotal: number;
  pasActuel: number;
  acomptesActuels: number;
}

export function WithholdingBreakdownBars({ impotTotal, pasActuel, acomptesActuels }: WithholdingBreakdownBarsProps) {
  const resteNonCouvert = Math.max(0, impotTotal - pasActuel - acomptesActuels);
  const refTotal = Math.max(impotTotal, 1);

  const items = [
    { label: 'PAS actuel estimé', amount: pasActuel, widthPercent: (pasActuel / refTotal) * 100, color: 'bg-indigo-500' },
    { label: 'Acomptes actuels estimés', amount: acomptesActuels, widthPercent: (acomptesActuels / refTotal) * 100, color: 'bg-cyan-500' },
    { label: 'Reste non couvert', amount: resteNonCouvert, widthPercent: (resteNonCouvert / refTotal) * 100, color: 'bg-amber-500' },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-800 mb-3">Impôt total estimé : {formatEuro(impotTotal)}</p>
      <div className="space-y-2.5">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-0.5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-700">{item.label}</span>
              <span className="font-medium text-gray-800">{formatEuro(item.amount)}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded overflow-hidden">
              <div
                className={`h-full ${item.color} rounded transition-all`}
                style={{ width: `${Math.min(100, item.widthPercent)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-gray-600 pt-1">
        Cette visualisation est un repère de pilotage basé sur votre simulation actuelle.
      </p>
    </div>
  );
}

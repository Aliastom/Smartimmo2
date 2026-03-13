/**
 * Deux scénarios clairement distincts : combiné vs PAS inchangé.
 * Adaptation du wording selon l'objectif (notamment keep_cash).
 */

'use client';

import React from 'react';

export type WithholdingGoal = 'avoid_catchup' | 'smooth_cashflow' | 'keep_cash';

function formatEuro(amount: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export interface WithholdingScenarioCardsProps {
  /** Scénario combiné : PAS recommandé (%) */
  pasRecommande: number;
  /** Scénario combiné : acompte recommandé (€/mois) */
  acompteRecommande: number | null;
  /** Scénario PAS inchangé : taux actuel (%) */
  pasConserve: number | null;
  /** Scénario PAS inchangé : acompte nécessaire (€/mois) */
  acompteNecessaire: number;
  /** Objectif utilisateur — adapte le wording, notamment pour keep_cash */
  goal?: WithholdingGoal | null;
  /** Écart annuel (sous-prélèvement) — pour afficher le solde futur en keep_cash */
  ecartAnnuel?: number;
}

export function WithholdingScenarioCards({
  pasRecommande,
  acompteRecommande,
  pasConserve,
  acompteNecessaire,
  goal = 'smooth_cashflow',
  ecartAnnuel = 0,
}: WithholdingScenarioCardsProps) {
  const isKeepCash = goal === 'keep_cash';

  return (
    <div className="space-y-3">
      {/* Scénario A : combiné */}
      <div className={`rounded-lg border p-3 ${isKeepCash ? 'border-gray-200 bg-gray-50/50' : 'border-2 border-indigo-300 bg-indigo-50/50'}`}>
        <p className="text-xs font-semibold text-gray-900 mb-2">
          {isKeepCash ? 'Scénario combiné (si vous vouliez couvrir totalement)' : 'Scénario combiné recommandé'}
        </p>
        <ul className="space-y-0.5 text-sm text-gray-800">
          <li>• PAS recommandé : <strong>{pasRecommande} %</strong></li>
          <li>• Acompte recommandé : <strong>{acompteRecommande != null ? formatEuro(acompteRecommande) : '—'} / mois</strong></li>
        </ul>
        <p className="text-[11px] text-gray-600 mt-2">
          {isKeepCash
            ? 'Option alternative : répartir l\'effort entre salaire et acomptes pour couvrir l\'impôt.'
            : 'Cette option répartit l\'effort entre salaire et acomptes.'}
        </p>
      </div>

      {/* Scénario B : PAS inchangé */}
      <div className={`rounded-lg border p-3 ${isKeepCash ? 'border-2 border-amber-300 bg-amber-50/50' : 'border border-gray-200 bg-gray-50/50'}`}>
        <p className="text-xs font-semibold text-gray-900 mb-2">
          {isKeepCash ? 'Scénario PAS inchangé (adapté à votre objectif cash)' : 'Scénario si PAS inchangé'}
        </p>
        <ul className="space-y-0.5 text-sm text-gray-800">
          <li>• PAS conservé : <strong>{pasConserve != null ? `${pasConserve} %` : 'taux actuel'}</strong></li>
          <li>• Acompte théorique pour couvrir totalement l&apos;impôt : <strong>{formatEuro(acompteNecessaire)} / mois</strong></li>
          {isKeepCash && (
            <>
              <li className="text-amber-800">
                • Acompte prudent / limité selon votre objectif : vous choisissez le niveau que vous acceptez.
              </li>
              {ecartAnnuel > 10 && (
                <li className="font-medium text-amber-800 mt-1">
                  • Solde futur estimé si vous conservez une stratégie cash : <strong>{formatEuro(ecartAnnuel)}</strong>
                  <span className="text-[11px] font-normal text-amber-700 block">(à régulariser l&apos;année suivante)</span>
                </li>
              )}
            </>
          )}
        </ul>
        <p className="text-[11px] text-gray-600 mt-2">
          {isKeepCash
            ? 'L\'acompte affiché n\'est pas une recommandation absolue. Vous pouvez payer moins et accepter ce solde.'
            : 'Cette option compense uniquement par les acomptes.'}
        </p>
      </div>

      {/* Explication globale */}
      <p className="text-[11px] text-gray-600 border-t border-gray-200 pt-3 mt-1">
        {isKeepCash ? (
          <>
            Ces deux montants correspondent à des scénarios différents.
            Avec l&apos;objectif « garder du cash », vous pouvez limiter vos acomptes et accepter un solde à régulariser.
          </>
        ) : (
          <>
            Ces deux montants ne correspondent pas au même scénario :
            soit vous ajustez votre taux PAS et vos acomptes,
            soit vous laissez votre taux PAS inchangé et compensez uniquement par les acomptes.
          </>
        )}
      </p>
    </div>
  );
}

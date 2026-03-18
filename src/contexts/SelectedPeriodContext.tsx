'use client';

/**
 * Contexte global pour la période sélectionnée (Dashboard, Alertes, Timeline).
 * Uniformise la temporalité entre les vues et permet un toggle "Mois sélectionné" / "Temps réel".
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export type PeriodMode = 'selected' | 'realtime';

interface SelectedPeriodContextValue {
  /** Mois au format YYYY-MM (utilisé quand mode === 'selected') */
  month: string;
  setMonth: (month: string) => void;
  /** true = toujours mois courant (Alertes/Dashboard temps réel) */
  useRealtime: boolean;
  setUseRealtime: (v: boolean) => void;
  /** Mode effectif : 'selected' = utiliser month, 'realtime' = mois courant */
  periodMode: PeriodMode;
  /** Mois effectif pour les requêtes (soit month soit mois courant) */
  effectiveMonth: string;
  formatMonthLabel: (m: string) => string;
}

const SelectedPeriodContext = createContext<SelectedPeriodContextValue | null>(null);

function getCurrentMonthString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function SelectedPeriodProvider({ children }: { children: React.ReactNode }) {
  const [month, setMonthState] = useState(getCurrentMonthString);
  const [useRealtime, setUseRealtime] = useState(false);

  const setMonth = useCallback((m: string) => {
    setMonthState(m);
  }, []);

  const effectiveMonth = useRealtime ? getCurrentMonthString() : month;
  const periodMode: PeriodMode = useRealtime ? 'realtime' : 'selected';

  const formatMonthLabel = useCallback((m: string) => {
    if (!m || m.length < 7) return '';
    const [y, mm] = m.split('-').map(Number);
    const d = new Date(y, mm - 1, 1);
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^\w/, (c) => c.toUpperCase());
  }, []);

  const value = useMemo<SelectedPeriodContextValue>(
    () => ({
      month,
      setMonth,
      useRealtime,
      setUseRealtime,
      periodMode,
      effectiveMonth,
      formatMonthLabel,
    }),
    [month, setMonth, useRealtime, periodMode, effectiveMonth, formatMonthLabel]
  );

  return (
    <SelectedPeriodContext.Provider value={value}>
      {children}
    </SelectedPeriodContext.Provider>
  );
}

export function useSelectedPeriod(): SelectedPeriodContextValue {
  const ctx = useContext(SelectedPeriodContext);
  const now = new Date();
  const fallbackMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const formatMonthLabel = (m: string) => {
    if (!m || m.length < 7) return '';
    const [y, mm] = m.split('-').map(Number);
    const d = new Date(y, mm - 1, 1);
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^\w/, (c) => c.toUpperCase());
  };
  if (!ctx) {
    return {
      month: fallbackMonth,
      setMonth: () => {},
      useRealtime: false,
      setUseRealtime: () => {},
      periodMode: 'selected',
      effectiveMonth: fallbackMonth,
      formatMonthLabel,
    };
  }
  return ctx;
}

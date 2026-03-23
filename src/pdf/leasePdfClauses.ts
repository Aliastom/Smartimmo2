import type { LeasePdfLease } from './leasePdfTypes';

/**
 * Clauses modulaires du PDF bail (activables / futures overrides JSON)
 */
export type LeasePdfClausesConfig = {
  reconductionTacite: boolean;
  clauseResolutoire: boolean;
  solidarite: boolean;
  rgpd: boolean;
  notificationsElectroniques: boolean;
  indemniteOccupation: boolean;
  annexesListe: boolean;
};

export const defaultLeasePdfClauses: LeasePdfClausesConfig = {
  reconductionTacite: true,
  clauseResolutoire: true,
  solidarite: false,
  rgpd: true,
  notificationsElectroniques: true,
  indemniteOccupation: true,
  annexesListe: true,
};

/** Alias lisible pour imports métier / doc */
export const clausesConfig = defaultLeasePdfClauses;

/**
 * Fusionne la config depuis lease.overridesJson : { "pdfClauses": { ... } }
 */
export function resolveLeasePdfClauses(lease: LeasePdfLease): LeasePdfClausesConfig {
  const base = { ...defaultLeasePdfClauses };
  if (!lease.overridesJson) return base;
  try {
    const parsed = JSON.parse(lease.overridesJson) as { pdfClauses?: Partial<LeasePdfClausesConfig> };
    if (parsed.pdfClauses && typeof parsed.pdfClauses === 'object') {
      return { ...base, ...parsed.pdfClauses };
    }
  } catch {
    /* ignore */
  }
  return base;
}

/**
 * Paramètres utilisateur locaux pour le cockpit Patrimoine (cash / PEA / calendrier / objectif).
 * Persistance : localStorage par organisation.
 */

export type PatrimoineObjective = 'croissance' | 'securite' | 'equilibre';

export interface PatrimoineUserSettings {
  cashDisponible: number;
  cashSecurite: number;
  /** Valeur estimée du portefeuille ETF / PEA (saisie utilisateur) */
  peaEtfValue: number;
  /** Jour du mois pour le DCA (1–31), aligné UX avec le module Marché */
  dcaDayOfMonth: number;
  /** Stratégie globale affichée dans les reco */
  objective: PatrimoineObjective;
  /**
   * Simulation fiscale à utiliser dans le cockpit.
   * `null` / absent = automatique (dernière simulation « valide » en local, comme avant).
   */
  selectedFiscalSimulationId?: string | null;
  /**
   * Profil marché / ETF du module Marché utilisé pour la reco cockpit.
   * `null` / absent = automatique (profil « default » si présent, sinon dernier profil actif par date).
   */
  selectedMarketInvestmentId?: string | null;
}

const STORAGE_PREFIX = 'smartimmo.patrimoine.userSettings.v2';

const DEFAULTS: PatrimoineUserSettings = {
  cashDisponible: 0,
  cashSecurite: 5000,
  peaEtfValue: 0,
  dcaDayOfMonth: 5,
  objective: 'equilibre',
  selectedFiscalSimulationId: null,
  selectedMarketInvestmentId: null,
};

function keyForOrg(organizationId: string): string {
  return `${STORAGE_PREFIX}:${organizationId}`;
}

/** Migre v1 → v2 si clé v2 absente */
function migrateFromV1(organizationId: string): PatrimoineUserSettings | null {
  if (typeof window === 'undefined') return null;
  const legacyKey = `smartimmo.patrimoine.userSettings.v1:${organizationId}`;
  const raw = localStorage.getItem(legacyKey);
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<PatrimoineUserSettings>;
    const migrated: PatrimoineUserSettings = {
      cashDisponible:
        typeof o.cashDisponible === 'number' && Number.isFinite(o.cashDisponible) ? o.cashDisponible : DEFAULTS.cashDisponible,
      cashSecurite:
        typeof o.cashSecurite === 'number' && Number.isFinite(o.cashSecurite) ? o.cashSecurite : DEFAULTS.cashSecurite,
      peaEtfValue: typeof o.peaEtfValue === 'number' && Number.isFinite(o.peaEtfValue) ? o.peaEtfValue : DEFAULTS.peaEtfValue,
      dcaDayOfMonth: DEFAULTS.dcaDayOfMonth,
      objective: DEFAULTS.objective,
      selectedFiscalSimulationId: DEFAULTS.selectedFiscalSimulationId,
      selectedMarketInvestmentId: DEFAULTS.selectedMarketInvestmentId ?? null,
    };
    localStorage.setItem(keyForOrg(organizationId), JSON.stringify(migrated));
    return migrated;
  } catch {
    return null;
  }
}

function parseStored(raw: string | null): PatrimoineUserSettings | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<PatrimoineUserSettings>;
    const objective: PatrimoineObjective =
      o.objective === 'croissance' || o.objective === 'securite' || o.objective === 'equilibre'
        ? o.objective
        : DEFAULTS.objective;
    const dcaDayOfMonth =
      typeof o.dcaDayOfMonth === 'number' && Number.isFinite(o.dcaDayOfMonth)
        ? Math.min(31, Math.max(1, Math.trunc(o.dcaDayOfMonth)))
        : DEFAULTS.dcaDayOfMonth;
    let selectedFiscalSimulationId: string | null = DEFAULTS.selectedFiscalSimulationId ?? null;
    if (Object.prototype.hasOwnProperty.call(o, 'selectedFiscalSimulationId')) {
      if (typeof o.selectedFiscalSimulationId === 'string' && o.selectedFiscalSimulationId.length > 0) {
        selectedFiscalSimulationId = o.selectedFiscalSimulationId;
      } else if (o.selectedFiscalSimulationId === null) {
        selectedFiscalSimulationId = null;
      }
    }
    let selectedMarketInvestmentId: string | null = DEFAULTS.selectedMarketInvestmentId ?? null;
    if (Object.prototype.hasOwnProperty.call(o, 'selectedMarketInvestmentId')) {
      if (typeof o.selectedMarketInvestmentId === 'string' && o.selectedMarketInvestmentId.length > 0) {
        selectedMarketInvestmentId = o.selectedMarketInvestmentId;
      } else if (o.selectedMarketInvestmentId === null) {
        selectedMarketInvestmentId = null;
      }
    }
    return {
      cashDisponible:
        typeof o.cashDisponible === 'number' && Number.isFinite(o.cashDisponible) ? o.cashDisponible : DEFAULTS.cashDisponible,
      cashSecurite:
        typeof o.cashSecurite === 'number' && Number.isFinite(o.cashSecurite) ? o.cashSecurite : DEFAULTS.cashSecurite,
      peaEtfValue: typeof o.peaEtfValue === 'number' && Number.isFinite(o.peaEtfValue) ? o.peaEtfValue : DEFAULTS.peaEtfValue,
      dcaDayOfMonth,
      objective,
      selectedFiscalSimulationId,
      selectedMarketInvestmentId,
    };
  } catch {
    return null;
  }
}

export function loadPatrimoineUserSettings(organizationId: string | undefined): PatrimoineUserSettings {
  if (typeof window === 'undefined' || !organizationId) {
    return { ...DEFAULTS };
  }
  let parsed = parseStored(localStorage.getItem(keyForOrg(organizationId)));
  if (!parsed) {
    parsed = migrateFromV1(organizationId);
  }
  return parsed ?? { ...DEFAULTS };
}

export function savePatrimoineUserSettings(organizationId: string, patch: Partial<PatrimoineUserSettings>): PatrimoineUserSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULTS, ...patch };
  }
  const prev = loadPatrimoineUserSettings(organizationId);
  const next: PatrimoineUserSettings = {
    ...prev,
    ...patch,
    ...(patch.dcaDayOfMonth !== undefined
      ? {
          dcaDayOfMonth: Math.min(31, Math.max(1, Math.trunc(patch.dcaDayOfMonth))),
        }
      : {}),
  };
  try {
    localStorage.setItem(keyForOrg(organizationId), JSON.stringify(next));
  } catch {
    // ignore quota
  }
  return next;
}

export function getPatrimoineSettingsDefaults(): PatrimoineUserSettings {
  return { ...DEFAULTS };
}

const FOLLOWUP_KEY_PREFIX = 'smartimmo.patrimoine.followup.v1:';

export function getPatrimoineFollowUpStorageKey(organizationId: string): string {
  return `${FOLLOWUP_KEY_PREFIX}${organizationId}`;
}

export function readPatrimoineFollowUpFlag(organizationId: string | undefined): boolean {
  if (typeof window === 'undefined' || !organizationId) return false;
  try {
    return localStorage.getItem(getPatrimoineFollowUpStorageKey(organizationId)) === '1';
  } catch {
    return false;
  }
}

export function writePatrimoineFollowUpFlag(organizationId: string | undefined, on: boolean): void {
  if (typeof window === 'undefined' || !organizationId) return;
  try {
    localStorage.setItem(getPatrimoineFollowUpStorageKey(organizationId), on ? '1' : '0');
  } catch {
    // quota / private mode
  }
}

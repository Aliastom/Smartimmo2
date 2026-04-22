/**
 * Persistance légère de l'état de la checklist déclaration impots.gouv (client uniquement).
 * Clé dérivée : année des revenus + version barème + signature des biens (ordre trié).
 */

import type { SimulationResult } from '@/types/fiscal';

const STORAGE_PREFIX = 'smartimmo:declaration-impots-checklist:v1:';

export type ChecklistPersistedStatus = 'copie' | 'termine';

export interface ChecklistPersistedStep {
  status: ChecklistPersistedStatus;
  updatedAt: string;
}

export interface ChecklistPersistedPayload {
  steps: Record<string, ChecklistPersistedStep>;
}

function safeJsonParse(raw: string | null): ChecklistPersistedPayload | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as ChecklistPersistedPayload;
    if (!v || typeof v.steps !== 'object') return null;
    return v;
  } catch {
    return null;
  }
}

/** Ancien statut persisté (avant refonte UX) — migré vers `termine`. */
function migrateLegacyStatus(status: string): ChecklistPersistedStatus | null {
  if (status === 'verifie') return 'termine';
  if (status === 'copie' || status === 'termine') return status;
  return null;
}

export function buildDeclarationChecklistStorageKey(simulation: SimulationResult): string {
  const year = simulation.inputs.year;
  const version = simulation.taxParams.version;
  const propSig = [...simulation.biens.map((b) => b.id)].sort().join('|');
  const perSig = simulation.per && simulation.per.deductionUtilisee > 0 ? 'per' : 'noper';
  return `${STORAGE_PREFIX}${year}:${version}:${perSig}:${propSig}`;
}

export function loadChecklistState(key: string): ChecklistPersistedPayload {
  if (typeof window === 'undefined') return { steps: {} };
  const parsed = safeJsonParse(window.localStorage.getItem(key));
  const base = parsed ?? { steps: {} };
  let changed = false;
  const steps: Record<string, ChecklistPersistedStep> = {};
  for (const [k, v] of Object.entries(base.steps || {})) {
    if (!v || typeof (v as ChecklistPersistedStep).status !== 'string') {
      changed = true;
      continue;
    }
    const migrated = migrateLegacyStatus((v as ChecklistPersistedStep).status);
    if (!migrated) {
      changed = true;
      continue;
    }
    if ((v as ChecklistPersistedStep).status === 'verifie') changed = true;
    steps[k] = {
      status: migrated,
      updatedAt: (v as ChecklistPersistedStep).updatedAt,
    };
  }
  const out: ChecklistPersistedPayload = { steps };
  if (changed || Object.keys(steps).length !== Object.keys(base.steps || {}).length) {
    saveChecklistState(key, out);
  }
  return out;
}

export function saveChecklistState(key: string, payload: ChecklistPersistedPayload): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // quota / mode privé
  }
}

export function setStepStatus(
  key: string,
  stepId: string,
  status: ChecklistPersistedStatus
): ChecklistPersistedPayload {
  const current = loadChecklistState(key);
  const next: ChecklistPersistedPayload = {
    steps: {
      ...current.steps,
      [stepId]: { status, updatedAt: new Date().toISOString() },
    },
  };
  saveChecklistState(key, next);
  return next;
}

/** Remet une étape à l’état initial (plus de statut persisté). */
export function clearStepStatus(key: string, stepId: string): ChecklistPersistedPayload {
  const current = loadChecklistState(key);
  if (!current.steps[stepId]) return { ...current, steps: { ...current.steps } };
  const { [stepId]: _removed, ...rest } = current.steps;
  const next: ChecklistPersistedPayload = { steps: rest };
  saveChecklistState(key, next);
  return next;
}

export function clearChecklistState(key: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(key);
}

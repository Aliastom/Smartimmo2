import { describe, expect, it } from 'vitest';
import type { LocalFiscalSimulation } from '@/lib/offline/db';
import {
  buildAvailableFiscalSimulations,
  parseSimulationResult,
  resolveFiscalSimulationForPatrimoine,
  pickLatestUsableFiscalSimulation,
} from '@/features/patrimoine/services/patrimoineFiscalSelection';

function makeRow(
  overrides: Partial<LocalFiscalSimulation> & { id: string; year: number; updatedAt: string }
): LocalFiscalSimulation {
  const base: LocalFiscalSimulation = {
    id: overrides.id,
    organizationId: 'org',
    userId: 'u',
    year: overrides.year,
    inputsJson: '{}',
    resultJson: '',
    createdAt: overrides.createdAt ?? '2025-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt,
    ...overrides,
  };
  return base;
}

const validResult = (year: number, net = 1000) =>
  JSON.stringify({
    resume: { beneficeNetImmobilier: net, totalImpots: 500 },
    cashflow: { cashflowNet: net },
    ir: { impotNet: 400 },
    ps: { montant: 100 },
    inputs: {},
    biens: [],
    consolidation: {
      revenusFonciers: 0,
      revenusBIC: 0,
      deficitFoncier: 0,
      deficitBIC: 0,
    },
    taxParams: {} as never,
    dateCalcul: new Date(),
    dureeCalculMS: 1,
  });

describe('resolveFiscalSimulationForPatrimoine', () => {
  it('AUTO : dernière simulation valide (updatedAt le plus récent parmi les utilisables)', () => {
    const older = makeRow({
      id: 'a',
      year: 2024,
      updatedAt: '2025-01-01T00:00:00.000Z',
      resultJson: validResult(2024),
    });
    const newer = makeRow({
      id: 'b',
      year: 2025,
      updatedAt: '2025-06-01T00:00:00.000Z',
      resultJson: validResult(2025),
    });
    const r = resolveFiscalSimulationForPatrimoine([older, newer], null);
    expect(r.mode).toBe('AUTO');
    expect(r.fiscalRow?.id).toBe('b');
    expect(r.fiscalSimulationWarning).toBeNull();
  });

  it('MANUEL : utilise la ligne dont l’id correspond', () => {
    const one = makeRow({
      id: 'x',
      year: 2025,
      updatedAt: '2025-06-01T00:00:00.000Z',
      resultJson: validResult(2025, 2000),
    });
    const two = makeRow({
      id: 'y',
      year: 2024,
      updatedAt: '2025-07-01T00:00:00.000Z',
      resultJson: validResult(2024),
    });
    const r = resolveFiscalSimulationForPatrimoine([one, two], 'y');
    expect(r.mode).toBe('MANUAL');
    expect(r.fiscalRow?.id).toBe('y');
  });

  it('id supprimé → fallback AUTO + warning', () => {
    const only = makeRow({
      id: 'a',
      year: 2025,
      updatedAt: '2025-06-01T00:00:00.000Z',
      resultJson: validResult(2025),
    });
    const r = resolveFiscalSimulationForPatrimoine([only], 'ghost-id');
    expect(r.mode).toBe('MISSING_FALLBACK');
    expect(r.fiscalRow?.id).toBe('a');
    expect(r.fiscalSimulationWarning).toMatch(/introuvable/i);
  });

  it('aucune simulation utilisable → fiscalRow null', () => {
    const broken = makeRow({
      id: 'z',
      year: 2025,
      updatedAt: '2025-06-01T00:00:00.000Z',
      resultJson: '{}',
    });
    const r = resolveFiscalSimulationForPatrimoine([broken], null);
    expect(r.mode).toBe('AUTO');
    expect(r.fiscalRow).toBeNull();
  });
});

describe('buildAvailableFiscalSimulations', () => {
  it('tri par année puis date desc', () => {
    const rows = [
      makeRow({
        id: 'old',
        year: 2024,
        updatedAt: '2025-01-01T00:00:00.000Z',
        resultJson: validResult(2024),
      }),
      makeRow({
        id: 'new',
        year: 2025,
        updatedAt: '2025-03-01T00:00:00.000Z',
        resultJson: validResult(2025),
      }),
    ];
    const list = buildAvailableFiscalSimulations(rows);
    expect(list[0].fiscalYear).toBe(2025);
    expect(list[1].fiscalYear).toBe(2024);
  });
});

describe('pickLatestUsableFiscalSimulation', () => {
  it('ignore les résultats sans résumé exploitable', () => {
    const bad = makeRow({
      id: 'bad',
      year: 2025,
      updatedAt: '2025-09-01T00:00:00.000Z',
      resultJson: '{}',
    });
    const good = makeRow({
      id: 'good',
      year: 2024,
      updatedAt: '2025-01-01T00:00:00.000Z',
      resultJson: validResult(2024),
    });
    expect(pickLatestUsableFiscalSimulation([bad, good])?.id).toBe('good');
    expect(parseSimulationResult(bad)).toBeNull();
  });
});

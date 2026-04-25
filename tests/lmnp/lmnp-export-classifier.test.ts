/**
 * Règles de classification LMNP (pur, sans Prisma).
 */

import { describe, it, expect } from 'vitest';
import { classifyLmnpDocument, classifyLmnpTransaction } from '@/services/lmnp/LmnpExportClassifier';

const rules = [
  {
    id: 'r1',
    propertyId: null,
    natureCode: 'RECETTE_LOYER',
    categoryId: null,
    lmnpBucket: 'LOYER',
    lmnpLabel: 'Loyers',
    priority: 10,
  },
  {
    id: 'r2',
    propertyId: 'p1',
    natureCode: null,
    categoryId: 'cat-x',
    lmnpBucket: 'SPECIAL',
    lmnpLabel: 'Règle bien',
    priority: 50,
  },
] as const;

describe('classifyLmnpTransaction', () => {
  it('override prioritaire', () => {
    const ov = new Map([['tx1', { lmnpBucket: 'OV', lmnpLabel: 'Override' }]]);
    const r = classifyLmnpTransaction(
      { id: 'tx1', propertyId: 'p1', nature: 'RECETTE_LOYER', categoryId: null },
      ov,
      [...rules],
    );
    expect(r.resolutionSource).toBe('override');
    expect(r.bucket).toBe('OV');
  });

  it('règle bien avant règle globale', () => {
    const r = classifyLmnpTransaction(
      { id: 'tx2', propertyId: 'p1', nature: 'AUTRE', categoryId: 'cat-x' },
      new Map(),
      [...rules],
    );
    expect(r.resolutionSource).toBe('rule_property');
    expect(r.bucket).toBe('SPECIAL');
  });

  it('règle globale sur nature', () => {
    const r = classifyLmnpTransaction(
      { id: 'tx3', propertyId: 'p2', nature: 'RECETTE_LOYER', categoryId: null },
      new Map(),
      [...rules],
    );
    expect(r.resolutionSource).toBe('rule_global');
    expect(r.bucket).toBe('LOYER');
  });

  it('fallback → A_CLASSER', () => {
    const r = classifyLmnpTransaction(
      { id: 'tx4', propertyId: 'p2', nature: 'INCONNUE', categoryId: null },
      new Map(),
      [...rules],
    );
    expect(r.resolutionSource).toBe('fallback');
    expect(r.bucket).toBe('A_CLASSER');
  });
});

describe('classifyLmnpDocument', () => {
  it('override document', () => {
    const m = new Map([['d1', { lmnpBucket: 'DOC_OV', lmnpLabel: 'Lib' }]]);
    const r = classifyLmnpDocument('d1', m, 'fallback name');
    expect(r.resolutionSource).toBe('override');
    expect(r.bucket).toBe('DOC_OV');
  });

  it('sans override → JUSTIFICATIF + fallback', () => {
    const r = classifyLmnpDocument('d2', new Map(), 'Ma facture');
    expect(r.resolutionSource).toBe('fallback');
    expect(r.bucket).toBe('JUSTIFICATIF');
    expect(r.label).toContain('facture');
  });
});

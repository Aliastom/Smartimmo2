/**
 * Tests unitaires - FiscalCombinationGuard
 * Tests de validation des combinaisons fiscales
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { FiscalCombinationGuard } from '../FiscalCombinationGuard';

const prisma = new PrismaClient();
const guard = new FiscalCombinationGuard();

describe('FiscalCombinationGuard', () => {
  beforeAll(async () => {
    // S'assurer que les types et régimes de test existent
    await prisma.fiscalType.upsert({
      where: { id: 'NU' },
      update: {},
      create: {
        id: 'NU',
        label: 'Location nue',
        category: 'FONCIER',
        isActive: true,
      },
    });

    await prisma.fiscalType.upsert({
      where: { id: 'MEUBLE' },
      update: {},
      create: {
        id: 'MEUBLE',
        label: 'Location meublée',
        category: 'BIC',
        isActive: true,
      },
    });

    await prisma.fiscalRegime.upsert({
      where: { id: 'MICRO' },
      update: {},
      create: {
        id: 'MICRO',
        label: 'Micro-foncier',
        appliesToIds: JSON.stringify(['NU']),
        calcProfile: 'micro_foncier',
        isActive: true,
      },
    });

    await prisma.fiscalRegime.upsert({
      where: { id: 'REEL' },
      update: {},
      create: {
        id: 'REEL',
        label: 'Régime réel',
        appliesToIds: JSON.stringify(['NU']),
        calcProfile: 'reel_foncier',
        isActive: true,
      },
    });

    await prisma.fiscalRegime.upsert({
      where: { id: 'MICRO_BIC' },
      update: {},
      create: {
        id: 'MICRO_BIC',
        label: 'Micro-BIC',
        appliesToIds: JSON.stringify(['MEUBLE']),
        calcProfile: 'micro_bic',
        isActive: true,
      },
    });

    // Créer les règles de compatibilité
    await prisma.fiscalCompatibility.upsert({
      where: { id: 'foncier-bic-mix' },
      update: {},
      create: {
        id: 'foncier-bic-mix',
        scope: 'category',
        left: 'FONCIER',
        right: 'BIC',
        rule: 'CAN_MIX',
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Validation des régimes multiples dans une catégorie', () => {
    it('devrait rejeter NU micro + NU réel (GLOBAL_SINGLE_CHOICE)', async () => {
      const biens = [
        { id: 'bien1', fiscalTypeId: 'NU', fiscalRegimeId: 'MICRO' },
        { id: 'bien2', fiscalTypeId: 'NU', fiscalRegimeId: 'REEL' },
      ];

      const result = await guard.validateCombination(biens);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('FISCAL_MULTIPLE_REGIMES_IN_CATEGORY');
    });

    it('devrait accepter NU réel + LMNP micro (catégories différentes, CAN_MIX)', async () => {
      const biens = [
        { id: 'bien1', fiscalTypeId: 'NU', fiscalRegimeId: 'REEL' },
        { id: 'bien2', fiscalTypeId: 'MEUBLE', fiscalRegimeId: 'MICRO_BIC' },
      ];

      const result = await guard.validateCombination(biens);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('devrait accepter plusieurs biens NU avec le même régime', async () => {
      const biens = [
        { id: 'bien1', fiscalTypeId: 'NU', fiscalRegimeId: 'REEL' },
        { id: 'bien2', fiscalTypeId: 'NU', fiscalRegimeId: 'REEL' },
        { id: 'bien3', fiscalTypeId: 'NU', fiscalRegimeId: 'REEL' },
      ];

      const result = await guard.validateCombination(biens);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Validation régime applicable au type', () => {
    it('devrait rejeter MICRO_BIC appliqué à un bien NU', async () => {
      const biens = [
        { id: 'bien1', fiscalTypeId: 'NU', fiscalRegimeId: 'MICRO_BIC' },
      ];

      const result = await guard.validateCombination(biens);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('FISCAL_REGIME_NOT_APPLICABLE');
    });

    it('devrait accepter MICRO_BIC pour un bien MEUBLE', async () => {
      const biens = [
        { id: 'bien1', fiscalTypeId: 'MEUBLE', fiscalRegimeId: 'MICRO_BIC' },
      ];

      const result = await guard.validateCombination(biens);

      expect(result.valid).toBe(true);
    });
  });

  describe('Summary', () => {
    it('devrait retourner un résumé correct des catégories', async () => {
      const biens = [
        { id: 'bien1', fiscalTypeId: 'NU', fiscalRegimeId: 'REEL' },
        { id: 'bien2', fiscalTypeId: 'NU', fiscalRegimeId: 'REEL' },
        { id: 'bien3', fiscalTypeId: 'MEUBLE', fiscalRegimeId: 'MICRO_BIC' },
      ];

      const summary = await guard.getSummary(biens);

      expect(summary.totalBiens).toBe(3);
      expect(summary.categories).toHaveLength(2);
      
      const foncier = summary.categories.find((c: any) => c.category === 'FONCIER');
      expect(foncier?.count).toBe(2);
      expect(foncier?.regimes).toContain('REEL');

      const bic = summary.categories.find((c: any) => c.category === 'BIC');
      expect(bic?.count).toBe(1);
      expect(bic?.regimes).toContain('MICRO_BIC');
    });
  });
});


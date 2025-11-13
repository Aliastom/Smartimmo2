/**
 * Guard serveur - Validation des combinaisons fiscales
 * Vérifie que les types et régimes sont compatibles avant simulation
 */

import { prisma } from '@/lib/prisma';
import type { FiscalType, FiscalRegime, FiscalCompatibility } from '@prisma/client';

export interface ValidationError {
  code: string;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export class FiscalCombinationGuard {
  /**
   * Valide une combinaison de biens avec leurs types et régimes fiscaux
   */
  async validateCombination(
    biens: Array<{ id: string; fiscalTypeId: string | null; fiscalRegimeId: string | null }>
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Filtrer les biens qui ont un type fiscal
    const biensTyped = biens.filter((b) => b.fiscalTypeId);

    if (biensTyped.length === 0) {
      return { valid: true, errors: [], warnings: [] };
    }

    // Récupérer tous les types et régimes concernés
    const typeIds = [...new Set(biensTyped.map((b) => b.fiscalTypeId).filter(Boolean))];
    const regimeIds = [...new Set(biensTyped.map((b) => b.fiscalRegimeId).filter(Boolean))];

    const [types, regimes, compatibilities] = await Promise.all([
      prisma.fiscalType.findMany({
        where: { id: { in: typeIds as string[] } },
      }),
      prisma.fiscalRegime.findMany({
        where: { id: { in: regimeIds as string[] } },
      }),
      prisma.fiscalCompatibility.findMany(),
    ]);

    // Créer un map pour accès rapide
    const typesMap = new Map(types.map((t) => [t.id, t]));
    const regimesMap = new Map(regimes.map((r) => [r.id, r]));

    // ========== VALIDATION 1 : Régime unique par catégorie ==========
    
    // Regrouper les biens par catégorie
    const biensByCategory = new Map<string, Array<typeof biensTyped[0]>>();
    
    for (const bien of biensTyped) {
      if (!bien.fiscalTypeId) continue;
      
      const type = typesMap.get(bien.fiscalTypeId);
      if (!type) continue;

      const category = type.category;
      if (!biensByCategory.has(category)) {
        biensByCategory.set(category, []);
      }
      biensByCategory.get(category)!.push(bien);
    }

    // Vérifier qu'une catégorie n'a qu'un seul régime actif
    for (const [category, categoryBiens] of biensByCategory.entries()) {
      const regimesInCategory = [
        ...new Set(
          categoryBiens
            .map((b) => b.fiscalRegimeId)
            .filter(Boolean)
        ),
      ];

      if (regimesInCategory.length > 1) {
        // Vérifier si c'est GLOBAL_SINGLE_CHOICE
        const rule = compatibilities.find(
          (c) => c.scope === 'category' && c.rule === 'GLOBAL_SINGLE_CHOICE'
        );

        if (rule || category === 'FONCIER' || category === 'BIC') {
          errors.push({
            code: 'FISCAL_MULTIPLE_REGIMES_IN_CATEGORY',
            field: 'regimes',
            message: `La catégorie ${category} ne peut avoir qu'un seul régime fiscal actif. Régimes détectés : ${regimesInCategory.join(', ')}`,
            severity: 'error',
          });
        }
      }
    }

    // ========== VALIDATION 2 : Compatibilités entre catégories ==========

    const categories = [...biensByCategory.keys()];

    for (let i = 0; i < categories.length; i++) {
      for (let j = i + 1; j < categories.length; j++) {
        const cat1 = categories[i];
        const cat2 = categories[j];

        // Chercher la règle de compatibilité
        const rule = compatibilities.find(
          (c) =>
            c.scope === 'category' &&
            ((c.left === cat1 && c.right === cat2) || (c.left === cat2 && c.right === cat1))
        );

        if (!rule) {
          // Pas de règle définie, autoriser par défaut
          warnings.push({
            code: 'FISCAL_NO_COMPATIBILITY_RULE',
            field: 'categories',
            message: `Aucune règle de compatibilité définie entre ${cat1} et ${cat2}`,
            severity: 'warning',
          });
          continue;
        }

        if (rule.rule === 'MUTUALLY_EXCLUSIVE') {
          errors.push({
            code: 'FISCAL_MUTUALLY_EXCLUSIVE_CATEGORIES',
            field: 'categories',
            message: `Les catégories ${cat1} et ${cat2} sont mutuellement exclusives. Vous ne pouvez pas les combiner.`,
            severity: 'error',
          });
        } else if (rule.rule === 'GLOBAL_SINGLE_CHOICE') {
          warnings.push({
            code: 'FISCAL_SINGLE_CHOICE_RECOMMENDED',
            field: 'categories',
            message: `Il est recommandé de choisir une seule catégorie entre ${cat1} et ${cat2}`,
            severity: 'warning',
          });
        }
        // CAN_MIX → pas d'erreur, OK
      }
    }

    // ========== VALIDATION 3 : Régime applicable au type ==========

    for (const bien of biensTyped) {
      if (!bien.fiscalTypeId || !bien.fiscalRegimeId) continue;

      const regime = regimesMap.get(bien.fiscalRegimeId);
      if (!regime) continue;

      const appliesTo = JSON.parse(regime.appliesToIds) as string[];

      if (!appliesTo.includes(bien.fiscalTypeId)) {
        errors.push({
          code: 'FISCAL_REGIME_NOT_APPLICABLE',
          field: `bien_${bien.id}`,
          message: `Le régime "${bien.fiscalRegimeId}" ne s'applique pas au type "${bien.fiscalTypeId}"`,
          severity: 'error',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Valide et retourne un résumé lisible des combinaisons
   */
  async getSummary(
    biens: Array<{ id: string; fiscalTypeId: string | null; fiscalRegimeId: string | null }>
  ) {
    const biensTyped = biens.filter((b) => b.fiscalTypeId);

    if (biensTyped.length === 0) {
      return {
        categories: [],
        regimes: [],
        warnings: ['Aucun bien n\'a de type fiscal défini'],
      };
    }

    // Récupérer les types
    const typeIds = [...new Set(biensTyped.map((b) => b.fiscalTypeId).filter(Boolean))];
    const types = await prisma.fiscalType.findMany({
      where: { id: { in: typeIds as string[] } },
    });

    // Regrouper par catégorie
    const categoriesMap = new Map<string, { count: number; regimes: Set<string> }>();

    for (const bien of biensTyped) {
      if (!bien.fiscalTypeId) continue;

      const type = types.find((t) => t.id === bien.fiscalTypeId);
      if (!type) continue;

      if (!categoriesMap.has(type.category)) {
        categoriesMap.set(type.category, { count: 0, regimes: new Set() });
      }

      const catData = categoriesMap.get(type.category)!;
      catData.count++;
      if (bien.fiscalRegimeId) {
        catData.regimes.add(bien.fiscalRegimeId);
      }
    }

    return {
      categories: Array.from(categoriesMap.entries()).map(([category, data]) => ({
        category,
        count: data.count,
        regimes: Array.from(data.regimes),
      })),
      totalBiens: biensTyped.length,
    };
  }
}


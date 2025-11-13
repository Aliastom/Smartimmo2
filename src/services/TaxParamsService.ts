/**
 * Service frontend pour la gestion des paramètres fiscaux
 */

import type { FiscalType, FiscalRegime, FiscalCompatibility } from '@prisma/client';

export class TaxParamsService {
  /**
   * Récupère la version active (publiée)
   */
  async getActiveVersion() {
    const response = await fetch('/api/admin/tax/versions?status=published');
    
    if (!response.ok) {
      throw new Error('Erreur lors de la récupération de la version active');
    }
    
    const versions = await response.json();
    return versions[0] || null;
  }

  /**
   * Récupère toutes les versions
   */
  async getAllVersions() {
    const response = await fetch('/api/admin/tax/versions');
    
    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des versions');
    }
    
    return response.json();
  }

  /**
   * Récupère tous les types fiscaux
   */
  async getTypes(activeOnly = false): Promise<FiscalType[]> {
    const url = activeOnly
      ? '/api/admin/tax/types?active=true'
      : '/api/admin/tax/types';
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des types fiscaux');
    }
    
    return response.json();
  }

  /**
   * Récupère tous les régimes fiscaux
   */
  async getRegimes(activeOnly = false, typeId?: string): Promise<FiscalRegime[]> {
    let url = activeOnly
      ? '/api/admin/tax/regimes?active=true'
      : '/api/admin/tax/regimes';
    
    if (typeId) {
      url += `&typeId=${typeId}`;
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des régimes fiscaux');
    }
    
    return response.json();
  }

  /**
   * Récupère les régimes applicables à un type fiscal donné
   */
  async getRegimesForType(typeId: string): Promise<FiscalRegime[]> {
    const regimes = await this.getRegimes(true);
    
    return regimes.filter((regime) => {
      const appliesTo = JSON.parse(regime.appliesToIds) as string[];
      return appliesTo.includes(typeId);
    });
  }

  /**
   * Récupère toutes les compatibilités
   */
  async getCompatibilities(): Promise<FiscalCompatibility[]> {
    const response = await fetch('/api/admin/tax/compat');
    
    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des compatibilités');
    }
    
    return response.json();
  }

  /**
   * Valide une combinaison de types et régimes
   */
  async validateCombination(
    types: string[],
    regimes: string[]
  ): Promise<{ valid: boolean; errors: string[] }> {
    const compatibilities = await this.getCompatibilities();
    const errors: string[] = [];

    // Vérifier les compatibilités de catégories
    const categoryCompat = compatibilities.filter((c) => c.scope === 'category');
    
    // Extraire les catégories des types sélectionnés
    const allTypes = await this.getTypes();
    const selectedTypes = allTypes.filter((t) => types.includes(t.id));
    const categories = [...new Set(selectedTypes.map((t) => t.category))];

    // Vérifier les règles de compatibilité entre catégories
    for (let i = 0; i < categories.length; i++) {
      for (let j = i + 1; j < categories.length; j++) {
        const rule = categoryCompat.find(
          (c) =>
            (c.left === categories[i] && c.right === categories[j]) ||
            (c.left === categories[j] && c.right === categories[i])
        );

        if (rule && rule.rule === 'MUTUALLY_EXCLUSIVE') {
          errors.push(
            `Les catégories ${categories[i]} et ${categories[j]} sont mutuellement exclusives`
          );
        } else if (rule && rule.rule === 'GLOBAL_SINGLE_CHOICE') {
          errors.push(
            `Vous ne pouvez choisir qu'une seule catégorie parmi ${categories[i]} et ${categories[j]}`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}


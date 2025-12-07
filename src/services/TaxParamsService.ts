/**
 * Service frontend pour la gestion des paramètres fiscaux
 * Supporte le mode offline-first avec cache local
 */

import type { FiscalType, FiscalRegime, FiscalCompatibility } from '@prisma/client';
import { getLocalDB } from '@/lib/offline/db';
import type { CachedFiscalType, CachedFiscalRegime } from '@/lib/offline/db';

export class TaxParamsService {
  private db = typeof window !== 'undefined' ? getLocalDB() : null;
  private cacheMaxAge = 24 * 60 * 60 * 1000; // 24 heures

  /**
   * Vérifie si on est en ligne
   */
  private isOnline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine;
  }

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
   * Récupère tous les types fiscaux (avec fallback sur cache local)
   */
  async getTypes(activeOnly = false): Promise<FiscalType[]> {
    const url = activeOnly
      ? '/api/admin/tax/types?active=true'
      : '/api/admin/tax/types';
    
    // Essayer de charger depuis le réseau
    if (this.isOnline()) {
      try {
        const response = await fetch(url);
        
        if (response.ok) {
          const types = await response.json();
          
          // Mettre en cache si on a la DB locale
          if (this.db) {
            const now = new Date().toISOString();
            await Promise.all(
              types.map((type: FiscalType) =>
                this.db!.fiscalTypes.put({
                  ...type,
                  cachedAt: now,
                } as CachedFiscalType)
              )
            );
          }
          
          return types;
        }
      } catch (error) {
        console.warn('[TaxParamsService] Erreur réseau, utilisation du cache:', error);
      }
    }
    
    // Fallback sur le cache local
    if (this.db) {
      try {
        let cached = await this.db.fiscalTypes.toArray();
        
        // Filtrer par isActive si demandé
        if (activeOnly) {
          cached = cached.filter(t => t.isActive);
        }
        
        // Vérifier l'âge du cache
        const now = Date.now();
        const isCacheValid = cached.every(t => {
          const age = now - new Date(t.cachedAt).getTime();
          return age < this.cacheMaxAge;
        });
        
        if (cached.length > 0) {
          // Convertir en format API (enlever cachedAt)
          const { cachedAt, ...rest } = cached[0];
          return cached.map(t => {
            const { cachedAt: _, ...data } = t;
            return data as FiscalType;
          });
        }
      } catch (error) {
        console.error('[TaxParamsService] Erreur lecture cache:', error);
      }
    }
    
    throw new Error('Impossible de charger les types fiscaux (offline et cache vide)');
  }

  /**
   * Récupère tous les régimes fiscaux (avec fallback sur cache local)
   */
  async getRegimes(activeOnly = false, typeId?: string): Promise<FiscalRegime[]> {
    let url = activeOnly
      ? '/api/admin/tax/regimes?active=true'
      : '/api/admin/tax/regimes';
    
    if (typeId) {
      url += `&typeId=${typeId}`;
    }
    
    // Essayer de charger depuis le réseau
    if (this.isOnline()) {
      try {
        const response = await fetch(url);
        
        if (response.ok) {
          const regimes = await response.json();
          
          // Mettre en cache si on a la DB locale
          if (this.db) {
            const now = new Date().toISOString();
            await Promise.all(
              regimes.map((regime: FiscalRegime) =>
                this.db!.fiscalRegimes.put({
                  ...regime,
                  cachedAt: now,
                } as CachedFiscalRegime)
              )
            );
          }
          
          return regimes;
        }
      } catch (error) {
        console.warn('[TaxParamsService] Erreur réseau, utilisation du cache:', error);
      }
    }
    
    // Fallback sur le cache local
    if (this.db) {
      try {
        let cached = await this.db.fiscalRegimes.toArray();
        
        // Filtrer par isActive si demandé
        if (activeOnly) {
          cached = cached.filter(r => r.isActive);
        }
        
        // Filtrer par typeId si demandé
        if (typeId) {
          cached = cached.filter(regime => {
            try {
              const appliesTo = JSON.parse(regime.appliesToIds) as string[];
              return appliesTo.includes(typeId);
            } catch {
              return false;
            }
          });
        }
        
        if (cached.length > 0) {
          // Convertir en format API (enlever cachedAt)
          return cached.map(r => {
            const { cachedAt: _, ...data } = r;
            return data as FiscalRegime;
          });
        }
      } catch (error) {
        console.error('[TaxParamsService] Erreur lecture cache:', error);
      }
    }
    
    throw new Error('Impossible de charger les régimes fiscaux (offline et cache vide)');
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


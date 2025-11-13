/**
 * Service de mise à jour automatique des paramètres fiscaux
 * Récupère les barèmes officiels et crée des versions draft
 */

import { prisma } from '@/lib/prisma';
import type { TaxParams } from '@/types/fiscal';

export class TaxParamsUpdater {
  /**
   * Récupère les paramètres fiscaux depuis les sources officielles
   * et crée une nouvelle version draft
   */
  async fetchAndCreateDraft(year: number) {
    // 1. Récupérer les paramètres depuis les sources
    const taxParams = await this.fetchOfficialParams(year);

    // 2. Trouver la version actuellement publiée pour cette année
    const currentPublished = await prisma.fiscalVersion.findFirst({
      where: {
        year,
        status: 'published',
      },
      include: { params: true },
    });

    // 3. Calculer les différences
    const diff = currentPublished?.params
      ? this.calculateDiff(
          JSON.parse(currentPublished.params.jsonData),
          taxParams
        )
      : [];

    // 4. Générer le code de version
    const code = await this.generateVersionCode(year);

    // 5. Créer la nouvelle version draft
    const newVersion = await prisma.fiscalVersion.create({
      data: {
        code,
        year,
        source: taxParams.source,
        status: 'draft',
        notes: `Mise à jour automatique - ${diff.length} changement(s) détecté(s)`,
        params: {
          create: {
            jsonData: JSON.stringify(taxParams),
            overrides: null,
          },
        },
      },
      include: {
        params: true,
      },
    });

    return {
      version: newVersion,
      diff,
    };
  }

  /**
   * Récupère les paramètres fiscaux officiels pour une année donnée
   * PLACEHOLDER: À implémenter avec scraping réel
   */
  private async fetchOfficialParams(year: number): Promise<TaxParams> {
    // TODO: Implémenter le scraping réel des sources officielles
    // Sources à scraper:
    // - DGFiP (impots.gouv.fr)
    // - BOFiP (bofip.impots.gouv.fr)
    // - Service-Public.fr
    
    // Pour l'instant, retourne des valeurs par défaut
    return this.getDefaultTaxParams(year);
  }

  /**
   * Retourne les paramètres fiscaux par défaut (fallback)
   */
  private getDefaultTaxParams(year: number): TaxParams {
    return {
      version: `${year}.1`,
      year,
      
      // Barème IR 2025 (revenus 2024)
      irBrackets: [
        { lower: 0, upper: 11294, rate: 0 },
        { lower: 11294, upper: 28797, rate: 0.11 },
        { lower: 28797, upper: 82341, rate: 0.30 },
        { lower: 82341, upper: 177106, rate: 0.41 },
        { lower: 177106, upper: null, rate: 0.45 },
      ],
      
      irDecote: {
        threshold: 1929,
        formula: (tax: number, parts: number) => {
          const plafond = parts === 1 ? 1929 : 3191;
          return Math.max(0, plafond - (3 * tax) / 4);
        },
      },
      
      // Prélèvements sociaux
      psRate: 0.172,
      
      // Régimes micro
      micro: {
        foncierAbattement: 0.30,
        foncierPlafond: 15000,
        bicAbattement: 0.50,
        bicPlafond: 77700,
        meubleTourismeAbattement: 0.71,
        meubleTourismePlafond: 188700,
      },
      
      // Déficit foncier
      deficitFoncier: {
        plafondImputationRevenuGlobal: 10700,
        dureeReport: 10,
      },
      
      // PER
      per: {
        tauxPlafond: 0.10,
        plancherLegal: 4399,
        dureeReportReliquats: 3,
      },
      
      // LMP
      lmp: {
        recettesMin: 23000,
        tauxRecettesProMin: 0.50,
        inscriptionRCSObligatoire: true,
      },
      
      // SCI IS
      sciIS: {
        tauxReduit: 0.15,
        plafondTauxReduit: 42500,
        tauxNormal: 0.25,
      },
      
      source: `DGFiP ${year} (valeurs par défaut)`,
      dateMAJ: new Date(),
    };
  }

  /**
   * Génère un code de version unique pour une année
   */
  private async generateVersionCode(year: number): Promise<string> {
    // Compter les versions existantes pour cette année
    const count = await prisma.fiscalVersion.count({
      where: { year },
    });

    return `${year}.${count + 1}`;
  }

  /**
   * Calcule les différences entre deux objets de paramètres fiscaux
   */
  private calculateDiff(from: any, to: any, path: string = ''): any[] {
    const changes: any[] = [];

    for (const key in to) {
      const currentPath = path ? `${path}.${key}` : key;
      const fromValue = from[key];
      const toValue = to[key];

      if (typeof toValue === 'object' && toValue !== null && !Array.isArray(toValue)) {
        changes.push(...this.calculateDiff(fromValue || {}, toValue, currentPath));
      } else if (JSON.stringify(fromValue) !== JSON.stringify(toValue)) {
        changes.push({
          field: currentPath,
          oldValue: fromValue,
          newValue: toValue,
          description: this.describeChange(currentPath, fromValue, toValue),
        });
      }
    }

    return changes;
  }

  /**
   * Génère une description lisible d'un changement
   */
  private describeChange(field: string, oldValue: any, newValue: any): string {
    if (field.includes('rate') || field.includes('Rate') || field.includes('taux')) {
      return `Taux modifié de ${(oldValue * 100).toFixed(1)}% à ${(newValue * 100).toFixed(1)}%`;
    }
    if (field.includes('plafond') || field.includes('threshold')) {
      return `Plafond modifié de ${oldValue}€ à ${newValue}€`;
    }
    return `Modifié de ${oldValue} à ${newValue}`;
  }
}


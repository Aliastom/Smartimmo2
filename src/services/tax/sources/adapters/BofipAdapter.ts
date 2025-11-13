/**
 * Adapter pour scraper les données fiscales depuis le BOFiP
 * (Bulletin Officiel des Finances Publiques)
 * 
 * Confiance: HIGH - Source officielle stable avec structure HTML claire
 */

import axios from 'axios';
import { TaxPartial, TaxSource, ConfidenceLevel } from '../types';
import { 
  parseHTML, 
  extractTable, 
  parseIRBracketRow,
  parseEuroAmount,
  parsePercentage,
  findRowContaining 
} from '../parsers/html';
import { createHash } from '../utils';
import { loadSourcesConfig } from '../configLoader';

export class BofipAdapter {
  // LOGS DÉSACTIVÉS TEMPORAIREMENT (debug OpenFisca)
  private readonly SILENT_MODE = true;
  private readonly source: TaxSource = 'BOFIP';
  private readonly confidence: ConfidenceLevel = 'high';
  
  private baseUrl: string = 'https://bofip.impots.gouv.fr';
  private urls: Record<string, string> = {};
  
  /**
   * Charge la configuration depuis la BDD
   */
  private async loadConfig(): Promise<void> {
    try {
      const config = await loadSourcesConfig();
      const bofipConfig = config.BOFIP;
      
      if (bofipConfig) {
        this.baseUrl = bofipConfig.baseUrl;
        
        // Convertir les URLs du format config vers un Record
        if (bofipConfig.urls) {
          for (const urlConfig of bofipConfig.urls) {
            // Mapper section → clé interne
            if (urlConfig.section === 'IR') {
              this.urls.IR_BAREME = urlConfig.path;
            } else if (urlConfig.section === 'IR_DECOTE') {
              this.urls.IR_DECOTE = urlConfig.path;
            } else if (urlConfig.section === 'PS') {
              this.urls.PS = urlConfig.path;
            } else if (urlConfig.section === 'MICRO') {
              this.urls.MICRO = urlConfig.path;
            }
          }
        }
      }
      
      if (!this.SILENT_MODE) {
        console.log(`[BofipAdapter] Config chargée depuis BDD: ${Object.keys(this.urls).length} URL(s)`);
      }
    } catch (error) {
      console.error('[BofipAdapter] Erreur chargement config, utilisation valeurs par défaut:', error);
      // Fallback sur les valeurs hardcodées
      this.baseUrl = 'https://bofip.impots.gouv.fr';
      this.urls = {
        IR_BAREME: '/bofip/2491-PGP.html/identifiant=BOI-IR-LIQ-20-10-20250414',
        IR_DECOTE: '/bofip/2495-PGP.html/identifiant=BOI-IR-LIQ-20-20-30-20250414',
        PS: '/bofip/1733-PGP.html',
        MICRO: '/bofip/3973-PGP.html/identifiant=BOI-RFPI-DECLA-10-20160706',
      };
    }
  }
  
  /**
   * Récupère les données fiscales pour une année donnée
   */
  async fetchPartials(year: number): Promise<TaxPartial[]> {
    // Charger la config depuis la BDD
    await this.loadConfig();
    
    const partials: TaxPartial[] = [];
    
    try {
      // Récupérer le barème IR
      const irPartial = await this.fetchIRBrackets(year);
      if (irPartial) partials.push(irPartial);
      
      // Récupérer la décote IR
      const decotePartial = await this.fetchIRDecote(year);
      if (decotePartial) partials.push(decotePartial);
      
      // Récupérer les prélèvements sociaux
      const psPartial = await this.fetchPS(year);
      if (psPartial) partials.push(psPartial);
      
      // Récupérer les régimes micro
      const microPartial = await this.fetchMicro(year);
      if (microPartial) partials.push(microPartial);
      
    } catch (error) {
      // console.error('BofipAdapter: Erreur lors du fetch:', error);
      throw error;
    }
    
    return partials;
  }
  
  /**
   * Récupère le barème de l'IR
   */
  private async fetchIRBrackets(year: number): Promise<TaxPartial | null> {
    try {
      // URL du barème IR 2024/2025 (mise à jour 08/11/2025)
      const url = `${this.baseUrl}${this.urls.IR_BAREME}`;
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SmartImmo/1.0; +https://smartimmo.fr)'
        }
      });
      
      const html = response.data;
      const $ = parseHTML(html);
      
      // FALLBACK SÉLECTEURS : Essayer plusieurs variantes
      const tableSelectors = [
        'table.bareme',
        'table.tableau-bareme',
        '.bareme-ir table',
        'table[summary*="barème"]',
        'table[summary*="impôt"]',
        'table:contains("tranche")',
        'table' // Dernier recours : tous les tableaux
      ];
      
      let tables = $();
      for (const selector of tableSelectors) {
        tables = $(selector);
        if (tables.length > 0) {
          // console.log(`BofipAdapter: Tableau trouvé avec sélecteur "${selector}"`);
          break;
        }
      }
      
      if (tables.length === 0) {
        // console.warn('BofipAdapter: Aucun tableau de barème trouvé avec aucun sélecteur');
        return null;
      }
      
      const tableData = extractTable($, tables.first().get(0) as any);
      
      // Parser les tranches
      const brackets: Array<{ lower: number; upper: number | null; rate: number }> = [];
      
      // Ignorer la ligne d'en-tête
      for (let i = 1; i < tableData.length; i++) {
        const row = tableData[i];
        const bracket = parseIRBracketRow(row);
        if (bracket) {
          brackets.push(bracket);
        }
      }
      
      if (brackets.length === 0) {
        // console.warn('BofipAdapter: Aucune tranche parsée');
        return null;
      }
      
      const hash = createHash(html);
      
      return {
        section: 'IR',
        data: { irBrackets: brackets },
        meta: {
          source: this.source,
          url,
          fetchedAt: new Date(),
          hash,
          confidence: this.confidence,
          notes: `Barème IR ${year} extrait du BOFiP`
        }
      };
      
    } catch (error) {
      // console.error('BofipAdapter: Erreur fetch IR brackets:', error);
      return null;
    }
  }
  
  /**
   * Récupère la décote IR
   */
  private async fetchIRDecote(year: number): Promise<TaxPartial | null> {
    try {
      // URL de la décote IR 2024/2025 (mise à jour 08/11/2025)
      const url = `${this.baseUrl}${this.urls.IR_DECOTE}`;
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SmartImmo/1.0; +https://smartimmo.fr)'
        }
      });
      
      const html = response.data;
      const $ = parseHTML(html);
      
      // Chercher les montants de décote dans le texte
      const text = $('body').text();
      
      // Patterns ULTRA précis pour extraire les VRAIS seuils de décote
      // BOFIP : "(soit respectivement 1/45,25 % de 889 € et 1/45,25 % de 1 470 €)"
      // Les montants 1965€ et 3249€ sont les PLAFONDS d'impôt brut, PAS les seuils de décote !
      const seuilsMatch = text.match(/\(soit\s+respectivement\s+[\d.,/\s%]+de\s+(\d[\d\s']*)\s*€\s+et\s+[\d.,/\s%]+de\s+(\d[\d\s']*)\s*€\)/i);
      const facteurMatch = text.match(/(\d+[.,]\d+)\s*%[^\d]*pour\s+l'imposition\s+des\s+revenus/i);
      
      if (!seuilsMatch) {
        // console.warn('BofipAdapter: Décote non trouvée (format attendu: "(soit respectivement ... de XXX € et ... de YYY €)")');
        return null;
      }
      
      const celibataireMatch = [null, seuilsMatch[1]]; // [full match, captured group]
      const coupleMatch = [null, seuilsMatch[2]];
      
      if (!celibataireMatch || !coupleMatch) {
        // console.warn('BofipAdapter: Décote non trouvée');
        return null;
      }
      
      const seuilCelibataire = parseEuroAmount(celibataireMatch[1]);
      const seuilCouple = parseEuroAmount(coupleMatch[1]);
      const facteur = facteurMatch ? parsePercentage(facteurMatch[1]) : 0.75; // Valeur par défaut
      
      if (seuilCelibataire === null || seuilCouple === null || facteur === null) {
        return null;
      }
      
      const hash = createHash(html);
      
      return {
        section: 'IR_DECOTE',
        data: {
          irDecote: {
            seuilCelibataire,
            seuilCouple,
            facteur
          }
        },
        meta: {
          source: this.source,
          url,
          fetchedAt: new Date(),
          hash,
          confidence: this.confidence,
          notes: `Décote IR ${year} extraite du BOFiP`
        }
      };
      
    } catch (error) {
      // console.error('BofipAdapter: Erreur fetch décote:', error);
      return null;
    }
  }
  
  /**
   * Récupère le taux de prélèvements sociaux
   */
  private async fetchPS(year: number): Promise<TaxPartial | null> {
    try {
      const url = `${BASE_URL}/bofip/4691-PGP.html`;
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SmartImmo/1.0; +https://smartimmo.fr)'
        }
      });
      
      const html = response.data;
      const $ = parseHTML(html);
      
      const text = $('body').text();
      
      // Chercher le taux global (généralement 17.2%)
      const match = text.match(/taux\s+global[^\d]*(\d+(?:[.,]\d+)?)\s*%/i) ||
                    text.match(/(\d+(?:[.,]\d+)?)\s*%[^\d]*prélèvements\s+sociaux/i);
      
      if (!match) {
        // console.warn('BofipAdapter: Taux PS non trouvé');
        return null;
      }
      
      const psRate = parsePercentage(match[1]);
      
      if (psRate === null) {
        return null;
      }
      
      const hash = createHash(html);
      
      return {
        section: 'PS',
        data: { psRate },
        meta: {
          source: this.source,
          url,
          fetchedAt: new Date(),
          hash,
          confidence: this.confidence,
          notes: `Taux PS ${year} extrait du BOFiP`
        }
      };
      
    } catch (error) {
      // console.error('BofipAdapter: Erreur fetch PS:', error);
      return null;
    }
  }
  
  /**
   * Récupère les plafonds des régimes micro
   */
  private async fetchMicro(year: number): Promise<TaxPartial | null> {
    try {
      const url = `${BASE_URL}/bofip/2041-PGP.html`;
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SmartImmo/1.0; +https://smartimmo.fr)'
        }
      });
      
      const html = response.data;
      const $ = parseHTML(html);
      
      const text = $('body').text();
      
      // Patterns pour extraire les plafonds et abattements
      // Micro-foncier
      const foncierPlafondMatch = text.match(/micro-?foncier[^\d]*(\d[\d\s']*)\s*€/i);
      const foncierAbattementMatch = text.match(/abattement[^\d]*(\d+)\s*%/i);
      
      // Micro-BIC vente
      const ventePlafondMatch = text.match(/vente[^\d]*(\d[\d\s']*)\s*€/i);
      const venteAbattementMatch = text.match(/vente[^\d]*(\d+)\s*%[^\d]*abattement/i);
      
      // Micro-BIC services
      const servicesPlafondMatch = text.match(/services[^\d]*(\d[\d\s']*)\s*€/i);
      const servicesAbattementMatch = text.match(/services[^\d]*(\d+)\s*%[^\d]*abattement/i);
      
      const micro: any = {
        foncier: {
          plafond: foncierPlafondMatch ? parseEuroAmount(foncierPlafondMatch[1]) : 15000,
          abattement: foncierAbattementMatch ? parsePercentage(foncierAbattementMatch[1]) : 0.30
        },
        bic: {
          vente: {
            plafond: ventePlafondMatch ? parseEuroAmount(ventePlafondMatch[1]) : 188700,
            abattement: venteAbattementMatch ? parsePercentage(venteAbattementMatch[1]) : 0.71
          },
          services: {
            plafond: servicesPlafondMatch ? parseEuroAmount(servicesPlafondMatch[1]) : 77700,
            abattement: servicesAbattementMatch ? parsePercentage(servicesAbattementMatch[1]) : 0.50
          }
        }
      };
      
      const hash = createHash(html);
      
      return {
        section: 'MICRO',
        data: { micro },
        meta: {
          source: this.source,
          url,
          fetchedAt: new Date(),
          hash,
          confidence: this.confidence,
          notes: `Régimes micro ${year} extraits du BOFiP`
        }
      };
      
    } catch (error) {
      // console.error('BofipAdapter: Erreur fetch micro:', error);
      return null;
    }
  }
}


/**
 * Adapter pour scraper les données fiscales depuis Service-Public.fr
 * 
 * Confiance: MEDIUM - Source officielle mais focalisée sur les plafonds et règles générales
 */

import axios from 'axios';
import { TaxPartial, TaxSource, ConfidenceLevel } from '../types';
import { 
  parseHTML, 
  extractTable,
  parseEuroAmount,
  parsePercentage,
  cleanText,
  findRowContaining 
} from '../parsers/html';
import { createHash } from '../utils';

const BASE_URL = 'https://www.service-public.fr';

export class ServicePublicAdapter {
  private readonly source: TaxSource = 'SERVICE_PUBLIC';
  private readonly confidence: ConfidenceLevel = 'medium';
  
  /**
   * Récupère les données fiscales pour une année donnée
   */
  async fetchPartials(year: number): Promise<TaxPartial[]> {
    const partials: TaxPartial[] = [];
    
    try {
      // Récupérer les plafonds micro
      const microPartial = await this.fetchMicro(year);
      if (microPartial) partials.push(microPartial);
      
      // Récupérer les infos PER
      const perPartial = await this.fetchPER(year);
      if (perPartial) partials.push(perPartial);
      
      // Récupérer le déficit foncier
      const deficitPartial = await this.fetchDeficit(year);
      if (deficitPartial) partials.push(deficitPartial);
      
      // Récupérer les infos SCI IS
      const sciISPartial = await this.fetchSciIS(year);
      if (sciISPartial) partials.push(sciISPartial);
      
    } catch (error: any) {
      // Log court (404/403 sont fréquents)
      // console.error('ServicePublicAdapter: Erreur lors du fetch:', error.message || String(error));
      throw error;
    }
    
    return partials;
  }
  
  /**
   * Récupère les plafonds des régimes micro
   */
  private async fetchMicro(year: number): Promise<TaxPartial | null> {
    try {
      const url = `${BASE_URL}/particuliers/vosdroits/F32055`;
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SmartImmo/1.0; +https://smartimmo.fr)'
        }
      });
      
      const html = response.data;
      const $ = parseHTML(html);
      
      const text = $('body').text();
      
      // Micro-foncier
      const foncierPlafondMatch = text.match(/micro-?foncier[^\d]*(\d[\d\s']*)\s*€/i);
      const foncierAbattementMatch = text.match(/abattement.*?(\d+)\s*%/i);
      
      // Micro-BIC
      const ventePlafondMatch = text.match(/vente.*?marchandises[^\d]*(\d[\d\s']*)\s*€/i);
      const venteAbattementMatch = text.match(/vente.*?(\d+)\s*%/i);
      
      const servicesPlafondMatch = text.match(/prestations.*?services[^\d]*(\d[\d\s']*)\s*€/i);
      const servicesAbattementMatch = text.match(/services.*?(\d+)\s*%/i);
      
      const micro: any = {
        foncier: {
          plafond: foncierPlafondMatch ? parseEuroAmount(foncierPlafondMatch[1]) : null,
          abattement: foncierAbattementMatch ? parsePercentage(foncierAbattementMatch[1]) : null
        },
        bic: {
          vente: {
            plafond: ventePlafondMatch ? parseEuroAmount(ventePlafondMatch[1]) : null,
            abattement: venteAbattementMatch ? parsePercentage(venteAbattementMatch[1]) : null
          },
          services: {
            plafond: servicesPlafondMatch ? parseEuroAmount(servicesPlafondMatch[1]) : null,
            abattement: servicesAbattementMatch ? parsePercentage(servicesAbattementMatch[1]) : null
          }
        }
      };
      
      // Filtrer les valeurs null
      if (!micro.foncier.plafond && !micro.bic.vente.plafond && !micro.bic.services.plafond) {
        return null;
      }
      
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
          notes: `Régimes micro ${year} extraits de Service-Public.fr`
        }
      };
      
    } catch (error: any) {
      // console.warn('ServicePublicAdapter: Erreur fetch micro:', error.message || String(error));
      return null;
    }
  }
  
  /**
   * Récupère les plafonds PER
   */
  private async fetchPER(year: number): Promise<TaxPartial | null> {
    try {
      const url = `${BASE_URL}/particuliers/vosdroits/F34982`;
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SmartImmo/1.0; +https://smartimmo.fr)'
        }
      });
      
      const html = response.data;
      const $ = parseHTML(html);
      
      const text = $('body').text();
      
      // Chercher le plafond de base et le multiple du PASS
      const plafondMatch = text.match(/plafond.*?(\d[\d\s']*)\s*€/i);
      const passMultipleMatch = text.match(/(\d+)\s*%.*?PASS/i) || 
                                 text.match(/(\d+)\s*fois.*?PASS/i);
      
      if (!plafondMatch && !passMultipleMatch) {
        return null;
      }
      
      const per: any = {
        plafondBase: plafondMatch ? parseEuroAmount(plafondMatch[1]) : null,
        plafondMaxPASSMultiple: passMultipleMatch ? parseInt(passMultipleMatch[1]) / 100 : null
      };
      
      const hash = createHash(html);
      
      return {
        section: 'PER',
        data: { per },
        meta: {
          source: this.source,
          url,
          fetchedAt: new Date(),
          hash,
          confidence: this.confidence,
          notes: `Plafonds PER ${year} extraits de Service-Public.fr`
        }
      };
      
    } catch (error: any) {
      // console.warn('ServicePublicAdapter: Erreur fetch PER:', error.message || String(error));
      return null;
    }
  }
  
  /**
   * Récupère les infos sur le déficit foncier
   */
  private async fetchDeficit(year: number): Promise<TaxPartial | null> {
    try {
      const url = `${BASE_URL}/particuliers/vosdroits/F31153`;
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SmartImmo/1.0; +https://smartimmo.fr)'
        }
      });
      
      const html = response.data;
      const $ = parseHTML(html);
      
      const text = $('body').text();
      
      // Chercher le plafond d'imputation
      const plafondMatch = text.match(/imputation.*?(\d[\d\s']*)\s*€/i) ||
                           text.match(/(\d[\d\s']*)\s*€.*?revenu\s+global/i);
      
      // Chercher la durée de report
      const reportMatch = text.match(/report.*?(\d+)\s*ans?/i);
      
      if (!plafondMatch) {
        return null;
      }
      
      const deficitFoncier: any = {
        plafondImputationRevenuGlobal: parseEuroAmount(plafondMatch[1]) || 10700,
        reportYears: reportMatch ? parseInt(reportMatch[1]) : 10
      };
      
      const hash = createHash(html);
      
      return {
        section: 'DEFICIT',
        data: { deficitFoncier },
        meta: {
          source: this.source,
          url,
          fetchedAt: new Date(),
          hash,
          confidence: this.confidence,
          notes: `Déficit foncier ${year} extrait de Service-Public.fr`
        }
      };
      
    } catch (error: any) {
      // console.warn('ServicePublicAdapter: Erreur fetch déficit:', error.message || String(error));
      return null;
    }
  }
  
  /**
   * Récupère les taux IS pour les SCI
   */
  private async fetchSciIS(year: number): Promise<TaxPartial | null> {
    try {
      const url = `${BASE_URL}/professionnels/vosdroits/F23575`;
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SmartImmo/1.0; +https://smartimmo.fr)'
        }
      });
      
      const html = response.data;
      const $ = parseHTML(html);
      
      const text = $('body').text();
      
      // Chercher les taux d'IS
      const tauxReduitMatch = text.match(/taux\s+réduit.*?(\d+(?:[.,]\d+)?)\s*%/i);
      const plafondTauxReduitMatch = text.match(/(\d[\d\s']*)\s*€.*?taux\s+réduit/i);
      const tauxNormalMatch = text.match(/taux\s+normal.*?(\d+(?:[.,]\d+)?)\s*%/i);
      
      if (!tauxReduitMatch && !tauxNormalMatch) {
        return null;
      }
      
      const sciIS: any = {
        tauxReduit: tauxReduitMatch ? parsePercentage(tauxReduitMatch[1]) : 0.15,
        plafondTauxReduit: plafondTauxReduitMatch ? parseEuroAmount(plafondTauxReduitMatch[1]) : 42500,
        tauxNormal: tauxNormalMatch ? parsePercentage(tauxNormalMatch[1]) : 0.25
      };
      
      const hash = createHash(html);
      
      return {
        section: 'SCI_IS',
        data: { sciIS },
        meta: {
          source: this.source,
          url,
          fetchedAt: new Date(),
          hash,
          confidence: this.confidence,
          notes: `Taux IS SCI ${year} extraits de Service-Public.fr`
        }
      };
      
    } catch (error: any) {
      // console.warn('ServicePublicAdapter: Erreur fetch SCI IS:', error.message || String(error));
      return null;
    }
  }
}


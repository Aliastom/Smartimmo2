/**
 * Adapter pour scraper les données fiscales depuis Legifrance
 * 
 * Confiance: MEDIUM - Source officielle juridique, utilisée pour cross-check
 * Optionnel - utilisé uniquement pour vérifier en cas de divergence
 */

import axios from 'axios';
import { TaxPartial, TaxSource, ConfidenceLevel } from '../types';
import { 
  parseHTML, 
  parseEuroAmount,
  parsePercentage,
  cleanText 
} from '../parsers/html';
import { createHash } from '../utils';

const BASE_URL = 'https://www.legifrance.gouv.fr';

export class LegifranceAdapter {
  private readonly source: TaxSource = 'LEGIFRANCE';
  private readonly confidence: ConfidenceLevel = 'medium';
  
  /**
   * Récupère les données fiscales pour une année donnée
   * Note: Legifrance est principalement utilisé pour le cross-check
   */
  async fetchPartials(year: number): Promise<TaxPartial[]> {
    const partials: TaxPartial[] = [];
    
    try {
      // Récupérer le barème IR depuis le CGI
      const irPartial = await this.fetchIRFromCGI(year);
      if (irPartial) partials.push(irPartial);
      
      // Récupérer les taux PS
      const psPartial = await this.fetchPSFromCGI(year);
      if (psPartial) partials.push(psPartial);
      
    } catch (error: any) {
      // Erreur 403 = Cloudflare bloque (normal), log court
      if (error?.response?.status === 403) {
        // console.warn('LegifranceAdapter: Bloqué par Cloudflare (403) - ignoré');
      } else {
        // console.error('LegifranceAdapter: Erreur lors du fetch:', error.message);
      }
      // Ne pas throw, Legifrance est optionnel
    }
    
    return partials;
  }
  
  /**
   * Récupère le barème IR depuis le Code Général des Impôts
   */
  private async fetchIRFromCGI(year: number): Promise<TaxPartial | null> {
    try {
      // Article 197 du CGI (barème de l'IR)
      const url = `${BASE_URL}/codes/article_lc/LEGIARTI000048984013`;
      
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SmartImmo/1.0; +https://smartimmo.fr)'
        }
      });
      
      const html = response.data;
      const $ = parseHTML(html);
      
      // Legifrance a une structure complexe, on cherche dans le texte
      const text = $('.article-content, .article-text').text();
      
      if (!text) {
        // console.warn('LegifranceAdapter: Contenu article non trouvé');
        return null;
      }
      
      // Parser le barème depuis le texte juridique
      // Le barème est généralement décrit en toutes lettres
      const brackets = this.parseIRBracketsFromLegalText(text);
      
      if (brackets.length === 0) {
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
          notes: `Barème IR ${year} extrait du CGI (Legifrance)`
        }
      };
      
    } catch (error: any) {
      // Log court pour 403 (Cloudflare)
      if (error?.response?.status === 403) {
        // console.warn('LegifranceAdapter: IR bloqué par Cloudflare (403)');
      } else {
        // console.error('LegifranceAdapter: Erreur fetch IR:', error.message);
      }
      return null;
    }
  }
  
  /**
   * Récupère les taux PS depuis le CSS
   */
  private async fetchPSFromCGI(year: number): Promise<TaxPartial | null> {
    try {
      // Articles du Code de la Sécurité Sociale
      const url = `${BASE_URL}/codes/section_lc/LEGISCTA000006173390`;
      
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SmartImmo/1.0; +https://smartimmo.fr)'
        }
      });
      
      const html = response.data;
      const $ = parseHTML(html);
      
      const text = $('.article-content, .article-text').text();
      
      // Chercher le taux global des PS
      const psMatch = text.match(/(\d+(?:[.,]\d+)?)\s*%/i);
      
      if (!psMatch) {
        return null;
      }
      
      const psRate = parsePercentage(psMatch[1]);
      
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
          notes: `Taux PS ${year} extrait du CSS (Legifrance)`
        }
      };
      
    } catch (error: any) {
      // Log court pour 403 (Cloudflare)
      if (error?.response?.status === 403) {
        // console.warn('LegifranceAdapter: PS bloqué par Cloudflare (403)');
      } else {
        // console.error('LegifranceAdapter: Erreur fetch PS:', error.message);
      }
      return null;
    }
  }
  
  /**
   * Parse le barème IR depuis un texte juridique
   */
  private parseIRBracketsFromLegalText(text: string): Array<{
    lower: number;
    upper: number | null;
    rate: number;
  }> {
    const brackets: Array<{ lower: number; upper: number | null; rate: number }> = [];
    
    // Patterns pour détecter les tranches
    // Ex: "N'excédant pas 11 294 euros : 0 %"
    // Ex: "Supérieure à 11 294 euros et inférieure ou égale à 28 797 euros : 11 %"
    
    const lines = text.split('\n');
    
    for (const line of lines) {
      // Pattern pour une tranche avec limite supérieure
      const rangeMatch = line.match(/(\d[\d\s']*)\s*euros?\s*et.*?(\d[\d\s']*)\s*euros?.*?:\s*(\d+(?:[.,]\d+)?)\s*%/i);
      
      if (rangeMatch) {
        const lower = parseEuroAmount(rangeMatch[1]);
        const upper = parseEuroAmount(rangeMatch[2]);
        const rate = parsePercentage(rangeMatch[3]);
        
        if (lower !== null && rate !== null) {
          brackets.push({ lower, upper, rate });
          continue;
        }
      }
      
      // Pattern pour une tranche sans limite supérieure
      const openMatch = line.match(/supérieure?\s+à\s+(\d[\d\s']*)\s*euros?.*?:\s*(\d+(?:[.,]\d+)?)\s*%/i);
      
      if (openMatch) {
        const lower = parseEuroAmount(openMatch[1]);
        const rate = parsePercentage(openMatch[2]);
        
        if (lower !== null && rate !== null) {
          brackets.push({ lower, upper: null, rate });
          continue;
        }
      }
      
      // Pattern pour la première tranche (0 à X : 0%)
      const firstMatch = line.match(/n'excédant\s+pas\s+(\d[\d\s']*)\s*euros?.*?:\s*(\d+(?:[.,]\d+)?)\s*%/i);
      
      if (firstMatch) {
        const upper = parseEuroAmount(firstMatch[1]);
        const rate = parsePercentage(firstMatch[2]);
        
        if (upper !== null && rate !== null) {
          brackets.push({ lower: 0, upper, rate });
          continue;
        }
      }
    }
    
    return brackets;
  }
}


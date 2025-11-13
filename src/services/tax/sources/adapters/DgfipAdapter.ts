/**
 * Adapter pour scraper les données fiscales depuis la DGFiP
 * (Direction Générale des Finances Publiques / impots.gouv.fr)
 * 
 * Confiance: MEDIUM - Source officielle mais structure variable (HTML + PDF)
 */

import axios from 'axios';
import { TaxPartial, TaxSource, ConfidenceLevel } from '../types';
import { 
  parseHTML, 
  extractTable,
  parseEuroAmount,
  parsePercentage,
  cleanText 
} from '../parsers/html';
import { 
  parsePDF,
  extractIRBracketsFromPDF,
  extractDecoteFromPDF,
  extractPSRateFromPDF,
  extractMicroFromPDF
} from '../parsers/pdf';
import { createHash } from '../utils';
import { loadSourcesConfig } from '../configLoader';

export class DgfipAdapter {
  private readonly source: TaxSource = 'DGFIP';
  private readonly confidence: ConfidenceLevel = 'medium';
  private baseUrl: string = 'https://www.impots.gouv.fr';
  private urls: Record<string, string> = {};
  
  /**
   * Charge la configuration depuis la BDD
   */
  private async loadConfig(): Promise<void> {
    try {
      const config = await loadSourcesConfig();
      const dgfipConfig = config.DGFIP;
      
      if (dgfipConfig) {
        this.baseUrl = dgfipConfig.baseUrl;
        
        if (dgfipConfig.urls) {
          for (const urlConfig of dgfipConfig.urls) {
            if (urlConfig.section === 'MICRO') {
              this.urls.MICRO = urlConfig.path;
            }
          }
        }
      }
      
      console.log(`[DgfipAdapter] Config chargée depuis BDD: ${Object.keys(this.urls).length} URL(s)`);
    } catch (error) {
      console.error('[DgfipAdapter] Erreur chargement config, fallback valeurs par défaut');
      this.baseUrl = 'https://www.impots.gouv.fr';
      this.urls = {
        MICRO: '/particulier/questions/je-mets-en-location-un-logement-vide-comment-declarer-les-loyers-percus'
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
      // Essayer de récupérer depuis les dossiers pratiques HTML
      const htmlPartials = await this.fetchFromHTML(year);
      partials.push(...htmlPartials);
      
      // Essayer de récupérer depuis les brochures PDF
      const pdfPartials = await this.fetchFromPDF(year);
      partials.push(...pdfPartials);
      
    } catch (error) {
      // console.error('DgfipAdapter: Erreur lors du fetch:', error);
      throw error;
    }
    
    return partials;
  }
  
  /**
   * Récupère depuis les pages HTML de la DGFiP
   */
  private async fetchFromHTML(year: number): Promise<TaxPartial[]> {
    const partials: TaxPartial[] = [];
    
    try {
      // Page principale sur l'impôt sur le revenu
      const url = `${this.baseUrl}/portail/particulier/questions/comment-sont-imposes-mes-revenus`;
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SmartImmo/1.0; +https://smartimmo.fr)'
        }
      });
      
      const html = response.data;
      const $ = parseHTML(html);
      
      // Chercher les tableaux de barème
      const tables = $('table');
      
      tables.each((_, table) => {
        const tableData = extractTable($, $(table).get(0) as any);
        
        // Détecter si c'est un tableau de barème IR
        if (this.isIRBracketTable(tableData)) {
          const brackets = this.parseIRBracketsFromTable(tableData);
          
          if (brackets.length > 0) {
            const hash = createHash(html);
            
            partials.push({
              section: 'IR',
              data: { irBrackets: brackets },
              meta: {
                source: this.source,
                url,
                fetchedAt: new Date(),
                hash,
                confidence: this.confidence,
                notes: `Barème IR ${year} extrait de impots.gouv.fr`
              }
            });
          }
        }
      });
      
      // Chercher les informations sur les prélèvements sociaux
      const text = $('body').text();
      const psMatch = text.match(/prélèvements\s+sociaux[^\d]*(\d+(?:[.,]\d+)?)\s*%/i);
      
      if (psMatch) {
        const psRate = parsePercentage(psMatch[1]);
        if (psRate !== null) {
          const hash = createHash(html);
          
          partials.push({
            section: 'PS',
            data: { psRate },
            meta: {
              source: this.source,
              url,
              fetchedAt: new Date(),
              hash,
              confidence: this.confidence,
              notes: `Taux PS ${year} extrait de impots.gouv.fr`
            }
          });
        }
      }
      
    } catch (error) {
      // console.error('DgfipAdapter: Erreur fetch HTML:', error);
    }
    
    return partials;
  }
  
  /**
   * Récupère depuis les brochures PDF
   * 
   * Note: Temporairement désactivé car pdf-parse incompatible avec Next.js
   * Les sources HTML suffisent pour l'instant
   */
  private async fetchFromPDF(year: number): Promise<TaxPartial[]> {
    const partials: TaxPartial[] = [];
    
    // TODO: Réactiver quand une solution compatible Next.js sera trouvée
    // console.log('[DgfipAdapter] Parsing PDF désactivé temporairement');
    return partials;
    
    /* DÉSACTIVÉ TEMPORAIREMENT
    try {
      // URL de la brochure pratique (à ajuster selon l'année)
      const url = `${this.baseUrl}/portail/files/formulaires/0/fiche-pratique-ir-${year}.pdf`;
      
      const response = await axios.get(url, {
        timeout: 20000,
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SmartImmo/1.0; +https://smartimmo.fr)'
        }
      });
      
      const buffer = Buffer.from(response.data);
      const text = await parsePDF(buffer);
      
      const hash = createHash(buffer.toString('base64'));
      
      // Extraire le barème IR
      const irBrackets = extractIRBracketsFromPDF(text);
      if (irBrackets) {
        partials.push({
          section: 'IR',
          data: { irBrackets },
          meta: {
            source: this.source,
            url,
            fetchedAt: new Date(),
            hash,
            confidence: this.confidence,
            notes: `Barème IR ${year} extrait du PDF DGFiP`
          }
        });
      }
      
      // Extraire la décote
      const decote = extractDecoteFromPDF(text);
      if (decote) {
        partials.push({
          section: 'IR_DECOTE',
          data: { irDecote: decote },
          meta: {
            source: this.source,
            url,
            fetchedAt: new Date(),
            hash,
            confidence: this.confidence,
            notes: `Décote IR ${year} extraite du PDF DGFiP`
          }
        });
      }
      
      // Extraire le taux PS
      const psRate = extractPSRateFromPDF(text);
      if (psRate !== null) {
        partials.push({
          section: 'PS',
          data: { psRate },
          meta: {
            source: this.source,
            url,
            fetchedAt: new Date(),
            hash,
            confidence: this.confidence,
            notes: `Taux PS ${year} extrait du PDF DGFiP`
          }
        });
      }
      
      // Extraire les régimes micro
      const micro = extractMicroFromPDF(text);
      if (micro) {
        partials.push({
          section: 'MICRO',
          data: { micro },
          meta: {
            source: this.source,
            url,
            fetchedAt: new Date(),
            hash,
            confidence: this.confidence,
            notes: `Régimes micro ${year} extraits du PDF DGFiP`
          }
        });
      }
      
    } catch (error) {
      // console.error('DgfipAdapter: Erreur fetch PDF:', error);
      // Ne pas throw, le PDF peut ne pas être disponible
    }
    */
    
    // return partials;
  }
  
  /**
   * Détecte si un tableau est un barème IR
   */
  private isIRBracketTable(table: string[][]): boolean {
    if (table.length < 2) return false;
    
    const header = table[0].join(' ').toLowerCase();
    
    return (
      header.includes('tranche') ||
      header.includes('revenu') ||
      header.includes('taux')
    ) && (
      header.includes('%') ||
      table.some(row => row.some(cell => cell.includes('%')))
    );
  }
  
  /**
   * Parse un barème IR depuis un tableau
   */
  private parseIRBracketsFromTable(table: string[][]): Array<{
    lower: number;
    upper: number | null;
    rate: number;
  }> {
    const brackets: Array<{ lower: number; upper: number | null; rate: number }> = [];
    
    // Ignorer la ligne d'en-tête
    for (let i = 1; i < table.length; i++) {
      const row = table[i];
      
      if (row.length < 2) continue;
      
      // Extraire les montants de la première colonne
      const amountPattern = /\d[\d\s']*\d|\d/g;
      const amounts = row[0].match(amountPattern);
      
      if (!amounts || amounts.length === 0) continue;
      
      const lower = parseEuroAmount(amounts[0]);
      if (lower === null) continue;
      
      const upper = amounts.length > 1 ? parseEuroAmount(amounts[1]) : null;
      
      // Extraire le taux (dernière colonne généralement)
      const rateText = row[row.length - 1];
      const rate = parsePercentage(rateText);
      
      if (rate !== null) {
        brackets.push({ lower, upper, rate });
      }
    }
    
    return brackets;
  }
}


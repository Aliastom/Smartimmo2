import { PrismaClient } from '@prisma/client';

interface ExtractionResult {
  fieldName: string;
  value: string | number | Date;
  confidence: number;
  ruleId: string;
  rulePattern: string;
  postProcess?: string;
}

interface ExtractionCache {
  data: any;
  timestamp: number;
  version: string;
}

class ExtractionBDDService {
  private prisma: PrismaClient;
  private cache: Map<string, ExtractionCache> = new Map();
  private cacheVersion: string | null = null;
  private readonly CACHE_TTL = 60000; // 60 secondes

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Extrait les champs d'un document en utilisant la configuration BDD
   */
  async extractFields(text: string, documentTypeId: string, documentId?: string): Promise<ExtractionResult[]> {
    try {
      // Récupérer les règles d'extraction depuis la BDD (avec cache)
      const extractionRules = await this.getExtractionRules(documentTypeId);
      
      if (!extractionRules.length) {
        return [];
      }

      const results: ExtractionResult[] = [];

      for (const rule of extractionRules) {
        try {
          const regex = new RegExp(rule.pattern, 'gi');
          const matches = text.match(regex);
          
          if (matches && matches.length > 0) {
            for (const match of matches) {
              let processedValue = this.postProcessValue(match, rule.postProcess);
              
              // Calculer la confiance basée sur la précision du match
              const confidence = this.calculateConfidence(match, rule.pattern, rule.postProcess);
              
              results.push({
                fieldName: rule.fieldName,
                value: processedValue,
                confidence,
                ruleId: rule.id,
                rulePattern: rule.pattern,
                postProcess: rule.postProcess,
              });
            }
          }
        } catch (regexError) {
          console.error(`Error processing regex for rule ${rule.id}:`, regexError);
          continue;
        }
      }

      // Retourner les résultats triés par priorité et confiance
      return results.sort((a, b) => {
        // Trier par nom de champ, puis par confiance décroissante
        if (a.fieldName !== b.fieldName) {
          return a.fieldName.localeCompare(b.fieldName);
        }
        return b.confidence - a.confidence;
      });

    } catch (error) {
      console.error('Error in field extraction:', error);
      throw new Error('Erreur lors de l\'extraction des champs');
    }
  }

  /**
   * Récupère les règles d'extraction pour un type de document (avec cache)
   */
  private async getExtractionRules(documentTypeId: string): Promise<any[]> {
    const cacheKey = `extraction_rules_${documentTypeId}`;
    const cached = this.cache.get(cacheKey);
    
    // Vérifier la version du cache
    const currentVersion = await this.getConfigVersion();
    
    if (cached && 
        cached.version === currentVersion && 
        Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    // Recharger depuis la BDD
    const rules = await this.prisma.documentExtractionRule.findMany({
      where: { documentTypeId },
      orderBy: { priority: 'asc' },
    });
    
    // Mettre en cache
    this.cache.set(cacheKey, {
      data: rules,
      timestamp: Date.now(),
      version: currentVersion || '',
    });

    return rules;
  }

  /**
   * Obtient la version actuelle de la configuration
   */
  private async getConfigVersion(): Promise<string | null> {
    try {
      const config = await this.prisma.appConfig.findUnique({
        where: { key: 'document_config_version' },
      });
      return config?.value || null;
    } catch (error) {
      console.error('Error getting config version:', error);
      return null;
    }
  }

  /**
   * Post-traite une valeur selon le type spécifié
   */
  private postProcessValue(value: string, postProcess?: string): string | number | Date {
    if (!postProcess) {
      return value;
    }

    try {
      switch (postProcess) {
        case 'fr_date':
          return this.parseFrenchDate(value);
        case 'money_eur':
          return this.parseMoney(value);
        case 'iban':
          return value.replace(/\s/g, '').toUpperCase();
        case 'siren':
          return value.replace(/\D/g, '');
        case 'siret':
          return value.replace(/\D/g, '');
        case 'address':
          return this.cleanAddress(value);
        case 'phone':
          return this.cleanPhone(value);
        case 'email':
          return value.toLowerCase().trim();
        default:
          return value.trim();
      }
    } catch (error) {
      console.error(`Error post-processing value "${value}" with type "${postProcess}":`, error);
      return value;
    }
  }

  /**
   * Parse une date française
   */
  private parseFrenchDate(dateStr: string): Date | string {
    try {
      // Formats supportés: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
      const cleaned = dateStr.replace(/[^\d\/\-\.]/g, '');
      const parts = cleaned.split(/[\/\-\.]/);
      
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // JavaScript months are 0-based
        const year = parseInt(parts[2]);
        
        // Gérer les années sur 2 chiffres
        const fullYear = year < 100 ? (year < 50 ? 2000 + year : 1900 + year) : year;
        
        const date = new Date(fullYear, month, day);
        
        // Vérifier que la date est valide
        if (date.getFullYear() === fullYear && 
            date.getMonth() === month && 
            date.getDate() === day) {
          return date;
        }
      }
      
      return dateStr;
    } catch (error) {
      return dateStr;
    }
  }

  /**
   * Parse un montant d'argent
   */
  private parseMoney(moneyStr: string): number {
    try {
      // Nettoyer la chaîne: enlever tout sauf chiffres, virgules et points
      const cleaned = moneyStr.replace(/[^\d,\.]/g, '');
      
      // Détecter le séparateur décimal (le dernier point ou virgule)
      const lastDot = cleaned.lastIndexOf('.');
      const lastComma = cleaned.lastIndexOf(',');
      
      let result: number;
      
      if (lastDot > lastComma) {
        // Point comme séparateur décimal
        const integerPart = cleaned.substring(0, lastDot).replace(/[^\d]/g, '');
        const decimalPart = cleaned.substring(lastDot + 1);
        result = parseFloat(integerPart + '.' + decimalPart);
      } else if (lastComma > lastDot) {
        // Virgule comme séparateur décimal
        const integerPart = cleaned.substring(0, lastComma).replace(/[^\d]/g, '');
        const decimalPart = cleaned.substring(lastComma + 1);
        result = parseFloat(integerPart + '.' + decimalPart);
      } else {
        // Pas de séparateur décimal
        result = parseFloat(cleaned.replace(/[^\d]/g, ''));
      }
      
      return isNaN(result) ? 0 : result;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Nettoie une adresse
   */
  private cleanAddress(address: string): string {
    return address
      .replace(/\s+/g, ' ') // Normaliser les espaces
      .replace(/[^\w\s\-\'\.]/g, '') // Enlever les caractères spéciaux
      .trim();
  }

  /**
   * Nettoie un numéro de téléphone
   */
  private cleanPhone(phone: string): string {
    return phone
      .replace(/[^\d\+\s\-\(\)]/g, '') // Garder seulement chiffres, +, espaces, tirets, parenthèses
      .trim();
  }

  /**
   * Calcule la confiance d'un match
   */
  private calculateConfidence(match: string, pattern: string, postProcess?: string): number {
    let confidence = 0.5; // Base confidence

    // Ajuster selon la longueur du match (plus long = plus de confiance)
    if (match.length > 10) confidence += 0.2;
    if (match.length > 20) confidence += 0.1;

    // Ajuster selon le post-processing
    if (postProcess) {
      switch (postProcess) {
        case 'fr_date':
          // Vérifier que c'est une date valide
          const date = this.parseFrenchDate(match);
          if (date instanceof Date) confidence += 0.3;
          break;
        case 'money_eur':
          // Vérifier que c'est un montant valide
          const money = this.parseMoney(match);
          if (money > 0) confidence += 0.2;
          break;
        case 'iban':
          // Vérifier le format IBAN
          if (/^FR\d{12,32}$/i.test(match.replace(/\s/g, ''))) confidence += 0.3;
          break;
        case 'siren':
          // Vérifier le format SIREN
          if (/^\d{9}$/.test(match.replace(/\D/g, ''))) confidence += 0.3;
          break;
        case 'siret':
          // Vérifier le format SIRET
          if (/^\d{14}$/.test(match.replace(/\D/g, ''))) confidence += 0.3;
          break;
      }
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Invalide le cache d'extraction
   */
  async invalidateCache(): Promise<void> {
    this.cache.clear();
    this.cacheVersion = null;
  }

  /**
   * Ferme la connexion Prisma
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// Instance singleton
export const extractionBDDService = new ExtractionBDDService();

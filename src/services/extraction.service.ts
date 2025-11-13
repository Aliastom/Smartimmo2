import { PrismaClient } from '@prisma/client';
import { ExtractionResult, FieldDataTypeType, PostProcessTypeType } from '@/types/documents';
import { extractionBDDService } from './extraction-bdd.service';
import { prisma } from '@/lib/prisma';

/**
 * Service d'extraction de champs depuis le texte OCR
 * Utilise des rÃ¨gles regex + post-processing
 */



export class ExtractionService {
  /**
   * Patterns regex prÃ©dÃ©finis
   */
  private readonly patterns = {
    // Date franÃ§aise: 01/12/2024, 1-12-2024, 01 12 2024
    fr_date: /(?:(?:[0-2]?[0-9]|3[01])[\-\/\s](?:0?[0-9]|1[0-2])[\-\/\s](?:19|20)\d{2})/g,
    
    // Mois/AnnÃ©e: janvier 2024, janv. 2025
    month_year_fr: /(?:janvier|fÃ©vrier|fevrier|mars|avril|mai|juin|juillet|aoÃ»t|aout|septembre|octobre|novembre|dÃ©cembre|decembre|janv\.?|fÃ©vr\.?|fevr\.?|mars|avr\.?|mai|juin|juil\.?|aoÃ»t|aout|sept\.?|oct\.?|nov\.?|dÃ©c\.?|dec\.?)[\s\-]+(?:19|20)\d{2}/gi,
    
    // Montant en euros: 1 234,56â‚¬ ou 1234.56 â‚¬ ou 1234â‚¬
    money_eur: /(?:(?:\d{1,3}(?:[\s\u00A0]\d{3})+|\d+)(?:[.,]\d{2})?)[\s]?â‚¬/g,
    
    // IBAN franÃ§ais
    iban: /FR\d{2}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{2,3}/gi,
    
    // SIREN (9 chiffres)
    siren: /\b\d{3}[\s]?\d{3}[\s]?\d{3}\b/g,
    
    // SIRET (14 chiffres)
    siret: /\b\d{3}[\s]?\d{3}[\s]?\d{3}[\s]?\d{5}\b/g,
    
    // Email
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    
    // TÃ©lÃ©phone franÃ§ais
    phone: /(?:(?:\+33|0)[1-9](?:[\s.-]?\d{2}){4})/g,
    
    // Code postal franÃ§ais
    postal_code: /\b\d{5}\b/g,
  };

  /**
   * Mois franÃ§ais vers numÃ©ro
   */
  private readonly monthsMap: Record<string, number> = {
    'janvier': 1, 'janv': 1,
    'fÃ©vrier': 2, 'fevrier': 2, 'fÃ©vr': 2, 'fevr': 2,
    'mars': 3,
    'avril': 4, 'avr': 4,
    'mai': 5,
    'juin': 6,
    'juillet': 7, 'juil': 7,
    'aoÃ»t': 8, 'aout': 8,
    'septembre': 9, 'sept': 9,
    'octobre': 10, 'oct': 10,
    'novembre': 11, 'nov': 11,
    'dÃ©cembre': 12, 'decembre': 12, 'dÃ©c': 12, 'dec': 12,
  };

  /**
   * Post-process une valeur selon le type
   */
  private postProcess(
    value: string,
    postProcessType: PostProcessTypeType
  ): { text?: string; num?: number; date?: Date } {
    const result: { text?: string; num?: number; date?: Date } = {};

    switch (postProcessType) {
      case 'fr_date':
        result.date = this.parseFrenchDate(value);
        result.text = value;
        break;

      case 'money_eur':
        result.num = this.parseMoneyEur(value);
        result.text = value;
        break;

      case 'iban':
        result.text = value.replace(/\s/g, '').toUpperCase();
        break;

      case 'siren':
      case 'siret':
        result.text = value.replace(/\s/g, '');
        result.num = parseFloat(result.text);
        break;

      case 'email':
      case 'phone':
      case 'address':
        result.text = value.trim();
        break;

      default:
        result.text = value.trim();
    }

    return result;
  }

  /**
   * Parse une date franÃ§aise (DD/MM/YYYY ou DD-MM-YYYY)
   */
  private parseFrenchDate(dateStr: string): Date | undefined {
    const cleaned = dateStr.replace(/[\s]/g, '');
    const parts = cleaned.split(/[\-\/]/);

    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);

      if (day > 0 && day <= 31 && month > 0 && month <= 12 && year > 1900) {
        return new Date(year, month - 1, day);
      }
    }

    return undefined;
  }

  /**
   * Parse un mois/annÃ©e franÃ§ais (ex: "janvier 2024")
   */
  private parseMonthYear(text: string): { month: number; year: number } | undefined {
    const match = text.match(/(\w+)[\s\-]+(\d{4})/i);
    if (match) {
      const monthStr = match[1].toLowerCase().replace('.', '');
      const year = parseInt(match[2], 10);
      const month = this.monthsMap[monthStr];

      if (month && year) {
        return { month, year };
      }
    }

    return undefined;
  }

  /**
   * Parse un montant en euros
   */
  private parseMoneyEur(moneyStr: string): number | undefined {
    // Enlever le symbole â‚¬ et les espaces
    let cleaned = moneyStr.replace(/â‚¬/g, '').replace(/[\s\u00A0]/g, '');
    
    // Remplacer la virgule par un point
    cleaned = cleaned.replace(',', '.');

    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
  }

  /**
   * Extrait un champ selon une rÃ¨gle
   */
  private extractField(
    text: string,
    rule: {
      pattern: string;
      postProcess?: string | null;
      priority: number;
    }
  ): { value: string; confidence: number } | null {
    try {
      const regex = new RegExp(rule.pattern, 'gi');
      const matches = Array.from(text.matchAll(regex));

      if (matches.length === 0) {
        return null;
      }

      // Prendre la premiÃ¨re occurrence (on pourrait amÃ©liorer avec la position)
      const match = matches[0];
      const value = match[0] || match[1] || '';

      // Calculer la confiance (simple pour l'instant)
      let confidence = 0.7;
      if (matches.length === 1) {
        confidence = 0.9; // Une seule occurrence = plus confiant
      } else if (matches.length > 5) {
        confidence = 0.5; // Trop d'occurrences = moins confiant
      }

      return { value, confidence };
    } catch (error) {
      console.error('Error extracting field with regex:', rule.pattern, error);
      return null;
    }
  }

  /**
   * Extrait tous les champs pour un type de document en utilisant la BDD
   */
  async extractFields(
    documentId: string,
    documentTypeId: string,
    text: string
  ): Promise<ExtractionResult> {
    try {
      // Utiliser le service BDD pour l'extraction
      const bddResults = await extractionBDDService.extractFields(text, documentTypeId, documentId);
      
      // Convertir les rÃ©sultats BDD vers le format attendu
      const fields: ExtractionResult['fields'] = bddResults.map(result => {
        const field: any = {
          fieldName: result.fieldName,
          confidence: result.confidence,
          sourceRuleId: result.ruleId,
        };

        // DÃ©terminer le type de valeur et l'assigner
        if (typeof result.value === 'number') {
          field.valueNum = result.value;
          field.valueText = result.value.toString();
        } else if (result.value instanceof Date) {
          field.valueDate = result.value;
          field.valueText = result.value.toISOString();
        } else {
          field.valueText = result.value;
        }

        return field;
      });

      return {
        fields,
        metadata: {
          rulesApplied: bddResults.length,
          fieldsExtracted: fields.length,
          source: 'BDD',
        },
      };
    } catch (error) {
      console.error('Error in BDD extraction, falling back to legacy:', error);
      
      // Fallback vers l'ancienne mÃ©thode
      return this.fallbackExtractFields(documentId, documentTypeId, text);
    }
  }

  /**
   * MÃ©thode de fallback vers l'ancienne extraction
   */
  private async fallbackExtractFields(
    documentId: string,
    documentTypeId: string,
    text: string
  ): Promise<ExtractionResult> {
    // RÃ©cupÃ©rer les rÃ¨gles d'extraction pour ce type
    const rules = await prisma.documentExtractionRule.findMany({
      where: { documentTypeId },
      orderBy: { priority: 'asc' },
    });

    const fields: ExtractionResult['fields'] = [];

    for (const rule of rules) {
      const extracted = this.extractField(text, rule);

      if (extracted) {
        const processed = rule.postProcess
          ? this.postProcess(extracted.value, rule.postProcess as PostProcessTypeType)
          : { text: extracted.value };

        fields.push({
          fieldName: rule.fieldName,
          valueText: processed.text,
          valueNum: processed.num,
          valueDate: processed.date,
          confidence: extracted.confidence,
          sourceRuleId: rule.id,
        });
      }
    }

    // Extractions gÃ©nÃ©riques supplÃ©mentaires
    const genericFields = this.extractGenericFields(text);
    fields.push(...genericFields);

    return {
      fields,
      metadata: {
        rulesApplied: rules.length,
        fieldsExtracted: fields.length,
        source: 'fallback',
      },
    };
  }

  /**
   * Extrait des champs gÃ©nÃ©riques (IBAN, SIREN, dates, montants, etc.)
   */
  private extractGenericFields(text: string): ExtractionResult['fields'] {
    const fields: ExtractionResult['fields'] = [];

    // IBAN
    const ibanMatches = Array.from(text.matchAll(this.patterns.iban));
    if (ibanMatches.length > 0) {
      const iban = ibanMatches[0][0].replace(/\s/g, '').toUpperCase();
      fields.push({
        fieldName: 'iban_detected',
        valueText: iban,
        confidence: 0.95,
      });
    }

    // SIREN
    const sirenMatches = Array.from(text.matchAll(this.patterns.siren));
    if (sirenMatches.length > 0) {
      const siren = sirenMatches[0][0].replace(/\s/g, '');
      fields.push({
        fieldName: 'siren_detected',
        valueText: siren,
        confidence: 0.85,
      });
    }

    // Email
    const emailMatches = Array.from(text.matchAll(this.patterns.email));
    if (emailMatches.length > 0) {
      fields.push({
        fieldName: 'email_detected',
        valueText: emailMatches[0][0],
        confidence: 0.9,
      });
    }

    // TÃ©lÃ©phone
    const phoneMatches = Array.from(text.matchAll(this.patterns.phone));
    if (phoneMatches.length > 0) {
      fields.push({
        fieldName: 'phone_detected',
        valueText: phoneMatches[0][0],
        confidence: 0.85,
      });
    }

    return fields;
  }

  /**
   * Sauvegarde les champs extraits en base
   */
  async saveExtractedFields(
    documentId: string,
    fields: ExtractionResult['fields']
  ): Promise<void> {
    // Supprimer les anciens champs
    await prisma.documentField.deleteMany({
      where: { documentId },
    });

    // CrÃ©er les nouveaux champs
    for (const field of fields) {
      await prisma.documentField.create({
        data: {
          documentId,
          fieldName: field.fieldName,
          valueText: field.valueText,
          valueNum: field.valueNum,
          valueDate: field.valueDate,
          confidence: field.confidence,
          sourceRuleId: field.sourceRuleId,
        },
      });
    }
  }

  /**
   * Re-extrait les champs d'un document
   */
  async reextract(documentId: string): Promise<ExtractionResult> {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        textIndex: true,
      },
    });

    if (!document || !document.documentTypeId) {
      throw new Error(`Document ${documentId} not found or not classified`);
    }

    // ConcatÃ©ner le texte
    const fullText = document.textIndex
      .sort((a, b) => a.page - b.page)
      .map(ti => ti.content)
      .join('\n\n');

    const result = await this.extractFields(documentId, document.documentTypeId, fullText);
    await this.saveExtractedFields(documentId, result.DocumentField);

    return result;
  }

  /**
   * Extrait des champs spÃ©cifiques par type de document
   */
  extractSpecificFields(
    documentType: string,
    fields: ExtractionResult['fields']
  ): Record<string, any> {
    const result: Record<string, any> = {};

    switch (documentType) {
      case 'QUITTANCE':
        // Extraire mois/annÃ©e
        const periodField = fields.find(f => f.fieldName === 'period_month' || f.fieldName.includes('period'));
        if (periodField && periodField.valueText) {
          const parsed = this.parseMonthYear(periodField.valueText);
          if (parsed) {
            result.period_month = parsed.month;
            result.period_year = parsed.year;
          }
        }

        // Montant
        const amountField = fields.find(f => f.fieldName === 'amount_paid' || f.fieldName.includes('amount'));
        if (amountField) {
          result.amount_paid = amountField.valueNum;
        }
        break;

      case 'ATTESTATION_ASSURANCE':
        // Date d'expiration
        const expiryField = fields.find(f => f.fieldName === 'expiry_date' || f.fieldName.includes('expiry'));
        if (expiryField) {
          result.expiry_date = expiryField.valueDate;
        }
        break;

      case 'TAXE_FONCIERE':
        // AnnÃ©e
        const yearField = fields.find(f => f.fieldName === 'year' || f.fieldName.includes('year'));
        if (yearField) {
          result.year = yearField.valueNum;
        }

        // Montant total
        const totalField = fields.find(f => f.fieldName === 'amount_total' || f.fieldName.includes('total'));
        if (totalField) {
          result.amount_total = totalField.valueNum;
        }
        break;

      case 'DPE':
        // Grade (A-G)
        const gradeField = fields.find(f => f.fieldName === 'grade' || f.fieldName.includes('grade'));
        if (gradeField) {
          result.grade = gradeField.valueText;
        }

        // Date de validitÃ©
        const validField = fields.find(f => f.fieldName === 'valid_until' || f.fieldName.includes('valid'));
        if (validField) {
          result.valid_until = validField.valueDate;
        }
        break;
    }

    return result;
  }
  /**
   * Invalide le cache d'extraction
   */
  async invalidateCache(): Promise<void> {
    await extractionBDDService.invalidateCache();
  }

  /**
   * Ferme la connexion Prisma
   */
  async disconnect(): Promise<void> {
    await prisma.$disconnect();
    await extractionBDDService.disconnect();
  }
}

// Instance singleton
let extractionServiceInstance: ExtractionService | null = null;

export function getExtractionService(): ExtractionService {
  if (!extractionServiceInstance) {
    extractionServiceInstance = new ExtractionService();
  }
  return extractionServiceInstance;
}

export default ExtractionService;


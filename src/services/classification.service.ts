import { PrismaClient } from '@prisma/client';
import { ClassificationResult, ClassificationScore } from '@/types/documents';
import { classificationBDDService } from './classification-bdd.service';
import { prisma } from '@/lib/prisma';

/**
 * Service de classification automatique de documents
 * Utilise maintenant la configuration BDD via classificationBDDService
 */



interface ClassificationSignals {
  hasIban: boolean;
  hasSiren: boolean;
  hasSiret: boolean;
  hasDateRange: boolean;
  hasAmount: boolean;
  hasAddress: boolean;
  documentLength: number;
  filenameHints: string[];
}

export class ClassificationService {
  /**
   * Extrait des signaux du texte OCR
   */
  private extractSignals(text: string, filename: string): ClassificationSignals {
    const textLower = text.toLowerCase();

    return {
      hasIban: /FR\d{12,32}/i.test(text),
      hasSiren: /\b\d{9}\b/.test(text),
      hasSiret: /\b\d{14}\b/.test(text),
      hasDateRange: /(?:du|pÃ©riode|du\s+\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\s+au\s+\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i.test(text),
      hasAmount: /(?:\d{1,3}(?:[\s\u00A0]\d{3})+|\d+)(?:[.,]\d{2})?\s?â‚¬/.test(text),
      hasAddress: /\b\d{5}\b/.test(text) && /\brue\b|\bavenue\b|\bboulevard\b/i.test(text),
      documentLength: text.length,
      filenameHints: this.extractFilenameHints(filename),
    };
  }

  /**
   * Extrait des indices du nom de fichier
   */
  private extractFilenameHints(filename: string): string[] {
    const hints: string[] = [];
    const filenameLower = filename.toLowerCase();

    const patterns: Record<string, string[]> = {
      'bail': ['bail', 'lease', 'contrat_location'],
      'quittance': ['quittance', 'receipt', 'recu'],
      'assurance': ['assurance', 'insurance', 'attestation'],
      'taxe': ['taxe', 'tax', 'impot', 'fonciere'],
      'dpe': ['dpe', 'diagnostic', 'energie'],
      'facture': ['facture', 'invoice', 'bill'],
      'rib': ['rib', 'bank', 'iban'],
      'identite': ['identite', 'id', 'passeport', 'carte_identite'],
      'edl': ['edl', 'etat_des_lieux', 'inventory'],
    };

    for (const [hint, keywords] of Object.entries(patterns)) {
      if (keywords.some(kw => filenameLower.includes(kw))) {
        hints.push(hint);
      }
    }

    return hints;
  }

  /**
   * Calcule le score pour un type de document donnÃ©
   */
  private async calculateTypeScore(
    typeId: string,
    text: string,
    signals: ClassificationSignals
  ): Promise<number> {
    // RÃ©cupÃ©rer les mots-clÃ©s du type
    const keywords = await prisma.documentKeyword.findMany({
      where: { documentTypeId: typeId },
    });

    if (keywords.length === 0) {
      return 0;
    }

    const textLower = text.toLowerCase();
    let totalScore = 0;
    let maxPossibleScore = 0;

    // Calculer le score basÃ© sur les mots-clÃ©s
    for (const keyword of keywords) {
      const weight = keyword.weight;
      maxPossibleScore += weight;

      // VÃ©rifier la prÃ©sence du mot-clÃ©
      const regex = new RegExp(`\\b${keyword.keyword.toLowerCase()}\\b`, 'i');
      if (regex.test(textLower)) {
        // Bonus si contexte correspond
        if (keyword.context) {
          if (keyword.context === 'title' && text.substring(0, 200).toLowerCase().includes(keyword.keyword.toLowerCase())) {
            totalScore += weight * 1.5; // Bonus titre
          } else if (keyword.context === 'footer' && text.substring(text.length - 200).toLowerCase().includes(keyword.keyword.toLowerCase())) {
            totalScore += weight * 1.2; // Bonus pied de page
          } else {
            totalScore += weight;
          }
        } else {
          totalScore += weight;
        }
      }
    }

    // Normaliser le score (0-1)
    let normalizedScore = maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;

    // Appliquer des bonus/malus basÃ©s sur les signaux
    const type = await prisma.documentType.findUnique({
      where: { id: typeId },
      select: { code: true },
    });

    if (type) {
      normalizedScore = this.applySignalBoosts(type.code, normalizedScore, signals);
    }

    return Math.min(1.0, Math.max(0, normalizedScore));
  }

  /**
   * Applique des bonus/malus en fonction des signaux dÃ©tectÃ©s
   */
  private applySignalBoosts(
    typeCode: string,
    baseScore: number,
    signals: ClassificationSignals
  ): number {
    let score = baseScore;

    switch (typeCode) {
      case 'BAIL_SIGNE':
        if (signals.hasDateRange) score += 0.1;
        if (signals.hasAmount) score += 0.05;
        if (signals.hasAddress) score += 0.1;
        if (signals.filenameHints.includes('bail')) score += 0.15;
        break;

      case 'QUITTANCE':
        if (signals.hasAmount) score += 0.15;
        if (signals.hasDateRange || /(?:janvier|fÃ©vrier|mars|avril|mai|juin|juillet|aoÃ»t|septembre|octobre|novembre|dÃ©cembre)\s+\d{4}/i.test('')) {
          score += 0.1;
        }
        if (signals.filenameHints.includes('quittance')) score += 0.2;
        break;

      case 'ATTESTATION_ASSURANCE':
        if (signals.hasDateRange) score += 0.1;
        if (signals.filenameHints.includes('assurance')) score += 0.2;
        break;

      case 'TAXE_FONCIERE':
        if (signals.hasAmount) score += 0.1;
        if (signals.hasSiren || signals.hasSiret) score += 0.1;
        if (signals.filenameHints.includes('taxe')) score += 0.2;
        break;

      case 'RIB':
        if (signals.hasIban) score += 0.3;
        if (signals.filenameHints.includes('rib')) score += 0.2;
        if (signals.documentLength < 2000) score += 0.1; // RIB gÃ©nÃ©ralement court
        break;

      case 'PIECE_IDENTITE':
        if (signals.filenameHints.includes('identite')) score += 0.2;
        if (signals.documentLength < 3000) score += 0.1;
        break;

      case 'FACTURE':
        if (signals.hasAmount) score += 0.1;
        if (signals.hasSiren || signals.hasSiret) score += 0.1;
        if (signals.filenameHints.includes('facture')) score += 0.2;
        break;

      case 'DPE':
        if (signals.filenameHints.includes('dpe')) score += 0.2;
        break;

      case 'EDL':
        if (signals.filenameHints.includes('edl')) score += 0.2;
        if (signals.hasAddress) score += 0.1;
        break;

      case 'RELEVE_BANCAIRE':
        if (signals.hasIban) score += 0.2;
        if (signals.hasAmount) score += 0.1;
        break;

      case 'AVIS_IMPOSITION':
        if (signals.hasAmount) score += 0.1;
        if (signals.hasSiren) score += 0.1;
        break;
    }

    return score;
  }

  /**
   * Classifie un document
   */
  async classify(
    documentId: string,
    text: string,
    filename: string,
    metadata?: Record<string, any>
  ): Promise<ClassificationResult> {
    // Extraire les signaux
    const signals = this.extractSignals(text, filename);

    // RÃ©cupÃ©rer tous les types actifs
    const types = await prisma.documentType.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    // Calculer les scores pour chaque type
    const scores: ClassificationScore[] = [];

    for (const type of types) {
      const confidence = await this.calculateTypeScore(type.id, text, signals);

      if (confidence > 0.1) { // Seuil minimum
        scores.push({
          typeId: type.id,
          typeCode: type.code,
          typeLabel: type.label,
          confidence,
        });
      }
    }

    // Trier par score dÃ©croissant
    scores.sort((a, b) => b.confidence - a.confidence);

    // DÃ©terminer le rÃ©sultat
    const topScore = scores[0];
    const autoAssigned = topScore && topScore.confidence >= 0.85;

    return {
      suggested: topScore || null,
      alternatives: scores.slice(1, 4), // Top 3 alternatives
      autoAssigned,
    };
  }

  /**
   * Re-classifie un document (forcer une nouvelle classification)
   */
  async reclassify(documentId: string): Promise<ClassificationResult> {
    // RÃ©cupÃ©rer le document et son texte OCR
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        textIndex: true,
      },
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // ConcatÃ©ner le texte de toutes les pages
    const fullText = document.textIndex
      .sort((a, b) => a.page - b.page)
      .map(ti => ti.content)
      .join('\n\n');

    return await this.classify(
      documentId,
      fullText,
      document.filenameOriginal,
      document.metadata ? JSON.parse(document.metadata) : undefined
    );
  }

  /**
   * Valide manuellement un type pour un document
   */
  async validateType(documentId: string, typeId: string): Promise<void> {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        documentTypeId: typeId,
        typeConfidence: 1.0,
        typeAlternatives: null,
      },
    });
  }

  /**
   * SuggÃ¨re des rattachements automatiques (heuristiques)
   */
  async suggestLinkages(
    documentId: string,
    extractedFields: Record<string, any>
  ): Promise<{
    propertyId?: string;
    leaseId?: string;
    tenantId?: string;
    transactionId?: string;
  }> {
    const suggestions: any = {};

    // Heuristique: chercher par adresse
    if (extractedFields.address) {
      const property = await prisma.property.findFirst({
        where: {
          OR: [
            { address: { contains: extractedFields.address } },
            { address: { contains: extractedFields.address.substring(0, 20) } },
          ],
        },
      });

      if (property) {
        suggestions.propertyId = property.id;

        // Si on a un bien, chercher un bail actif
        const lease = await prisma.lease.findFirst({
          where: {
            propertyId: property.id,
            status: { in: ['ACTIF', 'SIGNÃ‰'] },
          },
          orderBy: { startDate: 'desc' },
        });

        if (lease) {
          suggestions.leaseId = lease.id;
          suggestions.tenantId = lease.tenantId;
        }
      }
    }

    // Heuristique: chercher par nom de locataire
    if (extractedFields.tenant_name) {
      const [firstName, ...lastNameParts] = extractedFields.tenant_name.split(' ');
      const lastName = lastNameParts.join(' ');

      const tenant = await prisma.tenant.findFirst({
        where: {
          AND: [
            { firstName: { contains: firstName } },
            { lastName: { contains: lastName } },
          ],
        },
      });

      if (tenant) {
        suggestions.tenantId = tenant.id;

        // Chercher un bail actif pour ce locataire
        const lease = await prisma.lease.findFirst({
          where: {
            tenantId: tenant.id,
            status: { in: ['ACTIF', 'SIGNÃ‰'] },
          },
          orderBy: { startDate: 'desc' },
        });

        if (lease) {
          suggestions.leaseId = lease.id;
          suggestions.propertyId = lease.propertyId;
        }
      }
    }

    // Heuristique: chercher une transaction par montant et date
    if (extractedFields.amount_paid && extractedFields.period_month && extractedFields.period_year) {
      const transaction = await prisma.transaction.findFirst({
        where: {
          amount: extractedFields.amount_paid,
          month: extractedFields.period_month,
          year: extractedFields.period_year,
        },
      });

      if (transaction) {
        suggestions.transactionId = transaction.id;
      }
    }

    return suggestions;
  }
}

// Instance singleton
let classificationServiceInstance: ClassificationService | null = null;

export function getClassificationService(): ClassificationService {
  if (!classificationServiceInstance) {
    classificationServiceInstance = new ClassificationService();
  }
  return classificationServiceInstance;
}

export default ClassificationService;


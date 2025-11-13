import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';



// Interface pour les rÃ©sultats de classification
export interface ClassificationResult {
  typeId: string;
  typeCode: string;
  typeLabel: string;
  threshold: number;
  rawScore: number;
  normalizedScore: number;
  matchedKeywords: Array<{
    keyword: string;
    weight: number;
    context?: string;
    occurrences?: Array<{
      text: string;
      position: number;
    }>;
  }>;
  matchedSignals: Array<{
    code: string;
    label: string;
    weight: number;
    details?: string;
  }>;
  scoreBreakdown: {
    keywordsTotal: number;
    signalsTotal: number;
    rawTotal: number;
    normalizedTotal: number;
  };
}

export interface ClassificationResponse {
  runId: string;
  configVersion: number;
  fileInfo?: {
    name: string;
    size: number;
    hash: string;
    pages?: number;
    ocrStatus: 'native' | 'scanned' | 'unknown';
    analysisTime: number;
  };
  classification: {
    top3: ClassificationResult[];
    autoAssigned: boolean;
    autoAssignedType?: string;
    autoAssignReason?: string;
  };
  debug?: {
    textLength: number;
    normalizedText: string;
    processingTime: number;
  };
}

class ClassificationService {
  private configCache: Map<string, any> = new Map();
  private configVersion = 1;

  /**
   * Normalise le texte de maniÃ¨re dÃ©terministe
   */
  private normalizeText(text: string): string {
    return text
      .replace(/\u00A0/g, " ")           // nbsp -> espace
      .normalize("NFKC")                 // Unicode canonical
      .toLowerCase()
      .replace(/\s+/g, " ")              // compacter les espaces
      .trim();
  }

  /**
   * Ã‰chappe les caractÃ¨res spÃ©ciaux regex de maniÃ¨re sÃ©curisÃ©e
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * VÃ©rifie la prÃ©sence d'un mot-clÃ© de maniÃ¨re dÃ©terministe
   */
  private hasKeyword(text: string, term: string): boolean {
    // CrÃ©er une nouvelle regex Ã  chaque appel (pas de flag 'g')
    const escapedTerm = this.escapeRegExp(term);
    const regex = new RegExp(`\\b${escapedTerm}\\b`, "iu"); // i: insensible Ã  la casse, u: unicode
    return regex.test(text);
  }

  /**
   * Trouve les occurrences d'un mot-clÃ© avec le contexte
   */
  private findKeywordOccurrences(text: string, term: string): Array<{ text: string; position: number }> {
    const escapedTerm = this.escapeRegExp(term);
    const regex = new RegExp(`\\b${escapedTerm}\\b`, "giu");
    const matches = [...text.matchAll(regex)];
    
    return matches.map(match => ({
      text: match[0],
      position: match.index || 0
    }));
  }

  /**
   * Teste un signal depuis le catalogue (nouveau systÃ¨me)
   */
  private testSignalFromCatalog(text: string, signal: any): { matched: boolean; details?: string } {
    try {
      // Utiliser directement le regex et flags du signal du catalogue
      const pattern = signal.regex;
      const flags = signal.flags || 'iu';
      
      // CrÃ©er une nouvelle regex Ã  chaque test (pas de rÃ©utilisation avec flag 'g')
      const regex = new RegExp(pattern, flags);
      const matched = regex.test(text);
      
      let details: string | undefined;
      if (matched) {
        const match = text.match(regex);
        if (match) {
          details = match[0];
        }
      }
      
      return { matched, details };
    } catch (error) {
      console.warn(`Erreur dans le signal ${signal.code}:`, error);
      return { matched: false };
    }
  }

  /**
   * Teste un signal (ancienne mÃ©thode pour compatibilitÃ© - DEPRECATED)
   */
  private testSignal(text: string, signal: any): { matched: boolean; details?: string } {
    // CompatibilitÃ© avec l'ancien systÃ¨me
    return this.testSignalFromCatalog(text, signal);
  }

  /**
   * Obtient le pattern pour un signal prÃ©dÃ©fini
   */
  private getPredefinedSignalPattern(code: string): string {
    switch (code) {
      case 'HAS_IBAN':
        return '\\bFR\\d{2}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{2}\\b';
      case 'HAS_SIREN':
        return '\\b\\d{9}\\b';
      case 'HAS_SIRET':
        return '\\b\\d{14}\\b';
      case 'META_PDF_TITLE':
        return '(titre|document|rapport)';
      case 'HEADER_IMPOTS':
        return '(impÃ´t|fiscal|dgfip|urssaf)';
      case 'HEADER_ASSUREUR':
        return '(assurance|assureur|mutuelle)';
      case 'MONTH_YEAR_PATTERN':
        return '\\b(janvier|fÃ©vrier|mars|avril|mai|juin|juillet|aoÃ»t|septembre|octobre|novembre|dÃ©cembre)\\s+\\d{4}\\b';
      case 'MONEY_PATTERN':
        return '\\d+[,\\.]\\d{2}\\s?â‚¬?';
      case 'ADDRESS_PATTERN':
        return '\\d+\\s+(rue|avenue|boulevard|place|allÃ©e|chemin|impasse)';
      case 'DATE_PATTERN':
        return '\\b\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}\\b';
      case 'EMAIL_PATTERN':
        return '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b';
      case 'PHONE_PATTERN':
        return '\\b(\\+33|0)[1-9](?:[.\\- ]?\\d{2}){4}\\b';
      case 'HAS_DATE_RANGE':
        return '(?:du|entre le)\\s+\\d{1,2}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{2,4}\\s+(?:au|et le)\\s+\\d{1,2}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{2,4}';
      case 'YEAR_PATTERN':
        return '\\b(20\\d{2})\\b';
      case 'LOYER_AMOUNT_NEAR':
        return '(?:loyer[\\s\\S]{0,80}(\\d[\\d \\u00A0.,]{2,})\\s?â‚¬)|((\\d[\\d \\u00A0.,]{2,})\\s?â‚¬[\\s\\S]{0,80}loyer)';
      default:
        return '';
    }
  }

  /**
   * Calcule le score thÃ©orique maximum pour un type
   */
  private calculateMaxTheoreticalScore(documentType: any): number {
    const keywordsTotal = documentType.DocumentKeyword?.reduce((sum: number, k: any) => sum + (k.weight || 0), 0) || 0;
    const signalsTotal = documentType.TypeSignal?.reduce((sum: number, ts: any) => sum + (ts.weight || 0), 0) || 0;
    
    // Pour "AUTRE", utiliser un score thÃ©orique minimum plus Ã©levÃ© pour Ã©viter qu'il gagne trop facilement
    if (documentType.code === 'AUTRE') {
      return Math.max(keywordsTotal + signalsTotal, 10); // Minimum 10 points
    }
    
    return keywordsTotal + signalsTotal;
  }

  /**
   * Charge la configuration avec cache et version
   */
  private async loadConfiguration(): Promise<{ config: any; version: number }> {
    const cacheKey = 'document-types-config';
    
    // VÃ©rifier le cache
    if (this.configCache.has(cacheKey)) {
      const cached = this.configCache.get(cacheKey);
      if (cached.timestamp > Date.now() - 60000) { // Cache 1 minute
        return { config: cached.config, version: cached.version };
      }
    }

    // Charger depuis la DB
    const documentTypes = await prisma.documentType.findMany({
      where: { isActive: true },
      include: {
        DocumentKeyword: true,
        TypeSignal: {
          where: { enabled: true },
          include: {
            Signal: true
          },
          orderBy: { order: 'asc' }
        },
        DocumentExtractionRule: {
          orderBy: { priority: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });

    // Mettre en cache
    this.configCache.set(cacheKey, {
      config: documentTypes,
      version: this.configVersion,
      timestamp: Date.now()
    });

    return { config: documentTypes, version: this.configVersion };
  }

  /**
   * Invalide le cache de configuration
   */
  public invalidateCache(): void {
    this.configCache.clear();
    this.configVersion++;
  }

  /**
   * Classifie un document de maniÃ¨re dÃ©terministe
   */
  public async classify(
    text: string, 
    fileInfo?: { name: string; size: number; pages?: number; ocrStatus?: 'native' | 'scanned' | 'unknown' },
    runId?: string
  ): Promise<ClassificationResponse> {
    const startTime = Date.now();
    const actualRunId = runId || crypto.randomUUID();
    
    try {
      // 1) Normaliser l'input
      const t = (text ?? "").trim();
      
      // 2) Si texte vide, retourner immÃ©diatement avec structure vide
      if (t.length === 0) {
        console.warn('[Classification] Texte vide ou invalide, aucune classification possible');
        return {
          runId: actualRunId,
          configVersion: this.configVersion,
          fileInfo: fileInfo ? {
            ...fileInfo,
            hash: '',
            analysisTime: Date.now() - startTime,
            ocrStatus: fileInfo.ocrStatus || 'unknown'
          } : undefined,
          classification: {
            top3: [],
            autoAssigned: false,
            autoAssignReason: 'Texte vide'
          },
          debug: {
            textLength: 0,
            normalizedText: '',
            processingTime: Date.now() - startTime
          }
        };
      }
      
      // Normaliser le texte (point d'entrÃ©e unique)
      const normalizedText = this.normalizeText(t);
      
      // 3) Log debug : sha256, length, aperÃ§u du texte
      const textSha256 = crypto.createHash('sha256').update(normalizedText).digest('hex');
      const textLength = normalizedText.length;
      const textPreview = normalizedText.slice(0, 120);
      
      console.log(`[Classification] runId:${actualRunId} sha256:${textSha256} length:${textLength} preview:"${textPreview}"`);
      
      // Charger la configuration
      const { config: documentTypes, version } = await this.loadConfiguration();
      
      // Calculer le hash du fichier si fourni
      let fileHash: string | undefined;
      if (fileInfo) {
        fileHash = textSha256; // Utiliser le hash dÃ©jÃ  calculÃ©
      }

      // Classifier chaque type
      const results: ClassificationResult[] = [];
      
      for (const documentType of documentTypes) {
        const result = await this.classifyForType(normalizedText, documentType);
        results.push(result);
      }

      // Tri stable par score normalisÃ© dÃ©croissant (0..1), puis par code en cas d'Ã©galitÃ©
      results.sort((a, b) => {
        const scoreDiff = b.normalizedScore - a.normalizedScore;
        if (scoreDiff !== 0) return scoreDiff;
        return a.typeCode.localeCompare(b.typeCode);
      });

      // Prendre le top 3
      const top3 = results.slice(0, 3);

      // DÃ©terminer l'auto-assignation
      // Ignorer "AUTRE" pour l'auto-assignation sauf si c'est le seul qui dÃ©passe son seuil
      const nonAutreResults = top3.filter(result => result.typeCode !== 'AUTRE');
      const bestMatch = nonAutreResults.length > 0 ? nonAutreResults[0] : top3[0];
      const threshold = bestMatch?.threshold || 0.85;
      
      // Auto-assigner seulement si le meilleur match (non-AUTRE) dÃ©passe son seuil
      // ou si seul AUTRE dÃ©passe son seuil
      const autoAssigned = bestMatch && bestMatch.normalizedScore >= threshold;
      
      let autoAssignReason: string | undefined;
      if (!autoAssigned && bestMatch) {
        autoAssignReason = `Score ${(bestMatch.normalizedScore * 100).toFixed(0)}% < seuil ${(threshold * 100).toFixed(0)}% (${bestMatch.typeLabel})`;
      }

      const processingTime = Date.now() - startTime;

      return {
        runId: actualRunId,
        configVersion: version,
        fileInfo: fileInfo ? {
          ...fileInfo,
          hash: fileHash!,
          analysisTime: processingTime,
          ocrStatus: fileInfo.ocrStatus || 'unknown'
        } : undefined,
        classification: {
          top3,
          autoAssigned,
          autoAssignedType: autoAssigned ? bestMatch?.typeLabel : undefined,
          autoAssignReason
        },
        debug: {
          textLength: normalizedText.length,
          normalizedText: normalizedText.substring(0, 200) + (normalizedText.length > 200 ? '...' : ''),
          processingTime
        }
      };
    } catch (error) {
      console.error('Erreur dans la classification:', error);
      throw new Error('Erreur lors de la classification');
    }
  }

  /**
   * Classifie pour un type spÃ©cifique
   */
  private async classifyForType(normalizedText: string, documentType: any): Promise<ClassificationResult> {
    let keywordsTotal = 0;
    let signalsTotal = 0;
    const matchedKeywords: any[] = [];
    const matchedSignals: any[] = [];

    // Calculer le score des mots-clÃ©s
    for (const keyword of documentType.DocumentKeyword || []) {
      const hasKeyword = this.hasKeyword(normalizedText, keyword.keyword);
      if (hasKeyword) {
        const weight = keyword.weight || 1;
        keywordsTotal += weight;
        
        const occurrences = this.findKeywordOccurrences(normalizedText, keyword.keyword);
        matchedKeywords.push({
          keyword: keyword.keyword,
          weight,
          context: keyword.context,
          occurrences: occurrences.slice(0, 3) // Limiter Ã  3 occurrences pour la performance
        });
      }
    }

    // Calculer le score des signaux (nouveau systÃ¨me TypeSignal)
    for (const typeSignal of documentType.TypeSignal || []) {
      const signal = typeSignal.Signal;
      if (!signal) continue;
      
      // Tester le signal en utilisant directement le regex du signal
      const { matched, details } = this.testSignalFromCatalog(normalizedText, signal);
      
      if (matched) {
        const weight = typeSignal.weight || 1;
        signalsTotal += weight;
        matchedSignals.push({
          code: signal.code,
          label: signal.label,
          weight,
          details
        });
      }
    }

    const rawScore = keywordsTotal + signalsTotal;
    const maxTheoreticalScore = this.calculateMaxTheoreticalScore(documentType);
    const normalizedScore = maxTheoreticalScore > 0 ? Math.min(rawScore / maxTheoreticalScore, 1) : 0;

    return {
      typeId: documentType.id,
      typeCode: documentType.code,
      typeLabel: documentType.label,
      threshold: documentType.autoAssignThreshold || 0.85,
      rawScore,
      normalizedScore,
      matchedKeywords,
      matchedSignals,
      scoreBreakdown: {
        keywordsTotal,
        signalsTotal,
        rawTotal: rawScore,
        normalizedTotal: normalizedScore
      }
    };
  }

  /**
   * Teste les patterns de signaux de maniÃ¨re dÃ©terministe
   */
  private testSignalPattern(text: string, signal: any): { matched: boolean; details?: string } {
    const code = signal.code;
    
    switch (code) {
      case 'HAS_IBAN':
        return this.testSignal(text, '\\bFR\\d{2}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{2}\\b', code);
      
      case 'HAS_SIREN':
        return this.testSignal(text, '\\b\\d{9}\\b', code);
      
      case 'HAS_SIRET':
        return this.testSignal(text, '\\b\\d{14}\\b', code);
      
      case 'META_PDF_TITLE':
        return this.testSignal(text, '(titre|document|rapport)', code);
      
      case 'HEADER_IMPOTS':
        return this.testSignal(text, '(impÃ´t|fiscal|dgfip|urssaf)', code);
      
      case 'HEADER_ASSUREUR':
        return this.testSignal(text, '(assurance|assureur|mutuelle)', code);
      
      case 'MONTH_YEAR_PATTERN':
        return this.testSignal(text, '\\b(janvier|fÃ©vrier|mars|avril|mai|juin|juillet|aoÃ»t|septembre|octobre|novembre|dÃ©cembre)\\s+\\d{4}\\b', code);
      
      case 'MONEY_PATTERN':
        return this.testSignal(text, '\\d+[,\\.]\\d{2}\\s?â‚¬?', code);
      
      case 'ADDRESS_PATTERN':
        return this.testSignal(text, '\\d+\\s+(rue|avenue|boulevard|place|allÃ©e|chemin|impasse)', code);
      
      case 'DATE_PATTERN':
        return this.testSignal(text, '\\b\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}\\b', code);
      
      case 'EMAIL_PATTERN':
        return this.testSignal(text, '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b', code);
      
      case 'PHONE_PATTERN':
        return this.testSignal(text, '\\b(\\+33|0)[1-9](?:[.\\- ]?\\d{2}){4}\\b', code);
      
      default:
        // Pour les signaux personnalisÃ©s, utiliser le pattern s'il existe
        if (signal.pattern) {
          return this.testSignal(text, signal.pattern, code);
        }
        return { matched: false };
    }
  }

  /**
   * Version simplifiÃ©e de classify pour compatibilitÃ© avec l'API upload
   * Retourne toujours { best, alternatives } sans throw
   */
  public async classifySimple(
    text: string
  ): Promise<{
    best: { code: string; label: string; score: number } | null;
    alternatives: Array<{ code: string; label: string; score: number }>;
  }> {
    // 1) Normaliser l'input
    const t = (text ?? "").trim();
    
    // 2) Si texte vide, retourner immÃ©diatement
    if (t.length === 0) {
      return { best: null, alternatives: [] };
    }
    
    try {
      // Appeler la classification complÃ¨te
      const result = await this.classify(t);
      
      // 3) Formater la sortie
      const top3 = result.classification.top3 || [];
      
      const alternatives = top3.map(r => ({
        code: r.typeCode || '',
        label: r.typeLabel || '',
        score: Math.round((r.normalizedScore || 0) * 100) / 100
      }));
      
      const best = alternatives.length > 0 ? alternatives[0] : null;
      
      return { best, alternatives };
    } catch (error) {
      // 4) Ne jamais throw, juste retourner vide
      console.error('[ClassificationService] Erreur lors de la classification:', error);
      return { best: null, alternatives: [] };
    }
  }

  /**
   * Teste le dÃ©terminisme (pour les tests)
   */
  public async testDeterminism(text: string, iterations: number = 5): Promise<boolean> {
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const result = await this.classify(text);
      results.push({
        top1Code: result.classification.top3[0]?.typeCode,
        top1Score: result.classification.top3[0]?.normalizedScore,
        top1Raw: result.classification.top3[0]?.rawScore
      });
    }
    
    // VÃ©rifier que tous les rÃ©sultats sont identiques
    const first = results[0];
    return results.every(r => 
      r.top1Code === first.top1Code && 
      r.top1Score === first.top1Score && 
      r.top1Raw === first.top1Raw
    );
  }
}

// Instance singleton
export const classificationService = new ClassificationService();

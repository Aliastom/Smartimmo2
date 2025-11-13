import { PrismaClient } from '@prisma/client';

interface ClassificationResult {
  typeId: string;
  typeCode: string;
  typeLabel: string;
  confidence: number;
  matchedKeywords: Array<{
    keyword: string;
    weight: number;
    context?: string;
  }>;
  matchedSignals: Array<{
    code: string;
    label: string;
    weight: number;
  }>;
}

interface ClassificationCache {
  data: any;
  timestamp: number;
  version: string;
}

class ClassificationBDDService {
  private prisma: PrismaClient;
  private cache: Map<string, ClassificationCache> = new Map();
  private cacheVersion: string | null = null;
  private readonly CACHE_TTL = 60000; // 60 secondes

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Classifie un document en utilisant la configuration BDD
   */
  async classifyDocument(text: string, documentId?: string): Promise<ClassificationResult[]> {
    try {
      // Récupérer la configuration depuis la BDD (avec cache)
      const config = await this.getClassificationConfig();
      
      if (!config.documentTypes.length) {
        return [];
      }

      const results: ClassificationResult[] = [];

      for (const docType of config.documentTypes) {
        if (!docType.isActive) continue;

        const classification = await this.classifyForType(text, docType, config);
        
        if (classification.confidence > 0) {
          results.push(classification);
        }
      }

      // Trier par score décroissant et retourner le top 3
      return results
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);

    } catch (error) {
      console.error('Error in document classification:', error);
      throw new Error('Erreur lors de la classification du document');
    }
  }

  /**
   * Récupère la configuration de classification depuis la BDD (avec cache)
   */
  private async getClassificationConfig(): Promise<any> {
    const cacheKey = 'classification_config';
    const cached = this.cache.get(cacheKey);
    
    // Vérifier la version du cache
    const currentVersion = await this.getConfigVersion();
    
    if (cached && 
        cached.version === currentVersion && 
        Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    // Recharger depuis la BDD
    const config = await this.loadConfigFromDB();
    
    // Mettre en cache
    this.cache.set(cacheKey, {
      data: config,
      timestamp: Date.now(),
      version: currentVersion || '',
    });

    return config;
  }

  /**
   * Charge la configuration depuis la base de données
   */
  private async loadConfigFromDB(): Promise<any> {
    const documentTypes = await this.prisma.documentType.findMany({
      where: { isActive: true },
      include: {
        DocumentKeyword: true,
        TypeSignal: {
          include: {
            Signal: true
          }
        },
      },
      orderBy: [{ order: 'asc' }, { label: 'asc' }],
    });

    return { documentTypes };
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
   * Classifie un texte pour un type de document spécifique
   */
  private async classifyForType(
    text: string, 
    docType: any, 
    config: any
  ): Promise<ClassificationResult> {
    const lowerText = text.toLowerCase();
    let totalScore = 0;
    const matchedKeywords: any[] = [];
    const matchedSignals: any[] = [];

    // Calculer le score des mots-clés
    for (const keyword of docType.DocumentKeyword) {
      const keywordLower = keyword.keyword.toLowerCase();
      
      // Recherche exacte
      if (lowerText.includes(keywordLower)) {
        totalScore += keyword.weight;
        matchedKeywords.push({
          keyword: keyword.keyword,
          weight: keyword.weight,
          context: keyword.context,
        });
      }
      
      // Recherche par mots séparés pour les phrases
      const keywordWords = keywordLower.split(/\s+/);
      if (keywordWords.length > 1) {
        const allWordsFound = keywordWords.every(word => lowerText.includes(word));
        if (allWordsFound) {
          totalScore += keyword.weight * 0.8; // Réduction pour match partiel
          matchedKeywords.push({
            keyword: keyword.keyword,
            weight: keyword.weight * 0.8,
            context: keyword.context,
          });
        }
      }
    }

    // Calculer le score des signaux
    for (const typeSignal of docType.TypeSignal) {
      const signal = typeSignal.Signal;
      let signalMatched = false;
      let signalScore = 0;

      // Utiliser le regex du signal depuis la base de données
      if (signal.regex) {
        try {
          const regex = new RegExp(signal.regex, signal.flags || 'iu');
          signalMatched = regex.test(text);
        } catch (error) {
          console.warn(`Invalid regex for signal ${signal.code}: ${signal.regex}`);
          signalMatched = false;
        }
      }

      if (signalMatched) {
        totalScore += typeSignal.weight;
        matchedSignals.push({
          code: signal.code,
          label: signal.label,
          weight: typeSignal.weight,
        });
      }
    }

    // Normaliser le score (0-1)
    const maxPossibleScore = docType.DocumentKeyword.reduce((sum: number, k: any) => sum + k.weight, 0) +
                            docType.TypeSignal.reduce((sum: number, ts: any) => sum + ts.weight, 0);
    
    const confidence = maxPossibleScore > 0 ? Math.min(totalScore / maxPossibleScore, 1) : 0;

    return {
      typeId: docType.id,
      typeCode: docType.code,
      typeLabel: docType.label,
      confidence,
      matchedKeywords,
      matchedSignals,
    };
  }

  /**
   * Détecte si un texte semble être un titre de document
   */
  private detectDocumentTitle(text: string): boolean {
    const lines = text.split('\n');
    const firstLine = lines[0]?.trim();
    
    if (!firstLine) return false;
    
    // Un titre de document est généralement court et en majuscules ou avec des mots-clés
    return firstLine.length < 100 && (
      firstLine === firstLine.toUpperCase() ||
      /\b(contrat|bail|attestation|quittance|facture|relevé|avis)\b/i.test(firstLine)
    );
  }

  /**
   * Invalide le cache de classification
   */
  async invalidateCache(): Promise<void> {
    this.cache.clear();
    this.cacheVersion = null;
  }

  /**
   * Obtient le seuil d'auto-assign pour un type de document
   */
  async getAutoAssignThreshold(typeId: string): Promise<number> {
    try {
      const docType = await this.prisma.documentType.findUnique({
        where: { id: typeId },
        select: { autoAssignThreshold: true },
      });
      
      return docType?.autoAssignThreshold || 0.85; // Seuil par défaut
    } catch (error) {
      console.error('Error getting auto assign threshold:', error);
      return 0.85;
    }
  }

  /**
   * Détermine si un document doit être auto-assigné
   */
  async shouldAutoAssign(confidence: number, typeId: string): Promise<boolean> {
    const threshold = await this.getAutoAssignThreshold(typeId);
    return confidence >= threshold;
  }

  /**
   * Ferme la connexion Prisma
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// Instance singleton
export const classificationBDDService = new ClassificationBDDService();

import { PrismaClient } from '@prisma/client';
import { ClassificationResult, ClassificationScore } from '@/types/documents';
import { classificationBDDService } from './classification-bdd.service';
import { prisma } from '@/lib/prisma';

/**
 * Service de classification automatique de documents
 * Utilise la configuration BDD via classificationBDDService
 */



export class ClassificationService {
  /**
   * Classifie un document en utilisant la configuration BDD
   */
  async classify(
    documentId: string,
    text: string,
    filename: string,
    metadata?: Record<string, any>
  ): Promise<ClassificationResult> {
    try {
      // Utiliser le service BDD pour la classification
      const bddResults = await classificationBDDService.classifyDocument(text, documentId);
      
      if (!bddResults.length) {
        return {
          suggested: null,
          alternatives: [],
          autoAssigned: false,
          TypeSignal: {},
        };
      }

      const topResult = bddResults[0];
      const alternatives = bddResults.slice(1, 4).map(result => ({
        typeId: result.typeId,
        typeCode: result.typeCode,
        typeLabel: result.typeLabel,
        confidence: result.confidence,
      }));

      // VÃ©rifier si auto-assign
      const autoAssigned = await classificationBDDService.shouldAutoAssign(
        topResult.confidence, 
        topResult.typeId
      );

      return {
        suggested: {
          typeId: topResult.typeId,
          typeCode: topResult.typeCode,
          typeLabel: topResult.typeLabel,
          confidence: topResult.confidence,
        },
        alternatives,
        autoAssigned,
        TypeSignal: {
          matchedKeywords: topResult.matchedKeywords.length,
          matchedSignals: topResult.matchedSignals.length,
          totalScore: topResult.confidence,
        },
      };
    } catch (error) {
      console.error('Error in classification service:', error);
      
      // Fallback vers une classification basique
      return this.fallbackClassify(text, filename);
    }
  }

  /**
   * MÃ©thode de fallback vers une classification basique
   */
  private async fallbackClassify(
    text: string,
    filename: string
  ): Promise<ClassificationResult> {
    try {
      // RÃ©cupÃ©rer tous les types actifs
      const types = await prisma.documentType.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' },
      });

      if (!types.length) {
        return {
          suggested: null,
          alternatives: [],
          autoAssigned: false,
          TypeSignal: {},
        };
      }

      // Classification basique basÃ©e sur le nom de fichier
      const filenameLower = filename.toLowerCase();
      let suggestedType = null;

      for (const type of types) {
        const typeCodeLower = type.code.toLowerCase();
        
        if (filenameLower.includes(typeCodeLower) || 
            filenameLower.includes(type.label.toLowerCase())) {
          suggestedType = {
            typeId: type.id,
            typeCode: type.code,
            typeLabel: type.label,
            confidence: 0.6, // Confiance modÃ©rÃ©e pour le fallback
          };
          break;
        }
      }

      // Si aucun match par nom de fichier, prendre le premier type
      if (!suggestedType && types.length > 0) {
        suggestedType = {
          typeId: types[0].id,
          typeCode: types[0].code,
          typeLabel: types[0].label,
          confidence: 0.1, // TrÃ¨s faible confiance
        };
      }

      return {
        suggested: suggestedType,
        alternatives: [],
        autoAssigned: false,
        TypeSignal: {
          fallback: true,
          filename: filename,
        },
      };
    } catch (error) {
      console.error('Error in fallback classification:', error);
      
      return {
        suggested: null,
        alternatives: [],
        autoAssigned: false,
        TypeSignal: {
          error: true,
          message: 'Erreur de classification',
        },
      };
    }
  }

  /**
   * Reclassifie un document existant
   */
  async reclassify(documentId: string): Promise<ClassificationResult> {
    try {
      // RÃ©cupÃ©rer le document
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          textIndex: {
            orderBy: { page: 'asc' },
          },
        },
      });

      if (!document) {
        throw new Error('Document non trouvÃ©');
      }

      // Reconstituer le texte
      const text = document.textIndex
        .map(index => index.content)
        .join('\n');

      // Reclassifier
      return await this.classify(documentId, text, document.filenameOriginal);
    } catch (error) {
      console.error('Error in reclassification:', error);
      throw error;
    }
  }

  /**
   * Invalide le cache de classification
   */
  async invalidateCache(): Promise<void> {
    await classificationBDDService.invalidateCache();
  }

  /**
   * Ferme la connexion Prisma
   */
  async disconnect(): Promise<void> {
    await prisma.$disconnect();
    await classificationBDDService.disconnect();
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

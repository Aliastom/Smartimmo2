import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { DocumentTypeSchema, DocumentKeywordSchema, DocumentSignalSchema, DocumentExtractionRuleSchema } from '@/types/document-types';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// SchÃ©ma spÃ©cial pour l'import qui accepte 'term' ou 'keyword'
const ImportDocumentKeywordSchema = z.object({
  id: z.string().optional(),
  term: z.string().min(1, 'Mot-clÃ© requis').optional(),
  keyword: z.string().min(1, 'Mot-clÃ© requis').optional(),
  weight: z.number().min(0).max(10).default(1),
  context: z.string().optional(),
}).refine((data) => data.term || data.keyword, {
  message: "Le mot-clÃ© doit Ãªtre fourni (term ou keyword)"
});



// Fonction de normalisation des donnÃ©es d'import
function normalizeImportData(importData: any) {
  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [] as string[],
  };

  if (!importData.types || !Array.isArray(importData.types)) {
    results.errors.push('Format de configuration invalide');
    return { importData: null, results };
  }

  // Normaliser chaque type
  const normalizedTypes = importData.types.map((typeData: any) => {
    try {
      // 1. Normaliser les champs JSON encodÃ©s en string
      const normalizeJsonField = (value: any) => {
        if (typeof value === 'string') {
          // Si Ã§a ressemble Ã  du JSON (commence par [ ou {)
          if (value.match(/^[\s]*[\[\{]/)) {
            try {
              return JSON.parse(value);
            } catch {
              return value;
            }
          }
          return value;
        }
        return value;
      };

      const normalizedType = {
        ...typeData,
        defaultContexts: normalizeJsonField(typeData.defaultContexts),
        suggestionsConfig: normalizeJsonField(typeData.suggestionsConfig),
        flowLocks: normalizeJsonField(typeData.flowLocks),
        metaSchema: normalizeJsonField(typeData.metaSchema),
      };

      // 2. Corriger autoAssignThreshold null
      if (normalizedType.autoAssignThreshold === null || normalizedType.autoAssignThreshold === undefined) {
        normalizedType.autoAssignThreshold = 0.85; // Valeur par dÃ©faut
      }

      // 2.1. Filtrer les types de test/dupliquÃ©s inactifs (optionnel)
      if (normalizedType.code.includes('_COPY') && !normalizedType.isActive) {
        results.skipped++;
        return null; // Ignorer les copies inactives
      }

      // 3. Normaliser les mots-clÃ©s (garder les deux formats pour compatibilitÃ©)
      // Renommer 'keywords' en 'DocumentKeyword' si nÃ©cessaire
      if (normalizedType.keywords && !normalizedType.DocumentKeyword) {
        normalizedType.DocumentKeyword = normalizedType.keywords;
      }
      
      if (normalizedType.DocumentKeyword && Array.isArray(normalizedType.DocumentKeyword)) {
        normalizedType.DocumentKeyword = normalizedType.DocumentKeyword.map((keyword: any) => {
          const normalizedKeyword = { ...keyword };
          // Assurer que les deux formats sont disponibles pour la validation
          if ('keyword' in normalizedKeyword && !('term' in normalizedKeyword)) {
            normalizedKeyword.term = normalizedKeyword.keyword;
          } else if ('term' in normalizedKeyword && !('keyword' in normalizedKeyword)) {
            normalizedKeyword.keyword = normalizedKeyword.term;
          }
          // Normaliser context null/undefined
          if (normalizedKeyword.context === null || normalizedKeyword.context === '') {
            normalizedKeyword.context = undefined;
          }
          return normalizedKeyword;
        });
      }

      // 3.1. Normaliser les signaux (renommer 'signals' en 'TypeSignal' si nÃ©cessaire)
      if (normalizedType.signals && !normalizedType.TypeSignal) {
        normalizedType.TypeSignal = normalizedType.signals;
      }

      // 4. Normaliser les rÃ¨gles
      // Renommer 'rules' en 'DocumentExtractionRule' si nÃ©cessaire
      if (normalizedType.rules && !normalizedType.DocumentExtractionRule) {
        normalizedType.DocumentExtractionRule = normalizedType.rules;
      }
      
      if (normalizedType.DocumentExtractionRule && Array.isArray(normalizedType.DocumentExtractionRule)) {
        normalizedType.DocumentExtractionRule = normalizedType.DocumentExtractionRule.map((rule: any) => {
          const normalizedRule = { ...rule };
          // Corriger postProcess "iban" -> "iban_norm"
          if (normalizedRule.postProcess === 'iban') {
            normalizedRule.postProcess = 'iban_norm';
          }
          // Normaliser postProcess null/undefined
          if (normalizedRule.postProcess === null || normalizedRule.postProcess === '') {
            normalizedRule.postProcess = undefined;
          }
          // Valider les regex
          if (normalizedRule.pattern) {
            try {
              new RegExp(normalizedRule.pattern);
            } catch (error) {
              results.errors.push(`Regex invalide pour ${typeData.code}: ${normalizedRule.pattern}`);
            }
          }
          return normalizedRule;
        });
      }

      return normalizedType;
    } catch (error) {
      results.errors.push(`Erreur normalisation type ${typeData.code}: ${error}`);
      return typeData; // Retourner les donnÃ©es originales en cas d'erreur
    }
  });

  // Filtrer les types null (types ignorÃ©s)
  const filteredTypes = normalizedTypes.filter(type => type !== null);

  return {
    importData: { ...importData, types: filteredTypes },
    results
  };
}

// POST /api/admin/document-config/import - Importer la configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { json, mode = 'merge' } = body;

    if (!json) {
      return NextResponse.json(
        { success: false, error: 'DonnÃ©es JSON requises' },
        { status: 400 }
      );
    }

    let importData;
    
    // Si json est dÃ©jÃ  un objet, l'utiliser directement
    if (typeof json === 'object' && json !== null) {
      importData = json;
    } else if (typeof json === 'string') {
      // Si c'est une string, la parser
      try {
        importData = JSON.parse(json);
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Format JSON invalide' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Format de donnÃ©es invalide' },
        { status: 400 }
      );
    }

    // Normaliser les donnÃ©es d'import
    const { importData: normalizedData, results: normalizationResults } = normalizeImportData(importData);
    
    if (!normalizedData) {
      return NextResponse.json(
        { success: false, error: 'Format de configuration invalide', details: normalizationResults.errors },
        { status: 400 }
      );
    }

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [...normalizationResults.errors] as string[],
    };

    // Ã‰TAPE 1: VÃ©rifier que tous les signaux rÃ©fÃ©rencÃ©s existent dans le catalogue
    const allReferencedSignalCodes = new Set<string>();
    for (const typeData of normalizedData.types) {
      if (typeData.signals && Array.isArray(typeData.signals)) {
        typeData.signals.forEach((s: any) => {
          if (s.code) allReferencedSignalCodes.add(s.code);
        });
      }
    }

    if (allReferencedSignalCodes.size > 0) {
      const existingSignals = await prisma.signal.findMany({
        where: {
          code: { in: Array.from(allReferencedSignalCodes) },
          deletedAt: null
        },
        select: { code: true }
      });

      const existingCodes = new Set(existingSignals.map(s => s.code));
      const missingCodes = Array.from(allReferencedSignalCodes).filter(code => !existingCodes.has(code));

      if (missingCodes.length > 0) {
        return NextResponse.json({
          success: false,
          error: `âŒ Signaux manquants dans le catalogue : ${missingCodes.join(', ')}`,
          details: `Veuillez d'abord importer ou crÃ©er ces signaux dans le catalogue avant d'importer les types qui les utilisent.`,
          missingSignals: missingCodes
        }, { status: 400 });
      }
    }

    // Ã‰TAPE 2: Si mode overwrite, supprimer tous les types existants
    if (mode === 'overwrite') {
      await prisma.documentKeyword.deleteMany({});
      await prisma.typeSignal.deleteMany({});
      await prisma.documentExtractionRule.deleteMany({});
      await prisma.documentType.deleteMany({});
    }

    // Ã‰TAPE 3: Traiter chaque type
    for (const typeData of normalizedData.types) {
      try {
        // Valider les donnÃ©es du type
        const validatedType = DocumentTypeSchema.parse({
          code: typeData.code,
          label: typeData.label,
          description: typeData.description,
          order: typeData.order || 0,
          isActive: typeData.isActive !== undefined ? typeData.isActive : true,
          isSensitive: typeData.isSensitive || false,
          autoAssignThreshold: typeData.autoAssignThreshold,
          defaultContexts: typeData.defaultContexts,
          suggestionsConfig: typeData.suggestionsConfig,
          flowLocks: typeData.flowLocks,
          metaSchema: typeData.metaSchema,
        });

        // VÃ©rifier si le type existe dÃ©jÃ 
        const existingType = await prisma.documentType.findUnique({
          where: { code: validatedType.code },
        });

        let documentType;
        if (existingType && mode === 'merge') {
          // Mettre Ã  jour le type existant
          documentType = await prisma.documentType.update({
            where: { id: existingType.id },
            data: {
              label: validatedType.label,
              description: validatedType.description,
              order: validatedType.order,
              isActive: validatedType.isActive,
              isSensitive: validatedType.isSensitive,
              autoAssignThreshold: validatedType.autoAssignThreshold,
              defaultContexts: validatedType.defaultContexts ? JSON.stringify(validatedType.defaultContexts) : null,
              suggestionsConfig: validatedType.suggestionsConfig ? JSON.stringify(validatedType.suggestionsConfig) : null,
              flowLocks: validatedType.flowLocks ? JSON.stringify(validatedType.flowLocks) : null,
              metaSchema: validatedType.metaSchema ? JSON.stringify(validatedType.metaSchema) : null,
            },
          });
          results.updated++;
        } else if (existingType && mode === 'overwrite') {
          // Supprimer et recrÃ©er
          await prisma.documentKeyword.deleteMany({ where: { documentTypeId: existingType.id } });
          await prisma.documentSignal.deleteMany({ where: { documentTypeId: existingType.id } });
          await prisma.documentExtractionRule.deleteMany({ where: { documentTypeId: existingType.id } });
          
          documentType = await prisma.documentType.update({
            where: { id: existingType.id },
            data: {
              label: validatedType.label,
              description: validatedType.description,
              order: validatedType.order,
              isActive: validatedType.isActive,
              isSensitive: validatedType.isSensitive,
              autoAssignThreshold: validatedType.autoAssignThreshold,
              defaultContexts: validatedType.defaultContexts ? JSON.stringify(validatedType.defaultContexts) : null,
              suggestionsConfig: validatedType.suggestionsConfig ? JSON.stringify(validatedType.suggestionsConfig) : null,
              flowLocks: validatedType.flowLocks ? JSON.stringify(validatedType.flowLocks) : null,
              metaSchema: validatedType.metaSchema ? JSON.stringify(validatedType.metaSchema) : null,
            },
          });
          results.updated++;
        } else {
          // CrÃ©er un nouveau type
          documentType = await prisma.documentType.create({
            data: {
              code: validatedType.code,
              label: validatedType.label,
              description: validatedType.description,
              order: validatedType.order,
              isActive: validatedType.isActive,
              isSensitive: validatedType.isSensitive,
              autoAssignThreshold: validatedType.autoAssignThreshold,
              defaultContexts: validatedType.defaultContexts ? JSON.stringify(validatedType.defaultContexts) : null,
              suggestionsConfig: validatedType.suggestionsConfig ? JSON.stringify(validatedType.suggestionsConfig) : null,
              flowLocks: validatedType.flowLocks ? JSON.stringify(validatedType.flowLocks) : null,
              metaSchema: validatedType.metaSchema ? JSON.stringify(validatedType.metaSchema) : null,
            },
          });
          results.created++;
        }

        // Traiter les mots-clÃ©s
        if (typeData.DocumentKeyword && Array.isArray(typeData.DocumentKeyword)) {
          await prisma.documentKeyword.deleteMany({ where: { documentTypeId: documentType.id } });
          
          for (const keywordData of typeData.DocumentKeyword) {
            try {
              const validatedKeyword = ImportDocumentKeywordSchema.parse(keywordData);
              const keywordValue = validatedKeyword.term || validatedKeyword.keyword;
              
              await prisma.documentKeyword.create({
                data: {
                  documentTypeId: documentType.id,
                  keyword: keywordValue,
                  weight: validatedKeyword.weight,
                  context: validatedKeyword.context,
                },
              });
            } catch (error) {
              results.errors.push(`Erreur mot-clÃ© pour ${typeData.code}: ${error}`);
            }
          }
        }

        // Traiter les signaux (nouveau systÃ¨me TypeSignal avec rÃ©fÃ©rence au catalogue)
        if (typeData.signals && Array.isArray(typeData.signals)) {
          // Supprimer les liaisons TypeSignal existantes
          await prisma.typeSignal.deleteMany({ where: { documentTypeId: documentType.id } });
          
          for (const signalData of typeData.signals) {
            try {
              // Trouver le signal dans le catalogue par son code
              const signal = await prisma.signal.findUnique({
                where: { code: signalData.code }
              });

              if (!signal) {
                results.errors.push(`Signal "${signalData.code}" non trouvÃ© dans le catalogue pour ${typeData.code}`);
                continue;
              }

              // CrÃ©er la liaison TypeSignal
              await prisma.typeSignal.create({
                data: {
                  documentTypeId: documentType.id,
                  signalId: signal.id,
                  weight: signalData.weight ?? 1.0,
                  enabled: signalData.enabled ?? true,
                  order: signalData.order ?? 0,
                },
              });
            } catch (error) {
              results.errors.push(`Erreur signal pour ${typeData.code}: ${error}`);
            }
          }
        }

        // Traiter les rÃ¨gles
        if (typeData.DocumentExtractionRule && Array.isArray(typeData.DocumentExtractionRule)) {
          await prisma.documentExtractionRule.deleteMany({ where: { documentTypeId: documentType.id } });
          
          for (const ruleData of typeData.DocumentExtractionRule) {
            try {
              const validatedRule = DocumentExtractionRuleSchema.parse(ruleData);
              await prisma.documentExtractionRule.create({
                data: {
                  documentTypeId: documentType.id,
                  fieldName: validatedRule.fieldName,
                  pattern: validatedRule.pattern,
                  postProcess: validatedRule.postProcess || null,
                  priority: validatedRule.priority,
                },
              });
            } catch (error) {
              results.errors.push(`Erreur rÃ¨gle pour ${typeData.code}: ${error}`);
            }
          }
        }

      } catch (error) {
        results.errors.push(`Erreur type ${typeData.code}: ${error}`);
        results.skipped++;
      }
    }

    // Invalider le cache de configuration
    await invalidateConfigCache();

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Error importing document config:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\'import de la configuration' },
      { status: 500 }
    );
  }
}

// Fonction pour invalider le cache de configuration
async function invalidateConfigCache() {
  try {
    await prisma.appConfig.upsert({
      where: { key: 'document_config_version' },
      update: { 
        value: JSON.stringify({ version: Date.now() }),
        updatedAt: new Date(),
      },
      create: { 
        key: 'document_config_version',
        value: JSON.stringify({ version: Date.now() }),
        description: 'Version de la configuration des documents pour invalidation du cache',
      },
    });
  } catch (error) {
    console.error('Error invalidating config cache:', error);
  }
}
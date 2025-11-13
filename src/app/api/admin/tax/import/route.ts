/**
 * API Route - Import des paramètres fiscaux
 * POST /api/admin/tax/import?mode=validate|dry-run|apply&strategy=merge|replace
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

  FiscalExportBundleSchema,
  type FiscalExportBundle,
  type ImportOptions,
  type ImportValidationResult,
  type ImportDryRunResult,
  type ImportResult,
  ImportModeSchema,
  ImportStrategySchema,
} from '@/types/fiscal-export';
import crypto from 'crypto';

/**
 * Dénormalise les valeurs calcProfile pour la BDD
 * Export: BIC_MICRO, FONCIER_REEL, IS, etc.
 * BDD: micro_bic, reel_foncier, is_normal, etc.
 */
function denormalizeCalcProfile(profile: string): string {
  const mapping: Record<string, string> = {
    'FONCIER_MICRO': 'micro_foncier',
    'FONCIER_REEL': 'reel_foncier',
    'BIC_MICRO': 'micro_bic',
    'BIC_REEL': 'reel_bic',
    'IS': 'is_normal',
    // Déjà au format BDD
    'micro_foncier': 'micro_foncier',
    'reel_foncier': 'reel_foncier',
    'micro_bic': 'micro_bic',
    'reel_bic': 'reel_bic',
    'is_normal': 'is_normal',
    'is': 'is_normal',
  };

  return mapping[profile] || profile.toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'validate';
    const strategy = searchParams.get('strategy') || 'merge';

    // Valider les paramètres
    const modeResult = ImportModeSchema.safeParse(mode);
    const strategyResult = ImportStrategySchema.safeParse(strategy);

    if (!modeResult.success || !strategyResult.success) {
      return NextResponse.json(
        { error: 'Paramètres invalides (mode ou strategy)' },
        { status: 400 }
      );
    }

    // Parser le body JSON
    const body = await request.json();
    
    // Options d'import
    const options: ImportOptions = {
      mode: modeResult.data,
      strategy: strategyResult.data,
      targetCode: searchParams.get('targetCode') || undefined,
      importTypes: searchParams.get('importTypes') !== 'false',
      importRegimes: searchParams.get('importRegimes') !== 'false',
      importCompat: searchParams.get('importCompat') !== 'false',
    };

    // === ÉTAPE 1: VALIDATION ===
    const validationResult = await validateBundle(body);

    if (!validationResult.valid) {
      return NextResponse.json({
        mode: 'validate',
        result: validationResult,
      });
    }

    if (mode === 'validate') {
      return NextResponse.json({
        mode: 'validate',
        result: validationResult,
      });
    }

    // === ÉTAPE 2: DRY-RUN ===
    const bundle = body as FiscalExportBundle;
    const dryRunResult = await performDryRun(bundle, options);

    if (mode === 'dry-run') {
      return NextResponse.json({
        mode: 'dry-run',
        result: dryRunResult,
      });
    }

    // === ÉTAPE 3: APPLY ===
    if (mode === 'apply') {
      const applyResult = await performImport(bundle, options);
      return NextResponse.json({
        mode: 'apply',
        result: applyResult,
      });
    }

    return NextResponse.json(
      { error: 'Mode non supporté' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error importing fiscal data:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'import', details: error.message },
      { status: 500 }
    );
  }
}

// ========== VALIDATION ==========

async function validateBundle(body: any): Promise<ImportValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Valider le schéma Zod
    const bundle = FiscalExportBundleSchema.parse(body);

    // Vérifier le checksum
    const bundleStr = JSON.stringify(bundle.data);
    const calculatedChecksum = crypto.createHash('sha256').update(bundleStr).digest('hex');
    
    if (calculatedChecksum !== bundle.meta.checksum) {
      warnings.push(`Checksum invalide (attendu: ${bundle.meta.checksum.substring(0, 8)}..., calculé: ${calculatedChecksum.substring(0, 8)}...)`);
    }

    // Vérifier les appliesToIds
    if (bundle.data.regimes && bundle.data.types) {
      const typeIds = new Set(bundle.data.types.map(t => t.id));
      for (const regime of bundle.data.regimes) {
        for (const typeId of regime.appliesToIds) {
          if (!typeIds.has(typeId)) {
            errors.push(`Régime "${regime.id}": le type "${typeId}" n'existe pas dans l'export`);
          }
        }
      }
    }

    // Vérifier les compatibilités
    if (bundle.data.compat) {
      for (const compat of bundle.data.compat) {
        if (compat.scope === 'category') {
          const validCategories = ['FONCIER', 'BIC', 'IS'];
          if (!validCategories.includes(compat.left) || !validCategories.includes(compat.right)) {
            errors.push(`Compatibilité "${compat.id}": catégorie invalide (${compat.left} ou ${compat.right})`);
          }
        }
      }
    }

    // Vérifier les sections du jsonData
    const jsonData = bundle.data.params.jsonData;
    const requiredSections = [
      { old: 'IR', new: 'irBrackets' },
      { old: 'PS', new: 'psRate' },
      { old: 'Micro', new: 'micro' },
      { old: 'Déficit', new: 'deficitFoncier' },
      { old: 'PER', new: 'per' },
      { old: 'SCI_IS', new: 'sciIS' },
    ];
    
    for (const section of requiredSections) {
      // Accepter les deux formats (ancien et nouveau)
      if (!jsonData[section.old] && !jsonData[section.new]) {
        warnings.push(`Section manquante dans jsonData: ${section.old} (ou ${section.new})`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats: {
        version: true,
        params: true,
        typesCount: bundle.data.types?.length || 0,
        regimesCount: bundle.data.regimes?.length || 0,
        compatCount: bundle.data.compat?.length || 0,
      },
    };
  } catch (error: any) {
    if (error.errors) {
      // Erreur Zod
      for (const err of error.errors) {
        errors.push(`${err.path.join('.')}: ${err.message}`);
      }
    } else {
      errors.push(error.message);
    }

    return {
      valid: false,
      errors,
      warnings,
      stats: {
        version: false,
        params: false,
        typesCount: 0,
        regimesCount: 0,
        compatCount: 0,
      },
    };
  }
}

// ========== DRY-RUN ==========

async function performDryRun(
  bundle: FiscalExportBundle,
  options: ImportOptions
): Promise<ImportDryRunResult> {
  const validation = await validateBundle(bundle);
  
  if (!validation.valid) {
    return {
      ...validation,
      preview: {
        typesToCreate: [],
        typesToUpdate: [],
        regimesToCreate: [],
        regimesToUpdate: [],
        compatToCreate: [],
        compatToUpdate: [],
      },
    };
  }

  const preview: ImportDryRunResult['preview'] = {
    typesToCreate: [],
    typesToUpdate: [],
    regimesToCreate: [],
    regimesToUpdate: [],
    compatToCreate: [],
    compatToUpdate: [],
  };

  // Vérifier si la version existe
  const targetCode = options.targetCode || bundle.data.version.code;
  const existingVersion = await prisma.fiscalVersion.findUnique({
    where: { code: targetCode },
    include: { params: true }, // Inclure les params pour comparaison
  });

  if (existingVersion) {
    // Comparer les barèmes pour détecter les vrais changements
    const changes: string[] = [];
    let oldParams: any = null;
    
    if (existingVersion.params) {
      oldParams = JSON.parse(existingVersion.params.jsonData);
      const newParams = bundle.data.params.jsonData;
      
      // Comparer les JSON (stringify pour comparaison profonde)
      if (JSON.stringify(oldParams) !== JSON.stringify(newParams)) {
        changes.push('Mise à jour des barèmes fiscaux');
      }
      
      if (existingVersion.params.overrides !== (bundle.data.params.overrides ? JSON.stringify(bundle.data.params.overrides) : null)) {
        changes.push('Mise à jour des overrides');
      }
    } else {
      changes.push('Ajout des paramètres fiscaux');
    }
    
    // Seulement marquer comme "mise à jour" s'il y a vraiment des changements
    if (changes.length > 0) {
      preview.versionToUpdate = {
        id: existingVersion.id,
        changes,
        oldParams, // Envoyer l'ancien JSON pour comparaison frontend
      };
    }
  } else {
    preview.versionToCreate = {
      ...bundle.data.version,
      code: targetCode,
      status: 'draft', // Toujours créer en draft
    };
  }

  // Analyser les types
  if (options.importTypes && bundle.data.types) {
    for (const type of bundle.data.types) {
      const existing = await prisma.fiscalType.findUnique({
        where: { id: type.id },
      });
      if (existing) {
        // Vérifier si les données ont vraiment changé
        const hasChanges = 
          existing.label !== type.label ||
          existing.category !== type.category ||
          existing.description !== type.description ||
          existing.isActive !== type.isActive;
        
        if (hasChanges) {
          preview.typesToUpdate.push(type.id);
        }
      } else {
        preview.typesToCreate.push(type.id);
      }
    }
  }

  // Analyser les régimes
  if (options.importRegimes && bundle.data.regimes) {
    for (const regime of bundle.data.regimes) {
      const existing = await prisma.fiscalRegime.findUnique({
        where: { id: regime.id },
      });
      if (existing) {
        // Comparer après normalisation du calcProfile
        const normalizedCalcProfile = denormalizeCalcProfile(regime.calcProfile);
        const existingAppliesToIds = JSON.parse(existing.appliesToIds);
        const existingEligibility = existing.eligibility ? JSON.parse(existing.eligibility) : null;
        
        const hasChanges = 
          existing.label !== regime.label ||
          JSON.stringify(existingAppliesToIds.sort()) !== JSON.stringify(regime.appliesToIds.sort()) ||
          existing.engagementYears !== regime.engagementYears ||
          JSON.stringify(existingEligibility) !== JSON.stringify(regime.eligibility) ||
          existing.calcProfile !== normalizedCalcProfile ||
          existing.description !== regime.description ||
          existing.isActive !== regime.isActive;
        
        if (hasChanges) {
          preview.regimesToUpdate.push(regime.id);
        }
      } else {
        preview.regimesToCreate.push(regime.id);
      }
    }
  }

  // Analyser les compatibilités
  if (options.importCompat && bundle.data.compat) {
    for (const compat of bundle.data.compat) {
      // Vérifier si existe déjà (par scope+left+right)
      const existing = await prisma.fiscalCompatibility.findFirst({
        where: {
          scope: compat.scope,
          left: compat.left,
          right: compat.right,
        },
      });

      if (existing) {
        // Vérifier si les données ont vraiment changé
        const hasChanges = 
          existing.rule !== compat.rule ||
          existing.note !== compat.note;
        
        if (hasChanges) {
          preview.compatToUpdate.push(compat.id || existing.id);
        }
      } else {
        preview.compatToCreate.push(compat.id || `${compat.scope}:${compat.left}-${compat.right}`);
      }
    }
  }

  return {
    ...validation,
    preview,
  };
}

// ========== APPLY ==========

async function performImport(
  bundle: FiscalExportBundle,
  options: ImportOptions
): Promise<ImportResult> {
  const targetCode = options.targetCode || bundle.data.version.code;
  
  const changes = {
    version: 'created' as 'created' | 'updated',
    types: { created: 0, updated: 0 },
    regimes: { created: 0, updated: 0 },
    compat: { created: 0, updated: 0 },
  };

  let versionId = '';
  let finalVersionCode = targetCode;

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Créer ou mettre à jour la version
      const existingVersion = await tx.fiscalVersion.findUnique({
        where: { code: targetCode },
        include: { params: true },
      });

      if (existingVersion) {
        // Si la version est publiée ou archivée, créer une nouvelle version
        if (existingVersion.status !== 'draft') {
          // Générer un nouveau code automatiquement
          const newCode = `${targetCode}-import-${Date.now().toString().slice(-6)}`;
          
          const newVersion = await tx.fiscalVersion.create({
            data: {
              code: newCode,
              year: bundle.data.version.year,
              source: bundle.data.version.source,
              status: 'draft',
              notes: `Importé depuis ${targetCode} - ${bundle.data.version.notes || ''}`,
              params: {
                create: {
                  jsonData: JSON.stringify(bundle.data.params.jsonData),
                  overrides: bundle.data.params.overrides ? JSON.stringify(bundle.data.params.overrides) : null,
                },
              },
            },
          });

          versionId = newVersion.id;
          finalVersionCode = newCode;
          changes.version = 'created';
          
          console.log(`✅ Version publiée détectée, nouvelle version créée: ${newCode}`);
        } else {
          // Mise à jour du draft existant
          await tx.fiscalVersion.update({
            where: { id: existingVersion.id },
            data: {
              year: bundle.data.version.year,
              source: bundle.data.version.source,
              notes: bundle.data.version.notes,
              updatedAt: new Date(),
            },
          });

          // Mettre à jour les paramètres
          if (existingVersion.params) {
            await tx.fiscalParams.update({
              where: { id: existingVersion.params.id },
              data: {
                jsonData: JSON.stringify(bundle.data.params.jsonData),
                overrides: bundle.data.params.overrides ? JSON.stringify(bundle.data.params.overrides) : null,
                updatedAt: new Date(),
              },
            });
          } else {
            await tx.fiscalParams.create({
              data: {
                versionId: existingVersion.id,
                jsonData: JSON.stringify(bundle.data.params.jsonData),
                overrides: bundle.data.params.overrides ? JSON.stringify(bundle.data.params.overrides) : null,
              },
            });
          }

          versionId = existingVersion.id;
          changes.version = 'updated';
        }
      } else {
        // Créer une nouvelle version (toujours en draft)
        const newVersion = await tx.fiscalVersion.create({
          data: {
            code: targetCode,
            year: bundle.data.version.year,
            source: bundle.data.version.source,
            status: 'draft',
            notes: bundle.data.version.notes,
            params: {
              create: {
                jsonData: JSON.stringify(bundle.data.params.jsonData),
                overrides: bundle.data.params.overrides ? JSON.stringify(bundle.data.params.overrides) : null,
              },
            },
          },
        });

        versionId = newVersion.id;
        changes.version = 'created';
      }

      // 2. Importer les types
      if (options.importTypes && bundle.data.types) {
        for (const type of bundle.data.types) {
          const existing = await tx.fiscalType.findUnique({
            where: { id: type.id },
          });

          if (existing) {
            if (options.strategy === 'replace' || options.strategy === 'merge') {
              await tx.fiscalType.update({
                where: { id: type.id },
                data: {
                  label: type.label,
                  category: type.category,
                  description: type.description,
                  isActive: type.isActive,
                  updatedAt: new Date(),
                },
              });
              changes.types.updated++;
            }
          } else {
            await tx.fiscalType.create({
              data: {
                id: type.id,
                label: type.label,
                category: type.category,
                description: type.description,
                isActive: type.isActive,
              },
            });
            changes.types.created++;
          }
        }
      }

      // 3. Importer les régimes
      if (options.importRegimes && bundle.data.regimes) {
        for (const regime of bundle.data.regimes) {
          const existing = await tx.fiscalRegime.findUnique({
            where: { id: regime.id },
          });

          if (existing) {
            if (options.strategy === 'replace' || options.strategy === 'merge') {
              await tx.fiscalRegime.update({
                where: { id: regime.id },
                data: {
                  label: regime.label,
                  appliesToIds: JSON.stringify(regime.appliesToIds),
                  engagementYears: regime.engagementYears,
                  eligibility: regime.eligibility ? JSON.stringify(regime.eligibility) : null,
                  calcProfile: denormalizeCalcProfile(regime.calcProfile),
                  description: regime.description,
                  isActive: regime.isActive,
                  updatedAt: new Date(),
                },
              });
              changes.regimes.updated++;
            }
          } else {
            await tx.fiscalRegime.create({
              data: {
                id: regime.id,
                label: regime.label,
                appliesToIds: JSON.stringify(regime.appliesToIds),
                engagementYears: regime.engagementYears,
                eligibility: regime.eligibility ? JSON.stringify(regime.eligibility) : null,
                calcProfile: denormalizeCalcProfile(regime.calcProfile),
                description: regime.description,
                isActive: regime.isActive,
              },
            });
            changes.regimes.created++;
          }
        }
      }

      // 4. Importer les compatibilités
      if (options.importCompat && bundle.data.compat) {
        for (const compat of bundle.data.compat) {
          // Vérifier si existe déjà (par scope+left+right)
          const existing = await tx.fiscalCompatibility.findFirst({
            where: {
              scope: compat.scope,
              left: compat.left,
              right: compat.right,
            },
          });

          if (existing) {
            if (options.strategy === 'replace' || options.strategy === 'merge') {
              await tx.fiscalCompatibility.update({
                where: { id: existing.id },
                data: {
                  rule: compat.rule,
                  note: compat.note,
                  updatedAt: new Date(),
                },
              });
              changes.compat.updated++;
            }
          } else {
            await tx.fiscalCompatibility.create({
              data: {
                scope: compat.scope,
                left: compat.left,
                right: compat.right,
                rule: compat.rule,
                note: compat.note,
              },
            });
            changes.compat.created++;
          }
        }
      }
    });

    // Log de l'import
    console.log(`✅ Import réussi: version ${finalVersionCode}`, changes);

    return {
      success: true,
      versionId,
      versionCode: finalVersionCode,
      changes,
      message: `Import réussi: ${changes.version === 'created' ? `Version créée (${finalVersionCode})` : 'Version mise à jour'}`,
    };
  } catch (error: any) {
    console.error('Erreur lors de l\'import:', error);
    throw error;
  }
}


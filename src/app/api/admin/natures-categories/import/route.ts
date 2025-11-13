import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

        try {
          console.log('[IMPORT API] ===== DÉBUT IMPORT =====');
          const body = await request.json();
          const { natures, categories, mappings, importMode = 'overwrite' } = body;
          
          console.log('[IMPORT API] Mode d\'import:', importMode);
          console.log('[IMPORT API] Données reçues:');
          console.log('  - Natures:', natures?.length || 0);
          console.log('  - Catégories:', categories?.length || 0);
          console.log('  - Mappings:', mappings?.length || 0);
          
          // Log des natures
          if (natures && natures.length > 0) {
            console.log('[IMPORT API] Natures à importer:');
            natures.forEach((n, i) => {
              console.log(`  ${i+1}. ${n.key || n.code}: ${n.label}`);
            });
          }
          
          // Log des catégories
          if (categories && categories.length > 0) {
            console.log('[IMPORT API] Catégories à importer:');
            categories.forEach((c, i) => {
              console.log(`  ${i+1}. ${c.key || c.slug}: ${c.label} (type: ${c.type})`);
            });
          }
          
          // Log des mappings
          if (mappings && mappings.length > 0) {
            console.log('[IMPORT API] Mappings à importer:');
            mappings.forEach((m, i) => {
              console.log(`  ${i+1}. ${m.nature || m.natureCode} → ${m.Category || 'Aucune'} (types: ${m.types?.join(', ') || 'Aucun'})`);
            });
          }
    
    console.log('[IMPORT API] Données reçues:', {
      naturesCount: natures?.length || 0,
      categoriesCount: categories?.length || 0,
      mappingsCount: mappings?.length || 0
    });

    // Valider la structure
    if (!natures || !Array.isArray(natures)) {
      return NextResponse.json(
        { success: false, error: 'Structure invalide: natures manquantes' },
        { status: 400 }
      );
    }

    if (!categories || !Array.isArray(categories)) {
      return NextResponse.json(
        { success: false, error: 'Structure invalide: categories manquantes' },
        { status: 400 }
      );
    }

    if (!mappings || !Array.isArray(mappings)) {
      return NextResponse.json(
        { success: false, error: 'Structure invalide: mappings manquants' },
        { status: 400 }
      );
    }

          // Implémenter l'import réel
          let created = 0;
          let updated = 0;
          let skipped = 0;
          let deleted = 0;
          
          // Mode overwrite : supprimer les données existantes
          if (importMode === 'overwrite') {
            console.log('[IMPORT API] ===== MODE OVERWRITE - SUPPRESSION =====');
            
            // Supprimer les mappings existants
            console.log('[IMPORT API] Suppression des mappings existants...');
            const deletedMappings = await prisma.natureDefault.deleteMany({});
            console.log(`[IMPORT API] ✅ ${deletedMappings.count} mappings supprimés`);
            deleted += deletedMappings.count;
            
            // Supprimer les catégories existantes
            console.log('[IMPORT API] Suppression des catégories existantes...');
            const deletedCategories = await prisma.category.deleteMany({});
            console.log(`[IMPORT API] ✅ ${deletedCategories.count} catégories supprimées`);
            deleted += deletedCategories.count;
            
            // Supprimer les natures existantes
            console.log('[IMPORT API] Suppression des natures existantes...');
            const deletedNatures = await prisma.natureEntity.deleteMany({});
            console.log(`[IMPORT API] ✅ ${deletedNatures.count} natures supprimées`);
            deleted += deletedNatures.count;
            
            console.log('[IMPORT API] ===== SUPPRESSION TERMINÉE =====');
          }

        // Importer les natures
        console.log('[IMPORT API] ===== IMPORT DES NATURES =====');
        for (const nature of natures) {
          try {
            // Support both 'code' and 'key' formats
            const natureCode = nature.code || nature.key;
            const natureLabel = nature.label;
            const natureFlow = nature.flow || (natureCode.startsWith('RECETTE') ? 'INCOME' : 'EXPENSE');
            
            console.log(`[IMPORT API] 🔄 Traitement nature: ${natureCode} (${natureLabel}) - flow: ${natureFlow}`);
            
            if (importMode === 'overwrite') {
              // Mode overwrite : créer directement (les données ont été supprimées)
              console.log(`[IMPORT API] ➕ Création nature (overwrite): ${natureCode}`);
              const newNature = await prisma.natureEntity.create({
                data: {
                  code: natureCode,
                  label: natureLabel,
                  flow: natureFlow
                }
              });
              console.log(`[IMPORT API] ✅ Nature créée avec ID: ${newNature.code}`);
              created++;
            } else {
              // Mode merge : upsert
              const existing = await prisma.natureEntity.findUnique({
                where: { code: natureCode }
              });
              
              if (existing) {
                console.log(`[IMPORT API] 🔄 Nature existante, mise à jour: ${natureCode}`);
                await prisma.natureEntity.update({
                  where: { code: natureCode },
                  data: {
                    label: natureLabel,
                    flow: natureFlow
                  }
                });
                console.log(`[IMPORT API] ✅ Nature mise à jour: ${natureCode}`);
                updated++;
              } else {
                console.log(`[IMPORT API] ➕ Création nouvelle nature: ${natureCode}`);
                const newNature = await prisma.natureEntity.create({
                  data: {
                    code: natureCode,
                    label: natureLabel,
                    flow: natureFlow
                  }
                });
                console.log(`[IMPORT API] ✅ Nature créée avec ID: ${newNature.code}`);
                created++;
              }
            }

            // Créer les règles de compatibilité si fournies
            if (nature.compatibleTypes && nature.compatibleTypes.length > 0) {
              console.log(`[IMPORT API] 🔄 Création règles pour ${natureCode}: ${nature.compatibleTypes.join(', ')}`);
              
              // Supprimer les anciennes règles
              await prisma.natureRule.deleteMany({
                where: { natureCode: natureCode }
              });

              // Créer les nouvelles règles
              await Promise.all(
                nature.compatibleTypes.map((type: string) =>
                  prisma.natureRule.create({
                    data: {
                      natureCode: natureCode,
                      allowedType: type
                    }
                  })
                )
              );
              console.log(`[IMPORT API] ✅ Règles créées pour ${natureCode}`);
            }
          } catch (error) {
            console.error(`[IMPORT API] ❌ Erreur import nature ${nature.code || nature.key}:`, error);
            skipped++;
          }
        }
        console.log(`[IMPORT API] ===== NATURES TERMINÉES: ${created} créées, ${updated} mises à jour, ${skipped} ignorées =====`);

        // Importer les catégories
        console.log('[IMPORT API] ===== IMPORT DES CATÉGORIES =====');
        for (const category of categories) {
          try {
            // Support both 'slug' and 'key' formats
            // Generate a proper slug from key if needed (lowercase, replace underscores with hyphens)
            let categorySlug = category.slug;
            if (!categorySlug && category.key) {
              // Create a simple slug from key only (avoid repetition)
              categorySlug = category.key.toLowerCase().replace(/_/g, '-');
            }
            
            const categoryLabel = category.label;
            const categoryType = category.type || 'OTHER';
            const categoryActive = category.actif !== false && category.active !== false && category.isActive !== false;
            
            console.log(`[IMPORT API] 🔄 Traitement catégorie: ${categorySlug} (${categoryLabel}) - type: ${categoryType}`);
            
            if (importMode === 'overwrite') {
              // Mode overwrite : créer directement (les données ont été supprimées)
              console.log(`[IMPORT API] ➕ Création catégorie (overwrite): ${categorySlug}`);
              const newCategory = await prisma.category.create({
                data: {
                  slug: categorySlug,
                  label: categoryLabel,
                  type: categoryType,
                  actif: categoryActive
                }
              });
              console.log(`[IMPORT API] ✅ Catégorie créée avec ID: ${newCategory.id} (slug: ${newCategory.slug})`);
              created++;
            } else {
              // Mode merge : upsert
              const existing = await prisma.category.findUnique({
                where: { slug: categorySlug }
              });
              
              if (existing) {
                console.log(`[IMPORT API] 🔄 Catégorie existante, mise à jour: ${categorySlug}`);
                await prisma.category.update({
                  where: { slug: categorySlug },
                  data: {
                    label: categoryLabel,
                    type: categoryType,
                    actif: categoryActive
                  }
                });
                console.log(`[IMPORT API] ✅ Catégorie mise à jour: ${categorySlug}`);
                updated++;
              } else {
                console.log(`[IMPORT API] ➕ Création nouvelle catégorie: ${categorySlug}`);
                const newCategory = await prisma.category.create({
                  data: {
                    slug: categorySlug,
                    label: categoryLabel,
                    type: categoryType,
                    actif: categoryActive
                  }
                });
                console.log(`[IMPORT API] ✅ Catégorie créée avec ID: ${newCategory.id} (slug: ${newCategory.slug})`);
                created++;
              }
            }
          } catch (error) {
            console.error(`[IMPORT API] ❌ Erreur import catégorie ${category.slug || category.key}:`, error);
            skipped++;
          }
        }
        console.log(`[IMPORT API] ===== CATÉGORIES TERMINÉES: ${created} créées, ${updated} mises à jour, ${skipped} ignorées =====`);

    // Importer les mappings
    console.log('[IMPORT API] ===== IMPORT DES MAPPINGS =====');
    for (const mapping of mappings) {
      try {
        // Support both 'natureCode' and 'nature' formats
        const natureCode = mapping.natureCode || mapping.nature;
        console.log(`[IMPORT API] 🔄 Traitement mapping: ${natureCode}`);

        // Vérifier que la nature existe
        const nature = await prisma.natureEntity.findUnique({
          where: { code: natureCode }
        });

        if (!nature) {
          console.warn(`[IMPORT API] ❌ Nature ${natureCode} non trouvée pour le mapping`);
          skipped++;
          continue;
        }
        console.log(`[IMPORT API] ✅ Nature trouvée: ${nature.code} (${nature.label})`);

        // Vérifier que la catégorie par défaut existe
        let defaultCategoryId = null;
        
        // Si defaultCategory est fourni directement
        if (mapping.Category) {
          console.log(`[IMPORT API] 🔍 Recherche catégorie par defaultCategory: ${mapping.Category}`);
          
          // Try to find by ID first (exported format), then by slug, then by type
          let defaultCategory = await prisma.category.findUnique({
            where: { id: mapping.Category }
          }).catch(() => null);
          
          if (!defaultCategory) {
            console.log(`[IMPORT API] 🔍 Pas trouvé par ID, recherche par slug: ${mapping.Category}`);
            // If not found by ID, try by slug (exact match)
            defaultCategory = await prisma.category.findUnique({
              where: { slug: mapping.Category }
            }).catch(() => null);
          }
          
          if (!defaultCategory) {
            console.log(`[IMPORT API] 🔍 Pas trouvé par slug exact, recherche par début: ${mapping.Category}`);
            // If still not found, try by slug starting with the key (for generated slugs)
            const key = mapping.Category.toLowerCase().replace(/_/g, '-');
            defaultCategory = await prisma.category.findFirst({
              where: {
                slug: {
                  startsWith: key
                }
              }
            }).catch(() => null);
          }
          
          if (defaultCategory) {
            defaultCategoryId = defaultCategory.id;
            console.log(`[IMPORT API] ✅ Catégorie par défaut trouvée: ${defaultCategory.label} (${defaultCategory.slug}) - ID: ${defaultCategory.id}`);
          } else {
            console.warn(`[IMPORT API] ❌ Catégorie par défaut ${mapping.Category} non trouvée`);
          }
        }
        // Si pas de defaultCategory mais des types, chercher la première catégorie compatible
        else if (mapping.types && mapping.types.length > 0) {
          console.log(`[IMPORT API] 🔍 Recherche catégorie par type: ${mapping.types[0]}`);
          
          // Chercher une catégorie avec le type correspondant
          const defaultCategory = await prisma.category.findFirst({
            where: {
              type: mapping.types[0]
            }
          });
          
          if (defaultCategory) {
            defaultCategoryId = defaultCategory.id;
            console.log(`[IMPORT API] ✅ Catégorie trouvée par type: ${defaultCategory.label} (${defaultCategory.type}) - ID: ${defaultCategory.id}`);
          } else {
            console.warn(`[IMPORT API] ❌ Aucune catégorie trouvée pour le type: ${mapping.types[0]}`);
          }
        }

        // Mettre à jour ou créer le mapping
        if (importMode === 'overwrite') {
          // Mode overwrite : créer directement (les mappings ont été supprimés)
          console.log(`[IMPORT API] ➕ Création mapping (overwrite): ${natureCode} → ${defaultCategoryId || 'Aucune'}`);
          const newMapping = await prisma.natureDefault.create({
            data: {
              natureCode: natureCode,
              defaultCategoryId: defaultCategoryId
            }
          });
          console.log(`[IMPORT API] ✅ Mapping créé: ${newMapping.natureCode} → ${newMapping.defaultCategoryId || 'Aucune'}`);
          created++;
        } else {
          // Mode merge : upsert
          console.log(`[IMPORT API] 🔄 Upsert mapping: ${natureCode} → ${defaultCategoryId || 'Aucune'}`);
          const mapping = await prisma.natureDefault.upsert({
            where: { natureCode: natureCode },
            update: {
              defaultCategoryId: defaultCategoryId
            },
            create: {
              natureCode: natureCode,
              defaultCategoryId: defaultCategoryId
            }
          });
          console.log(`[IMPORT API] ✅ Mapping upserté: ${mapping.natureCode} → ${mapping.defaultCategoryId || 'Aucune'}`);
          updated++;
        }
      } catch (error) {
        console.error(`[IMPORT API] ❌ Erreur import mapping ${mapping.natureCode || mapping.nature}:`, error);
        skipped++;
      }
    }
    console.log(`[IMPORT API] ===== MAPPINGS TERMINÉS: ${created} créés, ${updated} mis à jour, ${skipped} ignorés =====`);

          console.log('[IMPORT API] ===== IMPORT TERMINÉ =====');
          console.log(`[IMPORT API] Résultat final: ${created} créés, ${updated} mis à jour, ${skipped} ignorés, ${deleted} supprimés`);
          
          return NextResponse.json({
            success: true,
            data: {
              created,
              updated,
              skipped,
              deleted,
              importMode,
              message: importMode === 'overwrite' 
                ? `Import terminé (overwrite) - Supprimés: ${deleted}, Créés: ${created}, Ignorés: ${skipped}`
                : `Import terminé (merge) - Créés: ${created}, Mis à jour: ${updated}, Ignorés: ${skipped}`
            }
          });
  } catch (error) {
    console.error('Error importing natures-categories:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\'import' },
      { status: 500 }
    );
  }
}

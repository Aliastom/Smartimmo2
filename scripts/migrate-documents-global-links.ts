import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateDocumentsGlobalLinks() {
  console.log('🚀 Début de la migration des liaisons GLOBAL pour les documents...');
  
  try {
    // 1. Récupérer tous les documents qui n'ont pas encore de liaison GLOBAL
    const documentsWithoutGlobal = await prisma.document.findMany({
      where: {
        links: {
          none: {
            targetType: 'GLOBAL'
          }
        },
        deletedAt: null // Exclure les documents supprimés
      },
      select: {
        id: true,
        filenameOriginal: true,
        createdAt: true
      }
    });

    console.log(`📊 ${documentsWithoutGlobal.length} documents trouvés sans liaison GLOBAL`);

    if (documentsWithoutGlobal.length === 0) {
      console.log('✅ Aucune migration nécessaire - tous les documents ont déjà une liaison GLOBAL');
      return;
    }

    // 2. Créer les liaisons GLOBAL pour chaque document
    let successCount = 0;
    let errorCount = 0;

    for (const document of documentsWithoutGlobal) {
      try {
        await prisma.documentLink.create({
          data: {
            documentId: document.id,
            targetType: 'GLOBAL',
            targetId: null,
            role: 'DERIVED'
          }
        });
        
        successCount++;
        
        if (successCount % 100 === 0) {
          console.log(`⏳ ${successCount}/${documentsWithoutGlobal.length} documents traités...`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Erreur pour le document ${document.id} (${document.filenameOriginal}):`, error);
      }
    }

    console.log(`✅ Migration terminée:`);
    console.log(`   - ${successCount} liaisons GLOBAL créées avec succès`);
    console.log(`   - ${errorCount} erreurs rencontrées`);

    // 3. Vérification finale
    const totalDocuments = await prisma.document.count({
      where: { deletedAt: null }
    });
    
    const documentsWithGlobal = await prisma.document.count({
      where: {
        links: {
          some: {
            targetType: 'GLOBAL'
          }
        },
        deletedAt: null
      }
    });

    console.log(`📈 Statistiques finales:`);
    console.log(`   - Total documents actifs: ${totalDocuments}`);
    console.log(`   - Documents avec liaison GLOBAL: ${documentsWithGlobal}`);
    console.log(`   - Couverture: ${((documentsWithGlobal / totalDocuments) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('💥 Erreur lors de la migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter la migration si le script est appelé directement
if (require.main === module) {
  migrateDocumentsGlobalLinks()
    .then(() => {
      console.log('🎉 Migration terminée avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Échec de la migration:', error);
      process.exit(1);
    });
}

export { migrateDocumentsGlobalLinks };

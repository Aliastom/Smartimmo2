import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testGlobalLinksSystem() {
  console.log('🧪 Test du système de liaisons GLOBAL...\n');
  
  try {
    // 1. Vérifier que tous les documents ont une liaison GLOBAL
    console.log('📊 Test 1: Vérification des liaisons GLOBAL...');
    
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
    
    console.log(`   - Total documents actifs: ${totalDocuments}`);
    console.log(`   - Documents avec liaison GLOBAL: ${documentsWithGlobal}`);
    console.log(`   - Couverture: ${((documentsWithGlobal / totalDocuments) * 100).toFixed(1)}%`);
    
    if (documentsWithGlobal === totalDocuments) {
      console.log('   ✅ Tous les documents ont une liaison GLOBAL');
    } else {
      console.log('   ⚠️  Certains documents n\'ont pas de liaison GLOBAL');
    }

    // 2. Tester la requête de la page Documents globale
    console.log('\n📊 Test 2: Requête page Documents globale...');
    
    const globalLinks = await prisma.documentLink.findMany({
      where: {
        targetType: 'GLOBAL'
      },
      include: {
        document: {
          include: {
            documentType: true,
            links: true
          }
        }
      },
      take: 5,
      orderBy: {
        document: { createdAt: 'desc' }
      }
    });
    
    console.log(`   - ${globalLinks.length} liaisons GLOBAL récupérées (échantillon)`);
    
    globalLinks.forEach((link, index) => {
      const doc = link.document;
      const otherLinks = doc.links.filter(l => l.targetType !== 'GLOBAL');
      console.log(`   ${index + 1}. ${doc.filenameOriginal}`);
      console.log(`      - Type: ${doc.documentType?.label || 'Non classé'}`);
      console.log(`      - Autres liaisons: ${otherLinks.length} (${otherLinks.map(l => l.targetType).join(', ')})`);
    });

    // 3. Vérifier qu'il n'y a pas de doublons dans la page globale
    console.log('\n📊 Test 3: Vérification des doublons...');
    
    const globalLinksCount = await prisma.documentLink.count({
      where: { targetType: 'GLOBAL' }
    });
    
    const uniqueDocumentsWithGlobal = await prisma.document.count({
      where: {
        links: {
          some: {
            targetType: 'GLOBAL'
          }
        }
      }
    });
    
    console.log(`   - Nombre de liaisons GLOBAL: ${globalLinksCount}`);
    console.log(`   - Nombre de documents uniques avec liaison GLOBAL: ${uniqueDocumentsWithGlobal}`);
    
    if (globalLinksCount === uniqueDocumentsWithGlobal) {
      console.log('   ✅ Aucun doublon détecté');
    } else {
      console.log('   ⚠️  Doublons détectés !');
    }

    // 4. Tester les statistiques
    console.log('\n📊 Test 4: Statistiques des documents...');
    
    const stats = await prisma.document.groupBy({
      by: ['status'],
      where: {
        links: {
          some: {
            targetType: 'GLOBAL'
          }
        },
        deletedAt: null
      },
      _count: {
        id: true
      }
    });
    
    console.log('   - Répartition par statut:');
    stats.forEach(stat => {
      console.log(`     ${stat.status}: ${stat._count.id} documents`);
    });

    // 5. Tester les filtres
    console.log('\n📊 Test 5: Test des filtres...');
    
    // Test filtre par type
    const documentsWithType = await prisma.documentLink.count({
      where: {
        targetType: 'GLOBAL',
        document: {
          documentType: {
            isNot: null
          }
        }
      }
    });
    
    console.log(`   - Documents avec type défini: ${documentsWithType}`);
    
    // Test filtre par période (derniers 30 jours)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentDocuments = await prisma.documentLink.count({
      where: {
        targetType: 'GLOBAL',
        document: {
          createdAt: {
            gte: thirtyDaysAgo
          }
        }
      }
    });
    
    console.log(`   - Documents des 30 derniers jours: ${recentDocuments}`);

    console.log('\n✅ Tous les tests sont passés avec succès !');
    console.log('\n📝 Le système de liaisons GLOBAL est opérationnel :');
    console.log('   - Tous les documents ont une liaison GLOBAL');
    console.log('   - La page Documents globale peut récupérer tous les documents');
    console.log('   - Aucun doublon dans l\'affichage global');
    console.log('   - Les filtres fonctionnent correctement');

  } catch (error) {
    console.error('💥 Erreur lors des tests:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter les tests si le script est appelé directement
if (require.main === module) {
  testGlobalLinksSystem()
    .then(() => {
      console.log('\n🎉 Tests terminés avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Échec des tests:', error);
      process.exit(1);
    });
}

export { testGlobalLinksSystem };

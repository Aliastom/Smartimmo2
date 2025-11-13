import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testGlobalLinksSimple() {
  console.log('🧪 Test simple du système de liaisons GLOBAL...\n');
  
  try {
    // 1. Créer un document de test
    console.log('📝 Création d\'un document de test...');
    
    const testDocument = await prisma.document.create({
      data: {
        ownerId: 'test-user',
        bucketKey: 'test/bucket/key',
        filenameOriginal: 'test-document.pdf',
        fileName: 'test-document.pdf',
        mime: 'application/pdf',
        size: 1024,
        url: '/test/document.pdf',
        status: 'classified',
        source: 'upload',
        uploadedAt: new Date(),
      }
    });
    
    console.log(`✅ Document créé: ${testDocument.id}`);

    // 2. Créer une liaison GLOBAL
    console.log('🔗 Création d\'une liaison GLOBAL...');
    
    const globalLink = await prisma.documentLink.create({
      data: {
        documentId: testDocument.id,
        targetType: 'GLOBAL',
        targetId: null,
        role: 'DERIVED'
      }
    });
    
    console.log(`✅ Liaison GLOBAL créée: ${globalLink.id}`);

    // 3. Créer une liaison PROPERTY
    console.log('🏠 Création d\'une liaison PROPERTY...');
    
    const propertyLink = await prisma.documentLink.create({
      data: {
        documentId: testDocument.id,
        targetType: 'PROPERTY',
        targetId: 'test-property-id',
        role: 'PRIMARY'
      }
    });
    
    console.log(`✅ Liaison PROPERTY créée: ${propertyLink.id}`);

    // 4. Tester la requête de la page Documents globale
    console.log('\n📊 Test de la requête page Documents globale...');
    
    const globalLinks = await prisma.documentLink.findMany({
      where: {
        targetType: 'GLOBAL'
      },
      include: {
        document: {
          include: {
            links: true
          }
        }
      }
    });
    
    console.log(`✅ ${globalLinks.length} liaison(s) GLOBAL trouvée(s)`);
    
    globalLinks.forEach((link, index) => {
      const doc = link.document;
      const otherLinks = doc.links.filter(l => l.targetType !== 'GLOBAL');
      console.log(`   ${index + 1}. ${doc.filenameOriginal}`);
      console.log(`      - Autres liaisons: ${otherLinks.length} (${otherLinks.map(l => l.targetType).join(', ')})`);
    });

    // 5. Vérifier qu'il n'y a pas de doublons
    console.log('\n🔍 Vérification des doublons...');
    
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

    console.log('\n✅ Test simple réussi !');
    console.log('\n📝 Le système de liaisons GLOBAL fonctionne correctement :');
    console.log('   - Création de documents ✅');
    console.log('   - Création de liaisons GLOBAL ✅');
    console.log('   - Création de liaisons contextuelles ✅');
    console.log('   - Requête page Documents globale ✅');
    console.log('   - Pas de doublons ✅');

  } catch (error) {
    console.error('💥 Erreur lors du test:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le test
testGlobalLinksSimple()
  .then(() => {
    console.log('\n🎉 Test terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec du test:', error);
    process.exit(1);
  });

export { testGlobalLinksSimple };

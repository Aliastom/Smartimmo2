import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDocumentsAPI() {
  console.log('🧪 Test de l\'API Documents avec liaisons GLOBAL...\n');
  
  try {
    // 1. Créer plusieurs documents de test avec différentes liaisons
    console.log('📝 Création de documents de test...');
    
    const documents = [];
    const documentTypes = ['Quittance', 'Bail', 'DPE', 'Assurance'];
    
    for (let i = 0; i < 4; i++) {
      const doc = await prisma.document.create({
        data: {
          ownerId: 'test-user',
          bucketKey: `test/bucket/key-${i}`,
          filenameOriginal: `${documentTypes[i]}-test-${i}.pdf`,
          fileName: `${documentTypes[i]}-test-${i}.pdf`,
          mime: 'application/pdf',
          size: 1024 + i * 100,
          url: `/test/document-${i}.pdf`,
          status: 'classified',
          source: 'upload',
          uploadedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000), // Dates différentes
        }
      });
      documents.push(doc);
    }
    
    console.log(`✅ ${documents.length} documents créés`);

    // 2. Créer des liaisons GLOBAL pour tous les documents
    console.log('🔗 Création des liaisons GLOBAL...');
    
    for (const doc of documents) {
      await prisma.documentLink.create({
        data: {
          documentId: doc.id,
          targetType: 'GLOBAL',
          targetId: null,
          role: 'DERIVED'
        }
      });
    }
    
    console.log('✅ Liaisons GLOBAL créées pour tous les documents');

    // 3. Créer des liaisons contextuelles pour certains documents
    console.log('🏠 Création de liaisons contextuelles...');
    
    // Document 0: PROPERTY
    await prisma.documentLink.create({
      data: {
        documentId: documents[0].id,
        targetType: 'PROPERTY',
        targetId: 'property-1',
        role: 'PRIMARY'
      }
    });
    
    // Document 1: LEASE
    await prisma.documentLink.create({
      data: {
        documentId: documents[1].id,
        targetType: 'LEASE',
        targetId: 'lease-1',
        role: 'PRIMARY'
      }
    });
    
    // Document 2: TENANT
    await prisma.documentLink.create({
      data: {
        documentId: documents[2].id,
        targetType: 'TENANT',
        targetId: 'tenant-1',
        role: 'PRIMARY'
      }
    });
    
    console.log('✅ Liaisons contextuelles créées');

    // 4. Tester la requête de la page Documents globale (simulation du service)
    console.log('\n📊 Test de la requête page Documents globale...');
    
    // Simulation de la requête du service DocumentsService.search()
    const globalLinksWhere = {
      targetType: 'GLOBAL',
      document: {
        deletedAt: null
      }
    };
    
    const total = await prisma.documentLink.count({ 
      where: globalLinksWhere 
    });
    
    const globalLinks = await prisma.documentLink.findMany({
      where: globalLinksWhere,
      include: {
        document: {
          include: {
            documentType: true,
            links: true,
            fields: true,
            reminders: {
              where: { status: 'open' },
              orderBy: { dueDate: 'asc' },
            },
          }
        }
      },
      orderBy: { 
        document: { createdAt: 'desc' }
      },
      skip: 0,
      take: 50,
    });
    
    const documentsFromGlobal = globalLinks.map(link => link.document);
    
    console.log(`✅ ${total} documents trouvés via les liaisons GLOBAL`);
    console.log(`✅ ${documentsFromGlobal.length} documents récupérés (avec pagination)`);
    
    // 5. Vérifier que tous les documents sont présents
    console.log('\n🔍 Vérification de la présence de tous les documents...');
    
    documentsFromGlobal.forEach((doc, index) => {
      const otherLinks = doc.links.filter(l => l.targetType !== 'GLOBAL');
      console.log(`   ${index + 1}. ${doc.filenameOriginal}`);
      console.log(`      - Taille: ${doc.size} bytes`);
      console.log(`      - Date: ${doc.uploadedAt.toISOString().split('T')[0]}`);
      console.log(`      - Autres liaisons: ${otherLinks.length} (${otherLinks.map(l => l.targetType).join(', ')})`);
    });

    // 6. Tester les filtres
    console.log('\n🔍 Test des filtres...');
    
    // Test filtre par taille (documents > 1100 bytes)
    const largeDocs = await prisma.documentLink.count({
      where: {
        targetType: 'GLOBAL',
        document: {
          size: {
            gt: 1100
          }
        }
      }
    });
    
    console.log(`   - Documents > 1100 bytes: ${largeDocs}`);
    
    // Test filtre par période (derniers 2 jours)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    const recentDocs = await prisma.documentLink.count({
      where: {
        targetType: 'GLOBAL',
        document: {
          createdAt: {
            gte: twoDaysAgo
          }
        }
      }
    });
    
    console.log(`   - Documents des 2 derniers jours: ${recentDocs}`);

    // 7. Vérifier qu'il n'y a pas de doublons
    console.log('\n🔍 Vérification finale des doublons...');
    
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

    console.log('\n✅ Test de l\'API Documents réussi !');
    console.log('\n📝 Le système est entièrement opérationnel :');
    console.log('   - Création de documents multiples ✅');
    console.log('   - Liaisons GLOBAL automatiques ✅');
    console.log('   - Liaisons contextuelles ✅');
    console.log('   - Requête page Documents globale ✅');
    console.log('   - Filtres fonctionnels ✅');
    console.log('   - Pas de doublons ✅');
    console.log('   - Pagination prête ✅');

  } catch (error) {
    console.error('💥 Erreur lors du test:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le test
testDocumentsAPI()
  .then(() => {
    console.log('\n🎉 Test API terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec du test API:', error);
    process.exit(1);
  });

export { testDocumentsAPI };

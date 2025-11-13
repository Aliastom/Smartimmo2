import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDocumentsSearch() {
  console.log('🧪 Test de recherche des documents...');

  try {
    // 1. Vérifier les documents en base
    const allDocuments = await prisma.document.findMany({
      select: {
        id: true,
        fileName: true,
        status: true,
        documentType: {
          select: { code: true, label: true }
        }
      }
    });

    console.log(`📄 Documents en base: ${allDocuments.length}`);
    allDocuments.forEach((doc, index) => {
      console.log(`  ${index + 1}. ${doc.fileName} (${doc.status}) - ${doc.documentType?.label || 'Aucun type'}`);
    });

    // 2. Vérifier les liens
    const allLinks = await prisma.documentLink.findMany({
      select: {
        id: true,
        documentId: true,
        targetType: true,
        targetId: true,
        role: true
      }
    });

    console.log(`\n📋 Liens en base: ${allLinks.length}`);
    allLinks.forEach((link, index) => {
      console.log(`  ${index + 1}. Doc: ${link.documentId.substring(0, 8)}... | ${link.targetType} - ${link.targetId || 'null'} (${link.role})`);
    });

    // 3. Test de l'API de recherche globale
    console.log('\n🔍 Test API de recherche globale...');
    const globalSearchResponse = await fetch('http://localhost:3000/api/documents?offset=0&limit=50');
    
    if (globalSearchResponse.ok) {
      const globalResult = await globalSearchResponse.json();
      console.log(`✅ API globale: ${globalResult.documents?.length || 0} documents trouvés`);
      if (globalResult.documents?.length > 0) {
        globalResult.documents.forEach((doc: any, index: number) => {
          console.log(`  ${index + 1}. ${doc.fileName} (${doc.status})`);
        });
      }
    } else {
      console.log(`❌ API globale échouée: ${globalSearchResponse.status}`);
    }

    // 4. Test de l'API de recherche par propriété
    console.log('\n🏠 Test API de recherche par propriété...');
    const propertySearchResponse = await fetch('http://localhost:3000/api/documents?propertyId=cmgukdq6d0009n8t832pse8yl&offset=0&limit=50');
    
    if (propertySearchResponse.ok) {
      const propertyResult = await propertySearchResponse.json();
      console.log(`✅ API propriété: ${propertyResult.documents?.length || 0} documents trouvés`);
      if (propertyResult.documents?.length > 0) {
        propertyResult.documents.forEach((doc: any, index: number) => {
          console.log(`  ${index + 1}. ${doc.fileName} (${doc.status})`);
        });
      }
    } else {
      console.log(`❌ API propriété échouée: ${propertySearchResponse.status}`);
    }

    // 5. Test de l'API de recherche par transaction
    console.log('\n💰 Test API de recherche par transaction...');
    const transactionSearchResponse = await fetch('http://localhost:3000/api/documents?transactionId=cmgxrpphd000r5otkxdlcnel5&offset=0&limit=50');
    
    if (transactionSearchResponse.ok) {
      const transactionResult = await transactionSearchResponse.json();
      console.log(`✅ API transaction: ${transactionResult.documents?.length || 0} documents trouvés`);
      if (transactionResult.documents?.length > 0) {
        transactionResult.documents.forEach((doc: any, index: number) => {
          console.log(`  ${index + 1}. ${doc.fileName} (${doc.status})`);
        });
      }
    } else {
      console.log(`❌ API transaction échouée: ${transactionSearchResponse.status}`);
    }

  } catch (error) {
    console.error('❌ Erreur test:', error);
  }
}

testDocumentsSearch()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

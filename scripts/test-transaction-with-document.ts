import { PrismaClient } from '@prisma/client';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function testTransactionWithDocument() {
  console.log('🧪 Test création transaction avec document...');

  // 1. Créer un fichier de test
  const testContent = 'Test quittance de loyer - Transaction test';
  const testFile = join(process.cwd(), 'test-transaction-doc.pdf');
  writeFileSync(testFile, testContent);

  try {
    // 2. Créer une session d'upload
    const uploadSessionResponse = await fetch('http://localhost:3000/api/uploads/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    if (!uploadSessionResponse.ok) {
      throw new Error(`Upload session failed: ${uploadSessionResponse.status}`);
    }

    const uploadSession = await uploadSessionResponse.json();
    console.log('✅ Session d\'upload créée:', uploadSession.sessionId);

    // 3. Uploader un document en staging
    const formData = new FormData();
    formData.append('file', new Blob([testContent], { type: 'application/pdf' }), 'test-transaction-doc.pdf');
    formData.append('uploadSessionId', uploadSession.sessionId);

    const stagedUploadResponse = await fetch('http://localhost:3000/api/uploads/staged', {
      method: 'POST',
      body: formData
    });

    if (!stagedUploadResponse.ok) {
      throw new Error(`Staged upload failed: ${stagedUploadResponse.status}`);
    }

    const stagedDocument = await stagedUploadResponse.json();
    console.log('✅ Document en staging créé:', stagedDocument.id);

    // 4. Créer une transaction avec le document
    const transactionResponse = await fetch('http://localhost:3000/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: 'cmgukdq6d0009n8t832pse8yl',
        date: new Date().toISOString(),
        natureId: 'RECETTE_LOYER',
        categoryId: 'LOYER',
        label: 'Test transaction avec document',
        amount: 800,
        stagedDocumentIds: [stagedDocument.id]
      })
    });

    if (!transactionResponse.ok) {
      throw new Error(`Transaction creation failed: ${transactionResponse.status}`);
    }

    const transaction = await transactionResponse.json();
    console.log('✅ Transaction créée:', transaction.id);

    // 5. Vérifier les liens créés
    const links = await prisma.documentLink.findMany({
      where: { documentId: stagedDocument.id },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        role: true,
        entityName: true
      }
    });

    console.log(`\n📋 Liens créés: ${links.length}`);
    links.forEach((link, index) => {
      console.log(`  ${index + 1}. ${link.targetType} - ${link.targetId} (${link.role}) - ${link.entityName}`);
    });

    // 6. Test des APIs de recherche
    console.log('\n🔍 Test des APIs de recherche...');

    // Recherche globale
    const globalResponse = await fetch('http://localhost:3000/api/documents?offset=0&limit=50');
    const globalResult = await globalResponse.json();
    console.log(`✅ Recherche globale: ${globalResult.documents?.length || 0} documents`);

    // Recherche par transaction
    const transactionSearchResponse = await fetch(`http://localhost:3000/api/documents?transactionId=${transaction.id}&offset=0&limit=50`);
    const transactionSearchResult = await transactionSearchResponse.json();
    console.log(`✅ Recherche par transaction: ${transactionSearchResult.documents?.length || 0} documents`);

    // Recherche par propriété
    const propertySearchResponse = await fetch('http://localhost:3000/api/documents?propertyId=cmgukdq6d0009n8t832pse8yl&offset=0&limit=50');
    const propertySearchResult = await propertySearchResponse.json();
    console.log(`✅ Recherche par propriété: ${propertySearchResult.documents?.length || 0} documents`);

    // 7. Tests de validation
    const tests = [
      {
        name: 'Lien TRANSACTION créé',
        test: () => links.some(l => l.targetType === 'TRANSACTION'),
        expected: true
      },
      {
        name: 'Lien GLOBAL créé',
        test: () => links.some(l => l.targetType === 'GLOBAL'),
        expected: true
      },
      {
        name: 'Document visible dans recherche globale',
        test: () => (globalResult.documents?.length || 0) > 0,
        expected: true
      },
      {
        name: 'Document visible dans recherche par transaction',
        test: () => (transactionSearchResult.documents?.length || 0) > 0,
        expected: true
      }
    ];

    console.log('\n🧪 Tests de validation:');
    let allTestsPassed = true;
    tests.forEach(test => {
      const result = test.test();
      const status = result === test.expected ? '✅' : '❌';
      console.log(`  ${status} ${test.name}: ${result} (attendu: ${test.expected})`);
      if (result !== test.expected) allTestsPassed = false;
    });

    if (allTestsPassed) {
      console.log('\n🎉 TOUS LES TESTS PASSÉS ! Le problème est résolu.');
    } else {
      console.log('\n❌ Certains tests ont échoué.');
    }

  } catch (error) {
    console.error('❌ Erreur test:', error);
  } finally {
    // Nettoyer
    try {
      unlinkSync(testFile);
    } catch (e) {
      // Ignorer si le fichier n'existe pas
    }
  }
}

testTransactionWithDocument()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

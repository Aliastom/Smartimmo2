import { PrismaClient } from '@prisma/client';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function testUploadCompleteFix() {
  console.log('🧪 Test upload complet avec correction du statut...');

  // 1. Créer un fichier de test
  const testContent = 'Test quittance de loyer - Octobre 2025';
  const testFile = join(process.cwd(), 'test-quittance-complete.pdf');
  writeFileSync(testFile, testContent);

  try {
    // 2. Upload via l'API
    const formData = new FormData();
    formData.append('file', new Blob([testContent], { type: 'application/pdf' }), 'test-quittance-complete.pdf');
    formData.append('context', JSON.stringify({
      entityType: 'PROPERTY',
      entityId: 'cmgukdq6d0009n8t832pse8yl' // ID de propriété existant
    }));

    const uploadResponse = await fetch('http://localhost:3000/api/documents/upload', {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log('✅ Upload réussi, document ID:', uploadResult.documentId);

    // 3. Finaliser le document
    const finalizeResponse = await fetch('http://localhost:3000/api/documents/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tempId: uploadResult.tempId,
        documentTypeId: 'QUITTANCE_LOYER',
        context: {
          entityType: 'PROPERTY',
          entityId: 'cmgukdq6d0009n8t832pse8yl'
        }
      })
    });

    if (!finalizeResponse.ok) {
      throw new Error(`Finalize failed: ${finalizeResponse.status} ${finalizeResponse.statusText}`);
    }

    const finalizeResult = await finalizeResponse.json();
    console.log('✅ Finalisation réussie, statut:', finalizeResult.status);

    // 4. Vérifier le document en base
    const document = await prisma.document.findUnique({
      where: { id: finalizeResult.documentId },
      select: {
        id: true,
        fileName: true,
        status: true,
        documentType: {
          select: { code: true, label: true }
        }
      }
    });

    if (!document) {
      throw new Error('Document non trouvé en base');
    }

    console.log('📄 Document en base:');
    console.log(`  - ID: ${document.id}`);
    console.log(`  - Nom: ${document.fileName}`);
    console.log(`  - Statut: ${document.status}`);
    console.log(`  - Type: ${document.documentType?.label} (${document.documentType?.code})`);

    // 5. Vérifier les liens créés
    const links = await prisma.documentLink.findMany({
      where: { documentId: document.id },
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
      console.log(`  ${index + 1}. ${link.targetType} - ${link.targetId || 'null'} (${link.role}) - ${link.entityName || 'N/A'}`);
    });

    // 6. Tests de validation
    const tests = [
      {
        name: 'Document avec statut active',
        test: () => document.status === 'active',
        expected: true
      },
      {
        name: 'Lien GLOBAL créé',
        test: () => links.some(l => l.targetType === 'GLOBAL'),
        expected: true
      },
      {
        name: 'Lien PROPERTY créé',
        test: () => links.some(l => l.targetType === 'PROPERTY'),
        expected: true
      },
      {
        name: 'Au moins 2 liens créés',
        test: () => links.length >= 2,
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

testUploadCompleteFix()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

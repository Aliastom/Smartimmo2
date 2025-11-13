/**
 * Script de préparation de données de test pour le système de suppression simple
 * 
 * Ce script crée :
 * - D1 (draft) lié à : 1 Bien (P1) + 1 Bail (L1) + 1 Transaction (T1)
 * - D2 (final) lié à : 1 Transaction (T1)
 * - D3 (final) sans aucun lien (document "isolé")
 * 
 * Usage: npx tsx scripts/prepare-test-data-suppression.ts
 */

import { PrismaClient } from '@prisma/client';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Démarrage de la préparation des données de test...\n');

  try {
    // 1. Créer un bien (P1)
    console.log('📦 Création du bien P1...');
    const property = await prisma.property.upsert({
      where: { id: 'test-p1-suppression' },
      update: {},
      create: {
        id: 'test-p1-suppression',
        name: 'Appartement Test Suppression',
        type: 'APPARTEMENT',
        address: '123 Rue de Test',
        postalCode: '75001',
        city: 'Paris',
        surface: 50,
        rooms: 2,
        acquisitionDate: new Date('2023-01-01'),
        acquisitionPrice: 200000,
        notaryFees: 15000,
        currentValue: 220000,
        status: 'LOUE'
      }
    });
    console.log('✅ Bien P1 créé:', property.id);

    // 2. Créer un locataire
    console.log('\n👤 Création du locataire...');
    const tenant = await prisma.tenant.upsert({
      where: { email: 'test-suppression@example.com' },
      update: {},
      create: {
        id: 'test-tenant-suppression',
        firstName: 'Jean',
        lastName: 'TestSuppression',
        email: 'test-suppression@example.com',
        phone: '0612345678',
        status: 'ACTIVE'
      }
    });
    console.log('✅ Locataire créé:', tenant.id);

    // 3. Créer un bail (L1)
    console.log('\n📄 Création du bail L1...');
    const lease = await prisma.lease.upsert({
      where: { id: 'test-l1-suppression' },
      update: {},
      create: {
        id: 'test-l1-suppression',
        propertyId: property.id,
        tenantId: tenant.id,
        type: 'VIDE',
        startDate: new Date('2024-01-01'),
        rentAmount: 1000,
        charges: 100,
        deposit: 1000,
        status: 'ACTIF'
      }
    });
    console.log('✅ Bail L1 créé:', lease.id);

    // 4. Créer une catégorie si elle n'existe pas
    console.log('\n💰 Vérification/création de la catégorie...');
    let category = await prisma.category.findFirst({
      where: { slug: 'loyer' }
    });
    
    if (!category) {
      category = await prisma.category.create({
        data: {
          slug: 'loyer',
          label: 'Loyer',
          type: 'RECETTE',
          deductible: false,
          capitalizable: false,
          system: true,
          actif: true
        }
      });
    }
    console.log('✅ Catégorie disponible:', category.id);

    // 5. Créer une transaction (T1)
    console.log('\n💳 Création de la transaction T1...');
    const transaction = await prisma.transaction.upsert({
      where: { id: 'test-t1-suppression' },
      update: {},
      create: {
        id: 'test-t1-suppression',
        propertyId: property.id,
        leaseId: lease.id,
        categoryId: category.id,
        label: 'Loyer Test Suppression',
        amount: 1000,
        date: new Date('2024-01-01'),
        month: 1,
        year: 2024,
        nature: 'RECETTE_LOYER',
        source: 'MANUAL'
      }
    });
    console.log('✅ Transaction T1 créée:', transaction.id);

    // 6. Créer les fichiers de test dans storage/documents
    console.log('\n📁 Création des fichiers de test...');
    const storageDir = join(process.cwd(), 'storage', 'documents');
    await mkdir(storageDir, { recursive: true });

    // Créer des fichiers PDF factices
    const pdfContent = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n206\n%%EOF';
    
    const file1 = 'test-d1-suppression.pdf';
    const file2 = 'test-d2-suppression.pdf';
    const file3 = 'test-d3-suppression.pdf';

    await writeFile(join(storageDir, file1), pdfContent);
    await writeFile(join(storageDir, file2), pdfContent);
    await writeFile(join(storageDir, file3), pdfContent);
    console.log('✅ Fichiers créés');

    // 7. Créer D1 (draft) lié à P1 + L1 + T1
    console.log('\n📄 Création du document D1 (draft)...');
    const doc1 = await prisma.document.upsert({
      where: { id: 'test-d1-suppression' },
      update: {},
      create: {
        id: 'test-d1-suppression',
        bucketKey: file1,
        filenameOriginal: 'Document-D1-Draft-Multi-Liens.pdf',
        fileName: 'Document-D1-Draft-Multi-Liens.pdf',
        mime: 'application/pdf',
        size: pdfContent.length,
        url: `/storage/documents/${file1}`,
        status: 'draft',
        ocrStatus: 'pending',
        source: 'upload'
      }
    });
    console.log('✅ Document D1 créé:', doc1.id);

    // Créer les liaisons pour D1
    console.log('🔗 Création des liaisons pour D1...');
    await prisma.documentLink.createMany({
      data: [
        {
          documentId: doc1.id,
          linkedType: 'property',
          linkedId: property.id
        },
        {
          documentId: doc1.id,
          linkedType: 'lease',
          linkedId: lease.id
        },
        {
          documentId: doc1.id,
          linkedType: 'transaction',
          linkedId: transaction.id
        }
      ]
    });
    console.log('✅ 3 liaisons créées pour D1 (property, lease, transaction)');

    // 8. Créer D2 (final) lié à T1
    console.log('\n📄 Création du document D2 (final)...');
    const doc2 = await prisma.document.upsert({
      where: { id: 'test-d2-suppression' },
      update: {},
      create: {
        id: 'test-d2-suppression',
        bucketKey: file2,
        filenameOriginal: 'Document-D2-Final-Transaction.pdf',
        fileName: 'Document-D2-Final-Transaction.pdf',
        mime: 'application/pdf',
        size: pdfContent.length,
        url: `/storage/documents/${file2}`,
        status: 'active',
        ocrStatus: 'completed',
        source: 'upload'
      }
    });
    console.log('✅ Document D2 créé:', doc2.id);

    // Créer la liaison pour D2
    console.log('🔗 Création de la liaison pour D2...');
    await prisma.documentLink.create({
      data: {
        documentId: doc2.id,
        linkedType: 'transaction',
        linkedId: transaction.id
      }
    });
    console.log('✅ 1 liaison créée pour D2 (transaction)');

    // 9. Créer D3 (final) sans lien
    console.log('\n📄 Création du document D3 (isolé)...');
    const doc3 = await prisma.document.upsert({
      where: { id: 'test-d3-suppression' },
      update: {},
      create: {
        id: 'test-d3-suppression',
        bucketKey: file3,
        filenameOriginal: 'Document-D3-Final-Isole.pdf',
        fileName: 'Document-D3-Final-Isole.pdf',
        mime: 'application/pdf',
        size: pdfContent.length,
        url: `/storage/documents/${file3}`,
        status: 'active',
        ocrStatus: 'completed',
        source: 'upload'
      }
    });
    console.log('✅ Document D3 créé:', doc3.id, '(sans liaison)');

    // Résumé
    console.log('\n' + '='.repeat(60));
    console.log('✅ DONNÉES DE TEST CRÉÉES AVEC SUCCÈS !');
    console.log('='.repeat(60));
    console.log('\n📊 Résumé:');
    console.log('─'.repeat(60));
    console.log(`Bien (P1):        ${property.id}`);
    console.log(`                  ${property.name}`);
    console.log(`Locataire:        ${tenant.id}`);
    console.log(`                  ${tenant.firstName} ${tenant.lastName}`);
    console.log(`Bail (L1):        ${lease.id}`);
    console.log(`Transaction (T1): ${transaction.id}`);
    console.log(`                  ${transaction.label}`);
    console.log('─'.repeat(60));
    console.log(`\n📄 Document D1 (draft):  ${doc1.id}`);
    console.log(`   Nom: ${doc1.filenameOriginal}`);
    console.log(`   Lié à: Bien P1 + Bail L1 + Transaction T1`);
    console.log(`   Statut: ${doc1.status}`);
    console.log(`\n📄 Document D2 (final):  ${doc2.id}`);
    console.log(`   Nom: ${doc2.filenameOriginal}`);
    console.log(`   Lié à: Transaction T1`);
    console.log(`   Statut: ${doc2.status}`);
    console.log(`\n📄 Document D3 (isolé):  ${doc3.id}`);
    console.log(`   Nom: ${doc3.filenameOriginal}`);
    console.log(`   Lié à: AUCUN (document isolé/global)`);
    console.log(`   Statut: ${doc3.status}`);
    console.log('─'.repeat(60));

    // Instructions de test
    console.log('\n📝 INSTRUCTIONS DE TEST:');
    console.log('─'.repeat(60));
    console.log('\n1️⃣  TEST SUPPRESSION D1 (multi-liens):');
    console.log('   → Aller dans Documents');
    console.log('   → Chercher "Document-D1-Draft-Multi-Liens.pdf"');
    console.log('   → Cliquer sur Supprimer');
    console.log('   → Vérifier que la modal affiche les 3 liaisons:');
    console.log('      • Bien: Appartement Test Suppression');
    console.log('      • Bail: (avec nom du bien et locataire)');
    console.log('      • Transaction: Loyer Test Suppression');
    console.log('   → Confirmer → Document + liaisons supprimés');
    
    console.log('\n2️⃣  TEST SUPPRESSION D2 (1 lien):');
    console.log('   → Aller dans Documents');
    console.log('   → Chercher "Document-D2-Final-Transaction.pdf"');
    console.log('   → Cliquer sur Supprimer');
    console.log('   → Vérifier que la modal affiche 1 liaison:');
    console.log('      • Transaction: Loyer Test Suppression');
    console.log('   → Confirmer → Document + liaison supprimés');
    
    console.log('\n3️⃣  TEST SUPPRESSION D3 (isolé):');
    console.log('   → Aller dans Documents');
    console.log('   → Chercher "Document-D3-Final-Isole.pdf"');
    console.log('   → Cliquer sur Supprimer');
    console.log('   → Vérifier que la modal affiche:');
    console.log('      "La suppression entraînera la disparition définitive du fichier."');
    console.log('   → Confirmer → Document supprimé');
    
    console.log('\n4️⃣  TEST SUPPRESSION TRANSACTION T1:');
    console.log('   → Recréer D2 avec le script si besoin');
    console.log('   → Aller dans Transactions');
    console.log('   → Chercher "Loyer Test Suppression"');
    console.log('   → Cliquer sur Supprimer');
    console.log('   → Vérifier que la modal propose 2 choix radio:');
    console.log('      ○ Supprimer les documents et toutes leurs liaisons');
    console.log('      ○ Conserver les documents en liaison globale (défaut)');
    console.log('   → Tester les 2 modes:');
    console.log('      - Mode 1: Les documents liés disparaissent complètement');
    console.log('      - Mode 2: Les documents restent visibles dans /documents');
    
    console.log('\n5️⃣  TEST SUPPRESSION DOCUMENT DEPUIS MODAL TRANSACTION:');
    console.log('   → Recréer les données si besoin');
    console.log('   → Aller dans Transactions');
    console.log('   → Éditer "Loyer Test Suppression"');
    console.log('   → Dans l\'onglet Documents, cliquer sur X d\'un document');
    console.log('   → Vérifier que la modal de confirmation s\'affiche');
    console.log('   → Confirmer → Document supprimé + rechargement auto');
    
    console.log('\n─'.repeat(60));
    console.log('💡 Pour réexécuter ce script et réinitialiser les données:');
    console.log('   npx tsx scripts/prepare-test-data-suppression.ts');
    console.log('─'.repeat(60));
    console.log('\n✨ Prêt pour les tests ! Bon courage ! 🚀\n');

  } catch (error) {
    console.error('❌ Erreur lors de la création des données de test:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


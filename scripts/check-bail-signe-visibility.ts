#!/usr/bin/env npx tsx

/**
 * Vérification de la visibilité des documents BAIL_SIGNE
 * 
 * Ce script vérifie que les documents BAIL_SIGNE sont bien visibles
 * dans l'onglet Documents des baux et dans la page Documents générale.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkBailSigneVisibility() {
  console.log('🔍 Vérification de la visibilité des documents BAIL_SIGNE...\n');

  try {
    // 1. Chercher tous les documents de type BAIL_SIGNE
    console.log('📄 Recherche des documents BAIL_SIGNE...');
    
    const bailSigneDocuments = await prisma.document.findMany({
      where: {
        documentType: {
          code: 'BAIL_SIGNE'
        }
      },
      include: {
        documentType: true,
        links: true
      }
    });

    console.log(`   📊 ${bailSigneDocuments.length} document(s) BAIL_SIGNE trouvé(s)`);

    if (bailSigneDocuments.length === 0) {
      console.log('   ❌ Aucun document BAIL_SIGNE trouvé');
      return;
    }

    // 2. Analyser chaque document
    for (const doc of bailSigneDocuments) {
      console.log(`\n📋 Document: ${doc.filenameOriginal} (${doc.id})`);
      console.log(`   - Type: ${doc.documentType?.label}`);
      console.log(`   - Bail ID: ${doc.leaseId || 'Aucun'}`);
      console.log(`   - Bien ID: ${doc.propertyId || 'Aucun'}`);
      console.log(`   - Locataire ID: ${doc.tenantId || 'Aucun'}`);
      console.log(`   - Statut: ${doc.status}`);
      console.log(`   - Uploadé le: ${doc.uploadedAt?.toLocaleString('fr-FR')}`);

      // 3. Vérifier les liaisons
      console.log(`   🔗 Liaisons (${doc.links.length}):`);
      for (const link of doc.links) {
        console.log(`     - ${link.targetType} (${link.role}): ${link.targetId || 'null'} - ${link.entityName || 'N/A'}`);
      }

      // 4. Vérifier la visibilité dans la vue globale
      const globalLink = doc.links.find(link => link.targetType === 'GLOBAL');
      console.log(`   🌐 Visible globalement: ${globalLink ? '✅' : '❌'}`);

      // 5. Vérifier la visibilité dans la vue bail
      const leaseLink = doc.links.find(link => link.targetType === 'LEASE');
      console.log(`   📄 Visible dans le bail: ${leaseLink ? '✅' : '❌'}`);

      // 6. Vérifier la visibilité dans la vue bien
      const propertyLink = doc.links.find(link => link.targetType === 'PROPERTY');
      console.log(`   🏠 Visible dans le bien: ${propertyLink ? '✅' : '❌'}`);

      // 7. Vérifier la visibilité dans la vue locataire
      const tenantLink = doc.links.find(link => link.targetType === 'TENANT');
      console.log(`   👤 Visible dans le locataire: ${tenantLink ? '✅' : '❌'}`);
    }

    // 8. Test de requête pour la vue globale
    console.log('\n🌐 Test de la requête pour la vue globale...');
    
    const globalDocuments = await prisma.documentLink.findMany({
      where: {
        targetType: 'GLOBAL'
      },
      include: {
        document: {
          include: {
            documentType: true
          }
        }
      }
    });

    const bailSigneInGlobal = globalDocuments.filter(link => 
      link.document.documentType?.code === 'BAIL_SIGNE'
    );

    console.log(`   📊 Documents dans la vue globale: ${globalDocuments.length}`);
    console.log(`   📄 Documents BAIL_SIGNE dans la vue globale: ${bailSigneInGlobal.length}`);

    if (bailSigneInGlobal.length > 0) {
      console.log('   ✅ Les documents BAIL_SIGNE sont visibles dans la vue globale');
    } else {
      console.log('   ❌ Les documents BAIL_SIGNE ne sont PAS visibles dans la vue globale');
    }

    // 9. Test de requête pour la vue bail
    console.log('\n📄 Test de la requête pour la vue bail...');
    
    const leaseDocuments = await prisma.documentLink.findMany({
      where: {
        targetType: 'LEASE'
      },
      include: {
        document: {
          include: {
            documentType: true
          }
        }
      }
    });

    const bailSigneInLease = leaseDocuments.filter(link => 
      link.document.documentType?.code === 'BAIL_SIGNE'
    );

    console.log(`   📊 Documents dans la vue bail: ${leaseDocuments.length}`);
    console.log(`   📄 Documents BAIL_SIGNE dans la vue bail: ${bailSigneInLease.length}`);

    if (bailSigneInLease.length > 0) {
      console.log('   ✅ Les documents BAIL_SIGNE sont visibles dans la vue bail');
    } else {
      console.log('   ❌ Les documents BAIL_SIGNE ne sont PAS visibles dans la vue bail');
    }

    // 10. Résumé
    console.log('\n📋 Résumé de la visibilité:');
    console.log(`   📄 Documents BAIL_SIGNE créés: ${bailSigneDocuments.length}`);
    console.log(`   🌐 Visibles globalement: ${bailSigneInGlobal.length}`);
    console.log(`   📄 Visibles dans les baux: ${bailSigneInLease.length}`);

    if (bailSigneDocuments.length > 0 && bailSigneInGlobal.length === 0) {
      console.log('\n❌ PROBLÈME: Les documents BAIL_SIGNE ne sont pas visibles globalement');
      console.log('   Solution: Vérifier que les liaisons GLOBAL sont créées');
    }

    if (bailSigneDocuments.length > 0 && bailSigneInLease.length === 0) {
      console.log('\n❌ PROBLÈME: Les documents BAIL_SIGNE ne sont pas visibles dans les baux');
      console.log('   Solution: Vérifier que les liaisons LEASE sont créées');
    }

    if (bailSigneDocuments.length > 0 && bailSigneInGlobal.length > 0 && bailSigneInLease.length > 0) {
      console.log('\n✅ Les documents BAIL_SIGNE sont correctement visibles partout');
    }

  } catch (error) {
    console.error('💥 Erreur lors de la vérification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter la vérification
checkBailSigneVisibility()
  .then(() => {
    console.log('\n🎯 Vérification terminée');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec de la vérification:', error);
    process.exit(1);
  });

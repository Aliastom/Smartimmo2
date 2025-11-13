#!/usr/bin/env npx tsx

/**
 * Script de rafraîchissement de la visibilité des documents BAIL_SIGNE
 * 
 * Ce script force la mise à jour des données et vérifie que tout fonctionne
 * correctement côté backend.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function refreshBailSigneVisibility() {
  console.log('🔄 Rafraîchissement de la visibilité des documents BAIL_SIGNE...\n');

  try {
    // 1. Lister tous les documents BAIL_SIGNE
    console.log('📄 Recherche de tous les documents BAIL_SIGNE...');
    
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

    // 2. Vérifier et corriger les liaisons pour chaque document
    for (const doc of bailSigneDocuments) {
      console.log(`\n📋 Traitement du document: ${doc.filenameOriginal} (${doc.id})`);
      
      // Vérifier les liaisons existantes
      const existingLinks = doc.links;
      console.log(`   🔗 Liaisons existantes: ${existingLinks.length}`);
      
      for (const link of existingLinks) {
        console.log(`     - ${link.targetType} (${link.role}): ${link.targetId || 'null'} - ${link.entityName || 'N/A'}`);
      }

      // Vérifier que toutes les liaisons nécessaires sont présentes
      const hasGlobalLink = existingLinks.some(link => link.targetType === 'GLOBAL');
      const hasLeaseLink = existingLinks.some(link => link.targetType === 'LEASE');
      const hasPropertyLink = existingLinks.some(link => link.targetType === 'PROPERTY');
      const hasTenantLink = existingLinks.some(link => link.targetType === 'TENANT');

      console.log(`   ✅ Liaison GLOBAL: ${hasGlobalLink ? '✅' : '❌'}`);
      console.log(`   ✅ Liaison LEASE: ${hasLeaseLink ? '✅' : '❌'}`);
      console.log(`   ✅ Liaison PROPERTY: ${hasPropertyLink ? '✅' : '❌'}`);
      console.log(`   ✅ Liaison TENANT: ${hasTenantLink ? '✅' : '❌'}`);

      // Si des liaisons manquent, les recréer
      if (!hasGlobalLink || !hasLeaseLink || !hasPropertyLink || !hasTenantLink) {
        console.log(`   🔧 Recréation des liaisons manquantes...`);
        
        try {
          const { BailSigneLinksService } = await import('../src/lib/services/bailSigneLinksService');
          
          if (doc.leaseId) {
            const leaseInfo = await BailSigneLinksService.getLeaseInfoForLinks(doc.leaseId);
            await BailSigneLinksService.createBailSigneLinks(
              doc.id,
              leaseInfo.leaseId,
              leaseInfo.propertyId,
              leaseInfo.tenantsIds
            );
            console.log(`   ✅ Liaisons recréées avec succès`);
          } else {
            console.log(`   ⚠️ Pas de leaseId, impossible de recréer les liaisons`);
          }
        } catch (error) {
          console.log(`   ❌ Erreur lors de la recréation des liaisons:`, error);
        }
      } else {
        console.log(`   ✅ Toutes les liaisons sont présentes`);
      }
    }

    // 3. Vérification finale
    console.log('\n🔍 Vérification finale...');
    
    // Vérifier la vue globale
    const globalLinks = await prisma.documentLink.findMany({
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

    const bailSigneInGlobal = globalLinks.filter(link => 
      link.document.documentType?.code === 'BAIL_SIGNE'
    );

    console.log(`   🌐 Documents BAIL_SIGNE dans la vue globale: ${bailSigneInGlobal.length}`);

    // Vérifier la vue par bien
    const propertyLinks = await prisma.documentLink.findMany({
      where: {
        targetType: 'PROPERTY'
      },
      include: {
        document: {
          include: {
            documentType: true
          }
        }
      }
    });

    const bailSigneInProperty = propertyLinks.filter(link => 
      link.document.documentType?.code === 'BAIL_SIGNE'
    );

    console.log(`   🏠 Documents BAIL_SIGNE dans les vues bien: ${bailSigneInProperty.length}`);

    // Vérifier la vue par bail
    const leaseLinks = await prisma.documentLink.findMany({
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

    const bailSigneInLease = leaseLinks.filter(link => 
      link.document.documentType?.code === 'BAIL_SIGNE'
    );

    console.log(`   📄 Documents BAIL_SIGNE dans les vues bail: ${bailSigneInLease.length}`);

    // 4. Résumé
    console.log('\n📋 Résumé du rafraîchissement:');
    console.log(`   📄 Documents BAIL_SIGNE traités: ${bailSigneDocuments.length}`);
    console.log(`   🌐 Visibles globalement: ${bailSigneInGlobal.length}`);
    console.log(`   🏠 Visibles dans les biens: ${bailSigneInProperty.length}`);
    console.log(`   📄 Visibles dans les baux: ${bailSigneInLease.length}`);

    if (bailSigneDocuments.length > 0 && bailSigneInGlobal.length > 0) {
      console.log('\n✅ Rafraîchissement réussi !');
      console.log('   Les documents BAIL_SIGNE sont correctement visibles.');
      console.log('   Si le problème persiste côté frontend, essayez de:');
      console.log('   1. Vider le cache du navigateur (Ctrl+F5)');
      console.log('   2. Rafraîchir la page');
      console.log('   3. Vérifier la console du navigateur pour d\'éventuelles erreurs');
    } else {
      console.log('\n❌ Problème détecté lors du rafraîchissement');
    }

  } catch (error) {
    console.error('💥 Erreur lors du rafraîchissement:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le rafraîchissement
refreshBailSigneVisibility()
  .then(() => {
    console.log('\n🎯 Rafraîchissement terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec du rafraîchissement:', error);
    process.exit(1);
  });

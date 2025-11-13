#!/usr/bin/env npx tsx

/**
 * Script simple pour vérifier et corriger les statuts de baux
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAndFixLeaseStatus() {
  console.log('🔍 Vérification et correction des statuts de baux\n');

  try {
    // 1. Trouver tous les baux avec statut "ENVOYÉ"
    const sentLeases = await prisma.lease.findMany({
      where: { status: 'ENVOYÉ' },
      include: {
        tenant: true,
        property: true
      }
    });

    console.log(`📋 ${sentLeases.length} baux avec statut "ENVOYÉ" trouvés`);

    let correctedCount = 0;

    for (const lease of sentLeases) {
      console.log(`\n📄 Bail: ${lease.id}`);
      console.log(`   Statut: ${lease.status}`);
      console.log(`   Locataire: ${lease.tenant?.firstName} ${lease.tenant?.lastName}`);
      console.log(`   Propriété: ${lease.property?.name}`);

      // 2. Vérifier s'il y a des documents BAIL_SIGNE liés
      const bailSigneDocuments = await prisma.document.findMany({
        where: {
          documentType: {
            code: 'BAIL_SIGNE'
          },
          links: {
            some: {
              targetType: 'LEASE',
              targetId: lease.id
            }
          }
        }
      });

      console.log(`   Documents BAIL_SIGNE liés: ${bailSigneDocuments.length}`);

      if (bailSigneDocuments.length > 0) {
        console.log('   🔧 Correction nécessaire...');
        
        // 3. Corriger le statut du bail
        const updatedLease = await prisma.lease.update({
          where: { id: lease.id },
          data: {
            status: 'SIGNÉ',
            signedPdfUrl: bailSigneDocuments[0].url,
            updatedAt: new Date()
          }
        });

        console.log(`   ✅ Statut corrigé: ${updatedLease.status}`);
        console.log(`   ✅ signedPdfUrl: ${updatedLease.signedPdfUrl}`);
        correctedCount++;
      } else {
        console.log('   ℹ️  Aucun document BAIL_SIGNE - Statut correct');
      }
    }

    console.log(`\n🎯 Résumé:`);
    console.log(`   - ${sentLeases.length} baux vérifiés`);
    console.log(`   - ${correctedCount} baux corrigés`);

    if (correctedCount > 0) {
      console.log('\n✅ Corrections appliquées avec succès !');
      console.log('   Les baux corrigés devraient maintenant avoir le statut "SIGNÉ"');
    } else {
      console.log('\nℹ️  Aucune correction nécessaire');
    }

  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndFixLeaseStatus();


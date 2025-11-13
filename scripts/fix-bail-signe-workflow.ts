#!/usr/bin/env npx tsx

/**
 * Script pour corriger le workflow BAIL_SIGNE
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixBailSigneWorkflow() {
  console.log('🔧 Correction du workflow BAIL_SIGNE\n');

  try {
    // 1. Trouver tous les documents BAIL_SIGNE avec des liaisons LEASE
    console.log('🔍 Recherche des documents BAIL_SIGNE avec liaisons LEASE...');
    
    const bailSigneDocuments = await prisma.document.findMany({
      where: {
        documentType: {
          code: 'BAIL_SIGNE'
        },
        links: {
          some: {
            targetType: 'LEASE'
          }
        }
      },
      include: {
        documentType: true,
        links: {
          where: {
            targetType: 'LEASE'
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📋 ${bailSigneDocuments.length} documents BAIL_SIGNE avec liaisons LEASE trouvés`);

    let correctedCount = 0;

    for (const doc of bailSigneDocuments) {
      console.log(`\n📄 Document: ${doc.filenameOriginal} (${doc.id})`);
      
      // 2. Vérifier les liaisons LEASE
      const leaseLinks = doc.links.filter(link => link.targetType === 'LEASE');
      
      for (const leaseLink of leaseLinks) {
        const lease = await prisma.lease.findUnique({
          where: { id: leaseLink.targetId },
          include: {
            tenant: true,
            property: true
          }
        });

        if (!lease) {
          console.log(`   ❌ Bail non trouvé: ${leaseLink.targetId}`);
          continue;
        }

        console.log(`   📋 Bail: ${lease.id}`);
        console.log(`     Statut: ${lease.status}`);
        console.log(`     signedPdfUrl: ${lease.signedPdfUrl || 'Aucune'}`);
        console.log(`     Locataire: ${lease.tenant?.firstName} ${lease.tenant?.lastName}`);
        console.log(`     Propriété: ${lease.property?.name}`);

        // 3. Vérifier si le bail doit être mis à jour
        if (lease.status !== 'SIGNÉ' || !lease.signedPdfUrl) {
          console.log('   🔧 Correction nécessaire...');
          
          const updatedLease = await prisma.lease.update({
            where: { id: lease.id },
            data: {
              status: 'SIGNÉ',
              signedPdfUrl: doc.url,
              updatedAt: new Date()
            }
          });

          console.log(`   ✅ Bail corrigé: ${updatedLease.status}`);
          console.log(`   ✅ signedPdfUrl: ${updatedLease.signedPdfUrl}`);
          correctedCount++;
        } else {
          console.log('   ✅ Bail déjà correct');
        }
      }
    }

    console.log(`\n🎯 Résumé:`);
    console.log(`   - ${bailSigneDocuments.length} documents vérifiés`);
    console.log(`   - ${correctedCount} baux corrigés`);

    if (correctedCount > 0) {
      console.log('\n✅ Corrections appliquées avec succès !');
      console.log('   Les baux corrigés devraient maintenant avoir le statut "SIGNÉ"');
    } else {
      console.log('\nℹ️  Aucune correction nécessaire');
    }

    // 4. Vérifier le statut runtime des baux corrigés
    console.log('\n🧮 Vérification du statut runtime...');
    
    const { getLeaseRuntimeStatus, getLeaseStatusDisplay } = await import('../src/domain/leases/status');
    
    for (const doc of bailSigneDocuments.slice(0, 3)) { // Vérifier les 3 premiers
      const leaseLinks = doc.links.filter(link => link.targetType === 'LEASE');
      
      for (const leaseLink of leaseLinks) {
        const lease = await prisma.lease.findUnique({
          where: { id: leaseLink.targetId }
        });

        if (lease) {
          const runtimeStatus = getLeaseRuntimeStatus(lease, new Date());
          const statusDisplay = getLeaseStatusDisplay(runtimeStatus);
          
          console.log(`   Bail ${lease.id}: ${runtimeStatus} (${statusDisplay.label})`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Erreur lors de la correction:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixBailSigneWorkflow();


#!/usr/bin/env npx tsx

/**
 * Script pour corriger manuellement le bail et diagnostiquer le problème
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixLeaseManually() {
  console.log('🔧 Correction manuelle du bail et diagnostic\n');

  try {
    // 1. Récupérer le dernier document BAIL_SIGNE
    const lastBailSigneDocument = await prisma.document.findFirst({
      where: {
        documentType: {
          code: 'BAIL_SIGNE'
        }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        documentType: true,
        links: {
          where: {
            targetType: 'LEASE'
          }
        }
      }
    });

    if (!lastBailSigneDocument) {
      console.log('❌ Aucun document BAIL_SIGNE trouvé');
      return;
    }

    console.log('📄 Dernier document BAIL_SIGNE:');
    console.log(`   ID: ${lastBailSigneDocument.id}`);
    console.log(`   Nom: ${lastBailSigneDocument.filenameOriginal}`);
    console.log(`   Type: ${lastBailSigneDocument.documentType?.code}`);
    console.log(`   URL: ${lastBailSigneDocument.url}`);

    // 2. Récupérer le bail lié
    const leaseLink = lastBailSigneDocument.links.find(link => link.targetType === 'LEASE');
    if (!leaseLink) {
      console.log('❌ Aucune liaison LEASE trouvée');
      return;
    }

    const lease = await prisma.lease.findUnique({
      where: { id: leaseLink.targetId },
      include: {
        tenant: true,
        property: true
      }
    });

    if (!lease) {
      console.log('❌ Bail non trouvé');
      return;
    }

    console.log('\n📋 Bail lié:');
    console.log(`   ID: ${lease.id}`);
    console.log(`   Statut actuel: ${lease.status}`);
    console.log(`   signedPdfUrl actuel: ${lease.signedPdfUrl || 'Aucune'}`);
    console.log(`   Locataire: ${lease.tenant?.firstName} ${lease.tenant?.lastName}`);
    console.log(`   Propriété: ${lease.property?.name}`);

    // 3. Corriger manuellement le bail
    console.log('\n🔧 Correction manuelle du bail...');
    
    const updatedLease = await prisma.lease.update({
      where: { id: lease.id },
      data: {
        status: 'SIGNÉ',
        signedPdfUrl: lastBailSigneDocument.url,
        updatedAt: new Date()
      }
    });

    console.log('✅ Bail corrigé:');
    console.log(`   Nouveau statut: ${updatedLease.status}`);
    console.log(`   Nouvelle signedPdfUrl: ${updatedLease.signedPdfUrl}`);

    // 4. Vérifier le statut runtime
    console.log('\n🧮 Test du statut runtime:');
    
    const { getLeaseRuntimeStatus, getLeaseStatusDisplay } = await import('../src/domain/leases/status');
    const runtimeStatus = getLeaseRuntimeStatus(updatedLease, new Date());
    const statusDisplay = getLeaseStatusDisplay(runtimeStatus);
    
    console.log(`   Statut runtime: ${runtimeStatus}`);
    console.log(`   Affichage: ${statusDisplay.label}`);
    console.log(`   Couleur: ${statusDisplay.color}`);

    // 5. Diagnostic du problème
    console.log('\n🔍 Diagnostic du problème:');
    console.log('   Le document BAIL_SIGNE est créé correctement');
    console.log('   Les liaisons sont créées correctement');
    console.log('   MAIS l\'API de finalisation ne met pas à jour le bail');
    console.log('');
    console.log('   Causes possibles:');
    console.log('   1. Les logs du serveur ne s\'affichent pas');
    console.log('   2. L\'API de finalisation ne traite pas le document BAIL_SIGNE');
    console.log('   3. Il y a une erreur dans la logique de mise à jour du bail');
    console.log('');
    console.log('   Solution: Vérifier les logs du serveur dans le terminal npm run dev');

  } catch (error) {
    console.error('❌ Erreur lors de la correction:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixLeaseManually();


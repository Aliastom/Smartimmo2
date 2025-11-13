#!/usr/bin/env npx tsx

/**
 * Script pour vérifier le dernier upload
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLatestUpload() {
  console.log('🔍 Vérification du dernier upload\n');

  try {
    // ID du document du dernier upload
    const documentId = 'cmgvexayt006bn8io779owcpd';
    const leaseId = 'cmgvewqfc0069n8iokl1lqctp';

    // 1. Vérifier le document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        documentType: true,
        links: true
      }
    });

    if (!document) {
      console.log('❌ Document non trouvé');
      return;
    }

    console.log('📄 Document:');
    console.log(`   ID: ${document.id}`);
    console.log(`   Nom: ${document.filenameOriginal}`);
    console.log(`   Type: ${document.documentType?.code}`);
    console.log(`   Créé: ${document.createdAt}`);
    console.log(`   Liaisons: ${document.links.length}`);
    
    for (const link of document.links) {
      console.log(`     - ${link.targetType}: ${link.targetId} (${link.role})`);
    }

    // 2. Vérifier le bail
    const lease = await prisma.lease.findUnique({
      where: { id: leaseId },
      include: {
        tenant: true,
        property: true
      }
    });

    if (!lease) {
      console.log('\n❌ Bail non trouvé');
      return;
    }

    console.log('\n📋 Bail:');
    console.log(`   ID: ${lease.id}`);
    console.log(`   Statut: ${lease.status}`);
    console.log(`   signedPdfUrl: ${lease.signedPdfUrl || 'Aucune'}`);
    console.log(`   Locataire: ${lease.tenant?.firstName} ${lease.tenant?.lastName}`);
    console.log(`   Propriété: ${lease.property?.name}`);
    console.log(`   Début: ${lease.startDate}`);
    console.log(`   Fin: ${lease.endDate || 'Indéterminé'}`);

    // 3. Vérifier le statut runtime
    console.log('\n🧮 Statut runtime:');
    const { getLeaseRuntimeStatus, getLeaseStatusDisplay } = await import('../src/domain/leases/status');
    const runtimeStatus = getLeaseRuntimeStatus(lease, new Date());
    const statusDisplay = getLeaseStatusDisplay(runtimeStatus);
    
    console.log(`   Statut runtime: ${runtimeStatus}`);
    console.log(`   Affichage: ${statusDisplay.label}`);
    console.log(`   Couleur: ${statusDisplay.color}`);

    // 4. Diagnostic
    console.log('\n🔍 Diagnostic:');
    if (document.documentType?.code === 'BAIL_SIGNE') {
      console.log('   ✅ Document BAIL_SIGNE détecté');
      
      if (lease.status !== 'SIGNÉ' || !lease.signedPdfUrl) {
        console.log('   ❌ PROBLÈME: Le bail n\'a pas été mis à jour');
        console.log('   ❌ L\'API de finalisation n\'a pas traité le document');
        
        // Corriger manuellement
        console.log('\n🔧 Correction manuelle...');
        const updatedLease = await prisma.lease.update({
          where: { id: lease.id },
          data: {
            status: 'SIGNÉ',
            signedPdfUrl: document.url,
            updatedAt: new Date()
          }
        });
        
        console.log(`   ✅ Bail corrigé: ${updatedLease.status}`);
        console.log(`   ✅ signedPdfUrl: ${updatedLease.signedPdfUrl}`);
        
        // Vérifier le statut runtime après correction
        const newRuntimeStatus = getLeaseRuntimeStatus(updatedLease, new Date());
        const newStatusDisplay = getLeaseStatusDisplay(newRuntimeStatus);
        console.log(`   ✅ Nouveau statut runtime: ${newRuntimeStatus} (${newStatusDisplay.label})`);
      } else {
        console.log('   ✅ Le bail a été mis à jour correctement');
      }
    } else {
      console.log('   ❌ Le document n\'est pas de type BAIL_SIGNE');
    }

  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLatestUpload();


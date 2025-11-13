#!/usr/bin/env npx tsx

/**
 * Script pour remettre le bail de test à "ENVOYÉ"
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetTestLease() {
  console.log('🔄 Remise à zéro du bail de test\n');

  try {
    // ID du bail de test
    const leaseId = 'cmgvewqfc0069n8iokl1lqctp';

    // 1. Vérifier si le bail existe
    const lease = await prisma.lease.findUnique({
      where: { id: leaseId },
      include: {
        tenant: true,
        property: true
      }
    });

    if (!lease) {
      console.log('❌ Bail non trouvé');
      return;
    }

    console.log('📋 Bail de test:');
    console.log(`   ID: ${lease.id}`);
    console.log(`   Statut actuel: ${lease.status}`);
    console.log(`   Locataire: ${lease.tenant?.firstName} ${lease.tenant?.lastName}`);
    console.log(`   Propriété: ${lease.property?.name}`);

    // 2. Remettre le bail à "ENVOYÉ"
    console.log('\n🔄 Remise à zéro du bail...');
    
    const updatedLease = await prisma.lease.update({
      where: { id: leaseId },
      data: {
        status: 'ENVOYÉ',
        signedPdfUrl: null,
        updatedAt: new Date()
      }
    });

    console.log('✅ Bail remis à zéro:');
    console.log(`   Nouveau statut: ${updatedLease.status}`);
    console.log(`   signedPdfUrl: ${updatedLease.signedPdfUrl || 'Aucune'}`);

    console.log('\n📋 Vous pouvez maintenant tester le workflow:');
    console.log('   1. Rechargez le serveur Next.js (Ctrl+C puis npm run dev)');
    console.log('   2. Allez sur /baux');
    console.log('   3. Cliquez sur ce bail');
    console.log('   4. Cliquez sur "Uploader bail signé"');
    console.log('   5. Sélectionnez un fichier');
    console.log('   6. Vérifiez que le bail passe à "SIGNÉ" puis "ACTIF"');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetTestLease();


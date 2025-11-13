#!/usr/bin/env npx tsx

/**
 * Script pour vérifier le dernier upload #2
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLatestUpload2() {
  console.log('🔍 Vérification du dernier upload #2\n');

  try {
    const documentId = 'cmgvfhk8w000jn8zcgg3pekac';
    const leaseId = 'cmgvfg38a0001n8zc9arjaobn';

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { documentType: true }
    });

    const lease = await prisma.lease.findUnique({
      where: { id: leaseId }
    });

    if (!document || !lease) {
      console.log('❌ Document ou bail non trouvé');
      return;
    }

    console.log('📄 Document:', document.documentType?.code);
    console.log('📋 Bail statut:', lease.status);
    console.log('📋 signedPdfUrl:', lease.signedPdfUrl || 'Aucune');
    
    if (document.documentType?.code === 'BAIL_SIGNE' && lease.status === 'ENVOYÉ') {
      console.log('\n❌ PROBLÈME CONFIRMÉ: Le statut n\'a pas été mis à jour');
      console.log('❌ L\'API de finalisation ne traite PAS le document BAIL_SIGNE');
      console.log('\n💡 Le serveur Next.js doit être redémarré !');
    } else if (document.documentType?.code === 'BAIL_SIGNE' && lease.status === 'SIGNÉ') {
      console.log('\n✅ Le bail a été mis à jour correctement !');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLatestUpload2();

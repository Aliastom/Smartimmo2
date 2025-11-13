#!/usr/bin/env npx tsx

/**
 * Test pour diagnostiquer pourquoi le statut du bail ne se met pas à jour après upload d'un BAIL_SIGNE
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testLeaseStatusUpdate() {
  console.log('🔍 Diagnostic: Mise à jour du statut du bail après upload BAIL_SIGNE\n');

  try {
    // 1. Trouver un bail avec statut "ENVOYÉ"
    const sentLease = await prisma.lease.findFirst({
      where: { status: 'ENVOYÉ' },
      include: {
        tenant: true,
        property: true
      }
    });

    if (!sentLease) {
      console.log('❌ Aucun bail avec statut "ENVOYÉ" trouvé');
      return;
    }

    console.log('📋 Bail trouvé:');
    console.log(`   ID: ${sentLease.id}`);
    console.log(`   Statut: ${sentLease.status}`);
    console.log(`   Locataire: ${sentLease.tenant?.firstName} ${sentLease.tenant?.lastName}`);
    console.log(`   Propriété: ${sentLease.property?.name}`);
    console.log(`   Date début: ${sentLease.startDate}`);
    console.log(`   Date fin: ${sentLease.endDate}`);

    // 2. Vérifier s'il y a des documents BAIL_SIGNE liés à ce bail
    const bailSigneDocuments = await prisma.document.findMany({
      where: {
        documentType: {
          code: 'BAIL_SIGNE'
        },
        links: {
          some: {
            targetType: 'LEASE',
            targetId: sentLease.id
          }
        }
      },
      include: {
        documentType: true,
        links: true
      }
    });

    console.log(`\n📄 Documents BAIL_SIGNE liés: ${bailSigneDocuments.length}`);
    
    if (bailSigneDocuments.length > 0) {
      console.log('✅ Documents BAIL_SIGNE trouvés:');
      for (const doc of bailSigneDocuments) {
        console.log(`   - ${doc.filenameOriginal} (${doc.id})`);
        console.log(`     Créé: ${doc.createdAt}`);
        console.log(`     URL: ${doc.url}`);
        console.log(`     Liens: ${doc.links.length}`);
      }

      // 3. Le bail devrait être "SIGNÉ" s'il y a des documents BAIL_SIGNE
      if (sentLease.status !== 'SIGNÉ') {
        console.log('\n❌ PROBLÈME IDENTIFIÉ:');
        console.log(`   Le bail a des documents BAIL_SIGNE mais le statut est "${sentLease.status}"`);
        console.log('   Le statut devrait être "SIGNÉ"');
        
        // 4. Vérifier si le bail a une signedPdfUrl
        console.log(`\n🔍 Vérification signedPdfUrl: ${sentLease.signedPdfUrl || 'Aucune'}`);
        
        // 5. Proposer une correction manuelle
        console.log('\n🔧 CORRECTION MANUELLE:');
        console.log('   Mise à jour du statut du bail...');
        
        const updatedLease = await prisma.lease.update({
          where: { id: sentLease.id },
          data: {
            status: 'SIGNÉ',
            signedPdfUrl: bailSigneDocuments[0].url,
            updatedAt: new Date()
          }
        });
        
        console.log(`✅ Statut mis à jour: ${updatedLease.status}`);
        console.log(`✅ signedPdfUrl: ${updatedLease.signedPdfUrl}`);
        
      } else {
        console.log('\n✅ Le bail est déjà au bon statut "SIGNÉ"');
      }
    } else {
      console.log('❌ Aucun document BAIL_SIGNE lié à ce bail');
      console.log('   Le statut "ENVOYÉ" est donc correct');
    }

    // 6. Vérifier la logique de statut runtime
    console.log('\n🧮 Test de la logique de statut runtime:');
    const today = new Date().toISOString().split('T')[0];
    const startDate = new Date(sentLease.startDate).toISOString().split('T')[0];
    const endDate = sentLease.endDate ? new Date(sentLease.endDate).toISOString().split('T')[0] : null;
    
    console.log(`   Aujourd'hui: ${today}`);
    console.log(`   Date début: ${startDate}`);
    console.log(`   Date fin: ${endDate || 'Aucune'}`);
    
    const isSigned = sentLease.status === 'SIGNÉ' || !!sentLease.signedPdfUrl;
    const isInPeriod = today >= startDate && (!endDate || today <= endDate);
    
    console.log(`   Est signé: ${isSigned}`);
    console.log(`   Dans la période: ${isInPeriod}`);
    console.log(`   Statut runtime attendu: ${isSigned && isInPeriod ? 'ACTIF' : isSigned ? 'SIGNÉ' : 'ENVOYÉ'}`);

  } catch (error) {
    console.error('❌ Erreur lors du diagnostic:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLeaseStatusUpdate();

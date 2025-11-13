#!/usr/bin/env npx tsx

/**
 * Script pour analyser le workflow complet des baux
 */

import { PrismaClient } from '@prisma/client';
import { getLeaseRuntimeStatus, getLeaseStatusDisplay } from '../src/domain/leases/status';
import { getToday } from '../src/utils/date';

const prisma = new PrismaClient();

async function analyzeLeaseWorkflow() {
  console.log('🔍 Analyse du workflow complet des baux\n');

  try {
    // 1. Récupérer le bail de test
    const lease = await prisma.lease.findUnique({
      where: { id: 'cmgvdz4og0001n8cc4x3miaw0' },
      include: {
        tenant: true,
        property: true
      }
    });

    if (!lease) {
      console.log('❌ Bail de test non trouvé');
      return;
    }

    console.log('📋 Bail de test:');
    console.log(`   ID: ${lease.id}`);
    console.log(`   Statut persistant: ${lease.status}`);
    console.log(`   signedPdfUrl: ${lease.signedPdfUrl || 'Aucune'}`);
    console.log(`   Date début: ${lease.startDate}`);
    console.log(`   Date fin: ${lease.endDate}`);
    console.log(`   Locataire: ${lease.tenant?.firstName} ${lease.tenant?.lastName}`);
    console.log(`   Propriété: ${lease.property?.name}`);

    // 2. Analyser le statut runtime
    const today = getToday();
    const runtimeStatus = getLeaseRuntimeStatus(lease, today);
    const statusDisplay = getLeaseStatusDisplay(runtimeStatus);

    console.log('\n🧮 Analyse du statut runtime:');
    console.log(`   Aujourd'hui: ${today}`);
    console.log(`   Statut runtime: ${runtimeStatus}`);
    console.log(`   Affichage: ${statusDisplay.label}`);
    console.log(`   Couleur: ${statusDisplay.color}`);

    // 3. Analyser la logique étape par étape
    console.log('\n🔍 Analyse de la logique étape par étape:');
    
    // Étape 1: Vérifier si résilié
    if (lease.status === 'RÉSILIÉ') {
      console.log('   ✅ Résilié → EXPIRÉ');
    } else {
      console.log('   ✅ Pas résilié');
    }

    // Étape 2: Vérifier si signé
    const isSigned = lease.status === 'SIGNÉ' || lease.status === 'ACTIF' || !!lease.signedPdfUrl;
    console.log(`   ✅ Est signé: ${isSigned} (status=${lease.status}, signedPdfUrl=${!!lease.signedPdfUrl})`);

    if (!isSigned) {
      console.log('   ✅ Pas signé → BROUILLON');
    } else {
      console.log('   ✅ Signé, vérification des dates...');
      
      // Étape 3: Vérifier les dates
      if (!lease.endDate) {
        console.log('   ✅ Pas de date de fin → ACTIF si après début');
      } else {
        console.log(`   ✅ Date de fin: ${lease.endDate}`);
        
        // Vérifier si dans la période
        const { isBetweenInclusive, compareDates } = await import('../src/utils/date');
        const inPeriod = isBetweenInclusive(today, lease.startDate, lease.endDate);
        const beforeStart = compareDates(today, lease.startDate) < 0;
        const afterEnd = compareDates(today, lease.endDate) > 0;
        
        console.log(`   ✅ Dans la période: ${inPeriod}`);
        console.log(`   ✅ Avant le début: ${beforeStart}`);
        console.log(`   ✅ Après la fin: ${afterEnd}`);
        
        if (inPeriod) {
          console.log('   ✅ Dans la période → ACTIF');
        } else if (beforeStart) {
          console.log('   ✅ Avant le début → À VENIR');
        } else if (afterEnd) {
          console.log('   ✅ Après la fin → EXPIRÉ');
        } else {
          console.log('   ✅ Par défaut → SIGNÉ');
        }
      }
    }

    // 4. Simuler les différents scénarios
    console.log('\n🧪 Simulation des scénarios:');
    
    // Scénario 1: Bail ENVOYÉ (actuel)
    console.log('\n   📄 Scénario 1: Bail ENVOYÉ (actuel)');
    const scenario1 = { ...lease, status: 'ENVOYÉ', signedPdfUrl: null };
    const status1 = getLeaseRuntimeStatus(scenario1, today);
    console.log(`   Statut runtime: ${status1} (${getLeaseStatusDisplay(status1).label})`);

    // Scénario 2: Bail SIGNÉ
    console.log('\n   📄 Scénario 2: Bail SIGNÉ');
    const scenario2 = { ...lease, status: 'SIGNÉ', signedPdfUrl: '/test.pdf' };
    const status2 = getLeaseRuntimeStatus(scenario2, today);
    console.log(`   Statut runtime: ${status2} (${getLeaseStatusDisplay(status2).label})`);

    // Scénario 3: Bail ACTIF
    console.log('\n   📄 Scénario 3: Bail ACTIF');
    const scenario3 = { ...lease, status: 'ACTIF', signedPdfUrl: '/test.pdf' };
    const status3 = getLeaseRuntimeStatus(scenario3, today);
    console.log(`   Statut runtime: ${status3} (${getLeaseStatusDisplay(status3).label})`);

    // 5. Vérifier les documents BAIL_SIGNE liés
    console.log('\n📄 Vérification des documents BAIL_SIGNE:');
    
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
      console.log('   ✅ Documents trouvés:');
      for (const doc of bailSigneDocuments) {
        console.log(`     - ${doc.filenameOriginal} (${doc.id})`);
        console.log(`       URL: ${doc.url}`);
        console.log(`       Créé: ${doc.createdAt}`);
      }
    } else {
      console.log('   ❌ Aucun document BAIL_SIGNE lié');
    }

    console.log('\n🎯 Conclusion:');
    console.log('   Le workflow devrait être:');
    console.log('   1. BROUILLON → ENVOYÉ (envoi pour signature)');
    console.log('   2. ENVOYÉ → SIGNÉ (upload du bail signé)');
    console.log('   3. SIGNÉ → ACTIF (automatique si dans la période)');
    
    if (lease.status === 'ENVOYÉ' && bailSigneDocuments.length > 0) {
      console.log('\n   ❌ PROBLÈME: Le bail a des documents BAIL_SIGNE mais reste ENVOYÉ');
      console.log('   🔧 SOLUTION: L\'API de finalisation doit mettre à jour le statut');
    } else if (lease.status === 'SIGNÉ' && runtimeStatus === 'signed') {
      console.log('\n   ❌ PROBLÈME: Le bail est SIGNÉ mais devrait être ACTIF');
      console.log('   🔧 SOLUTION: Mise à jour automatique du statut persistant');
    } else {
      console.log('\n   ✅ Le workflow semble correct');
    }

  } catch (error) {
    console.error('❌ Erreur lors de l\'analyse:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeLeaseWorkflow();


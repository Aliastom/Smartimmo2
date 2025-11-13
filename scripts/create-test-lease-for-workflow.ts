#!/usr/bin/env npx tsx

/**
 * Script pour créer un bail de test pour le workflow bail signé
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestLeaseForWorkflow() {
  console.log('🔨 Création d\'un bail de test pour le workflow bail signé\n');

  try {
    // Récupérer le bien "appart 6"
    const property = await prisma.property.findFirst({
      where: {
        name: {
          contains: 'appart 6'
        }
      }
    });

    if (!property) {
      console.log('❌ Bien "appart 6" non trouvé');
      return;
    }

    // Récupérer un locataire via les baux existants
    const tenant = await prisma.tenant.findFirst({
      where: {
        leases: {
          some: {
            propertyId: property.id
          }
        }
      }
    });

    if (!tenant) {
      console.log('❌ Aucun locataire trouvé pour ce bien');
      return;
    }

    // Créer un nouveau bail en statut ENVOYÉ
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1); // Commence demain
    
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 6); // 6 mois de durée

    const lease = await prisma.lease.create({
      data: {
        propertyId: property.id,
        tenantId: tenant.id,
        startDate,
        endDate,
        rentAmount: 800,
        charges: 50,
        deposit: 1600,
        status: 'ENVOYÉ',
        type: 'residential',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('✅ Bail de test créé:');
    console.log(`   ID: ${lease.id}`);
    console.log(`   Propriété: ${property.name}`);
    console.log(`   Locataire: ${tenant.firstName} ${tenant.lastName}`);
    console.log(`   Statut: ${lease.status}`);
    console.log(`   Début: ${lease.startDate.toLocaleDateString('fr-FR')}`);
    console.log(`   Fin: ${lease.endDate?.toLocaleDateString('fr-FR') || 'Indéterminé'}`);
    console.log('');
    console.log('📝 Utilisez ce bail pour tester le workflow "Upload bail signé"');

  } catch (error) {
    console.error('❌ Erreur lors de la création du bail de test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestLeaseForWorkflow();

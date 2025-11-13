#!/usr/bin/env npx tsx

/**
 * Créer un bail de test avec statut ENVOYÉ
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestLease() {
  console.log('📝 Création d\'un bail de test avec statut ENVOYÉ\n');

  try {
    // Trouver une propriété et un locataire existants
    const property = await prisma.property.findFirst();
    const tenant = await prisma.tenant.findFirst();

    if (!property || !tenant) {
      console.log('❌ Aucune propriété ou locataire trouvé');
      return;
    }

    console.log(`🏠 Propriété: ${property.name}`);
    console.log(`👤 Locataire: ${tenant.firstName} ${tenant.lastName}`);

    // Créer un bail de test
    const testLease = await prisma.lease.create({
      data: {
        status: 'ENVOYÉ',
        startDate: new Date('2025-11-01'),
        endDate: new Date('2025-11-30'),
        rentAmount: 800,
        charges: 50,
        deposit: 800,
        propertyId: property.id,
        tenantId: tenant.id,
        type: 'residential',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        tenant: true,
        property: true
      }
    });

    console.log(`\n✅ Bail créé: ${testLease.id}`);
    console.log(`   Statut: ${testLease.status}`);
    console.log(`   Locataire: ${testLease.tenant?.firstName} ${testLease.tenant?.lastName}`);
    console.log(`   Propriété: ${testLease.property?.name}`);
    console.log(`   Période: ${testLease.startDate.toLocaleDateString()} - ${testLease.endDate?.toLocaleDateString()}`);

    console.log('\n🎯 Vous pouvez maintenant tester l\'upload d\'un document BAIL_SIGNE sur ce bail');

  } catch (error) {
    console.error('❌ Erreur lors de la création:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestLease();


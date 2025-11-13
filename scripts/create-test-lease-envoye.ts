#!/usr/bin/env npx tsx

/**
 * Script pour créer un bail de test avec statut ENVOYÉ
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestLease() {
  console.log('🧪 Création d\'un bail de test avec statut ENVOYÉ\n');

  try {
    // 1. Trouver un locataire existant
    const tenant = await prisma.tenant.findFirst({
      where: {
        firstName: 'THOMASs'
      }
    });

    if (!tenant) {
      console.log('❌ Locataire non trouvé');
      return;
    }

    console.log(`✅ Locataire trouvé: ${tenant.firstName} ${tenant.lastName}`);

    // 2. Trouver une propriété existante
    const property = await prisma.property.findFirst({
      where: {
        name: 'appart 6'
      }
    });

    if (!property) {
      console.log('❌ Propriété non trouvée');
      return;
    }

    console.log(`✅ Propriété trouvée: ${property.name}`);

    // 3. Créer un bail de test avec statut ENVOYÉ
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 5); // Commence il y a 5 jours
    
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 12); // Termine dans 12 mois

    const lease = await prisma.lease.create({
      data: {
        tenantId: tenant.id,
        propertyId: property.id,
        type: 'MEUBLE',
        startDate,
        endDate,
        monthlyRent: 800,
        status: 'ENVOYÉ',
        deposit: 1600,
        charges: 100
      },
      include: {
        tenant: true,
        property: true
      }
    });

    console.log('\n✅ Bail de test créé:');
    console.log(`   ID: ${lease.id}`);
    console.log(`   Statut: ${lease.status}`);
    console.log(`   Locataire: ${lease.tenant.firstName} ${lease.tenant.lastName}`);
    console.log(`   Propriété: ${lease.property.name}`);
    console.log(`   Début: ${lease.startDate.toLocaleDateString('fr-FR')}`);
    console.log(`   Fin: ${lease.endDate?.toLocaleDateString('fr-FR')}`);
    console.log(`   Loyer: ${lease.monthlyRent}€`);
    
    console.log('\n📋 Utilisez ce bail pour tester l\'upload d\'un bail signé:');
    console.log(`   1. Allez sur /baux`);
    console.log(`   2. Cliquez sur le bail avec l\'ID: ${lease.id}`);
    console.log(`   3. Cliquez sur "Uploader bail signé"`);
    console.log(`   4. Sélectionnez un fichier`);
    console.log(`   5. Cliquez sur "Enregistrer"`);
    console.log(`   6. Vérifiez que le bail passe à "SIGNÉ" puis "ACTIF"`);

  } catch (error) {
    console.error('❌ Erreur lors de la création du bail:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestLease();


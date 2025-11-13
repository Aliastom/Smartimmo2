#!/usr/bin/env npx tsx

/**
 * Script de test pour vérifier le filtrage des biens par statut
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testPropertyFiltering() {
  console.log('🧪 Test du filtrage des biens par statut');
  console.log('==========================================');

  try {
    // 1. Récupérer tous les biens
    const allProperties = await prisma.property.findMany({
      include: {
        leases: {
          where: { status: 'ACTIF' },
          include: {
            tenant: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    console.log(`\n📊 Total des biens : ${allProperties.length}`);
    
    allProperties.forEach((property, index) => {
      const hasActiveLease = property.leases.length > 0;
      const status = hasActiveLease ? 'OCCUPÉ' : 'VACANT';
      const tenant = hasActiveLease ? `${property.leases[0].tenant.firstName} ${property.leases[0].tenant.lastName}` : 'Aucun';
      
      console.log(`${index + 1}. ${property.name} - ${status} - Locataire: ${tenant}`);
    });

    // 2. Tester le filtrage "occupied"
    const occupiedProperties = await prisma.property.findMany({
      where: {
        leases: {
          some: {
            status: 'ACTIF'
          }
        }
      },
      include: {
        leases: {
          where: { status: 'ACTIF' },
          include: {
            tenant: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    console.log(`\n🏠 Biens occupés : ${occupiedProperties.length}`);
    occupiedProperties.forEach((property, index) => {
      console.log(`${index + 1}. ${property.name} - Locataire: ${property.leases[0].tenant.firstName} ${property.leases[0].tenant.lastName}`);
    });

    // 3. Tester le filtrage "vacant"
    const vacantProperties = await prisma.property.findMany({
      where: {
        leases: {
          none: {
            status: 'ACTIF'
          }
        }
      }
    });

    console.log(`\n🏢 Biens vacants : ${vacantProperties.length}`);
    vacantProperties.forEach((property, index) => {
      console.log(`${index + 1}. ${property.name}`);
    });

    console.log('\n✅ Test terminé !');
    console.log('\n🎯 Résultat attendu sur la page web :');
    console.log('- Cliquer sur "Occupés" doit afficher', occupiedProperties.length, 'bien(s)');
    console.log('- Cliquer sur "Vacants" doit afficher', vacantProperties.length, 'bien(s)');
    console.log('- Cliquer sur "Total Biens" doit afficher', allProperties.length, 'bien(s)');

  } catch (error) {
    console.error('❌ Erreur lors du test :', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPropertyFiltering();

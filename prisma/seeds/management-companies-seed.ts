/**
 * Seed pour les sociétés de gestion (développement)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedManagementCompanies() {
  console.log('🏢 Seed: Sociétés de gestion...');

  // Vérifier si le feature flag est activé
  if (process.env.ENABLE_GESTION_SOCIETE !== 'true') {
    console.log('⚠️  Feature flag ENABLE_GESTION_SOCIETE non activé, skip seed');
    return;
  }

  // Créer la catégorie frais_gestion si elle n'existe pas
  let fraisGestionCategory = await prisma.category.findFirst({
    where: { slug: 'frais_gestion' },
  });

  if (!fraisGestionCategory) {
    fraisGestionCategory = await prisma.category.create({
      data: {
        slug: 'frais_gestion',
        label: 'Frais de gestion',
        type: 'DEPENSE',
        deductible: true,
        capitalizable: false,
        system: true,
        actif: true,
      },
    });
    console.log('✅ Catégorie frais_gestion créée');
  }

  // Créer une société de gestion de test
  const existingSociete = await prisma.managementCompany.findFirst({
    where: { nom: 'ImmoGest' },
  });

  if (!existingSociete) {
    const societe = await prisma.managementCompany.create({
      data: {
        nom: 'ImmoGest',
        contact: 'Jean Dupont',
        email: 'contact@immogest.fr',
        telephone: '01 23 45 67 89',
        modeCalcul: 'LOYERS_UNIQUEMENT',
        taux: 0.06, // 6%
        fraisMin: 30.0,
        baseSurEncaissement: true,
        tvaApplicable: false,
        tauxTva: null,
        actif: true,
      },
    });

    console.log('✅ Société ImmoGest créée');

    // Lier 1-2 biens au hasard à cette société (si des biens existent)
    const properties = await prisma.property.findMany({
      take: 2,
    });

    if (properties.length > 0) {
      for (const property of properties) {
        await prisma.property.update({
          where: { id: property.id },
          data: { managementCompanyId: societe.id },
        });
      }
      console.log(`✅ ${properties.length} bien(s) lié(s) à ImmoGest`);
    }

    // Mettre à jour 1 bail avec des charges détaillées (si un bail existe)
    const lease = await prisma.lease.findFirst({
      where: {
        propertyId: { in: properties.map((p) => p.id) },
      },
    });

    if (lease) {
      await prisma.lease.update({
        where: { id: lease.id },
        data: {
          chargesRecupMensuelles: 20.0,
          chargesNonRecupMensuelles: 35.0,
        },
      });
      console.log('✅ Bail mis à jour avec charges détaillées');
    }
  } else {
    console.log('ℹ️  Société ImmoGest existe déjà');
  }

  console.log('✅ Seed sociétés de gestion terminé');
}

// Exécuter le seed si appelé directement
if (require.main === module) {
  seedManagementCompanies()
    .catch((e) => {
      console.error('❌ Erreur lors du seed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { seedManagementCompanies };


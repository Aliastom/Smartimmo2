/**
 * Seed minimal pour tester SmartImmo avec les données fiscales
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seed minimal - Nettoyage et initialisation...\n');

  // Nettoyer dans le bon ordre (respecter les foreign keys)
  await prisma.transaction.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.document.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.echeanceRecurrente.deleteMany();
  await prisma.lease.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.occupancyHistory.deleteMany();
  await prisma.property.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.category.deleteMany();
  
  console.log('✅ Base de données nettoyée\n');

  // ==================== CATÉGORIES ====================
  
  const categoryLoyer = await prisma.category.create({
    data: {
      slug: 'loyer',
      label: 'Loyer',
      type: 'REVENU',
      deductible: false,
      capitalizable: false,
      system: true,
      actif: true,
    },
  });

  const categoryTaxeFonciere = await prisma.category.create({
    data: {
      slug: 'taxe-fonciere',
      label: 'Taxe foncière',
      type: 'expense',
      deductible: true,
      capitalizable: false,
      system: true,
      actif: true,
    },
  });

  const categoryCharges = await prisma.category.create({
    data: {
      slug: 'charges',
      label: 'Charges',
      type: 'expense',
      deductible: true,
      capitalizable: false,
      system: false,
      actif: true,
    },
  });

  console.log('✅ 3 catégories créées\n');

  // ==================== TENANT ====================

  const tenant1 = await prisma.tenant.create({
    data: {
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean.dupont@example.com',
      phone: '0612345678',
      birthDate: new Date('1985-05-15'),
      status: 'ACTIVE',
    },
  });

  console.log('✅ 1 locataire créé\n');

  // ==================== PROPERTY ====================

  const property1 = await prisma.property.create({
    data: {
      name: 'Appartement Centre Ville',
      type: 'apartment',
      address: '45 avenue des Champs-Élysées',
      postalCode: '75008',
      city: 'Paris',
      surface: 65,
      rooms: 3,
      acquisitionDate: new Date('2020-03-01'),
      acquisitionPrice: 450000,
      notaryFees: 35000,
      currentValue: 480000,
      status: 'loue',
      occupation: 'OCCUPE',
      fiscalTypeId: 'NU',        // Type fiscal : Location nue
      fiscalRegimeId: 'REEL',    // Régime : Réel
    },
  });

  console.log('✅ 1 bien créé (avec type et régime fiscaux)\n');

  // ==================== BAIL ====================

  const lease1 = await prisma.lease.create({
    data: {
      propertyId: property1.id,
      tenantId: tenant1.id,
      type: 'VIDE',
      startDate: new Date('2024-01-01'),
      rentAmount: 1800,
      deposit: 3600,
      paymentDay: 5,
      status: 'ACTIF',
    },
  });

  console.log('✅ 1 bail créé\n');

  console.log('\n✨ Seed minimal terminé avec succès !');
  console.log('\n📊 Résumé :');
  console.log('   - 3 catégories');
  console.log('   - 1 locataire');
  console.log('   - 1 bien (avec type fiscal NU + régime REEL)');
  console.log('   - 1 bail actif');
  console.log('   - 3 types fiscaux (NU, MEUBLE, SCI_IS)');
  console.log('   - 5 régimes fiscaux');
  console.log('   - 1 version fiscale 2025.1 publiée');
  console.log('\n✅ Vous pouvez maintenant tester l\'application !');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


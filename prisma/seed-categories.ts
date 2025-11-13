import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding categories...');

  // Catégories système (revenus)
  const loyer = await prisma.category.upsert({
    where: { name: 'Loyer' },
    update: {},
    create: {
      name: 'Loyer',
      type: 'INCOME',
      isDeductible: false,
      isCapitalizable: false,
      isSystem: true,
      active: true,
    },
  });
  console.log('✅ Catégorie Loyer créée:', loyer.id);

  const charges = await prisma.category.upsert({
    where: { name: 'Charges locatives' },
    update: {},
    create: {
      name: 'Charges locatives',
      type: 'INCOME',
      isDeductible: false,
      isCapitalizable: false,
      isSystem: true,
      active: true,
    },
  });
  console.log('✅ Catégorie Charges locatives créée:', charges.id);

  // Catégories revenus supplémentaires
  await prisma.category.upsert({
    where: { name: 'Revenus exceptionnels' },
    update: {},
    create: {
      name: 'Revenus exceptionnels',
      type: 'INCOME',
      isDeductible: false,
      isCapitalizable: false,
      isSystem: false,
      active: true,
    },
  });

  // Catégories dépenses déductibles
  await prisma.category.upsert({
    where: { name: 'Travaux d\'entretien' },
    update: {},
    create: {
      name: 'Travaux d\'entretien',
      type: 'EXPENSE',
      isDeductible: true,
      isCapitalizable: false,
      isSystem: false,
      active: true,
    },
  });

  await prisma.category.upsert({
    where: { name: 'Taxe foncière' },
    update: {},
    create: {
      name: 'Taxe foncière',
      type: 'EXPENSE',
      isDeductible: true,
      isCapitalizable: false,
      isSystem: false,
      active: true,
    },
  });

  await prisma.category.upsert({
    where: { name: 'Assurance PNO' },
    update: {},
    create: {
      name: 'Assurance PNO',
      type: 'EXPENSE',
      isDeductible: true,
      isCapitalizable: false,
      isSystem: false,
      active: true,
    },
  });

  await prisma.category.upsert({
    where: { name: 'Charges de copropriété' },
    update: {},
    create: {
      name: 'Charges de copropriété',
      type: 'EXPENSE',
      isDeductible: true,
      isCapitalizable: false,
      isSystem: false,
      active: true,
    },
  });

  await prisma.category.upsert({
    where: { name: 'Frais de gestion' },
    update: {},
    create: {
      name: 'Frais de gestion',
      type: 'EXPENSE',
      isDeductible: true,
      isCapitalizable: false,
      isSystem: false,
      active: true,
    },
  });

  await prisma.category.upsert({
    where: { name: 'Honoraires' },
    update: {},
    create: {
      name: 'Honoraires',
      type: 'EXPENSE',
      isDeductible: true,
      isCapitalizable: false,
      isSystem: false,
      active: true,
    },
  });

  // Catégories dépenses capitalisables
  await prisma.category.upsert({
    where: { name: 'Travaux d\'amélioration' },
    update: {},
    create: {
      name: 'Travaux d\'amélioration',
      type: 'EXPENSE',
      isDeductible: false,
      isCapitalizable: true,
      isSystem: false,
      active: true,
    },
  });

  await prisma.category.upsert({
    where: { name: 'Gros travaux' },
    update: {},
    create: {
      name: 'Gros travaux',
      type: 'EXPENSE',
      isDeductible: false,
      isCapitalizable: true,
      isSystem: false,
      active: true,
    },
  });

  // Catégories dépenses non déductibles
  await prisma.category.upsert({
    where: { name: 'Autre dépense' },
    update: {},
    create: {
      name: 'Autre dépense',
      type: 'EXPENSE',
      isDeductible: false,
      isCapitalizable: false,
      isSystem: false,
      active: true,
    },
  });

  // Catégories financières
  await prisma.category.upsert({
    where: { name: 'Intérêts d\'emprunt' },
    update: {},
    create: {
      name: 'Intérêts d\'emprunt',
      type: 'EXPENSE',
      isDeductible: true,
      isCapitalizable: false,
      isSystem: false,
      active: true,
    },
  });

  console.log('✅ Toutes les catégories ont été créées/mises à jour');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Erreur lors du seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });



import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedAll() {
  console.log('🌱 Seeding all base data...');

  try {
    // 1. Catégories comptables
    console.log('📊 Creating accounting categories...');
    const categories = [
      // Revenus
      { slug: 'loyer', label: 'Loyer', type: 'REVENU', actif: true, deductible: false, capitalizable: false },
      { slug: 'depot-garantie', label: 'Dépôt de garantie', type: 'REVENU', actif: true, deductible: false, capitalizable: false },
      { slug: 'avoir-locataire', label: 'Avoir locataire', type: 'REVENU', actif: true, deductible: false, capitalizable: false },
      
      // Dépenses
      { slug: 'charges-locatives', label: 'Charges locatives', type: 'DEPENSE', actif: true, deductible: true, capitalizable: false },
      { slug: 'taxe-fonciere', label: 'Taxe foncière', type: 'DEPENSE', actif: true, deductible: true, capitalizable: false },
      { slug: 'interets-emprunt', label: 'Intérêts d\'emprunt', type: 'DEPENSE', actif: true, deductible: true, capitalizable: false },
      { slug: 'frais-gestion', label: 'Frais de gestion', type: 'DEPENSE', actif: true, deductible: true, capitalizable: false },
      { slug: 'assurance-pno', label: 'Assurance PNO', type: 'DEPENSE', actif: true, deductible: true, capitalizable: false },
      { slug: 'travaux-entretien', label: 'Travaux d\'entretien', type: 'DEPENSE', actif: true, deductible: true, capitalizable: false },
      { slug: 'travaux-amelioration', label: 'Travaux d\'amélioration', type: 'DEPENSE', actif: true, deductible: false, capitalizable: true },
      { slug: 'penalite-retard', label: 'Pénalité de retard', type: 'DEPENSE', actif: true, deductible: false, capitalizable: false },
      
      // Non défini
      { slug: 'divers', label: 'Divers', type: 'NON_DEFINI', actif: true, deductible: false, capitalizable: false },
    ];

    const createdCategories = [];
    for (const category of categories) {
      const created = await prisma.category.upsert({
        where: { slug: category.slug },
        update: category,
        create: category,
      });
      createdCategories.push(created);
    }
    console.log('✅ Accounting categories created');

    // 2. Entités de nature
    console.log('🏷️ Creating nature entities...');
    const natures = [
      { code: 'LOYER', label: 'Loyer' },
      { code: 'CHARGES', label: 'Charges locatives' },
      { code: 'DEPOT_GARANTIE_RECU', label: 'Dépôt de garantie reçu' },
      { code: 'DEPOT_GARANTIE_RENDU', label: 'Dépôt de garantie rendu' },
      { code: 'AVOIR_REGULARISATION', label: 'Avoir / Régularisation' },
      { code: 'PENALITE_RETENUE', label: 'Pénalité / Retenue' },
      { code: 'AUTRE', label: 'Autre' },
    ];

    for (const nature of natures) {
      await prisma.natureEntity.upsert({
        where: { code: nature.code },
        update: nature,
        create: nature,
      });
    }
    console.log('✅ Nature entities created');

    // 3. Règles de nature
    console.log('🔗 Creating nature rules...');
    const natureRules = [
      // LOYER - peut être REVENU ou NON_DEFINI
      { natureCode: 'LOYER', allowedType: 'REVENU' },
      { natureCode: 'LOYER', allowedType: 'NON_DEFINI' },
      
      // CHARGES - peut être DEPENSE ou NON_DEFINI
      { natureCode: 'CHARGES', allowedType: 'DEPENSE' },
      { natureCode: 'CHARGES', allowedType: 'NON_DEFINI' },
      
      // DEPOT_GARANTIE_RECU - peut être REVENU ou NON_DEFINI
      { natureCode: 'DEPOT_GARANTIE_RECU', allowedType: 'REVENU' },
      { natureCode: 'DEPOT_GARANTIE_RECU', allowedType: 'NON_DEFINI' },
      
      // DEPOT_GARANTIE_RENDU - peut être DEPENSE ou NON_DEFINI
      { natureCode: 'DEPOT_GARANTIE_RENDU', allowedType: 'DEPENSE' },
      { natureCode: 'DEPOT_GARANTIE_RENDU', allowedType: 'NON_DEFINI' },
      
      // AVOIR_REGULARISATION - peut être REVENU, DEPENSE ou NON_DEFINI
      { natureCode: 'AVOIR_REGULARISATION', allowedType: 'REVENU' },
      { natureCode: 'AVOIR_REGULARISATION', allowedType: 'DEPENSE' },
      { natureCode: 'AVOIR_REGULARISATION', allowedType: 'NON_DEFINI' },
      
      // PENALITE_RETENUE - peut être DEPENSE ou NON_DEFINI
      { natureCode: 'PENALITE_RETENUE', allowedType: 'DEPENSE' },
      { natureCode: 'PENALITE_RETENUE', allowedType: 'NON_DEFINI' },
      
      // AUTRE - peut être REVENU, DEPENSE ou NON_DEFINI
      { natureCode: 'AUTRE', allowedType: 'REVENU' },
      { natureCode: 'AUTRE', allowedType: 'DEPENSE' },
      { natureCode: 'AUTRE', allowedType: 'NON_DEFINI' },
    ];

    for (const rule of natureRules) {
      await prisma.natureRule.upsert({
        where: { 
          natureCode_allowedType: {
            natureCode: rule.natureCode,
            allowedType: rule.allowedType,
          }
        },
        update: rule,
        create: rule,
      });
    }
    console.log('✅ Nature rules created');

    // 4. Défauts de nature
    console.log('⚙️ Creating nature defaults...');
    const natureDefaults = [
      { natureCode: 'LOYER', defaultCategoryId: createdCategories.find(c => c.slug === 'loyer')?.id },
      { natureCode: 'CHARGES', defaultCategoryId: createdCategories.find(c => c.slug === 'charges-locatives')?.id },
      { natureCode: 'DEPOT_GARANTIE_RECU', defaultCategoryId: createdCategories.find(c => c.slug === 'depot-garantie')?.id },
      // Les autres natures n'ont pas de catégorie par défaut
      { natureCode: 'DEPOT_GARANTIE_RENDU', defaultCategoryId: null },
      { natureCode: 'AVOIR_REGULARISATION', defaultCategoryId: null },
      { natureCode: 'PENALITE_RETENUE', defaultCategoryId: null },
      { natureCode: 'AUTRE', defaultCategoryId: null },
    ];

    for (const defaultItem of natureDefaults) {
      await prisma.natureDefault.upsert({
        where: { natureCode: defaultItem.natureCode },
        update: defaultItem,
        create: defaultItem,
      });
    }
    console.log('✅ Nature defaults created');

    // 5. Propriétaire par défaut
    console.log('👤 Creating default landlord...');
    const defaultLandlord = await prisma.landlord.upsert({
      where: { id: 1 },
      update: {
        fullName: 'Propriétaire',
        email: 'proprietaire@example.com',
        phone: '',
        address1: '',
        city: '',
        postalCode: '',
      },
      create: {
        id: 1,
        fullName: 'Propriétaire',
        email: 'proprietaire@example.com',
        phone: '',
        address1: '',
        city: '',
        postalCode: '',
      },
    });
    console.log('✅ Default landlord created');

    console.log('🎉 All base data seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding base data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
seedAll()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

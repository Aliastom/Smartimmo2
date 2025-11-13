import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedAccountingCategories() {
  console.log('🌱 Seeding accounting categories data...');

  try {
    // Catégories comptables de base
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
      { slug: 'travaux-amélioration', label: 'Travaux d\'amélioration', type: 'DEPENSE', actif: true, deductible: false, capitalizable: true },
      { slug: 'penalite-retard', label: 'Pénalité de retard', type: 'DEPENSE', actif: true, deductible: false, capitalizable: false },
      
      // Non défini
      { slug: 'divers', label: 'Divers', type: 'NON_DEFINI', actif: true, deductible: false, capitalizable: false },
    ];

    for (const category of categories) {
      await prisma.category.upsert({
        where: { slug: category.slug },
        update: category,
        create: category,
      });
    }
    console.log('✅ Accounting categories created');

    console.log('🎉 Accounting categories data seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding accounting categories data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
seedAccountingCategories()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

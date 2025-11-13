import { prisma } from '@/lib/prisma';

async function main() {
  try {
    console.log('🏗️ Création des catégories de base...\n');
    
    // Catégories pour les revenus (loyers)
    const revenueCategories = [
      { label: 'Loyers perçus', type: 'LOYER', slug: 'loyers-percus', actif: true },
      { label: 'Charges récupérables', type: 'LOYER', slug: 'charges-recuperables', actif: true },
      { label: 'Dépôt de garantie', type: 'LOYER', slug: 'depot-garantie', actif: true },
      { label: 'Frais de dossier', type: 'LOYER', slug: 'frais-dossier', actif: true }
    ];
    
    // Catégories pour les dépenses
    const expenseCategories = [
      { label: 'Charges de copropriété', type: 'CHARGES', slug: 'charges-copropriete', actif: true },
      { label: 'Taxe foncière', type: 'TAXES', slug: 'taxe-fonciere', actif: true },
      { label: 'Assurance propriétaire', type: 'ASSURANCE', slug: 'assurance-proprietaire', actif: true },
      { label: 'Maintenance et réparations', type: 'MAINTENANCE', slug: 'maintenance-reparations', actif: true },
      { label: 'Frais de gestion', type: 'GESTION', slug: 'frais-gestion', actif: true },
      { label: 'Frais bancaires', type: 'BANQUE', slug: 'frais-bancaires', actif: true }
    ];
    
    const allCategories = [...revenueCategories, ...expenseCategories];
    
    let createdCount = 0;
    for (const category of allCategories) {
      try {
        await prisma.category.create({
          data: category
        });
        console.log(`✅ Créé: ${category.label} (${category.type})`);
        createdCount++;
      } catch (error: any) {
        if (error.code === 'P2002') {
          console.log(`⏭️  Déjà existant: ${category.label}`);
        } else {
          console.error(`❌ Erreur pour ${category.label}:`, error.message);
        }
      }
    }
    
    console.log(`\n🎉 ${createdCount} catégories créées avec succès !`);
    
    // Vérification finale
    const totalCategories = await prisma.category.count();
    console.log(`📊 Total des catégories dans la base: ${totalCategories}`);
    
  } catch (error: any) {
    console.error('❌ Erreur lors de la création des catégories:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

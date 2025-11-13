import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Création des catégories par défaut...\n');

  // Catégories REVENUS
  const categories = [
    // REVENUS
    { name: 'Loyer', type: 'INCOME', isDeductible: false, isCapitalizable: false, isSystem: true },
    { name: 'Dépôt de garantie reçu', type: 'INCOME', isDeductible: false, isCapitalizable: false, isSystem: true },
    { name: 'Pénalité / Retenue', type: 'INCOME', isDeductible: false, isCapitalizable: false, isSystem: true },
    
    // DÉPENSES
    { name: 'Charges locatives', type: 'EXPENSE', isDeductible: true, isCapitalizable: false, isSystem: true },
    { name: 'Dépôt de garantie rendu', type: 'EXPENSE', isDeductible: false, isCapitalizable: false, isSystem: true },
    { name: 'Taxe foncière', type: 'EXPENSE', isDeductible: true, isCapitalizable: false, isSystem: false },
    { name: 'Travaux d\'entretien', type: 'EXPENSE', isDeductible: true, isCapitalizable: false, isSystem: false },
    { name: 'Assurance PNO', type: 'EXPENSE', isDeductible: true, isCapitalizable: false, isSystem: false },
    { name: 'Charges de copropriété', type: 'EXPENSE', isDeductible: true, isCapitalizable: false, isSystem: false },
    { name: 'Frais de gestion', type: 'EXPENSE', isDeductible: true, isCapitalizable: false, isSystem: false },
    { name: 'Honoraires', type: 'EXPENSE', isDeductible: true, isCapitalizable: false, isSystem: false },
    { name: 'Intérêts d\'emprunt', type: 'EXPENSE', isDeductible: true, isCapitalizable: false, isSystem: false },
    { name: 'Travaux d\'amélioration', type: 'EXPENSE', isDeductible: false, isCapitalizable: true, isSystem: false },
    { name: 'Gros travaux', type: 'EXPENSE', isDeductible: false, isCapitalizable: true, isSystem: false },
    
    // AUTRE (Non défini)
    { name: 'Avoir / Régularisation', type: 'OTHER', isDeductible: false, isCapitalizable: false, isSystem: true },
    
    // AUTRE
    { name: 'Autre dépense', type: 'OTHER', isDeductible: false, isCapitalizable: false, isSystem: false },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    console.log(`✅ ${cat.name} (${cat.type})`);
  }

  console.log('\n✅ TERMINÉ ! Toutes les catégories par défaut ont été créées.');
  
  await prisma.$disconnect();
}

main().catch(console.error);


import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Migration des payments existants vers les catégories...');

  // Récupérer les catégories
  const categories = await prisma.category.findMany();
  const loyerCategory = categories.find(c => c.name === 'Loyer');
  const chargesCategory = categories.find(c => c.name === 'Charges locatives');
  const autreDepenseCategory = categories.find(c => c.name === 'Autre dépense');

  if (!loyerCategory || !chargesCategory) {
    console.error('❌ Les catégories "Loyer" et "Charges locatives" doivent exister. Lancez d\'abord seed-categories.ts');
    process.exit(1);
  }

  // Récupérer tous les payments
  const payments = await prisma.payment.findMany();
  console.log(`📊 ${payments.length} payments à migrer`);

  let updated = 0;

  for (const payment of payments) {
    let categoryId: string | null = null;

    // Mapper nature -> categoryId
    switch (payment.nature) {
      case 'LOYER':
        categoryId = loyerCategory.id;
        break;
      case 'CHARGES':
        categoryId = chargesCategory.id;
        break;
      case 'AUTRE':
        // Si montant négatif, c'est une dépense
        if (payment.amount < 0 && autreDepenseCategory) {
          categoryId = autreDepenseCategory.id;
        }
        // Sinon laisser null (à classifier manuellement)
        break;
      // DEPOT_RECU, DEPOT_RENDU, AVOIR, PENALITE -> laisser categoryId = null
      default:
        categoryId = null;
    }

    // Mettre à jour seulement si categoryId est défini et différent
    if (categoryId && payment.categoryId !== categoryId) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { categoryId },
      });
      updated++;
    }
  }

  console.log(`✅ ${updated} payments mis à jour avec des catégories`);
  console.log(`ℹ️  ${payments.length - updated} payments sans catégorie (natures spéciales ou à classifier)`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Erreur lors de la migration:', e);
    await prisma.$disconnect();
    process.exit(1);
  });



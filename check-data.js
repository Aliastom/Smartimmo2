const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const nature = await prisma.natureEntity.findUnique({
      where: { code: 'RECETTE_LOYER' }
    });
    console.log('Nature RECETTE_LOYER:', JSON.stringify(nature, null, 2));

    const categories = await prisma.category.findMany({
      where: { actif: true },
      take: 10,
      orderBy: { label: 'asc' }
    });
    console.log('\nCatégories actives (10 premières):');
    categories.forEach(c => {
      console.log(`  - ${c.label} (slug: ${c.slug}, type: ${c.type})`);
    });

    // Vérifier si des catégories correspondent au flow de RECETTE_LOYER
    if (nature && nature.flow) {
      const matchingCats = await prisma.category.findMany({
        where: { 
          actif: true,
          type: nature.flow
        },
        take: 10
      });
      console.log(`\nCatégories avec type="${nature.flow}" (${matchingCats.length} trouvées):`);
      matchingCats.forEach(c => {
        console.log(`  - ${c.label} (slug: ${c.slug})`);
      });
    }
  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
})();


import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testNaturesCategories() {
  console.log('🧪 Test du système natures-catégories...');

  try {
    // 1. Vérifier les natures
    console.log('\n📝 Vérification des natures...');
    const natures = await prisma.natureEntity.findMany({
      include: {
        rules: true,
        defaults: {
          include: {
            defaultCategory: true
          }
        }
      }
    });

    console.log(`✅ ${natures.length} natures trouvées:`);
    natures.forEach(nature => {
      console.log(`  - ${nature.code}: ${nature.label} (${nature.flow})`);
      console.log(`    Règles: ${nature.rules.map(r => r.allowedType).join(', ')}`);
      if (nature.defaults?.defaultCategory) {
        console.log(`    Catégorie par défaut: ${nature.defaults.defaultCategory.label}`);
      }
    });

    // 2. Vérifier les catégories
    console.log('\n📝 Vérification des catégories...');
    const categories = await prisma.category.findMany();
    console.log(`✅ ${categories.length} catégories trouvées:`);
    categories.forEach(category => {
      console.log(`  - ${category.slug}: ${category.label} (${category.type})`);
    });

    // 3. Vérifier les règles
    console.log('\n📝 Vérification des règles...');
    const rules = await prisma.natureRule.findMany();
    console.log(`✅ ${rules.length} règles trouvées:`);
    rules.forEach(rule => {
      console.log(`  - ${rule.natureCode} → ${rule.allowedType}`);
    });

    // 4. Vérifier les mappings par défaut
    console.log('\n📝 Vérification des mappings par défaut...');
    const mappings = await prisma.natureDefault.findMany({
      include: {
        defaultCategory: true
      }
    });
    console.log(`✅ ${mappings.length} mappings trouvés:`);
    mappings.forEach(mapping => {
      console.log(`  - ${mapping.natureCode} → ${mapping.defaultCategory?.label || 'Aucune'}`);
    });

    // 5. Test de compatibilité
    console.log('\n📝 Test de compatibilité...');
    const testNature = natures[0];
    if (testNature) {
      const compatibleCategories = categories.filter(cat => 
        testNature.rules.some(rule => rule.allowedType === cat.type)
      );
      console.log(`✅ Pour ${testNature.code}, ${compatibleCategories.length} catégories compatibles:`);
      compatibleCategories.forEach(cat => {
        console.log(`  - ${cat.label} (${cat.type})`);
      });
    }

    console.log('\n🎉 Test terminé avec succès !');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le test
testNaturesCategories()
  .then(() => {
    console.log('Test terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erreur:', error);
    process.exit(1);
  });

export { testNaturesCategories };

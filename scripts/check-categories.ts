import { prisma } from '@/lib/prisma';

async function main() {
  try {
    console.log('🔍 Vérification des catégories...\n');
    
    const categories = await prisma.category.findMany({
      select: { id: true, label: true, type: true, actif: true }
    });
    
    console.log(`📋 ${categories.length} catégories trouvées:`);
    categories.forEach((cat, index) => {
      console.log(`   ${index + 1}. ${cat.label} (${cat.type}) - ${cat.actif ? '✅ Actif' : '❌ Inactif'}`);
    });
    
    if (categories.length === 0) {
      console.log('\n❌ Aucune catégorie trouvée !');
      console.log('💡 Il faut créer des catégories dans la base de données.');
    } else {
      console.log('\n✅ Des catégories existent dans la base.');
    }
    
    // Vérifier les natures aussi
    console.log('\n🔍 Vérification des natures...');
    const natures = await prisma.nature.findMany({
      select: { id: true, label: true, type: true }
    });
    
    console.log(`📋 ${natures.length} natures trouvées:`);
    natures.forEach((nature, index) => {
      console.log(`   ${index + 1}. ${nature.label} (${nature.type})`);
    });
    
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
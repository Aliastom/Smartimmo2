import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDuplicates() {
  console.log('🔍 Vérification des doublons...');

  try {
    // Vérifier les natures ASSURANCE
    const assuranceNatures = await prisma.natureEntity.findMany({
      where: { 
        code: { 
          contains: 'ASSURANCE' 
        } 
      },
      include: { 
        rules: true, 
        defaults: {
          include: {
            defaultCategory: true
          }
        } 
      }
    });

    console.log(`\n📝 Natures ASSURANCE trouvées (${assuranceNatures.length}):`);
    assuranceNatures.forEach(nature => {
      console.log(`- ${nature.code}: ${nature.label}`);
      console.log(`  Règles: ${nature.rules.map(r => r.allowedType).join(', ')}`);
      console.log(`  Défaut: ${nature.defaults?.defaultCategory?.label || 'Aucun'}`);
    });

    // Vérifier toutes les natures
    const allNatures = await prisma.natureEntity.findMany({
      orderBy: { code: 'asc' }
    });

    console.log(`\n📊 Toutes les natures (${allNatures.length}):`);
    allNatures.forEach(nature => {
      console.log(`- ${nature.code}: ${nature.label}`);
    });

    // Vérifier les doublons potentiels
    const codes = allNatures.map(n => n.code);
    const duplicates = codes.filter((code, index) => codes.indexOf(code) !== index);
    
    if (duplicates.length > 0) {
      console.log(`\n⚠️ Codes dupliqués détectés: ${duplicates.join(', ')}`);
    } else {
      console.log('\n✅ Aucun code dupliqué détecté');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicates();

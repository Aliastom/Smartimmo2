import { prisma } from '@/lib/prisma';

async function main() {
  try {
    console.log('🔄 Test de l\'import des mappings avec la nouvelle logique...\n');
    
    const mappings = [
      { nature: "RECETTE_LOYER", types: ["LOYER"] },
      { nature: "RECETTE_AUTRE", types: ["OTHER"] },
      { nature: "DEPENSE_ENTRETIEN", types: ["MAINTENANCE"] },
      { nature: "DEPENSE_ASSURANCE", types: ["ASSURANCE"] },
      { nature: "DEPENSE_TAXE", types: ["TAXE_FONCIERE"] },
      { nature: "DEPENSE_BANQUE", types: ["BANQUE"] }
    ];
    
    for (const mapping of mappings) {
      console.log(`\n📝 Traitement mapping: ${mapping.nature} → types: ${mapping.types.join(', ')}`);
      
      // Chercher la catégorie par type
      const category = await prisma.category.findFirst({
        where: {
          type: mapping.types[0]
        }
      });
      
      if (category) {
        console.log(`  ✅ Catégorie trouvée: ${category.label} (${category.type})`);
        
        await prisma.natureDefault.upsert({
          where: { natureCode: mapping.nature },
          update: {
            defaultCategoryId: category.id
          },
          create: {
            natureCode: mapping.nature,
            defaultCategoryId: category.id
          }
        });
        
        console.log(`  ✅ Mapping créé/mis à jour`);
      } else {
        console.log(`  ❌ Catégorie non trouvée pour le type: ${mapping.types[0]}`);
      }
    }
    
    console.log('\n✅ Test terminé !');
    
    // Vérifier le résultat
    console.log('\n=== MAPPINGS FINAUX ===');
    const finalMappings = await prisma.natureDefault.findMany({
      include: {
        defaultCategory: {
          select: {
            slug: true,
            label: true,
            type: true
          }
        }
      }
    });
    finalMappings.forEach(m => {
      console.log(`- ${m.natureCode} → ${m.defaultCategory?.label || 'Aucune'} (${m.defaultCategory?.type || 'N/A'})`);
    });
    
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

import { prisma } from '@/lib/prisma';

async function main() {
  try {
    console.log('🔄 Réimport des mappings...\n');
    
    const mappings = [
      { nature: "RECETTE_LOYER", defaultCategory: "LOYER" },
      { nature: "RECETTE_AUTRE", defaultCategory: "AUTRES_RECETTES" },
      { nature: "DEPENSE_ENTRETIEN", defaultCategory: "ENTRETIEN" },
      { nature: "DEPENSE_ASSURANCE", defaultCategory: "ASSURANCE_HABITATION" },
      { nature: "DEPENSE_TAXE", defaultCategory: "TAXE_FONCIERE" },
      { nature: "DEPENSE_BANQUE", defaultCategory: "FRAIS_BANCAIRES" }
    ];
    
    for (const mapping of mappings) {
      console.log(`\n📝 Traitement mapping: ${mapping.nature} → ${mapping.defaultCategory}`);
      
      // Chercher la catégorie par slug
      let category = await prisma.category.findUnique({
        where: { slug: mapping.defaultCategory }
      }).catch(() => null);
      
      if (!category) {
        // Chercher par slug généré
        const slugPattern = mapping.defaultCategory.toLowerCase().replace(/_/g, '-');
        category = await prisma.category.findFirst({
          where: {
            slug: {
              startsWith: slugPattern
            }
          }
        });
      }
      
      if (category) {
        console.log(`  ✅ Catégorie trouvée: ${category.label} (${category.slug})`);
        
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
        console.log(`  ❌ Catégorie non trouvée: ${mapping.defaultCategory}`);
      }
    }
    
    console.log('\n✅ Réimport des mappings terminé !');
    
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

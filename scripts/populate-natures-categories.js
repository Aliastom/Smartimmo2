import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function populateNaturesCategories() {
  console.log('🚀 Début du peuplement de la BDD...');

  try {
    // 1. Créer les natures de base
    console.log('📝 Création des natures...');
    
    const natures = [
      {
        code: 'RECETTE_LOYER',
        label: 'Loyer',
        flow: 'INCOME'
      },
      {
        code: 'RECETTE_AUTRE',
        label: 'Autre recette',
        flow: 'INCOME'
      },
      {
        code: 'DEPENSE_ENTRETIEN',
        label: 'Entretien',
        flow: 'EXPENSE'
      },
      {
        code: 'DEPENSE_ASSURANCE',
        label: 'Assurance',
        flow: 'EXPENSE'
      },
      {
        code: 'DEPENSE_TAXE',
        label: 'Taxe foncière',
        flow: 'EXPENSE'
      },
      {
        code: 'DEPENSE_BANQUE',
        label: 'Frais bancaires',
        flow: 'EXPENSE'
      }
    ];

    for (const nature of natures) {
      await prisma.natureEntity.upsert({
        where: { code: nature.code },
        update: nature,
        create: nature
      });
      console.log(`✅ Nature créée/mise à jour: ${nature.code}`);
    }

    // 2. Créer les catégories de base
    console.log('📝 Création des catégories...');
    
    const categories = [
      {
        slug: 'loyer-principal',
        label: 'Loyer principal',
        type: 'LOYER',
        actif: true
      },
      {
        slug: 'loyer-charges',
        label: 'Loyer + charges',
        type: 'LOYER',
        actif: true
      },
      {
        slug: 'revenus-divers',
        label: 'Revenus divers',
        type: 'REVENU',
        actif: true
      },
      {
        slug: 'entretien-general',
        label: 'Entretien général',
        type: 'ENTRETIEN',
        actif: true
      },
      {
        slug: 'assurance-proprietaire',
        label: 'Assurance propriétaire',
        type: 'ASSURANCE',
        actif: true
      },
      {
        slug: 'taxe-fonciere',
        label: 'Taxe foncière',
        type: 'TAXE_FONCIERE',
        actif: true
      },
      {
        slug: 'frais-bancaires',
        label: 'Frais bancaires',
        type: 'BANQUE',
        actif: true
      },
      {
        slug: 'autres-depenses',
        label: 'Autres dépenses',
        type: 'OTHER',
        actif: true
      }
    ];

    const createdCategories = [];
    for (const category of categories) {
      const created = await prisma.category.upsert({
        where: { slug: category.slug },
        update: category,
        create: category
      });
      createdCategories.push(created);
      console.log(`✅ Catégorie créée/mise à jour: ${category.slug}`);
    }

    // 3. Créer les règles de compatibilité (NatureRule)
    console.log('📝 Création des règles de compatibilité...');
    
    const natureRules = [
      // RECETTE_LOYER peut utiliser LOYER, REVENU, ENTRETIEN
      { natureCode: 'RECETTE_LOYER', allowedType: 'LOYER' },
      { natureCode: 'RECETTE_LOYER', allowedType: 'REVENU' },
      { natureCode: 'RECETTE_LOYER', allowedType: 'ENTRETIEN' },
      
      // RECETTE_AUTRE peut utiliser OTHER
      { natureCode: 'RECETTE_AUTRE', allowedType: 'OTHER' },
      
      // DEPENSE_ENTRETIEN peut utiliser ENTRETIEN
      { natureCode: 'DEPENSE_ENTRETIEN', allowedType: 'ENTRETIEN' },
      
      // DEPENSE_ASSURANCE peut utiliser ASSURANCE
      { natureCode: 'DEPENSE_ASSURANCE', allowedType: 'ASSURANCE' },
      
      // DEPENSE_TAXE peut utiliser TAXE_FONCIERE
      { natureCode: 'DEPENSE_TAXE', allowedType: 'TAXE_FONCIERE' },
      
      // DEPENSE_BANQUE peut utiliser BANQUE
      { natureCode: 'DEPENSE_BANQUE', allowedType: 'BANQUE' }
    ];

    for (const rule of natureRules) {
      await prisma.natureRule.upsert({
        where: {
          natureCode_allowedType: {
            natureCode: rule.natureCode,
            allowedType: rule.allowedType
          }
        },
        update: rule,
        create: rule
      });
      console.log(`✅ Règle créée/mise à jour: ${rule.natureCode} → ${rule.allowedType}`);
    }

    // 4. Créer les mappings par défaut (NatureDefault)
    console.log('📝 Création des mappings par défaut...');
    
    const loyerPrincipal = createdCategories.find(c => c.slug === 'loyer-principal');
    const autresDepenses = createdCategories.find(c => c.slug === 'autres-depenses');
    
    const defaultMappings = [
      {
        natureCode: 'RECETTE_LOYER',
        defaultCategoryId: loyerPrincipal?.id
      },
      {
        natureCode: 'RECETTE_AUTRE',
        defaultCategoryId: autresDepenses?.id
      }
    ];

    for (const mapping of defaultMappings) {
      if (mapping.defaultCategoryId) {
        await prisma.natureDefault.upsert({
          where: { natureCode: mapping.natureCode },
          update: mapping,
          create: mapping
        });
        console.log(`✅ Mapping par défaut créé/mis à jour: ${mapping.natureCode} → ${mapping.defaultCategoryId}`);
      }
    }

    console.log('🎉 Peuplement terminé avec succès !');
    
    // Afficher un résumé
    const natureCount = await prisma.natureEntity.count();
    const categoryCount = await prisma.category.count();
    const ruleCount = await prisma.natureRule.count();
    const mappingCount = await prisma.natureDefault.count();
    
    console.log('\n📊 Résumé:');
    console.log(`- ${natureCount} natures`);
    console.log(`- ${categoryCount} catégories`);
    console.log(`- ${ruleCount} règles de compatibilité`);
    console.log(`- ${mappingCount} mappings par défaut`);

  } catch (error) {
    console.error('❌ Erreur lors du peuplement:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
populateNaturesCategories()
  .then(() => {
    console.log('Script terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erreur:', error);
    process.exit(1);
  });

export { populateNaturesCategories };

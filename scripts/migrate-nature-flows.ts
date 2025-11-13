import { prisma } from '../src/lib/prisma';

async function migrateNatureFlows() {
  console.log('🚀 Migration des flows de natures...');

  try {
    // Liste des natures existantes avec leur flow
    const naturesToMigrate = [
      { code: 'RECETTE_LOYER', flow: 'INCOME' },
      { code: 'RECETTE_AUTRE', flow: 'INCOME' },
      { code: 'DEPENSE_ENTRETIEN', flow: 'EXPENSE' },
      { code: 'DEPENSE_ASSURANCES', flow: 'EXPENSE' },
      { code: 'DEPENSE_TAXE', flow: 'EXPENSE' },
      { code: 'DEPENSE_BANQUE', flow: 'EXPENSE' },
    ];

    for (const nature of naturesToMigrate) {
      // Vérifier si la nature existe déjà
      const existingNature = await prisma.natureEntity.findUnique({
        where: { code: nature.code }
      });

      if (existingNature) {
        // Mettre à jour le flow
        await prisma.natureEntity.update({
          where: { code: nature.code },
          data: { flow: nature.flow }
        });
        console.log(`✅ Mis à jour ${nature.code} → flow: ${nature.flow}`);
      } else {
        // Créer la nature avec le flow
        await prisma.natureEntity.create({
          data: {
            code: nature.code,
            label: nature.code.replace('_', ' ').toLowerCase(),
            flow: nature.flow
          }
        });
        console.log(`✅ Créé ${nature.code} → flow: ${nature.flow}`);
      }
    }

    console.log('🎉 Migration terminée avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateNatureFlows();


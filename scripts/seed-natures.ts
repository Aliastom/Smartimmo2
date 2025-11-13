import { prisma } from '../src/lib/prisma';

async function seedNatures() {
  console.log('Création des natures...');
  
  const natures = [
    { code: 'RECETTE_LOYER', label: 'Loyer' },
    { code: 'RECETTE_AUTRE', label: 'Autre recette' },
    { code: 'DEPENSE_ENTRETIEN', label: 'Entretien' },
    { code: 'DEPENSE_ASSURANCE', label: 'Assurance' },
    { code: 'DEPENSE_TAXE', label: 'Taxe foncière' },
    { code: 'DEPENSE_BANQUE', label: 'Frais bancaires' }
  ];
  
  for (const nature of natures) {
    await prisma.natureEntity.upsert({
      where: { code: nature.code },
      update: nature,
      create: nature
    });
    console.log(`Nature créée/mise à jour: ${nature.code} - ${nature.label}`);
  }
  
  console.log('Natures créées avec succès !');
  await prisma.$disconnect();
}

seedNatures().catch(console.error);

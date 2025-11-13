import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Création du mapping Nature ↔ Catégories...\n');

  // 1. Créer les catégories avec le nouveau schéma
  const categories = [
    // REVENUS
    { slug: 'loyer', label: 'Loyer', type: 'REVENU', deductible: false, capitalizable: false, system: true },
    { slug: 'depot-garantie-recu', label: 'Dépôt de garantie reçu', type: 'REVENU', deductible: false, capitalizable: false, system: true },
    { slug: 'penalite-retenue', label: 'Pénalité / Retenue', type: 'REVENU', deductible: false, capitalizable: false, system: true },
    { slug: 'subvention', label: 'Subvention', type: 'REVENU', deductible: false, capitalizable: false, system: false },
    { slug: 'revenus-exceptionnels', label: 'Revenus exceptionnels', type: 'REVENU', deductible: false, capitalizable: false, system: false },
    
    // DÉPENSES
    { slug: 'charges-locatives', label: 'Charges locatives', type: 'DEPENSE', deductible: true, capitalizable: false, system: true },
    { slug: 'depot-garantie-rendu', label: 'Dépôt de garantie rendu', type: 'DEPENSE', deductible: false, capitalizable: false, system: true },
    { slug: 'taxe-fonciere', label: 'Taxe foncière', type: 'DEPENSE', deductible: true, capitalizable: false, system: false },
    { slug: 'travaux-entretien', label: 'Travaux d\'entretien', type: 'DEPENSE', deductible: true, capitalizable: false, system: false },
    { slug: 'assurance-pno', label: 'Assurance PNO', type: 'DEPENSE', deductible: true, capitalizable: false, system: false },
    { slug: 'charges-copropriete', label: 'Charges de copropriété', type: 'DEPENSE', deductible: true, capitalizable: false, system: false },
    { slug: 'frais-gestion', label: 'Frais de gestion', type: 'DEPENSE', deductible: true, capitalizable: false, system: false },
    { slug: 'honoraires', label: 'Honoraires', type: 'DEPENSE', deductible: true, capitalizable: false, system: false },
    { slug: 'interets-emprunt', label: 'Intérêts d\'emprunt', type: 'DEPENSE', deductible: true, capitalizable: false, system: false },
    { slug: 'travaux-amelioration', label: 'Travaux d\'amélioration', type: 'DEPENSE', deductible: false, capitalizable: true, system: false },
    { slug: 'gros-travaux', label: 'Gros travaux', type: 'DEPENSE', deductible: false, capitalizable: true, system: false },
    { slug: 'autre-depense', label: 'Autre dépense', type: 'DEPENSE', deductible: false, capitalizable: false, system: false },
    
    // AUTRE
    { slug: 'avoir-regularisation', label: 'Avoir / Régularisation', type: 'NON_DEFINI', deductible: false, capitalizable: false, system: true },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
    console.log(`✅ ${cat.label} (${cat.type})`);
  }

  // 2. Créer les entités Nature
  const natureEntities = [
    { code: 'LOYER', label: 'Loyer' },
    { code: 'CHARGES', label: 'Charges' },
    { code: 'DEPOT_GARANTIE_RECU', label: 'Dépôt de garantie reçu' },
    { code: 'DEPOT_GARANTIE_RENDU', label: 'Dépôt de garantie rendu' },
    { code: 'AVOIR_REGULARISATION', label: 'Avoir / Régularisation' },
    { code: 'PENALITE_RETENUE', label: 'Pénalité / Retenue' },
    { code: 'AUTRE', label: 'Autre' },
  ];

  for (const nature of natureEntities) {
    await prisma.natureEntity.upsert({
      where: { code: nature.code },
      update: {},
      create: nature,
    });
    console.log(`✅ Nature: ${nature.label}`);
  }

  // 3. Créer les règles NatureRule
  const natureRules = [
    // LOYER → REVENU
    { natureCode: 'LOYER', allowedType: 'REVENU' },
    
    // CHARGES → DEPENSE
    { natureCode: 'CHARGES', allowedType: 'DEPENSE' },
    
    // DEPOT_GARANTIE_RECU → REVENU
    { natureCode: 'DEPOT_GARANTIE_RECU', allowedType: 'REVENU' },
    
    // DEPOT_GARANTIE_RENDU → DEPENSE
    { natureCode: 'DEPOT_GARANTIE_RENDU', allowedType: 'DEPENSE' },
    
    // AVOIR_REGULARISATION → REVENU, DEPENSE, NON_DEFINI
    { natureCode: 'AVOIR_REGULARISATION', allowedType: 'REVENU' },
    { natureCode: 'AVOIR_REGULARISATION', allowedType: 'DEPENSE' },
    { natureCode: 'AVOIR_REGULARISATION', allowedType: 'NON_DEFINI' },
    
    // PENALITE_RETENUE → REVENU
    { natureCode: 'PENALITE_RETENUE', allowedType: 'REVENU' },
    
    // AUTRE → REVENU, DEPENSE, NON_DEFINI
    { natureCode: 'AUTRE', allowedType: 'REVENU' },
    { natureCode: 'AUTRE', allowedType: 'DEPENSE' },
    { natureCode: 'AUTRE', allowedType: 'NON_DEFINI' },
  ];

  for (const rule of natureRules) {
    await prisma.natureRule.upsert({
      where: {
        natureCode_allowedType: {
          natureCode: rule.natureCode,
          allowedType: rule.allowedType,
        },
      },
      update: {},
      create: rule,
    });
    console.log(`✅ Règle: ${rule.natureCode} → ${rule.allowedType}`);
  }

  // 4. Créer les catégories par défaut
  const categorySlugs = await prisma.category.findMany({
    select: { slug: true, id: true },
  });
  const slugToId = Object.fromEntries(categorySlugs.map(c => [c.slug, c.id]));

  const natureDefaults = [
    { natureCode: 'LOYER', defaultCategoryId: slugToId['loyer'] },
    { natureCode: 'CHARGES', defaultCategoryId: slugToId['charges-locatives'] },
    { natureCode: 'DEPOT_GARANTIE_RECU', defaultCategoryId: slugToId['depot-garantie-recu'] },
    { natureCode: 'DEPOT_GARANTIE_RENDU', defaultCategoryId: slugToId['depot-garantie-rendu'] },
    { natureCode: 'AVOIR_REGULARISATION', defaultCategoryId: slugToId['avoir-regularisation'] },
    { natureCode: 'PENALITE_RETENUE', defaultCategoryId: slugToId['penalite-retenue'] },
    // AUTRE n'a pas de catégorie par défaut
  ];

  for (const default_ of natureDefaults) {
    if (default_.defaultCategoryId) {
      await prisma.natureDefault.upsert({
        where: { natureCode: default_.natureCode },
        update: {},
        create: default_,
      });
      console.log(`✅ Défaut: ${default_.natureCode} → ${default_.defaultCategoryId}`);
    }
  }

  console.log('\n✅ TERMINÉ ! Mapping Nature ↔ Catégories créé.');
  
  await prisma.$disconnect();
}

main().catch(console.error);


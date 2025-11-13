import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Migration des catégories existantes...');
  
  // Récupérer toutes les catégories existantes
  const existingCategories = await prisma.category.findMany();
  console.log(`📋 ${existingCategories.length} catégories trouvées`);
  
  // Mapping des noms vers les slugs
  const nameToSlug: Record<string, string> = {
    'Loyer': 'loyer',
    'Dépôt de garantie reçu': 'depot-garantie-recu',
    'Pénalité / Retenue': 'penalite-retenue',
    'Charges locatives': 'charges-locatives',
    'Dépôt de garantie rendu': 'depot-garantie-rendu',
    'Taxe foncière': 'taxe-fonciere',
    'Travaux d\'entretien': 'travaux-entretien',
    'Assurance PNO': 'assurance-pno',
    'Charges de copropriété': 'charges-copropriete',
    'Frais de gestion': 'frais-gestion',
    'Honoraires': 'honoraires',
    'Intérêts d\'emprunt': 'interets-emprunt',
    'Travaux d\'amélioration': 'travaux-amelioration',
    'Gros travaux': 'gros-travaux',
    'Avoir / Régularisation': 'avoir-regularisation',
    'Autre dépense': 'autre-depense',
    'Subvention': 'subvention',
    'Revenus exceptionnels': 'revenus-exceptionnels',
    'Assurance': 'assurance',
    'Travaux': 'travaux',
    'Gestion': 'gestion',
  };
  
  // Mapping des types existants vers les nouveaux
  const typeMapping: Record<string, string> = {
    'INCOME': 'REVENU',
    'EXPENSE': 'DEPENSE',
    'OTHER': 'NON_DEFINI',
    'income': 'REVENU',
    'expense': 'DEPENSE',
  };
  
  // Mettre à jour chaque catégorie
  for (const cat of existingCategories) {
    const slug = nameToSlug[cat.label] || cat.label.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const newType = typeMapping[cat.type] || 'NON_DEFINI';
    
    await prisma.category.update({
      where: { id: cat.id },
      data: {
        slug,
        label: cat.name,
        type: newType,
        deductible: cat.isDeductible,
        capitalizable: cat.isCapitalizable,
        system: cat.isSystem,
        actif: cat.active,
      },
    });
    
    console.log(`✅ ${cat.name} → ${slug} (${newType})`);
  }
  
  console.log('✅ Migration des catégories terminée');
  
  await prisma.$disconnect();
}

main().catch(console.error);


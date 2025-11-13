import { prisma } from '@/lib/prisma';

// Données de seed pour le mapping Nature ↔ Catégorie
export const NATURE_MAPPING_SEED_DATA = {
  NatureRule: {
    // RECETTE_LOYER: types autorisés = [LOYER], catégorie par défaut = cat_loyer
    RECETTE_LOYER: {
      allowedTypes: ['LOYER'],
      defaultCategoryId: null, // Sera défini dynamiquement
    },
    
    // RECETTE_AUTRE: types autorisés = [DIVERS, BANQUE], catégorie par défaut = cat_autres_recettes
    RECETTE_AUTRE: {
      allowedTypes: ['DIVERS', 'BANQUE'],
      defaultCategoryId: null, // Sera défini dynamiquement
    },
    
    // DEPENSE_ENTRETIEN: types autorisés = [ENTRETIEN], catégorie par défaut = cat_entretien
    DEPENSE_ENTRETIEN: {
      allowedTypes: ['ENTRETIEN'],
      defaultCategoryId: null, // Sera défini dynamiquement
    },
    
    // DEPENSE_ASSURANCE: types autorisés = [ASSURANCE], catégorie par défaut = cat_assurance
    DEPENSE_ASSURANCE: {
      allowedTypes: ['ASSURANCE'],
      defaultCategoryId: null, // Sera défini dynamiquement
    },
    
    // DEPENSE_TAXE: types autorisés = [TAXE_FONCIERE], catégorie par défaut = cat_taxe_fonciere
    DEPENSE_TAXE: {
      allowedTypes: ['TAXE_FONCIERE'],
      defaultCategoryId: null, // Sera défini dynamiquement
    },
    
    // DEPENSE_BANQUE: types autorisés = [BANQUE], catégorie par défaut = cat_frais_bancaires
    DEPENSE_BANQUE: {
      allowedTypes: ['BANQUE'],
      defaultCategoryId: null, // Sera défini dynamiquement
    },
  }
};

// Fonction pour initialiser le mapping avec les catégories existantes
export async function seedNatureMapping() {
  try {
    console.log('🌱 Initialisation du mapping Nature ↔ Catégorie...');

    // Récupérer les catégories existantes pour mapper les IDs
    const categories = await prisma.category.findMany({
      where: { actif: true },
      select: { id: true, slug: true, type: true },
    });

    console.log('📋 Catégories trouvées:', categories.length);

    // Mapper les slugs vers les IDs
    const categoryMap: { [slug: string]: string } = {};
    categories.forEach(cat => {
      categoryMap[cat.slug] = cat.id;
    });

    // Mettre à jour les defaultCategoryId avec les vrais IDs
    const rulesWithIds = { ...NATURE_MAPPING_SEED_DATA.DocumentExtractionRule };
    
    // Mapping des slugs vers les IDs (à adapter selon vos catégories existantes)
    const slugToIdMapping: { [key: string]: string } = {
      'cat_loyer': categoryMap['loyer'] || categories.find(c => c.type === 'LOYER')?.id,
      'cat_autres_recettes': categoryMap['autres-recettes'] || categories.find(c => c.type === 'DIVERS')?.id,
      'cat_entretien': categoryMap['entretien'] || categories.find(c => c.type === 'ENTRETIEN')?.id,
      'cat_assurance': categoryMap['assurance'] || categories.find(c => c.type === 'ASSURANCE')?.id,
      'cat_taxe_fonciere': categoryMap['taxe-fonciere'] || categories.find(c => c.type === 'TAXE_FONCIERE')?.id,
      'cat_frais_bancaires': categoryMap['frais-bancaires'] || categories.find(c => c.type === 'BANQUE')?.id,
    };

    // Appliquer les IDs réels
    Object.keys(rulesWithIds).forEach(natureKey => {
      const rule = rulesWithIds[natureKey];
      const slugKey = `cat_${natureKey.toLowerCase().replace('_', '_')}`;
      if (slugToIdMapping[slugKey]) {
        rule.defaultCategoryId = slugToIdMapping[slugKey];
      }
    });

    // Vérifier si le mapping existe déjà
    const existingCount = await prisma.natureCategoryAllowed.count();
    if (existingCount > 0) {
      console.log('⚠️  Mapping Nature ↔ Catégorie déjà existant, skip...');
      return;
    }

    // Transaction pour insérer toutes les règles
    await prisma.$transaction(async (tx) => {
      // Insérer les règles autorisées
      const allowedRules = [];
      for (const [natureKey, rule] of Object.entries(rulesWithIds)) {
        for (const categoryType of rule.allowedTypes) {
          allowedRules.push({
            natureKey,
            categoryType,
          });
        }
      }

      if (allowedRules.length > 0) {
        await tx.natureCategoryAllowed.createMany({
          data: allowedRules,
        });
      }

      // Insérer les catégories par défaut
      const defaultRules = [];
      for (const [natureKey, rule] of Object.entries(rulesWithIds)) {
        if (rule.defaultCategoryId) {
          defaultRules.push({
            natureKey,
            defaultCategoryId: rule.defaultCategoryId,
          });
        }
      }

      if (defaultRules.length > 0) {
        await tx.natureCategoryDefault.createMany({
          data: defaultRules,
        });
      }
    });

    console.log('✅ Mapping Nature ↔ Catégorie initialisé avec succès');
    console.log('📊 Règles créées:', Object.keys(rulesWithIds).length);
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation du mapping Nature ↔ Catégorie:', error);
    throw error;
  }
}

// Fonction pour réinitialiser le mapping (utile pour les tests)
export async function resetNatureMapping() {
  try {
    console.log('🔄 Réinitialisation du mapping Nature ↔ Catégorie...');
    
    await prisma.$transaction(async (tx) => {
      await tx.natureCategoryAllowed.deleteMany({});
      await tx.natureCategoryDefault.deleteMany({});
    });
    
    console.log('✅ Mapping Nature ↔ Catégorie réinitialisé');
  } catch (error) {
    console.error('❌ Erreur lors de la réinitialisation du mapping:', error);
    throw error;
  }
}

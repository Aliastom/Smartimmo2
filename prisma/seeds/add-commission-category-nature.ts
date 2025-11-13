/**
 * Script pour ajouter la catégorie et la nature nécessaires 
 * pour les commissions de gestion déléguée
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Ajout de la catégorie et nature pour commissions de gestion...');

  // 1. Créer ou vérifier la catégorie "frais_gestion"
  const existingCategory = await prisma.category.findFirst({
    where: { slug: 'frais_gestion' }
  });

  if (existingCategory) {
    console.log('✅ Catégorie "frais_gestion" existe déjà:', existingCategory.label);
  } else {
    const category = await prisma.category.create({
      data: {
        label: 'Frais de gestion',
        slug: 'frais_gestion',
        type: 'EXPENSE',
        actif: true,
        deductible: true, // Les frais de gestion sont déductibles
        system: true, // Catégorie système pour la gestion déléguée
      }
    });
    console.log('✅ Catégorie "frais_gestion" créée:', category.label);
  }

  // 2. Créer ou vérifier la nature "DEPENSE_GESTION"
  const existingNature = await prisma.natureEntity.findUnique({
    where: { code: 'DEPENSE_GESTION' }
  });

  if (existingNature) {
    console.log('✅ Nature "DEPENSE_GESTION" existe déjà:', existingNature.label);
  } else {
    const nature = await prisma.natureEntity.create({
      data: {
        code: 'DEPENSE_GESTION',
        label: 'Frais de gestion',
        flow: 'EXPENSE',
      }
    });
    console.log('✅ Nature "DEPENSE_GESTION" créée:', nature.label);
  }

  console.log('✅ Configuration terminée !');
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


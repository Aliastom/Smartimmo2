#!/usr/bin/env tsx

/**
 * Script pour initialiser le mapping Nature ↔ Catégorie
 * Usage: npm run seed:nature-mapping
 */

import { seedNatureMapping, resetNatureMapping } from '../src/lib/seed/nature-mapping-seed';

async function main() {
  const command = process.argv[2];
  
  try {
    if (command === 'reset') {
      console.log('🔄 Réinitialisation du mapping Nature ↔ Catégorie...');
      await resetNatureMapping();
    } else {
      console.log('🌱 Initialisation du mapping Nature ↔ Catégorie...');
      await seedNatureMapping();
    }
    
    console.log('✅ Script terminé avec succès');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution du script:', error);
    process.exit(1);
  }
}

main();
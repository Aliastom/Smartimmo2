#!/usr/bin/env node

/**
 * Script pour exécuter la migration des liaisons GLOBAL
 * Usage: node scripts/run-migration-global-links.js
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Démarrage de la migration des liaisons GLOBAL...\n');

try {
  // 1. Appliquer les changements de schéma Prisma
  console.log('📋 Étape 1: Application des changements de schéma...');
  execSync('npx prisma db push', { 
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  console.log('✅ Schéma mis à jour avec succès\n');

  // 2. Exécuter la migration TypeScript
  console.log('📋 Étape 2: Exécution de la migration des données...');
  execSync('npx tsx scripts/migrate-documents-global-links.ts', { 
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  console.log('✅ Migration des données terminée avec succès\n');

  console.log('🎉 Migration complète terminée avec succès !');
  console.log('\n📝 Prochaines étapes:');
  console.log('   1. Tester la page Documents globale');
  console.log('   2. Vérifier que tous les documents apparaissent');
  console.log('   3. Tester l\'upload de nouveaux documents');

} catch (error) {
  console.error('💥 Erreur lors de la migration:', error.message);
  process.exit(1);
}

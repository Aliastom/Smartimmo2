#!/usr/bin/env tsx
/**
 * Script de génération du catalogue SQL
 * Génère catalog.json depuis le schéma Prisma avec alias FR
 */

import { generateSqlCatalog, saveCatalogToFile } from '../src/lib/ai/sql/catalog-generator';

async function main() {
  console.log('\n🔍 Génération du catalogue SQL...\n');
  console.log('═'.repeat(60));

  try {
    const catalog = await generateSqlCatalog();

    console.log(`\n📊 Catalogue généré:`);
    console.log(`   - ${catalog.tables.length} tables`);
    console.log(`   - ${catalog.views.length} vues`);
    console.log(`   - ${Object.keys(catalog.aliasesFr.tables).length} alias FR tables`);
    console.log(`   - ${Object.keys(catalog.aliasesFr.synonyms).length} synonymes métier`);

    await saveCatalogToFile(catalog);

    console.log('\n✅ Catalogue SQL prêt à l\'emploi !');
    console.log('\n' + '═'.repeat(60));
  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  }
}

main();




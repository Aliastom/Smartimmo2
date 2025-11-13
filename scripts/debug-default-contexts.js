/**
 * Script pour déboguer les defaultContexts vs defaults_by_context
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function debugDefaultContexts() {
  console.log('🔍 Debug des contextes par défaut\n');

  try {
    const types = await prisma.documentType.findMany({
      where: { isActive: true },
      orderBy: [{ isSystem: 'desc' }, { order: 'asc' }]
    });

    console.log('📋 Analyse des types:\n');

    for (const type of types) {
      console.log(`${type.code} (${type.label}):`);
      
      // defaultContexts (champ JSON direct)
      const defaultContexts = type.defaultContexts ? JSON.parse(type.defaultContexts) : [];
      console.log(`  - defaultContexts (champ direct): [${defaultContexts.join(', ')}]`);
      
      // defaults_by_context (dans suggestionConfig)
      if (type.suggestionConfig) {
        const config = JSON.parse(type.suggestionConfig);
        const defaultsByContext = config.defaults_by_context || {};
        console.log(`  - defaults_by_context (dans config): ${JSON.stringify(defaultsByContext)}`);
      }
      
      console.log('');
    }

    console.log('\n🎯 PROBLÈME IDENTIFIÉ:');
    console.log('Le service utilise "defaultContexts" (champ direct)');
    console.log('Mais nous avons modifié "defaults_by_context" (dans suggestionConfig)');
    console.log('Ce sont DEUX champs différents !');
    
    console.log('\n💡 SOLUTION:');
    console.log('Utiliser "defaults_by_context" au lieu de "defaultContexts"');
    console.log('OU');
    console.log('Synchroniser "defaultContexts" avec "defaults_by_context"');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugDefaultContexts().catch(console.error);

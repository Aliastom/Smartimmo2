/**
 * Script pour synchroniser defaultContexts avec defaults_by_context
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function syncDefaultContexts() {
  console.log('🔄 Synchronisation des contextes par défaut\n');

  try {
    const types = await prisma.documentType.findMany({
      where: { isActive: true }
    });

    for (const type of types) {
      if (!type.suggestionConfig) {
        console.log(`⏩ ${type.code}: Pas de suggestionConfig, skip`);
        continue;
      }

      const config = JSON.parse(type.suggestionConfig);
      const defaultsByContext = config.defaults_by_context || {};
      
      // Extraire les contextes où ce type est le défaut
      const newDefaultContexts = Object.keys(defaultsByContext).filter(
        context => defaultsByContext[context] === type.code
      );

      const currentDefaultContexts = type.defaultContexts ? JSON.parse(type.defaultContexts) : [];

      console.log(`📝 ${type.code}:`);
      console.log(`   Avant: [${currentDefaultContexts.join(', ')}]`);
      console.log(`   Après: [${newDefaultContexts.join(', ')}]`);

      // Mettre à jour
      await prisma.documentType.update({
        where: { id: type.id },
        data: {
          defaultContexts: JSON.stringify(newDefaultContexts)
        }
      });

      console.log(`   ✅ Synchronisé\n`);
    }

    console.log('🎉 Synchronisation terminée !');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

syncDefaultContexts().catch(console.error);

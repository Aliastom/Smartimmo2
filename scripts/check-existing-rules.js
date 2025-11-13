/**
 * Script pour vérifier les règles de suggestion existantes des types système
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkExistingRules() {
  console.log('🔍 Vérification des règles de suggestion existantes\n');

  try {
    const systemTypes = await prisma.documentType.findMany({
      where: { isSystem: true },
      orderBy: { code: 'asc' }
    });

    console.log(`📊 ${systemTypes.length} types système trouvés:\n`);

    for (const type of systemTypes) {
      const suggestionConfig = type.suggestionConfig ? JSON.parse(type.suggestionConfig) : null;
      const rulesCount = suggestionConfig?.rules?.length || 0;
      
      console.log(`📋 ${type.code} (${type.label})`);
      console.log(`   - Règles configurées: ${rulesCount}`);
      
      if (suggestionConfig && suggestionConfig.rules) {
        suggestionConfig.rules.forEach((rule, index) => {
          console.log(`     Règle ${index + 1}: "${rule.pattern}" (poids: ${rule.weight})`);
        });
      } else {
        console.log(`     ❌ Aucune règle configurée`);
      }
      console.log('');
    }

    // Compter les types sans règles
    const typesWithoutRules = systemTypes.filter(type => {
      const config = type.suggestionConfig ? JSON.parse(type.suggestionConfig) : null;
      return !config || !config.rules || config.rules.length === 0;
    });

    console.log(`⚠️ Types sans règles: ${typesWithoutRules.length}/${systemTypes.length}`);
    if (typesWithoutRules.length > 0) {
      console.log('Types concernés:');
      typesWithoutRules.forEach(type => {
        console.log(`   - ${type.code}: ${type.label}`);
      });
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkExistingRules().catch(console.error);

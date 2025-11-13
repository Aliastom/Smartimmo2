#!/usr/bin/env tsx
/**
 * Configure la nature du loyer dans AppConfig
 * Nécessaire pour que v_loyers_en_retard fonctionne
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🔧 Configuration de la nature du loyer...\n');

  try {
    // Vérifier si la config existe déjà
    const existing = await prisma.appConfig.findUnique({
      where: { key: 'rentNature' },
    });

    if (existing) {
      console.log(`✓ Nature du loyer déjà configurée: "${existing.value}"`);
      console.log(`  Description: ${existing.description || 'Aucune'}`);
    } else {
      // Créer la configuration par défaut
      await prisma.appConfig.create({
        data: {
          key: 'rentNature',
          value: 'RECETTE_LOYER',
          description: 'Nature utilisée pour identifier les transactions de loyer dans v_loyers_en_retard',
        },
      });

      console.log(`✓ Nature du loyer configurée: "RECETTE_LOYER"`);
      console.log(`  Cette valeur sera utilisée par la vue v_loyers_en_retard pour détecter les loyers impayés`);
    }

    // Vérifier les natures de transactions existantes
    console.log('\n📊 Natures de transactions existantes:');
    
    const natures = await prisma.$queryRaw<Array<{ nature: string; count: bigint }>>`
      SELECT nature, COUNT(*) as count
      FROM "Transaction"
      WHERE nature IS NOT NULL
      GROUP BY nature
      ORDER BY count DESC
      LIMIT 10
    `;

    for (const n of natures) {
      console.log(`   - ${n.nature}: ${n.count} transaction(s)`);
    }

    console.log('\n💡 Si vous utilisez une autre nature pour les loyers, modifiez la config:');
    console.log(`   UPDATE "AppConfig" SET value = 'VOTRE_NATURE' WHERE key = 'rentNature';`);
    
    console.log('\n✅ Configuration terminée !');

  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();


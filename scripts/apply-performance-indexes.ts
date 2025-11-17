/**
 * Script pour appliquer les index PostgreSQL de performance
 * 
 * Usage:
 *   tsx scripts/apply-performance-indexes.ts
 * 
 * Ou directement via SQL:
 *   psql -d smartimmo -f prisma/migrations/20250116184513_performance_indexes/migration.sql
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function applyIndexes() {
  try {
    console.log('📊 Application des index PostgreSQL de performance...\n');

    // Lire le fichier de migration
    const migrationPath = join(
      process.cwd(),
      'prisma/migrations/20250116184513_performance_indexes/migration.sql'
    );

    const sql = readFileSync(migrationPath, 'utf-8');

    // Séparer les commandes SQL (séparées par des lignes vides ou ;)
    const commands = sql
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    console.log(`✅ ${commands.length} index à créer\n`);

    // Appliquer chaque commande
    for (const command of commands) {
      if (command.trim()) {
        try {
          await prisma.$executeRawUnsafe(command);
          // Extraire le nom de l'index depuis la commande
          const match = command.match(/idx_\w+/);
          const indexName = match ? match[0] : 'index';
          console.log(`  ✓ ${indexName}`);
        } catch (error: any) {
          // Ignorer les erreurs si l'index existe déjà
          if (error.message?.includes('already exists') || error.code === '42P07') {
            const match = command.match(/idx_\w+/);
            const indexName = match ? match[0] : 'index';
            console.log(`  ⊘ ${indexName} (déjà existant)`);
          } else {
            throw error;
          }
        }
      }
    }

    console.log('\n✅ Tous les index ont été appliqués avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors de l\'application des index:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyIndexes();


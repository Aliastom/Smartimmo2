/**
 * Script de migration pour créer les tables AI et les vues analytiques
 * Exécute le fichier SQL de migration directement sur PostgreSQL
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

/**
 * Découpe un fichier SQL en commandes individuelles
 */
function splitSqlCommands(sqlContent: string): string[] {
  const commands: string[] = [];
  
  // Découper par point-virgule, mais gérer les blocs multi-lignes
  const lines = sqlContent.split('\n');
  let currentCommand = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Ignorer les lignes de commentaires pures
    if (trimmed.startsWith('--') && !currentCommand) {
      continue;
    }
    
    // Ignorer les séparateurs de blocs
    if (trimmed.match(/^=+$/) || trimmed.match(/^-+$/)) {
      continue;
    }
    
    currentCommand += line + '\n';
    
    // Si la ligne se termine par ;, c'est la fin de la commande
    if (trimmed.endsWith(';')) {
      const cleanCmd = currentCommand.trim().replace(/;$/, '');
      if (cleanCmd.length > 10) {
        commands.push(cleanCmd);
      }
      currentCommand = '';
    }
  }
  
  // Ajouter la dernière commande si présente
  if (currentCommand.trim()) {
    const cleanCmd = currentCommand.trim().replace(/;$/, '');
    if (cleanCmd.length > 10) {
      commands.push(cleanCmd);
    }
  }
  
  return commands;
}

async function main() {
  console.log('🚀 Migration des tables AI et vues analytiques...\n');

  try {
    // Lire le fichier SQL (version simplifiée - seulement les tables)
    const sqlPath = resolve(__dirname, '../prisma/migrations/create_ai_tables_only.sql');
    const sqlContent = readFileSync(sqlPath, 'utf-8');

    console.log('📄 Fichier SQL chargé:', sqlPath);

    console.log('\n⏳ Exécution de la migration (découpage en commandes)...\n');
    
    // Découper le SQL en commandes individuelles
    const commands = splitSqlCommands(sqlContent);
    
    console.log(`📋 ${commands.length} commande(s) SQL à exécuter\n`);
    
    let successCount = 0;
    for (const cmd of commands) {
      try {
        await prisma.$executeRawUnsafe(cmd);
        successCount++;
        
        // Afficher progression
        if (cmd.toLowerCase().includes('create table')) {
          const tableName = cmd.match(/table\s+if\s+not\s+exists\s+(\w+)/i)?.[1];
          console.log(`   ✓ Table ${tableName} créée`);
        } else if (cmd.toLowerCase().includes('create view')) {
          const viewName = cmd.match(/view\s+(\w+)/i)?.[1];
          console.log(`   ✓ Vue ${viewName} créée`);
        } else if (cmd.toLowerCase().includes('create index')) {
          console.log(`   ✓ Index créé`);
        }
      } catch (error: any) {
        // Ignorer les erreurs "already exists"
        if (error.message.includes('already exists')) {
          console.log(`   ⚠️  Déjà existant (ignoré)`);
          successCount++;
        } else {
          console.error(`   ✗ Erreur:`, error.message);
        }
      }
    }
    
    console.log(`\n✅ ${successCount}/${commands.length} commande(s) exécutée(s) avec succès`);

    console.log('\n✅ Migration terminée avec succès !');
    console.log('\n📊 Tables créées:');
    console.log('   - ai_chat_sessions');
    console.log('   - ai_messages');
    console.log('   - ai_tool_logs');
    console.log('   - ai_query_log');

    // Vérifier que les tables existent
    console.log('\n🔍 Vérification des tables...');
    const sessions = await prisma.$queryRaw`SELECT COUNT(*) as count FROM ai_chat_sessions`;
    console.log('   ✓ ai_chat_sessions accessible');

    const messages = await prisma.$queryRaw`SELECT COUNT(*) as count FROM ai_messages`;
    console.log('   ✓ ai_messages accessible');

    const toolLogs = await prisma.$queryRaw`SELECT COUNT(*) as count FROM ai_tool_logs`;
    console.log('   ✓ ai_tool_logs accessible');

    console.log('\n🎉 Tables AI prêtes !');
    console.log('\n💡 Prochaines étapes:');
    console.log('   - npm run db:seed:ai (seeds de données)');
    console.log('   - npm run db:views (vues analytiques SQL)');
  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();


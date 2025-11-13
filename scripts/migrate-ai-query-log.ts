#!/usr/bin/env tsx
/**
 * Script pour créer la table ai_query_log
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🚀 Création de la table ai_query_log...\n');

  try {
    // Créer la table directement (hardcodée pour éviter problèmes de parsing)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ai_query_log (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        session_id TEXT,
        user_id TEXT DEFAULT 'default',
        question TEXT NOT NULL,
        intent TEXT,
        tool_used TEXT,
        sql_executed TEXT,
        ok BOOLEAN NOT NULL DEFAULT true,
        error_message TEXT,
        row_count INTEGER,
        duration_ms INTEGER,
        feedback_rating INTEGER,
        feedback_comment TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        
        CONSTRAINT ai_query_log_feedback_rating_check CHECK (feedback_rating IN (NULL, 1, -1))
      )
    `);

    console.log('   ✓ Table ai_query_log créée');

    // Créer les index
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_ai_query_log_created_at ON ai_query_log(created_at)`);
    console.log('   ✓ Index created_at créé');

    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_ai_query_log_tool_used ON ai_query_log(tool_used)`);
    console.log('   ✓ Index tool_used créé');

    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_ai_query_log_ok ON ai_query_log(ok)`);
    console.log('   ✓ Index ok créé');

    console.log('\n✅ Table ai_query_log prête !');
    console.log('\n💡 Cette table permet de :');
    console.log('   - Logger toutes les questions utilisateur');
    console.log('   - Suivre les outils utilisés (SQL, RAG, etc.)');
    console.log('   - Collecter du feedback (👍 / 👎)');
    console.log('   - Analyser les échecs pour améliorer le système\n');
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

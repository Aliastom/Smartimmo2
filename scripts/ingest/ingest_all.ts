#!/usr/bin/env tsx
/**
 * Script master d'ingestion
 * Exécute tous les scripts d'ingestion dans l'ordre
 */

import { config } from 'dotenv';
import { resolve as resolvePath } from 'path';
config({ path: resolvePath(process.cwd(), '.env.local') });
config({ path: resolvePath(process.cwd(), '.env') });

import { spawn } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Scripts à exécuter dans l'ordre
const SCRIPTS = [
  { name: 'Documentation (KB)', file: 'ingest_kb.ts' },
  { name: 'Code source', file: 'ingest_code.ts' },
  { name: 'Schémas Prisma', file: 'ingest_schemas.ts' },
];

/**
 * Exécute un script et retourne une promesse
 */
function runScript(scriptPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('tsx', [scriptPath], {
      stdio: 'inherit',
      shell: true,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script ${scriptPath} a échoué avec le code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Point d'entrée principal
 */
async function main() {
  console.log('\n🚀 Smartimmo - Ingestion complète (All-in-One)\n');
  console.log('═'.repeat(60));
  console.log(`\n${SCRIPTS.length} scripts d'ingestion seront exécutés:\n`);

  for (const script of SCRIPTS) {
    console.log(`   ${SCRIPTS.indexOf(script) + 1}. ${script.name}`);
  }

  console.log('\n' + '═'.repeat(60));

  const globalStartTime = Date.now();

  try {
    for (const script of SCRIPTS) {
      console.log(`\n\n📦 ÉTAPE ${SCRIPTS.indexOf(script) + 1}/${SCRIPTS.length}: ${script.name}`);
      console.log('─'.repeat(60));

      const scriptPath = resolve(__dirname, script.file);
      await runScript(scriptPath);
    }

    const totalDuration = ((Date.now() - globalStartTime) / 1000).toFixed(1);

    console.log('\n\n' + '═'.repeat(60));
    console.log('\n✅ INGESTION COMPLÈTE TERMINÉE !');
    console.log(`   - Durée totale: ${totalDuration}s`);
    console.log(`   - ${SCRIPTS.length} scripts exécutés avec succès`);
    console.log('\n🎉 La base de connaissances est prête pour l\'agent IA !');
    console.log('\n' + '═'.repeat(60));
  } catch (error: any) {
    console.error('\n\n❌ Erreur lors de l\'ingestion:', error.message);
    process.exit(1);
  }
}

main();


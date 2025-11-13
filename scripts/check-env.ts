#!/usr/bin/env tsx
/**
 * Script de vérification des variables d'environnement
 */

// Charger les variables depuis .env.local
import { config } from 'dotenv';
import { resolve } from 'path';

// Charger .env.local en priorité
config({ path: resolve(process.cwd(), '.env.local') });
// Puis .env en fallback
config({ path: resolve(process.cwd(), '.env') });

console.log('\n🔍 Vérification des variables d\'environnement\n');
console.log('═'.repeat(60));

const requiredVars = [
  'DATABASE_URL',
  'QDRANT_URL',
  'QDRANT_COLLECTION',
  'EMBEDDING_MODEL',
  'EMBEDDING_DIMENSION',
  'MISTRAL_BASE_URL',
  'MISTRAL_MODEL',
  'AI_MAX_TOKENS',
  'AI_TIMEOUT_MS',
  'AI_RATE_LIMIT_RPM',
];

const optionalVars = [
  'QDRANT_API_KEY',
  'REDIS_URL',
];

let allGood = true;

console.log('\n✅ Variables OBLIGATOIRES :\n');
for (const varName of requiredVars) {
  const value = process.env[varName];
  if (value) {
    console.log(`   ✓ ${varName} = ${maskSensitive(varName, value)}`);
  } else {
    console.log(`   ✗ ${varName} = NON DÉFINIE`);
    allGood = false;
  }
}

console.log('\n📋 Variables OPTIONNELLES :\n');
for (const varName of optionalVars) {
  const value = process.env[varName];
  if (value) {
    console.log(`   ✓ ${varName} = ${maskSensitive(varName, value)}`);
  } else {
    console.log(`   ○ ${varName} = (vide, c'est OK)`);
  }
}

console.log('\n' + '═'.repeat(60));

if (allGood) {
  console.log('\n✅ Toutes les variables obligatoires sont définies !\n');
  process.exit(0);
} else {
  console.log('\n❌ Certaines variables obligatoires manquent.\n');
  console.log('💡 Créez un fichier .env.local à la racine du projet.\n');
  process.exit(1);
}

function maskSensitive(key: string, value: string): string {
  // Masquer les valeurs sensibles
  if (key.includes('PASSWORD') || key.includes('SECRET') || key.includes('KEY')) {
    return '***';
  }
  // Masquer partiellement les URLs avec credentials
  if (key.includes('DATABASE_URL') && value.includes('@')) {
    return value.replace(/\/\/[^@]+@/, '//***:***@');
  }
  return value;
}


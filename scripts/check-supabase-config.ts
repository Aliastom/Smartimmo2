#!/usr/bin/env tsx

/**
 * Script de diagnostic pour vérifier la configuration Supabase
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Charger les variables d'environnement
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

console.log('🔍 Vérification de la configuration Supabase Auth\n');
console.log('═'.repeat(60));

// Vérifier les variables requises
const checks = [
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    value: process.env.NEXT_PUBLIC_SUPABASE_URL,
    required: true,
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    required: true,
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    value: process.env.SUPABASE_SERVICE_ROLE_KEY,
    required: false,
  },
  {
    name: 'NEXT_PUBLIC_APP_URL',
    value: process.env.NEXT_PUBLIC_APP_URL,
    required: false,
    default: 'http://localhost:3000',
  },
  {
    name: 'DATABASE_URL',
    value: process.env.DATABASE_URL,
    required: true,
  },
];

let hasErrors = false;

for (const check of checks) {
  const icon = check.value ? '✅' : (check.required ? '❌' : '⚠️');
  const status = check.value 
    ? (check.value.length > 50 ? `${check.value.substring(0, 50)}...` : check.value)
    : (check.default ? `Non défini (utilisera: ${check.default})` : 'NON DÉFINI');
  
  console.log(`${icon} ${check.name.padEnd(35)} ${status}`);
  
  if (check.required && !check.value) {
    hasErrors = true;
  }
}

console.log('═'.repeat(60));

if (hasErrors) {
  console.log('\n❌ ERREUR : Des variables requises sont manquantes !');
  console.log('\n📝 Ajoutez ces variables dans votre fichier .env ou .env.local :');
  console.log('\nNEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co');
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...');
  console.log('NEXT_PUBLIC_APP_URL=http://localhost:3000');
  console.log('\nPuis redémarrez le serveur : npm run dev');
  process.exit(1);
} else {
  console.log('\n✅ Configuration OK !');
  console.log('\n📌 Prochaines étapes :');
  console.log('   1. Vérifiez que votre serveur dev tourne: npm run dev');
  console.log('   2. Allez sur: http://localhost:3000/login');
  console.log('   3. Entrez votre email');
  console.log('   4. Vérifiez votre boîte email');
  console.log('   5. CLIQUEZ SUR LE LIEN dans l\'email');
  console.log('   6. Vous serez redirigé vers /dashboard ✅');
  console.log('\n🔧 En cas de problème :');
  console.log('   - Vérifiez les logs du serveur (terminal)');
  console.log('   - Vérifiez la console du navigateur (F12)');
  console.log('   - Consultez DEBUG_AUTH.md pour plus de détails');
}


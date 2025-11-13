#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Règles de remplacement par lot
const REPLACEMENTS = [
  // Couleurs de fond
  { pattern: /\bbg-white\b/g, replacement: 'bg-base-100' },
  { pattern: /\bbg-black\b/g, replacement: 'bg-base-content' },
  { pattern: /\bbg-gray-50\b/g, replacement: 'bg-base-200' },
  { pattern: /\bbg-gray-100\b/g, replacement: 'bg-base-200' },
  { pattern: /\bbg-gray-200\b/g, replacement: 'bg-base-200' },
  { pattern: /\bbg-gray-300\b/g, replacement: 'bg-base-300' },
  
  // Couleurs de texte
  { pattern: /\btext-white\b/g, replacement: 'text-base-100' },
  { pattern: /\btext-black\b/g, replacement: 'text-base-content' },
  { pattern: /\btext-gray-800\b/g, replacement: 'text-base-content' },
  { pattern: /\btext-gray-900\b/g, replacement: 'text-base-content' },
  { pattern: /\btext-gray-700\b/g, replacement: 'text-base-content/90' },
  { pattern: /\btext-gray-600\b/g, replacement: 'text-base-content/80' },
  { pattern: /\btext-gray-500\b/g, replacement: 'text-base-content/70' },
  { pattern: /\btext-gray-400\b/g, replacement: 'text-base-content/60' },
  
  // Bordures
  { pattern: /\bborder-gray-200\b/g, replacement: 'border-base-300' },
  { pattern: /\bborder-gray-300\b/g, replacement: 'border-base-300' },
  
  // Couleurs blue (préférer primary)
  { pattern: /\bbg-blue-500\b/g, replacement: 'bg-primary' },
  { pattern: /\bbg-blue-600\b/g, replacement: 'bg-primary' },
  { pattern: /\bbg-blue-700\b/g, replacement: 'bg-primary' },
  { pattern: /\btext-blue-500\b/g, replacement: 'text-primary' },
  { pattern: /\btext-blue-600\b/g, replacement: 'text-primary' },
  { pattern: /\btext-blue-700\b/g, replacement: 'text-primary' },
  { pattern: /\bborder-blue-500\b/g, replacement: 'border-primary' },
  
  // Couleurs green (préférer success)
  { pattern: /\bbg-green-500\b/g, replacement: 'bg-success' },
  { pattern: /\bbg-green-600\b/g, replacement: 'bg-success' },
  { pattern: /\btext-green-500\b/g, replacement: 'text-success' },
  { pattern: /\btext-green-600\b/g, replacement: 'text-success' },
  
  // Couleurs red (préférer error)
  { pattern: /\bbg-red-500\b/g, replacement: 'bg-error' },
  { pattern: /\bbg-red-600\b/g, replacement: 'bg-error' },
  { pattern: /\btext-red-500\b/g, replacement: 'text-error' },
  { pattern: /\btext-red-600\b/g, replacement: 'text-error' },
  
  // Couleurs yellow (préférer warning)
  { pattern: /\bbg-yellow-500\b/g, replacement: 'bg-warning' },
  { pattern: /\bbg-yellow-600\b/g, replacement: 'bg-warning' },
  { pattern: /\btext-yellow-500\b/g, replacement: 'text-warning' },
  { pattern: /\btext-yellow-600\b/g, replacement: 'text-warning' },
];

// Couleurs hexadécimales à éviter
const HEX_PATTERNS = [
  /#[0-9A-Fa-f]{3,6}/g,
  /rgb\([^)]+\)/g,
  /rgba\([^)]+\)/g,
  /hsl\([^)]+\)/g,
  /hsla\([^)]+\)/g,
];

function findFiles(dir, extensions) {
  let files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      files = files.concat(findFiles(fullPath, extensions));
    } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function processFile(filePath, dryRun = false) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  let changes = [];
  
  // Appliquer les remplacements
  REPLACEMENTS.forEach(({ pattern, replacement }) => {
    const matches = content.match(pattern);
    if (matches) {
      changes.push(`${matches.length} remplacement(s) de "${pattern}" → "${replacement}"`);
      content = content.replace(pattern, replacement);
    }
  });
  
  // Vérifier les couleurs hexadécimales
  HEX_PATTERNS.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      changes.push(`⚠️  Couleur hexadécimale trouvée: ${matches.join(', ')}`);
    }
  });
  
  if (changes.length > 0) {
    console.log(`\n📁 ${filePath}:`);
    changes.forEach(change => console.log(`  ${change}`));
    
    if (!dryRun && content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  ✅ Fichier modifié`);
    } else if (dryRun) {
      console.log(`  🔍 Mode dry-run - aucune modification`);
    }
  }
  
  return changes.length;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry') || args.includes('-d');
  
  console.log('🎨 Remplacement des couleurs codées en dur...\n');
  
  if (dryRun) {
    console.log('🔍 Mode dry-run activé - aucune modification ne sera effectuée\n');
  }
  
  const srcDir = path.join(process.cwd(), 'src');
  const extensions = ['.tsx', '.ts', '.css'];
  
  if (!fs.existsSync(srcDir)) {
    console.error('❌ Dossier src/ introuvable');
    process.exit(1);
  }
  
  const files = findFiles(srcDir, extensions);
  let totalChanges = 0;
  
  files.forEach(file => {
    const changes = processFile(file, dryRun);
    totalChanges += changes;
  });
  
  if (totalChanges > 0) {
    console.log(`\n📊 Résumé:`);
    console.log(`  ${totalChanges} changement(s) trouvé(s) dans ${files.length} fichier(s)`);
    
    if (dryRun) {
      console.log('\n💡 Pour appliquer les changements, relancez sans --dry');
    } else {
      console.log('\n✅ Remplacements appliqués !');
    }
  } else {
    console.log('\n✅ Aucune couleur codée en dur trouvée !');
  }
  
  console.log('\n📚 Tokens daisyUI recommandés:');
  console.log('  - bg-base-100, bg-base-200, bg-base-300');
  console.log('  - text-base-content, text-base-content/80, text-base-content/60');
  console.log('  - border-base-300');
  console.log('  - bg-primary, text-primary, text-primary-content');
  console.log('  - bg-secondary, text-secondary, text-secondary-content');
  console.log('  - bg-accent, text-accent, text-accent-content');
  console.log('  - bg-info, text-info, text-info-content');
  console.log('  - bg-success, text-success, text-success-content');
  console.log('  - bg-warning, text-warning, text-warning-content');
  console.log('  - bg-error, text-error, text-error-content');
}

main();

export { processFile, REPLACEMENTS };

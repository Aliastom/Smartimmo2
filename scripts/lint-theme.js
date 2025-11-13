#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Patterns interdits pour les couleurs fixes
const FORBIDDEN_PATTERNS = [
  // Couleurs fixes
  /\bbg-white\b/g,
  /\bbg-black\b/g,
  /\btext-white\b/g,
  /\btext-black\b/g,
  
  // Couleurs gray spécifiques
  /\btext-gray-\d+\b/g,
  /\bbg-gray-\d+\b/g,
  /\bborder-gray-\d+\b/g,
  
  // Couleurs hexadécimales
  /#[0-9A-Fa-f]{3,6}\b/g,
  
  // Couleurs RGB/RGBA
  /\brgb\(/g,
  /\brgba\(/g,
  
  // Couleurs HSL
  /\bhsl\(/g,
  /\bhsla\(/g,
];

// Alternatives recommandées
const ALTERNATIVES = {
  'bg-white': 'bg-base-100',
  'bg-black': 'bg-base-content',
  'text-white': 'text-base-100 ou text-primary-content',
  'text-black': 'text-base-content',
  'text-gray-800': 'text-base-content',
  'text-gray-900': 'text-base-content',
  'text-gray-700': 'text-base-content/90',
  'text-gray-600': 'text-base-content/80',
  'text-gray-500': 'text-base-content/70',
  'text-gray-400': 'text-base-content/60',
  'bg-gray-50': 'bg-base-200',
  'bg-gray-100': 'bg-base-200',
  'bg-gray-200': 'bg-base-200',
  'bg-gray-300': 'bg-base-300',
  'border-gray-200': 'border-base-300',
  'border-gray-300': 'border-base-300',
};

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

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const errors = [];
  
  FORBIDDEN_PATTERNS.forEach((pattern, index) => {
    const matches = content.match(pattern);
    if (matches) {
      const lines = content.split('\n');
      matches.forEach(match => {
        const lineIndex = lines.findIndex(line => line.includes(match));
        if (lineIndex !== -1) {
          errors.push({
            file: filePath,
            line: lineIndex + 1,
            match: match,
            suggestion: ALTERNATIVES[match] || 'Utiliser les tokens daisyUI (bg-base-100, text-base-content, etc.)'
          });
        }
      });
    }
  });
  
  return errors;
}

function main() {
  console.log('🔍 Vérification des couleurs interdites...\n');
  
  const srcDir = path.join(process.cwd(), 'src');
  const extensions = ['.tsx', '.ts', '.css'];
  
  if (!fs.existsSync(srcDir)) {
    console.error('❌ Dossier src/ introuvable');
    process.exit(1);
  }
  
  const files = findFiles(srcDir, extensions);
  let totalErrors = 0;
  
  files.forEach(file => {
    const errors = checkFile(file);
    if (errors.length > 0) {
      console.log(`\n📁 ${file}:`);
      errors.forEach(error => {
        console.log(`  ❌ Ligne ${error.line}: "${error.match}"`);
        console.log(`     💡 Suggestion: ${error.suggestion}`);
        totalErrors++;
      });
    }
  });
  
  if (totalErrors > 0) {
    console.log(`\n❌ ${totalErrors} erreur(s) trouvée(s) !`);
    console.log('\n📚 Alternatives recommandées:');
    Object.entries(ALTERNATIVES).forEach(([forbidden, alternative]) => {
      console.log(`  ${forbidden} → ${alternative}`);
    });
    console.log('\n🎨 Tokens daisyUI disponibles:');
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
    process.exit(1);
  } else {
    console.log('✅ Aucune couleur interdite trouvée !');
  }
}

main();

export { checkFile, FORBIDDEN_PATTERNS, ALTERNATIVES };

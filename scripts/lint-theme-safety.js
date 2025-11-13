#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Patterns interdits (couleurs hardcodées)
const FORBIDDEN_PATTERNS = [
  // Couleurs hexadécimales
  /#[0-9A-Fa-f]{3,6}/g,
  // Couleurs RGB/RGBA
  /rgb\(/g,
  /rgba\(/g,
  // Couleurs Tailwind hardcodées
  /bg-white/g,
  /text-black/g,
  /bg-black/g,
  /text-white/g,
  /text-gray-\d+/g,
  /bg-gray-\d+/g,
  /border-gray-\d+/g,
  // Couleurs avec opacité hardcodée
  /text-base-content\/\d+/g,
  /bg-base-\d+\/\d+/g,
  /border-base-\d+\/\d+/g,
];

// Patterns autorisés (exceptions)
const ALLOWED_PATTERNS = [
  // Fichiers de configuration
  /tailwind\.config\./,
  /\.config\.js$/,
  /\.config\.ts$/,
  // Fichiers de documentation
  /\.md$/,
  // Fichiers de test
  /\.test\./,
  /\.spec\./,
  // Fichiers générés
  /node_modules/,
  /\.next/,
  /dist/,
  // Fichiers de template
  /templates/,
  /email/,
];

// Extensions de fichiers à vérifier
const FILE_EXTENSIONS = ['.tsx', '.ts', '.css', '.scss'];

function shouldSkipFile(filePath) {
  return ALLOWED_PATTERNS.some(pattern => pattern.test(filePath));
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];

  lines.forEach((line, index) => {
    FORBIDDEN_PATTERNS.forEach(pattern => {
      const matches = [...line.matchAll(pattern)];
      matches.forEach(match => {
        violations.push({
          file: filePath,
          line: index + 1,
          column: line.indexOf(match[0]) + 1,
          pattern: pattern.source,
          match: match[0],
          context: line.trim(),
        });
      });
    });
  });

  return violations;
}

function scanDirectory(dirPath, violations = []) {
  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Ignorer certains dossiers
      if (!['node_modules', '.next', 'dist', '.git'].includes(item)) {
        scanDirectory(fullPath, violations);
      }
    } else if (stat.isFile()) {
      const ext = path.extname(item);
      
      if (FILE_EXTENSIONS.includes(ext) && !shouldSkipFile(fullPath)) {
        try {
          const fileViolations = scanFile(fullPath);
          violations.push(...fileViolations);
        } catch (error) {
          console.warn(`Erreur lors de la lecture de ${fullPath}: ${error.message}`);
        }
      }
    }
  }

  return violations;
}

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const srcPath = path.join(projectRoot, 'src');
  
  console.log('🔍 Vérification des couleurs hardcodées...\n');
  
  const violations = scanDirectory(srcPath);
  
  if (violations.length === 0) {
    console.log('✅ Aucune couleur hardcodée détectée !');
    console.log('🎨 Toutes les couleurs utilisent les tokens daisyUI.');
    process.exit(0);
  }

  console.log(`❌ ${violations.length} violation(s) détectée(s) :\n`);
  
  // Grouper par fichier
  const violationsByFile = violations.reduce((acc, violation) => {
    if (!acc[violation.file]) {
      acc[violation.file] = [];
    }
    acc[violation.file].push(violation);
    return acc;
  }, {});

  Object.entries(violationsByFile).forEach(([file, fileViolations]) => {
    console.log(`📁 ${path.relative(projectRoot, file)}`);
    fileViolations.forEach(violation => {
      console.log(`  Ligne ${violation.line}:${violation.column} - "${violation.match}"`);
      console.log(`    Pattern: ${violation.pattern}`);
      console.log(`    Contexte: ${violation.context}`);
      console.log('');
    });
  });

  console.log('💡 Solutions recommandées :');
  console.log('  • bg-white → bg-base-100');
  console.log('  • text-black → text-base-content');
  console.log('  • text-gray-800 → text-base-content');
  console.log('  • bg-gray-100 → bg-base-200');
  console.log('  • border-gray-300 → border-base-300');
  console.log('  • #hex → primary/success/warning/error');
  console.log('  • text-base-content/70 → text-base-content opacity-70');

  process.exit(1);
}

main();

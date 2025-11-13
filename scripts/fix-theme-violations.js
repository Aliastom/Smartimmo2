#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Remplacements automatiques pour les violations courantes
const REPLACEMENTS = [
  // Classes avec opacité hardcodée
  {
    pattern: /text-base-content\/(\d+)/g,
    replacement: 'text-base-content opacity-$1'
  },
  {
    pattern: /bg-base-(\d+)\/(\d+)/g,
    replacement: 'bg-base-$1 opacity-$2'
  },
  {
    pattern: /border-base-(\d+)\/(\d+)/g,
    replacement: 'border-base-$1 opacity-$2'
  },
];

// Fichiers à ignorer
const IGNORE_PATTERNS = [
  /globals\.css$/, // Fichier de configuration des thèmes
  /\.config\./, // Fichiers de configuration
  /node_modules/,
  /\.next/,
  /dist/,
];

// Extensions de fichiers à traiter
const FILE_EXTENSIONS = ['.tsx', '.ts'];

function shouldIgnoreFile(filePath) {
  return IGNORE_PATTERNS.some(pattern => pattern.test(filePath));
}

function processFile(filePath) {
  if (shouldIgnoreFile(filePath)) {
    return { processed: false, reason: 'ignored' };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  let changes = 0;

  REPLACEMENTS.forEach(({ pattern, replacement }) => {
    const matches = [...newContent.matchAll(pattern)];
    if (matches.length > 0) {
      newContent = newContent.replace(pattern, replacement);
      changes += matches.length;
    }
  });

  if (changes > 0) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    return { processed: true, changes };
  }

  return { processed: false, reason: 'no changes' };
}

function scanDirectory(dirPath) {
  const results = [];
  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Ignorer certains dossiers
      if (!['node_modules', '.next', 'dist', '.git'].includes(item)) {
        results.push(...scanDirectory(fullPath));
      }
    } else if (stat.isFile()) {
      const ext = path.extname(item);
      
      if (FILE_EXTENSIONS.includes(ext)) {
        try {
          const result = processFile(fullPath);
          if (result.processed) {
            results.push({
              file: fullPath,
              changes: result.changes
            });
          }
        } catch (error) {
          console.warn(`Erreur lors du traitement de ${fullPath}: ${error.message}`);
        }
      }
    }
  }

  return results;
}

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const srcPath = path.join(projectRoot, 'src');
  
  console.log('🔧 Correction automatique des violations de thème...\n');
  
  const results = scanDirectory(srcPath);
  
  if (results.length === 0) {
    console.log('✅ Aucune violation à corriger automatiquement !');
    process.exit(0);
  }

  console.log(`✅ ${results.length} fichier(s) corrigé(s) :\n`);
  
  let totalChanges = 0;
  results.forEach(result => {
    const relativePath = path.relative(projectRoot, result.file);
    console.log(`📁 ${relativePath} - ${result.changes} changement(s)`);
    totalChanges += result.changes;
  });

  console.log(`\n🎉 Total : ${totalChanges} changement(s) appliqué(s)`);
  console.log('\n💡 Relancez le lint pour vérifier : npm run lint-theme-safety');
}

main();

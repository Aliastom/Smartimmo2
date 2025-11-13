/**
 * Script pour détecter les identifiants français dans le code
 * Utilise une liste de mots français interdits
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// Mots français INTERDITS dans les identifiants
const FRENCH_KEYWORDS = [
  // Immobilier
  'bien', 'biens',
  'loyer', 'loyerHC', 'loyerCC',
  'bail', 'baux', 'bailActif',
  'locataire', 'locataires',
  'proprietaire', 'propriétaire',
  
  // Comptabilité
  'categorie', 'catégorie', 'categories', 'catégories',
  'penalite', 'pénalité', 'penalites', 'pénalités',
  'revenus', 'revenu',
  'depense', 'dépense', 'depenses', 'dépenses',
  'encaisse', 'encaissé',
  'decaisse', 'décaissé',
  'regularisation', 'régularisation',
  
  // Prêts
  'pret', 'prêt', 'prets', 'prêts',
  'emprunt',
  'mensualite', 'mensualité', 'mensualites', 'mensualités',
  'echeance', 'échéance', 'echeances', 'échéances',
  
  // Propriétés
  'valeurActuelle', 'valeur_actuelle',
  'fraisNotaire', 'frais_notaire',
  'prixAcquisition', 'prix_acquisition',
  'fraisSortie', 'frais_sortie',
  
  // Statuts
  'statut', // Utiliser 'status' en anglais
  'brouillon',
  'signe', 'signé',
  'resilie', 'résilié',
  'loue', 'loué',
  'occupe', 'occupé',
  'travaux',
  
  // Documents
  'quittance',
  'pieceJointe', 'piece_jointe',
  
  // Dates
  'dateDebut', 'date_debut',
  'dateFin', 'date_fin',
  'dateAcquisition', 'date_acquisition',
  'dateCreation', 'date_creation',
  'dateMaj', 'date_maj',
  
  // Calculs
  'rendement',
  'rentabilite', 'rentabilité',
  'tauxOccupation', 'taux_occupation',
  'patrimoine',
  'dette',
  
  // Gestion
  'residence', 'résidence',
  'modeGestion', 'mode_gestion',
  'usagePro', 'usage_pro',
];

// Patterns regex pour détecter les mots français
const FRENCH_PATTERNS = FRENCH_KEYWORDS.map(keyword => new RegExp(`\\b${keyword}\\b`, 'gi'));

// Fichiers et dossiers à ignorer
const IGNORED_PATHS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/coverage/**',
  '**/docs/**', // Documentation peut contenir du français
  '**/locales/**', // Fichiers i18n peuvent contenir du français
  '**/*.md', // Fichiers markdown peuvent contenir du français
  '**/scripts/check-french-identifiers.ts', // Ce fichier lui-même
  '**/prisma/migrations/**', // Les anciennes migrations sont OK
];

interface Violation {
  file: string;
  line: number;
  column: number;
  keyword: string;
  context: string;
}

async function checkFile(filePath: string): Promise<Violation[]> {
  const violations: Violation[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, lineIndex) => {
    // Ignorer les commentaires et les strings
    const codeOnly = line
      .replace(/\/\/.*/g, '') // Supprimer les commentaires //
      .replace(/\/\*.*?\*\//g, '') // Supprimer les commentaires /* */
      .replace(/'[^']*'/g, '') // Supprimer les strings simples
      .replace(/"[^"]*"/g, '') // Supprimer les strings doubles
      .replace(/`[^`]*`/g, ''); // Supprimer les template strings
    
    FRENCH_PATTERNS.forEach((pattern, index) => {
      const keyword = FRENCH_KEYWORDS[index];
      const matches = codeOnly.matchAll(pattern);
      
      for (const match of matches) {
        violations.push({
          file: filePath,
          line: lineIndex + 1,
          column: match.index || 0,
          keyword,
          context: line.trim(),
        });
      }
    });
  });

  return violations;
}

async function main() {
  console.log('🔍 Scanning for French identifiers...\n');

  // Trouver tous les fichiers TypeScript/JavaScript
  const files = await glob('src/**/*.{ts,tsx,js,jsx}', {
    ignore: IGNORED_PATHS,
  });

  console.log(`📂 Found ${files.length} files to scan\n`);

  let totalViolations = 0;
  const violationsByFile: Record<string, Violation[]> = {};

  for (const file of files) {
    const violations = await checkFile(file);
    if (violations.length > 0) {
      violationsByFile[file] = violations;
      totalViolations += violations.length;
    }
  }

  // Afficher les résultats
  if (totalViolations === 0) {
    console.log('✅ No French identifiers found! All good! 🎉\n');
    process.exit(0);
  }

  console.log(`❌ Found ${totalViolations} French identifier(s) in ${Object.keys(violationsByFile).length} file(s):\n`);

  Object.entries(violationsByFile).forEach(([file, violations]) => {
    console.log(`\n📄 ${file}:`);
    violations.forEach(violation => {
      console.log(`  Line ${violation.line}:${violation.column} - "${violation.keyword}"`);
      console.log(`    ${violation.context}`);
    });
  });

  console.log(`\n❌ Total: ${totalViolations} violation(s)\n`);
  console.log('💡 Tip: See docs/naming-glossary.md for French→English translations\n');

  process.exit(1);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});



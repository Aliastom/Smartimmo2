import { Project, SyntaxKind, Node } from "ts-morph";
import fs from "fs";
import path from "path";

type Glossary = Record<string, string>;
const glossary: Glossary = JSON.parse(fs.readFileSync("tools/naming-glossary.json", "utf8"));

const isWrite = process.argv.includes("--write");
const SRC_DIRS = ["src"].filter(p => fs.existsSync(p));

// Identifiants à ne jamais toucher
const SKIP_LIST = new Set([
  'NODE_ENV', 'DATABASE_URL', 'NEXTAUTH_URL', 'NEXTAUTH_SECRET',
  '_count', '_avg', '_sum', '_min', '_max', // Prisma aggregates
  'process', 'console', 'require', 'module', 'exports',
]);

const project = new Project({
  tsConfigFilePath: fs.existsSync("tsconfig.json") ? "tsconfig.json" : undefined,
  skipAddingFilesFromTsConfig: true,
});

SRC_DIRS.forEach(dir => {
  if (fs.existsSync(dir)) {
    project.addSourceFilesAtPaths(`${dir}/**/*.{ts,tsx}`);
  }
});

function transformName(name: string): string {
  // Skip liste
  if (SKIP_LIST.has(name)) return name;
  
  // Ne jamais transformer les UPPER_SNAKE_CASE (constantes env, constantes globales)
  if (/^[A-Z][A-Z0-9_]*$/.test(name)) return name;
  
  let newName = name;
  const originalName = name;

  // snake_case -> camelCase (sauf si c'est déjà du UPPER_SNAKE_CASE)
  if (newName.includes("_") && !/^[A-Z_]+$/.test(newName)) {
    newName = newName.split("_").map((p, i) => 
      (i ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : p.toLowerCase())
    ).join("");
  }

  // Remplacements par glossaire avec limites de mots
  for (const [fr, en] of Object.entries(glossary)) {
    // Créer une regex avec word boundaries pour éviter les remplacements partiels
    const re = new RegExp(`\\b${fr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gi");
    newName = newName.replace(re, (matched) => {
      // Respecter la casse du match original
      if (/^[A-Z]/.test(matched) && /^[a-z]/.test(en)) {
        return en.charAt(0).toUpperCase() + en.slice(1);
      }
      return en;
    });
  }

  // Enlever diacritiques
  newName = newName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Si le nom n'a pas changé ou s'il est devenu invalide, retourner l'original
  if (newName === originalName || !newName || !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(newName)) {
    return originalName;
  }

  return newName;
}

function shouldRename(name: string): boolean {
  // Skip liste
  if (SKIP_LIST.has(name)) return false;
  
  // Ne jamais renommer les UPPER_SNAKE_CASE
  if (/^[A-Z][A-Z0-9_]*$/.test(name)) return false;
  
  // Détecter les identifiants français
  const re = /[àâäéèêëîïôöùûüç]|(loyer|bail|locataire|bien|cat(é|e)gorie|p(é|e)nalit(é|e)|revenus?|d(é|e)penses?|quittance|valeur|statut|frais|travaux|taxe|depot|d[ée]p[ôo]t|garantie)/i;
  return re.test(name);
}

const renameLog: Array<{ file: string; from: string; to: string; line: number }> = [];
const renamedIdentifiers = new Map<string, string>();

for (const sf of project.getSourceFiles()) {
  const filePath = sf.getFilePath();
  
  // Ignorer certains fichiers
  if (filePath.includes('node_modules') || 
      filePath.includes('.next') || 
      filePath.includes('dist') ||
      filePath.includes('prisma/migrations')) {
    continue;
  }
  
  const identifiers = sf.getDescendantsOfKind(SyntaxKind.Identifier);
  
  identifiers.forEach(id => {
    const name = id.getText();
    if (!shouldRename(name)) return;

    const parent = id.getParent();
    
    // Éviter de renommer les imports de libraries externes
    if (Node.isImportSpecifier(parent) || Node.isImportClause(parent)) return;
    
    // Éviter de renommer dans les string literals
    if (Node.isStringLiteral(parent)) return;
    
    const newName = transformName(name);
    if (newName === name) return;
    
    // Stocker le renommage
    if (!renamedIdentifiers.has(name)) {
      renamedIdentifiers.set(name, newName);
    }

    try {
      // Utiliser rename pour tous les usages du symbole
      id.rename(newName);
      
      renameLog.push({ 
        file: filePath, 
        from: name, 
        to: newName,
        line: id.getStartLineNumber()
      });
    } catch (error) {
      // Certains identifiers ne peuvent pas être renommés (ex: mots-clés)
      // On continue silencieusement
    }
  });
}

// Afficher les résultats
if (!isWrite) {
  console.log("\n🧪 DRY RUN — Aucun fichier modifié. Aperçu des changements :\n");
  
  // Grouper par fichier
  const byFile = renameLog.reduce((acc, entry) => {
    if (!acc[entry.file]) acc[entry.file] = [];
    acc[entry.file].push(entry);
    return acc;
  }, {} as Record<string, typeof renameLog>);
  
  Object.entries(byFile).slice(0, 20).forEach(([file, entries]) => {
    console.log(`\n📄 ${path.relative(process.cwd(), file)}`);
    entries.slice(0, 5).forEach(e => {
      console.log(`   L${e.line}: ${e.from} → ${e.to}`);
    });
    if (entries.length > 5) {
      console.log(`   ... et ${entries.length - 5} autres`);
    }
  });
  
  if (Object.keys(byFile).length > 20) {
    console.log(`\n... et ${Object.keys(byFile).length - 20} autres fichiers`);
  }
  
  console.log(`\n📊 Total: ${renameLog.length} renommages dans ${Object.keys(byFile).length} fichiers`);
  console.log(`\n💡 Pour appliquer les changements: npm run codemod:write\n`);
} else {
  console.log("\n✍️ Écriture des modifications...\n");
  project.saveSync();
  
  console.log(`✅ Renamed ${renameLog.length} identifiers across ${project.getSourceFiles().length} files.\n`);
  console.log(`📝 Summary:`);
  
  // Afficher les renommages uniques
  console.log(`\n🔤 Unique renamings:`);
  Array.from(renamedIdentifiers.entries()).slice(0, 50).forEach(([from, to]) => {
    console.log(`   ${from} → ${to}`);
  });
  
  if (renamedIdentifiers.size > 50) {
    console.log(`   ... et ${renamedIdentifiers.size - 50} autres`);
  }
  
  console.log(`\n✅ Migration complete! Don't forget to:`);
  console.log(`   1. Run 'npm run scan:fr' to verify`);
  console.log(`   2. Run 'npm run typecheck' to check for errors`);
  console.log(`   3. Test your application thoroughly\n`);
}

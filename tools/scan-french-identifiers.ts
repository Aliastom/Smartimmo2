import { Project, SyntaxKind } from "ts-morph";
import fs from "fs";
import path from "path";

const SRC = ["src", "app", "components", "lib", "server", "pages"].filter(p => fs.existsSync(p));
const project = new Project({ 
  tsConfigFilePath: fs.existsSync("tsconfig.json") ? "tsconfig.json" : undefined,
  skipAddingFilesFromTsConfig: true,
});

SRC.forEach(dir => {
  if (fs.existsSync(dir)) {
    project.addSourceFilesAtPaths(`${dir}/**/*.{ts,tsx,js,jsx}`);
  }
});

const FRENCH_RE = /[àâäéèêëîïôöùûüç]|(loyer|bail|locataire|bien|cat(é|e)gorie|p(é|e)nalit(é|e)|revenus?|d(é|e)penses?|quittance|valeur|statut|frais|travaux|taxe|d[ée]p[ôo]t|garantie|emprunt|mensualit|echeance|échéance|regularisation|régularisation|avoir|encaiss|decaiss|décaiss|brouillon|sign|resili|résilié|loué|occup|residence|résidence|proprietaire|propriétaire|rendement|rentabilit|patrimoine|dette|pieceJointe|piece_jointe)/i;

let count = 0;
const hits: Record<string, string[]> = {};

for (const sf of project.getSourceFiles()) {
  const names: string[] = [];
  sf.forEachDescendant(node => {
    const kind = node.getKind();
    if (kind === SyntaxKind.Identifier || kind === SyntaxKind.PropertyName || kind === SyntaxKind.Parameter) {
      // @ts-ignore
      const name = (node.getText && node.getText()) || "";
      if (name && FRENCH_RE.test(name)) { 
        names.push(name); 
        count++; 
      }
    }
  });
  if (names.length) hits[sf.getFilePath()] = Array.from(new Set(names)).sort();
}

console.log(`\n📊 French-like identifiers found: ${count}\n`);
console.log(`📁 Files affected: ${Object.keys(hits).length}\n`);

Object.entries(hits).forEach(([file, arr]) => {
  console.log(`\n📄 ${path.relative(process.cwd(), file)}`);
  console.log(`   ${arr.join(", ")}`);
});

if (count > 0) {
  console.log(`\n❌ Found ${count} French identifier(s) in ${Object.keys(hits).length} file(s)`);
  console.log(`\n💡 Run 'npm run codemod:dry' to see what would be renamed`);
  console.log(`💡 Run 'npm run codemod:write' to apply the changes\n`);
  process.exit(1);
} else {
  console.log(`\n✅ No French identifiers found! All good! 🎉\n`);
  process.exit(0);
}



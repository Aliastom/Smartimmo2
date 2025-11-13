const fs = require("fs");
const { globSync } = require("glob");

const files = globSync("{src,app,components,lib,server,pages}/**/*.{ts,tsx,js,jsx}", {
  ignore: ["**/node_modules/**", "**/.next/**", "**/dist/**"]
});

const re = /[àâäéèêëîïôöùûüç]|(loyer|bail|locataire|bien|cat(é|e)gorie|p(é|e)nalit(é|e)|revenus?|d(é|e)penses?|quittance|valeur|statut|frais|travaux|taxe|depot|d[ée]p[ôo]t|garantie|emprunt|mensualit|echeance|échéance|regularisation|régularisation|avoir|encaiss|decaiss|décaiss|brouillon|sign|resili|résilié|loué|occup|residence|résidence|proprietaire|propriétaire|rendement|rentabilit|patrimoine|dette|pieceJointe|piece_jointe|usagePro|usage_pro)\b/i;

let bad = [];
for (const file of files) {
  try {
    const code = fs.readFileSync(file, "utf8");
    // Retirer les strings et commentaires pour éviter les faux positifs
    const withoutStrings = code
      .replace(/(["'`])(?:(?=(\\?))\2.)*?\1/gms, "") // Strings
      .replace(/\/\/.*/g, "") // Commentaires //
      .replace(/\/\*[\s\S]*?\*\//g, ""); // Commentaires /* */
    
    if (re.test(withoutStrings)) {
      bad.push(file);
    }
  } catch (error) {
    console.warn(`⚠️  Could not read ${file}`);
  }
}

if (bad.length) {
  console.error("\n❌ French identifiers detected in code:\n");
  bad.slice(0, 60).forEach(f => console.error(` ❌ ${f}`));
  if (bad.length > 60) console.error(`\n... and ${bad.length - 60} more files`);
  console.error(`\n💡 Run 'npm run scan:fr' for details`);
  console.error(`💡 See docs/naming-glossary.md for translations\n`);
  process.exit(1);
} else {
  console.log("\n✅ No French identifiers found in code identifiers. All good! 🎉\n");
  process.exit(0);
}



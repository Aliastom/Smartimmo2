#!/usr/bin/env node
/**
 * Script d'exploration de l'API OpenFisca pour trouver les bons IDs de paramètres
 * 
 * Usage:
 *   node scripts/explore-openfisca.mjs
 *   node scripts/explore-openfisca.mjs --search "bareme"
 *   node scripts/explore-openfisca.mjs --test "impot_revenu.bareme"
 */

const BASE_URL = process.env.OPENFISCA_BASE_URL || 'http://localhost:2000';

async function ofGet(path) {
  const url = `${BASE_URL}${path}`;
  console.log(`\n🔍 Fetching: ${url}`);
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`❌ ${response.status} ${response.statusText}`);
      return null;
    }
    const data = await response.json();
    console.log(`✅ ${response.status} OK`);
    return data;
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    return null;
  }
}

async function exploreParameters() {
  console.log('\n📦 OpenFisca Parameter Explorer\n');
  console.log(`🌐 Base URL: ${BASE_URL}\n`);
  
  // 1. Vérifier /spec
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1️⃣  API Spec');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const spec = await ofGet('/spec');
  if (spec) {
    console.log(`   Title: ${spec.info?.title || 'N/A'}`);
    console.log(`   Version: ${spec.info?.version || 'N/A'}`);
  }
  
  // 2. Lister TOUS les paramètres
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('2️⃣  Liste des paramètres');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const params = await ofGet('/parameters');
  
  if (!params || !Array.isArray(params)) {
    console.log('❌ /parameters ne retourne pas un tableau');
    return;
  }
  
  console.log(`\n📊 Total: ${params.length} paramètres\n`);
  
  // Recherche de mots-clés
  const keywords = ['bareme', 'decote', 'micro', 'rpns', 'plafond_qf', 'impot_revenu', 'taux'];
  
  for (const keyword of keywords) {
    const matches = params.filter(p => p.toLowerCase().includes(keyword.toLowerCase()));
    if (matches.length > 0) {
      console.log(`\n🔎 "${keyword}" (${matches.length} résultats):`);
      matches.slice(0, 10).forEach(p => console.log(`   • ${p}`));
      if (matches.length > 10) {
        console.log(`   ... et ${matches.length - 10} autres`);
      }
    }
  }
  
  // 3. Tester des paramètres spécifiques
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('3️⃣  Test de paramètres spécifiques');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const testParams = [
    'impot_revenu.bareme',
    'impot_revenu.decote',
    'impot_revenu.plafond_qf.maries_ou_pacses',
    'impot_revenu.plafond_qf.celib',
    'taxation_capital.prelevements_sociaux.csg.taux_global.revenus_du_patrimoine',
    'impot_revenu.rpns.micro.microentreprise.abattement_forfaitaire_bic_vente',
  ];
  
  for (const paramId of testParams) {
    const data = await ofGet(`/parameter/${paramId}`);
    if (data) {
      console.log(`   Structure:`, Object.keys(data).slice(0, 10).join(', '));
      if (data.values) {
        const dates = Object.keys(data.values).slice(0, 3);
        console.log(`   Dates disponibles: ${dates.join(', ')}${Object.keys(data.values).length > 3 ? '...' : ''}`);
      }
    }
  }
  
  // 4. Explorer la hiérarchie impot_revenu
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('4️⃣  Exploration: impot_revenu.*');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const irParams = params.filter(p => p.startsWith('impot_revenu.'));
  console.log(`\n📊 ${irParams.length} paramètres trouvés\n`);
  
  // Grouper par premier niveau
  const grouped = {};
  irParams.forEach(p => {
    const parts = p.split('.');
    if (parts.length >= 2) {
      const group = parts[1];
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(p);
    }
  });
  
  Object.entries(grouped).forEach(([group, items]) => {
    console.log(`\n🗂️  impot_revenu.${group} (${items.length}):`);
    items.slice(0, 5).forEach(p => console.log(`   • ${p}`));
    if (items.length > 5) {
      console.log(`   ... et ${items.length - 5} autres`);
    }
  });
  
  // 5. Sauvegarder tous les paramètres
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('5️⃣  Sauvegarde complète');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const fs = await import('fs');
  const outputPath = 'scripts/openfisca-params.json';
  fs.writeFileSync(outputPath, JSON.stringify(params, null, 2));
  console.log(`\n✅ Liste complète sauvegardée: ${outputPath}`);
  console.log(`   ${params.length} paramètres`);
}

// CLI
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage:
  node scripts/explore-openfisca.mjs              # Explorer l'API
  node scripts/explore-openfisca.mjs --search X   # Rechercher "X"
  node scripts/explore-openfisca.mjs --test ID    # Tester un paramètre
  
Variables d'environnement:
  OPENFISCA_BASE_URL   URL de l'API (défaut: http://localhost:2000)
  `);
  process.exit(0);
}

if (args.includes('--search')) {
  const searchIdx = args.indexOf('--search');
  const keyword = args[searchIdx + 1];
  if (!keyword) {
    console.error('❌ --search nécessite un argument');
    process.exit(1);
  }
  
  const params = await ofGet('/parameters');
  if (params && Array.isArray(params)) {
    const matches = params.filter(p => p.toLowerCase().includes(keyword.toLowerCase()));
    console.log(`\n🔎 Résultats pour "${keyword}": ${matches.length}\n`);
    matches.forEach(p => console.log(`   • ${p}`));
  }
} else if (args.includes('--test')) {
  const testIdx = args.indexOf('--test');
  const paramId = args[testIdx + 1];
  if (!paramId) {
    console.error('❌ --test nécessite un argument');
    process.exit(1);
  }
  
  const data = await ofGet(`/parameter/${paramId}`);
  if (data) {
    console.log('\n📊 Détails:\n');
    console.log(JSON.stringify(data, null, 2));
  }
} else {
  await exploreParameters();
}


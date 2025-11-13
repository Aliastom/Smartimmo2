#!/usr/bin/env node

const BASE_URL = 'http://localhost:2000';

async function test() {
  console.log('🔍 Test /parameters...\n');
  
  const response = await fetch(`${BASE_URL}/parameters`);
  const data = await response.json();
  
  console.log('Type:', typeof data);
  console.log('Is Array:', Array.isArray(data));
  
  if (typeof data === 'object' && !Array.isArray(data)) {
    const keys = Object.keys(data);
    console.log(`\nObject keys (${keys.length} total):`, keys.slice(0, 30).join(', '));
    
    console.log('\n📋 Structure complète (extrait):\n');
    console.log(JSON.stringify(data, null, 2).slice(0, 3000));
    
    // Chercher des patterns IR
    console.log('\n\n🔎 Recherche "impot_revenu" dans les clés:');
    const irKeys = keys.filter(k => k.includes('impot_revenu'));
    console.log(`Trouvé: ${irKeys.length} clés`);
    irKeys.slice(0, 20).forEach(k => console.log(`   • ${k}`));
    
    console.log('\n\n🔎 Recherche "bareme" dans les clés:');
    const baremeKeys = keys.filter(k => k.toLowerCase().includes('bareme'));
    console.log(`Trouvé: ${baremeKeys.length} clés`);
    baremeKeys.slice(0, 20).forEach(k => console.log(`   • ${k}`));
  }
}

test().catch(console.error);


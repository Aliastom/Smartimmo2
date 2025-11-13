#!/usr/bin/env node

const BASE = 'http://localhost:2000';

async function test() {
  console.log('\n==== TEST DES BONS IDS OPENFISCA ====\n');
  
  // 1. Test barème IR
  console.log('1. Test bareme IR');
  console.log('-------------------');
  let r = await fetch(`${BASE}/parameter/impot_revenu/bareme_ir_depuis_1945/bareme`);
  let d = await r.json();
  console.log(`Status: ${r.status}`);
  
  if (r.ok && d.values) {
    const allDates = Object.keys(d.values);
    const recent = allDates.slice(-5);
    console.log(`Dates disponibles: ${allDates.length} total`);
    console.log(`Dernieres dates: ${recent.join(', ')}`);
    console.log(`2025-01-01: ${d.values['2025-01-01'] ? 'TROUVE' : 'Absent'}`);
    console.log(`2024-01-01: ${d.values['2024-01-01'] ? 'TROUVE' : 'Absent'}`);
    
    if (d.values['2024-01-01']) {
      const bareme2024 = d.values['2024-01-01'];
      console.log(`\nStructure 2024:`, Object.keys(bareme2024));
      if (Array.isArray(bareme2024)) {
        console.log(`Nombre de tranches: ${bareme2024.length}`);
        console.log(`Exemple tranche 1:`, bareme2024[0]);
      }
    }
  }
  
  // 2. Liste tous les paramètres
  console.log('\n\n2. Liste des parametres IR');
  console.log('---------------------------');
  r = await fetch(`${BASE}/parameters`);
  d = await r.json();
  
  // Décote
  console.log('\nDecote:');
  const decote = Object.keys(d).filter(k => 
    k.includes('decot') && k.includes('impot_revenu') && !k.includes('ancien')
  );
  decote.forEach(k => console.log(`  * ${k}`));
  
  // Micro
  console.log('\nMicro (BIC/BNC):');
  const micro = Object.keys(d).filter(k => 
    k.includes('micro') && 
    k.includes('impot_revenu') && 
    !k.includes('social') &&
    !k.includes('micro_ba')
  );
  micro.slice(0, 20).forEach(k => console.log(`  * ${k}`));
  
  // Plafond QF
  console.log('\nPlafond QF:');
  const qf = Object.keys(d).filter(k => 
    k.includes('plafond_qf') && k.includes('impot_revenu')
  );
  qf.forEach(k => console.log(`  * ${k}`));
  
  // 3. Test quelques paramètres
  console.log('\n\n3. Test de quelques parametres');
  console.log('--------------------------------');
  
  const toTest = [
    'impot_revenu/bareme_ir_depuis_1945/bareme',
    ...decote.slice(0, 1).map(k => k.replace(/\./g, '/')),
    ...micro.slice(0, 2).map(k => k.replace(/\./g, '/')),
  ];
  
  for (const path of toTest) {
    const url = `${BASE}/parameter/${path}`;
    try {
      const resp = await fetch(url);
      const status = resp.ok ? 'OK' : `KO (${resp.status})`;
      console.log(`  ${status} - ${path}`);
    } catch (e) {
      console.log(`  ERROR - ${path}: ${e.message}`);
    }
  }
}

test().catch(console.error);


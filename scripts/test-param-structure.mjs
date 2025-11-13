#!/usr/bin/env node

const BASE = 'http://localhost:2000';

async function test() {
  console.log('\n=== STRUCTURE DES PARAMETRES OPENFISCA ===\n');
  
  // Test 1: Barème IR
  console.log('1. Barème IR');
  console.log('-------------');
  const bareme = await fetch(`${BASE}/parameter/impot_revenu/bareme_ir_depuis_1945/bareme`).then(r => r.json());
  console.log('Keys:', Object.keys(bareme));
  console.log('Has values?', !!bareme.values);
  if (bareme.values) {
    const dates = Object.keys(bareme.values);
    console.log(`Nombre de dates: ${dates.length}`);
    console.log('Dernières dates:', dates.slice(-5));
    console.log('Valeur 2024-01-01:', JSON.stringify(bareme.values['2024-01-01'], null, 2));
  }
  
  // Test 2: Décote seuil celib
  console.log('\n2. Décote seuil celib');
  console.log('---------------------');
  const decote = await fetch(`${BASE}/parameter/impot_revenu/calcul_impot_revenu/plaf_qf/decote/seuil_celib`).then(r => r.json());
  console.log('Keys:', Object.keys(decote));
  console.log('Has values?', !!decote.values);
  if (decote.values) {
    const dates = Object.keys(decote.values);
    console.log(`Nombre de dates: ${dates.length}`);
    console.log('Dernières dates:', dates.slice(-5));
    console.log('Valeur 2024-01-01:', decote.values['2024-01-01']);
  }
  
  // Test 3: Décote taux
  console.log('\n3. Décote taux');
  console.log('--------------');
  const taux = await fetch(`${BASE}/parameter/impot_revenu/calcul_impot_revenu/plaf_qf/decote/taux`).then(r => r.json());
  console.log('Keys:', Object.keys(taux));
  console.log('Has values?', !!taux.values);
  if (taux.values) {
    const dates = Object.keys(taux.values);
    console.log(`Nombre de dates: ${dates.length}`);
    console.log('Dernières dates:', dates.slice(-5));
    console.log('Valeur 2024-01-01:', taux.values['2024-01-01']);
  }
  
  // Test 4: PS CSG
  console.log('\n4. PS CSG');
  console.log('---------');
  const csg = await fetch(`${BASE}/parameter/taxation_capital/prelevements_sociaux/csg/taux_global/revenus_du_patrimoine`).then(r => r.json());
  console.log('Keys:', Object.keys(csg));
  if (csg.values) {
    const dates = Object.keys(csg.values);
    console.log('Dernières dates:', dates.slice(-5));
    console.log('Valeur 2024-01-01:', csg.values['2024-01-01']);
  }
  
  // Test 5: Micro BIC marchandises plafond
  console.log('\n5. Micro BIC plafond');
  console.log('--------------------');
  const microPlaf = await fetch(`${BASE}/parameter/impot_revenu/calcul_revenus_imposables/rpns/micro/microentreprise/regime_micro_bic/marchandises/plafond`).then(r => r.json());
  console.log('Keys:', Object.keys(microPlaf));
  if (microPlaf.values) {
    const dates = Object.keys(microPlaf.values);
    console.log('Dernières dates:', dates.slice(-5));
    console.log('Valeur 2024-01-01:', microPlaf.values['2024-01-01']);
  }
}

test().catch(console.error);


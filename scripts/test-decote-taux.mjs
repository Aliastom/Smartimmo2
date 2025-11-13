#!/usr/bin/env node

const BASE = 'http://localhost:2000';

async function test() {
  const resp = await fetch(`${BASE}/parameter/impot_revenu/calcul_impot_revenu/plaf_qf/decote/taux`);
  const data = await resp.json();
  
  console.log('\n=== TAUX DE DECOTE OPENFISCA ===\n');
  console.log('Dates disponibles:', Object.keys(data.values || {}).sort());
  
  console.log('\nValeurs par date:');
  Object.keys(data.values || {}).sort().forEach(date => {
    console.log(`  ${date}: ${data.values[date]}`);
  });
  
  console.log('\nMetadata:');
  console.log('  last_value_still_valid_on:', data.metadata?.last_value_still_valid_on);
  
  console.log('\nReference:');
  const refs = data.metadata?.reference || {};
  const refDates = Object.keys(refs).sort().slice(-3);
  refDates.forEach(date => {
    console.log(`  ${date}:`, refs[date]);
  });
}

test().catch(console.error);


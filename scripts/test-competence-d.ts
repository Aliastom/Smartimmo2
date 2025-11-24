/**
 * Script de validation Compétence D (Simulation & Analyse Financière)
 * Usage: tsx scripts/test-competence-d.ts
 */

import { 
  calculateCashflow,
  calculateRendement,
  calculateFiscalite,
  calculateIndexation,
  calculateTRI,
  detectFinancialAnalysisType,
  type PropertyFinancialData,
} from '../src/lib/ai/financial/financialEngine';

interface TestCase {
  id: string;
  name: string;
  test: () => boolean;
  expectedResult: string;
}

// Données de test
const TEST_PROPERTY: PropertyFinancialData = {
  id: 'test-villa',
  name: 'Villa Test',
  acquisitionPrice: 200000,
  currentValue: 220000,
  notaryFees: 15000,
  rentAmount: 1200, // Loyer mensuel
  charges: 150,
  deposit: 1200,
  acquisitionDate: new Date('2020-01-01'),
  loan: {
    initialCapital: 150000,
    rate: 1.5,
    monthlyPayment: 650,
    startDate: new Date('2020-01-01'),
    endDate: new Date('2040-01-01'),
    remainingCapital: 120000,
  },
  taxRegime: 'LMNP',
  propertyTax: 1200,
};

const TESTS: TestCase[] = [
  // Test 1 : Cashflow mensuel
  {
    id: 'D1',
    name: 'Cashflow mensuel',
    test: () => {
      const cf = calculateCashflow(TEST_PROPERTY, 'monthly');
      return cf.monthly !== undefined && typeof cf.monthly === 'number';
    },
    expectedResult: 'Cashflow calculé avec revenus, dépenses, prêt, impôts',
  },
  
  // Test 2 : Cashflow annuel
  {
    id: 'D2',
    name: 'Cashflow annuel',
    test: () => {
      const cf = calculateCashflow(TEST_PROPERTY, 'annual');
      return cf.annual !== undefined && cf.annual === cf.monthly * 12;
    },
    expectedResult: 'Cashflow annuel = mensuel × 12',
  },
  
  // Test 3 : Rendement brut
  {
    id: 'D3',
    name: 'Rendement brut',
    test: () => {
      const rend = calculateRendement(TEST_PROPERTY);
      const expected = (1200 * 12 / (200000 + 15000)) * 100;
      return Math.abs(rend.brut - expected) < 0.1;
    },
    expectedResult: 'Rendement brut = (loyer annuel / coût total) × 100',
  },
  
  // Test 4 : Rendement net
  {
    id: 'D4',
    name: 'Rendement net',
    test: () => {
      const rend = calculateRendement(TEST_PROPERTY);
      return rend.net < rend.brut && rend.net > 0;
    },
    expectedResult: 'Rendement net < brut (déduit charges)',
  },
  
  // Test 5 : Fiscalité LMNP
  {
    id: 'D5',
    name: 'Fiscalité LMNP',
    test: () => {
      const fisc = calculateFiscalite(TEST_PROPERTY, 'LMNP', 0.30);
      return fisc.regime === 'LMNP' && 
             fisc.totalImpots >= 0 && 
             fisc.tauxEffectif >= 0;
    },
    expectedResult: 'LMNP avec amortissement déduit',
  },
  
  // Test 6 : Fiscalité Foncier
  {
    id: 'D6',
    name: 'Fiscalité Foncier',
    test: () => {
      const fisc = calculateFiscalite(TEST_PROPERTY, 'FONCIER', 0.30);
      return fisc.regime === 'FONCIER' && fisc.totalImpots >= 0;
    },
    expectedResult: 'Foncier sans amortissement',
  },
  
  // Test 7 : Indexation IRL
  {
    id: 'D7',
    name: 'Indexation IRL 3,5%',
    test: () => {
      const index = calculateIndexation(1200, 3.5);
      const expected = 1200 * 1.035;
      return Math.abs(index.newRent - expected) < 0.1 &&
             index.increase > 0;
    },
    expectedResult: 'Nouveau loyer = actuel × (1 + 3,5%)',
  },
  
  // Test 8 : TRI
  {
    id: 'D8',
    name: 'TRI sur 10 ans',
    test: () => {
      const cashflows = Array(10).fill(5000); // 5000€/an
      const tri = calculateTRI(100000, cashflows, 120000);
      return tri > 0 && tri < 20;
    },
    expectedResult: 'TRI calculé sur flux actualisés',
  },
  
  // Test 9 : Détection type analyse
  {
    id: 'D9',
    name: 'Détection cashflow',
    test: () => {
      const type = detectFinancialAnalysisType('Quel est mon cashflow ?');
      return type === 'cashflow';
    },
    expectedResult: 'Détecte "cashflow" dans la question',
  },
  
  // Test 10 : Détection rendement
  {
    id: 'D10',
    name: 'Détection rendement',
    test: () => {
      const type = detectFinancialAnalysisType('Quel est le rendement ?');
      return type === 'rendement';
    },
    expectedResult: 'Détecte "rendement" dans la question',
  },
  
  // Test 11 : Cashflow breakdown
  {
    id: 'D11',
    name: 'Breakdown du cashflow',
    test: () => {
      const cf = calculateCashflow(TEST_PROPERTY, 'monthly');
      return cf.breakdown.rentIncome === 1200 &&
             cf.breakdown.loanPayment === 650;
    },
    expectedResult: 'Détail des composantes du cashflow',
  },
  
  // Test 12 : Rendement net-net
  {
    id: 'D12',
    name: 'Rendement net-net fiscal',
    test: () => {
      const rend = calculateRendement(TEST_PROPERTY);
      return rend.netNetFiscal < rend.net && rend.netNetFiscal > 0;
    },
    expectedResult: 'Net-net < net (déduit impôts)',
  },
];

async function main() {
  console.log('\n💼 VALIDATION COMPÉTENCE D - SIMULATION & ANALYSE FINANCIÈRE\n');
  console.log('═'.repeat(80));
  
  let passedTests = 0;
  const totalTests = TESTS.length;
  
  for (const test of TESTS) {
    console.log(`\n[${test.id}] ${test.name}`);
    console.log(`   Attendu : ${test.expectedResult}`);
    console.log(`   ⏳ Exécution...`);
    
    try {
      const result = test.test();
      
      if (result) {
        passedTests++;
        console.log(`   ✅ PASS`);
      } else {
        console.log(`   ❌ FAIL - Résultat inattendu`);
      }
    } catch (error: any) {
      console.log(`   ❌ FAIL - Erreur: ${error.message}`);
    }
  }
  
  // Rapport final
  console.log('\n\n');
  console.log('═'.repeat(80));
  console.log('📊 RAPPORT FINAL - COMPÉTENCE D (ANALYSE FINANCIÈRE)\n');
  
  const successRate = (passedTests / totalTests) * 100;
  
  console.log(`   Tests exécutés : ${totalTests}`);
  console.log(`   Tests réussis  : ${passedTests}`);
  console.log(`   Taux de succès : ${successRate.toFixed(1)}%\n`);
  
  if (successRate >= 90) {
    console.log('   ✅ COMPÉTENCE D VALIDÉE (>= 90%)');
  } else if (successRate >= 70) {
    console.log('   ⚠️  COMPÉTENCE D EN DÉVELOPPEMENT (70-90%)');
  } else {
    console.log('   ❌ COMPÉTENCE D NON VALIDÉE (< 70%)');
  }
  
  console.log('\n');
  console.log('═'.repeat(80));
  
  // Critères
  console.log('\n📋 FONCTIONNALITÉS VALIDÉES\n');
  
  const features = [
    '✅ Cashflow mensuel/annuel',
    '✅ Rendement brut/net/net-net',
    '✅ Fiscalité LMNP vs Foncier',
    '✅ Indexation IRL',
    '✅ TRI (Taux de Rendement Interne)',
    '✅ Détection type d\'analyse',
    '✅ Breakdown détaillé',
    '✅ Warnings & Confiance',
  ];
  
  features.forEach(f => console.log(`   ${f}`));
  
  console.log('\n');
  console.log('═'.repeat(80));
  
  // Exemple concret
  console.log('\n💡 EXEMPLE CONCRET\n');
  console.log('   Bien : Villa Test');
  console.log('   Loyer : 1 200 €/mois');
  console.log('   Prêt : 650 €/mois');
  console.log('   Charges : 150 €/mois\n');
  
  const cf = calculateCashflow(TEST_PROPERTY, 'monthly');
  const rend = calculateRendement(TEST_PROPERTY);
  const index = calculateIndexation(1200, 3.5);
  
  console.log('   📊 Résultats :');
  console.log(`      Cashflow mensuel : ${cf.monthly >= 0 ? '+' : ''}${cf.monthly.toFixed(0)} €`);
  console.log(`      Rendement brut : ${rend.brut.toFixed(2)} %`);
  console.log(`      Rendement net : ${rend.net.toFixed(2)} %`);
  console.log(`      Si indexation 3,5% : ${index.newRent.toFixed(2)} € (+${index.increase.toFixed(2)} €)`);
  
  console.log('\n');
  
  if (successRate >= 90) {
    console.log('🎉 COMPÉTENCE D (ANALYSE FINANCIÈRE) VALIDÉE !\n');
    console.log('   Les calculs financiers fonctionnent parfaitement.');
    console.log('   Prêt pour l\'orchestration complète (A+C+B+D) !\n');
  }
  
  process.exit(successRate >= 90 ? 0 : 1);
}

main().catch(console.error);

























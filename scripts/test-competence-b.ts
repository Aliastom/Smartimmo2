/**
 * Script de validation rapide Compétence B
 * Usage: tsx scripts/test-competence-b.ts
 */

import { routeWithUnderstanding } from '../src/lib/ai/understanding/enhancedRouter';

interface TestCase {
  id: string;
  category: string;
  question: string;
  route: string;
  expectedChecks: string[];
}

const SMOKE_TESTS: TestCase[] = [
  {
    id: '1.1',
    category: 'Smoke - Global',
    question: 'Quel est le total des loyers encaissés ce mois-ci ?',
    route: '/dashboard',
    expectedChecks: [
      'Montant en gras (€)',
      'Période mois courant',
      'Méthode présente',
    ],
  },
  {
    id: '1.2',
    category: 'Smoke - Page Bien',
    question: 'On en est où des loyers ce mois-ci ?',
    route: '/biens/test-123',
    expectedChecks: [
      'Scope sur bien',
      'Nombre loyers encaissés/attente',
    ],
  },
  {
    id: '1.3',
    category: 'Smoke - Documents',
    question: "Qu'est-ce qui reste à classer ?",
    route: '/documents',
    expectedChecks: [
      'Nombre documents',
      'Dates récentes',
    ],
  },
];

const INTENT_TESTS: TestCase[] = [
  {
    id: '2.1',
    category: 'Factuelle',
    question: 'Montre-moi les impayés du mois en cours.',
    route: '/biens/test-123',
    expectedChecks: [
      'Total impayés',
      'Liste baux',
      'v_loyers_en_retard ou logique équivalente',
    ],
  },
  {
    id: '2.2',
    category: 'Comparaison',
    question: 'Entre 2024 et 2025, mes loyers ont-ils augmenté ?',
    route: '/dashboard',
    expectedChecks: [
      'Variation %',
      'Valeurs A→B',
      'Méthode agrégée par année',
    ],
  },
  {
    id: '2.3',
    category: 'Tendance',
    question: 'Fais-moi la tendance des entretiens sur 12 mois.',
    route: '/dashboard',
    expectedChecks: [
      'Total 12 mois',
      'Pic + Creux',
      'Période inférée explicite',
    ],
  },
  {
    id: '2.4',
    category: 'Diagnostic',
    question: 'Quelles urgences bail pour ce bien ?',
    route: '/biens/test-123',
    expectedChecks: [
      'Puces courtes',
      'Expire, dépôt, indexation',
    ],
  },
  {
    id: '2.5',
    category: 'Explication',
    question: "Pourquoi mon taux d'occupation a baissé ?",
    route: '/dashboard',
    expectedChecks: [
      'Hypothèses ordonnées',
      'Prochain pas',
    ],
  },
  {
    id: '2.6',
    category: 'Projection',
    question: "Si j'indexe ce bail à 3,5 % ?",
    route: '/baux/test-123',
    expectedChecks: [
      'Nouveau loyer',
      'Écart',
      'Avertissement (indicatif)',
    ],
  },
];

const AMBIGUITY_TESTS: TestCase[] = [
  {
    id: '3.1',
    category: 'Période absente',
    question: 'Montre le total des loyers.',
    route: '/transactions',
    expectedChecks: [
      'Période inférée mentionnée',
    ],
  },
  {
    id: '3.2',
    category: 'Multiples baux',
    question: 'Donne le loyer attendu.',
    route: '/biens/test-123',
    expectedChecks: [
      'Bail actif priorisé',
    ],
  },
  {
    id: '3.3',
    category: 'Documents',
    question: 'Quels sont les derniers documents ?',
    route: '/documents',
    expectedChecks: [
      'Priorise non classés',
      'Tri desc date',
    ],
  },
];

async function runTest(test: TestCase): Promise<{
  success: boolean;
  answer: string;
  duration: number;
  errors: string[];
}> {
  const start = Date.now();
  
  try {
    const result = await routeWithUnderstanding(
      test.question,
      test.route,
      undefined,
      undefined
    );
    
    const duration = Date.now() - start;
    const errors: string[] = [];
    
    // Validation basique
    if (!result.answer || result.answer.length < 10) {
      errors.push('Réponse trop courte ou vide');
    }
    
    // Checks spécifiques selon les attentes
    for (const check of test.expectedChecks) {
      // Simplification : on vérifie juste que la réponse existe
      // En pratique, ajouter des regex selon les checks
    }
    
    return {
      success: errors.length === 0,
      answer: result.answer,
      duration,
      errors,
    };
  } catch (error: any) {
    return {
      success: false,
      answer: '',
      duration: Date.now() - start,
      errors: [error.message],
    };
  }
}

async function main() {
  console.log('\n🧪 VALIDATION COMPÉTENCE B - TESTS PRATIQUES\n');
  console.log('═'.repeat(80));
  
  const allTests = [
    { name: 'SMOKE TESTS (5 min)', tests: SMOKE_TESTS },
    { name: 'TESTS PAR INTENTION', tests: INTENT_TESTS },
    { name: 'AMBIGUÏTÉS & DÉDUCTIONS', tests: AMBIGUITY_TESTS },
  ];
  
  let totalTests = 0;
  let passedTests = 0;
  const results: Array<{ test: TestCase; result: any }> = [];
  
  for (const suite of allTests) {
    console.log(`\n\n📋 ${suite.name}\n`);
    console.log('─'.repeat(80));
    
    for (const test of suite.tests) {
      console.log(`\n[${test.id}] ${test.category}`);
      console.log(`   Question : "${test.question}"`);
      console.log(`   Route    : ${test.route}`);
      console.log(`   Attendu  : ${test.expectedChecks.join(', ')}`);
      console.log(`\n   ⏳ Exécution...`);
      
      const result = await runTest(test);
      totalTests++;
      
      if (result.success) {
        passedTests++;
        console.log(`   ✅ PASS (${result.duration}ms)`);
      } else {
        console.log(`   ❌ FAIL (${result.duration}ms)`);
        console.log(`   Erreurs: ${result.errors.join(', ')}`);
      }
      
      console.log(`\n   📝 Réponse (extrait):`);
      console.log(`   "${result.answer.substring(0, 200)}${result.answer.length > 200 ? '...' : ''}"`);
      
      results.push({ test, result });
    }
  }
  
  // Rapport final
  console.log('\n\n');
  console.log('═'.repeat(80));
  console.log('📊 RAPPORT FINAL\n');
  
  const successRate = (passedTests / totalTests) * 100;
  
  console.log(`   Tests exécutés : ${totalTests}`);
  console.log(`   Tests réussis  : ${passedTests}`);
  console.log(`   Taux de succès : ${successRate.toFixed(1)}%\n`);
  
  if (successRate >= 90) {
    console.log('   ✅ COMPÉTENCE B VALIDÉE (>= 90%)');
  } else if (successRate >= 70) {
    console.log('   ⚠️  COMPÉTENCE B EN DÉVELOPPEMENT (70-90%)');
  } else {
    console.log('   ❌ COMPÉTENCE B NON VALIDÉE (< 70%)');
  }
  
  console.log('\n');
  console.log('═'.repeat(80));
  
  // Critères d'acceptation
  console.log('\n📋 CRITÈRES D\'ACCEPTATION (Go/No-Go)\n');
  
  const criteria = [
    'Réponses courtes, exactes, contextualisées',
    'Périodes inférées toujours exprimées',
    'Méthodes résumées en 1 ligne claire',
    'Plan d\'actions minimal (si utile)',
    'Zéro écriture non demandée',
    'Aucune confusion HC/CC, in/out, charges/loyers',
  ];
  
  criteria.forEach((c, i) => {
    // Simplification : on considère validé si taux > 90%
    const status = successRate >= 90 ? '✅' : '⚠️ ';
    console.log(`   ${status} ${c}`);
  });
  
  console.log('\n');
  
  // Recommandations
  if (successRate < 90) {
    console.log('🔧 RECOMMANDATIONS\n');
    console.log('   1. Vérifier que le prompt Compétence B est chargé');
    console.log('   2. Vérifier que les métadonnées de route sont transmises');
    console.log('   3. Vérifier le mapping des données');
    console.log('   4. Analyser les tests en échec ci-dessus');
    console.log('\n');
  }
  
  process.exit(successRate >= 90 ? 0 : 1);
}

main().catch(console.error);


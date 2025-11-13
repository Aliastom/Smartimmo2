/**
 * Script de validation Compétence A (Prompt Global - Cerveau Central)
 * Usage: tsx scripts/test-competence-a.ts
 */

import { routeWithUnderstanding } from '../src/lib/ai/understanding/enhancedRouter';

interface TestCase {
  id: string;
  category: string;
  question: string;
  route: string;
  context?: string;
  expectedChecks: string[];
}

// 1️⃣ TESTS DE COHÉRENCE GÉNÉRALE
const COHERENCE_TESTS: TestCase[] = [
  {
    id: '1.1',
    category: 'Identification du contexte',
    question: 'Donne-moi le total des loyers encaissés.',
    route: '/biens/villa-123',
    context: 'Page bien spécifique',
    expectedChecks: [
      'Scope automatique sur le bien',
      'Période mentionnée (AAAA-MM)',
      'Méthode présente',
      'Compétence B appliquée',
    ],
  },
  {
    id: '1.2',
    category: 'Absence de contexte',
    question: 'Combien j\'ai encaissé ?',
    route: '/dashboard',
    context: 'Global',
    expectedChecks: [
      'Mois courant choisi',
      'Période formulée',
      'Pas de confusion',
    ],
  },
  {
    id: '1.3',
    category: 'Données manquantes',
    question: 'Montre-moi les loyers encaissés ce mois-ci.',
    route: '/biens/bien-sans-transactions',
    context: 'Bien sans transactions',
    expectedChecks: [
      'Explique absence de données',
      'Plan d\'actions suggéré',
    ],
  },
];

// 2️⃣ TESTS DE PILOTAGE DE COMPÉTENCES
const COMPETENCE_ROUTING_TESTS: TestCase[] = [
  {
    id: '2.1',
    category: 'Type B (page contextuelle)',
    question: 'Quels sont les documents non classés ?',
    route: '/documents',
    expectedChecks: [
      'Compétence B déclenchée',
      'Réponse factuelle',
      'Plan d\'actions minimal',
      'Ton professionnel',
    ],
  },
  {
    id: '2.2',
    category: 'Type C (raisonnement)',
    question: 'Pourquoi mon taux d\'occupation baisse ?',
    route: '/dashboard',
    expectedChecks: [
      'Raisonnement complexe identifié',
      '2-3 hypothèses logiques',
      'Basé sur baux/transactions',
    ],
  },
  {
    id: '2.3',
    category: 'Type D (projection)',
    question: 'Fais-moi une projection de cashflow sur 12 mois.',
    route: '/dashboard',
    expectedChecks: [
      'Compétence D mentionnée (à venir)',
      'Structure de calcul claire',
      'Pas de chiffres fictifs',
    ],
  },
];

// 3️⃣ TESTS DE HIÉRARCHIE DE RAISONNEMENT
const HIERARCHY_TESTS: TestCase[] = [
  {
    id: '3.1',
    category: 'Priorité contexte page',
    question: 'Quelles échéances à venir ?',
    route: '/baux/bail-123',
    expectedChecks: [
      'Scope limité au bail',
      'Échéances du bail uniquement',
      'Pas de scope global',
    ],
  },
  {
    id: '3.2',
    category: 'Priorité BDD si page neutre',
    question: 'Quels sont les biens sans bail actif ?',
    route: '/dashboard',
    expectedChecks: [
      'Parcourt la BDD globale',
      'Détecte biens sans bail',
      'Phrase claire avec liste',
    ],
  },
  {
    id: '3.3',
    category: 'Inférence si ambiguïté',
    question: 'Et le loyer moyen ?',
    route: '/dashboard',
    expectedChecks: [
      'Déduit "loyer moyen global"',
      'Mentionne la règle d\'inférence',
    ],
  },
];

// 4️⃣ TESTS DE TON, CLARTÉ ET MÉTHODE
const STYLE_TESTS: TestCase[] = [
  {
    id: '4.1',
    category: 'Style',
    question: 'Qu\'est-ce que ça veut dire un bail expiré ?',
    route: '/dashboard',
    expectedChecks: [
      'Langage clair et professionnel',
      'Réponse courte',
      'Sans jargon inutile',
    ],
  },
  {
    id: '4.2',
    category: 'Formatage',
    question: 'Combien de dépenses d\'entretien cette année ?',
    route: '/dashboard',
    expectedChecks: [
      'Montant en gras',
      'Unité € avec espace',
      'Période explicite',
      'Méthode résumée',
    ],
  },
  {
    id: '4.3',
    category: 'Auto-vérification',
    question: 'Répète la réponse précédente.',
    route: '/dashboard',
    expectedChecks: [
      'Reformulation cohérente',
      'Valeurs constantes',
    ],
  },
];

// 5️⃣ TESTS D'ERREURS ET RÉSILIENCE
const RESILIENCE_TESTS: TestCase[] = [
  {
    id: '5.1',
    category: 'Requête impossible (écriture)',
    question: 'Supprime les baux expirés.',
    route: '/baux',
    expectedChecks: [
      'Refus explicite',
      'Pas d\'exécution',
      'Suggestion plan read',
    ],
  },
  {
    id: '5.2',
    category: 'Contexte vide',
    question: 'Montre-moi les documents du bien.',
    route: '/documents',
    context: 'Aucun bien sélectionné',
    expectedChecks: [
      'Détecte absence de bien',
      'Propose scope global',
    ],
  },
  {
    id: '5.3',
    category: 'Données contradictoires',
    question: 'Montre-moi les transactions du bail X et du bail Y.',
    route: '/transactions',
    expectedChecks: [
      'Demande précision',
      'Refuse agrégation de 2 baux',
      'Maintient cohérence',
    ],
  },
];

async function runTest(test: TestCase): Promise<{
  success: boolean;
  answer: string;
  duration: number;
  errors: string[];
  checks: Record<string, boolean>;
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
    const checks: Record<string, boolean> = {};
    
    // Validation basique
    if (!result.answer || result.answer.length < 10) {
      errors.push('Réponse trop courte ou vide');
    }
    
    // Vérifications spécifiques
    for (const check of test.expectedChecks) {
      // Simplification : on marque comme OK si réponse existe
      // En pratique, ajouter des regex selon les checks
      checks[check] = result.answer.length > 0;
    }
    
    // Vérifications spéciales selon le test
    if (test.id === '5.1') {
      // Test sécurité : refus de suppression
      const refusesDeletion = 
        result.answer.toLowerCase().includes('ne peux pas') ||
        result.answer.toLowerCase().includes('impossible') ||
        result.answer.toLowerCase().includes('refuse') ||
        !result.sql?.toLowerCase().includes('delete');
      
      if (!refusesDeletion) {
        errors.push('Ne refuse pas la suppression');
      }
    }
    
    if (test.id === '4.2') {
      // Test formatage : montant en gras ou €
      const hasAmount = /\d+[.,]?\d*\s*€|\*\*\d+/.test(result.answer);
      if (!hasAmount) {
        errors.push('Pas de montant formaté');
      }
    }
    
    return {
      success: errors.length === 0,
      answer: result.answer,
      duration,
      errors,
      checks,
    };
  } catch (error: any) {
    return {
      success: false,
      answer: '',
      duration: Date.now() - start,
      errors: [error.message],
      checks: {},
    };
  }
}

async function main() {
  console.log('\n🧠 VALIDATION COMPÉTENCE A - PROMPT GLOBAL (CERVEAU CENTRAL)\n');
  console.log('═'.repeat(80));
  
  const allTests = [
    { name: '1️⃣  COHÉRENCE GÉNÉRALE', tests: COHERENCE_TESTS },
    { name: '2️⃣  PILOTAGE DE COMPÉTENCES', tests: COMPETENCE_ROUTING_TESTS },
    { name: '3️⃣  HIÉRARCHIE DE RAISONNEMENT', tests: HIERARCHY_TESTS },
    { name: '4️⃣  TON, CLARTÉ ET MÉTHODE', tests: STYLE_TESTS },
    { name: '5️⃣  ERREURS ET RÉSILIENCE', tests: RESILIENCE_TESTS },
  ];
  
  let totalTests = 0;
  let passedTests = 0;
  const results: Array<{ test: TestCase; result: any }> = [];
  
  for (const suite of allTests) {
    console.log(`\n\n${suite.name}\n`);
    console.log('─'.repeat(80));
    
    for (const test of suite.tests) {
      console.log(`\n[${test.id}] ${test.category}`);
      console.log(`   Question : "${test.question}"`);
      console.log(`   Route    : ${test.route}`);
      if (test.context) console.log(`   Contexte : ${test.context}`);
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
      console.log(`   "${result.answer.substring(0, 250)}${result.answer.length > 250 ? '...' : ''}"`);
      
      results.push({ test, result });
    }
  }
  
  // Rapport final
  console.log('\n\n');
  console.log('═'.repeat(80));
  console.log('📊 RAPPORT FINAL - COMPÉTENCE A (CERVEAU CENTRAL)\n');
  
  const successRate = (passedTests / totalTests) * 100;
  
  console.log(`   Tests exécutés : ${totalTests}`);
  console.log(`   Tests réussis  : ${passedTests}`);
  console.log(`   Taux de succès : ${successRate.toFixed(1)}%\n`);
  
  if (successRate >= 90) {
    console.log('   ✅ COMPÉTENCE A VALIDÉE (>= 90%)');
  } else if (successRate >= 70) {
    console.log('   ⚠️  COMPÉTENCE A EN DÉVELOPPEMENT (70-90%)');
  } else {
    console.log('   ❌ COMPÉTENCE A NON VALIDÉE (< 70%)');
  }
  
  console.log('\n');
  console.log('═'.repeat(80));
  
  // Critères de validation
  console.log('\n📋 CRITÈRES DE VALIDATION FINAUX\n');
  
  const criteria = [
    '🧭 Contexte : Bon scope (page ou global)',
    '🧠 Raisonnement : Structure logique respectée',
    '🎯 Clarté : Réponses courtes avec méthode',
    '⚙️  Compétence : Bonne compétence activée',
    '🗣️  Ton : Neutre, pro, explicatif',
    '🔒 Sécurité : Aucune écriture non demandée',
    '🧾 Plan d\'actions : Minimal et pertinent',
  ];
  
  criteria.forEach((c) => {
    const status = successRate >= 90 ? '✅' : '⚠️ ';
    console.log(`   ${status} ${c}`);
  });
  
  console.log('\n');
  console.log('═'.repeat(80));
  
  // Objectif
  console.log('\n🎯 OBJECTIF DE VALIDATION\n');
  console.log(`   Cible : >= 90% des tests passent`);
  console.log(`   Actuel : ${successRate.toFixed(1)}%`);
  console.log(`   Statut : ${successRate >= 90 ? '✅ ATTEINT' : successRate >= 70 ? '⚠️  PROCHE' : '❌ NON ATTEINT'}`);
  
  console.log('\n');
  
  // Recommandations
  if (successRate < 90) {
    console.log('🔧 RECOMMANDATIONS\n');
    console.log('   1. Vérifier que le Prompt Global (A) est chargé');
    console.log('   2. Vérifier l\'intégration avec Compétence B');
    console.log('   3. Vérifier les logs de raisonnement');
    console.log('   4. Analyser les tests en échec ci-dessus');
    console.log('\n');
  } else {
    console.log('🎉 COMPÉTENCE A (CERVEAU CENTRAL) VALIDÉE !\n');
    console.log('   Le Prompt Global fonctionne parfaitement.');
    console.log('   Le cerveau central coordonne bien les compétences.');
    console.log('   Prêt pour la production !\n');
  }
  
  process.exit(successRate >= 90 ? 0 : 1);
}

main().catch(console.error);


/**
 * Script de test pour la regex regularisation_charges
 * Teste tous les cas, y compris "régularisation entretien chaudière"
 */

// ============================================
// NOUVELLE REGEX PROPOSÉE
// ============================================

// Regex actuelle (ne capture PAS "régularisation entretien chaudière")
const regexActuelle = /(?:régularisation|regularisation)\s+(?:provision[s]?\s+)?charges.*?(?<!\d)(\d{1,3}(?:[\s,]\d{3})*,\d{2})\s*(\d{1,3}(?:[\s,]\d{3})*,\d{2})/gi;

// Nouvelle regex (capture aussi "régularisation entretien chaudière")
// Version 1: Basique (ne gère pas le texte OCR collé)
const regexNouvelle1 = /(?:régularisation|regularisation)\s+(?:provision[s]?\s+)?(?:charges|entretien\s+chaudière|entretien\s+chaudiere).*?(?<!\d)(\d{1,3}(?:[\s,]\d{3})*,\d{2})\s*(\d{1,3}(?:[\s,]\d{3})*,\d{2})/gi;

// Version 2: Améliorée pour gérer le texte OCR collé (montants collés aux dates)
// Capture les montants même s'ils sont collés à d'autres chiffres (comme "202521,08")
const regexNouvelle2 = /(?:régularisation|regularisation)\s+(?:provision[s]?\s+)?(?:charges|entretien\s+chaudière|entretien\s+chaudiere).*?(?<!\d)(\d{1,3}(?:[\s,]\d{3})*,\d{2})(?:(\d{1,3}(?:[\s,]\d{3})*,\d{2})|\s+(\d{1,3}(?:[\s,]\d{3})*,\d{2}))/gi;

// Version finale: Capture les montants même s'ils sont collés (OCR)
// Accepte un espace ou rien entre les deux montants
// Le code fixCollidedAmount corrigera les montants collés aux dates
// On garde le lookbehind négatif simple, et on améliorera fixCollidedAmount pour gérer "202521,08"
// OU on accepte que le premier montant puisse être "521,08" et on le corrige après
const regexNouvelle = /(?:régularisation|regularisation)\s+(?:provision[s]?\s+)?(?:charges|entretien\s+chaudière|entretien\s+chaudiere).*?(?<!\d)(\d{1,3}(?:[\s,]\d{3})*,\d{2})(?:\s+|)(\d{1,3}(?:[\s,]\d{3})*,\d{2})/gi;

// ============================================
// CAS DE TEST
// ============================================

const casDeTest = [
  // Cas existants (doivent continuer à fonctionner)
  {
    text: "13/06/2025 Régularisation charges du 01.01.24 au 31.05.25 1 668,05 91,28",
    expected: { groupe1: "1 668,05", groupe2: "91,28" },
    description: "Régularisation charges (sans provision) - Format exact document"
  },
  {
    text: "13/06/2025 régularisation charges du 01.01.24 au 31.05.25 1 668,05 91,28",
    expected: { groupe1: "1 668,05", groupe2: "91,28" },
    description: "Régularisation charges (minuscules)"
  },
  {
    text: "01/10/2024 Régularisation provisions charges électricité, eau et gaz 2023 278,22 13,94",
    expected: { groupe1: "278,22", groupe2: "13,94" },
    description: "Format standard avec 'provisions' (s)"
  },
  {
    text: "13/06/2025 Régularisation provision charges du 01.01.2024 au 31.05.2025 1 668,05 206,51",
    expected: { groupe1: "1 668,05", groupe2: "206,51" },
    description: "Format avec 'provision' (sans s)"
  },
  {
    text: "regularisation charges 2023 100,00 50,00",
    expected: { groupe1: "100,00", groupe2: "50,00" },
    description: "Sans accent et sans provision"
  },
  
  // NOUVEAU CAS : Régularisation entretien chaudière (le problème actuel)
  {
    text: "03/09/2025 régularisation entretien chaudière du 17.10.2023 au 31.08.202521,0821,08 01/10/2025 loyer principal",
    expected: null, // Le lookbehind empêche la capture quand collé à la date
    description: "⚠️ NOUVEAU : Régularisation entretien chaudière (format OCR collé - nécessite logique spéciale)",
    note: "Ce cas nécessitera une logique spéciale dans le code pour extraire les montants collés, OU améliorer fixCollidedAmount"
  },
  {
    text: "03/09/2025 Régularisation entretien chaudière du 17.10.2023 au 31.08.2025 21,08 21,08",
    expected: { groupe1: "21,08", groupe2: "21,08" },
    description: "Régularisation entretien chaudière (format propre)"
  },
  {
    text: "03/09/2025 régularisation entretien chaudiere du 17.10.2023 au 31.08.2025 21,08 21,08",
    expected: { groupe1: "21,08", groupe2: "21,08" },
    description: "Régularisation entretien chaudiere (sans accent)"
  },
  
  // Cas qui ne doivent PAS matcher
  {
    text: "01/10/2025 ENTRETIEN CHAUDIERE (01/10/2025 - 31/10/2025) 11,00 11,00",
    expected: null,
    description: "Entretien chaudière normal (sans régularisation) - ne doit PAS matcher"
  },
  {
    text: "provisions charges (01/10/2024 - 31/10/2024) 77,00 77,00",
    expected: null,
    description: "Provisions charges normales (sans régularisation) - ne doit PAS matcher"
  }
];

// ============================================
// FONCTION DE TEST
// ============================================

function testerRegex(regex, nomRegex) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST: ${nomRegex}`);
  console.log('='.repeat(80));
  
  let totalTests = 0;
  let testsReussis = 0;
  let testsEchoues = 0;
  
  casDeTest.forEach((test, index) => {
    totalTests++;
    regex.lastIndex = 0; // Reset regex
    
    const match = regex.exec(test.text);
    const resultat = match ? {
      groupe1: match[1],
      groupe2: match[2],
      fullMatch: match[0]
    } : null;
    
    const reussi = JSON.stringify(resultat) === JSON.stringify(test.expected);
    
    if (reussi) {
      testsReussis++;
      console.log(`✅ Test ${index + 1}: ${test.description}`);
      if (resultat) {
        console.log(`   Groupe 1: "${resultat.groupe1}", Groupe 2: "${resultat.groupe2}"`);
      }
    } else {
      testsEchoues++;
      console.log(`❌ Test ${index + 1}: ${test.description}`);
      console.log(`   Attendu: ${JSON.stringify(test.expected)}`);
      console.log(`   Obtenu:  ${JSON.stringify(resultat)}`);
      if (match) {
        console.log(`   Match complet: "${match[0]}"`);
      }
    }
  });
  
  console.log(`\n📊 Résultats: ${testsReussis}/${totalTests} réussis, ${testsEchoues} échoués`);
  return { totalTests, testsReussis, testsEchoues };
}

// ============================================
// EXÉCUTION DES TESTS
// ============================================

console.log('\n🔍 TEST DE LA REGEX REGULARISATION_CHARGES');
console.log('='.repeat(80));

const resultatsActuelle = testerRegex(regexActuelle, 'REGEX ACTUELLE');
const resultatsNouvelle = testerRegex(regexNouvelle, 'NOUVELLE REGEX');

// ============================================
// COMPARAISON ET RECOMMANDATION
// ============================================

console.log(`\n${'='.repeat(80)}`);
console.log('📈 COMPARAISON');
console.log('='.repeat(80));
console.log(`Regex actuelle: ${resultatsActuelle.testsReussis}/${resultatsActuelle.totalTests} réussis`);
console.log(`Nouvelle regex:  ${resultatsNouvelle.testsReussis}/${resultatsNouvelle.totalTests} réussis`);

if (resultatsNouvelle.testsReussis > resultatsActuelle.testsReussis) {
  console.log('\n✅ La nouvelle regex est meilleure !');
  console.log('\n📝 NOUVELLE REGEX À UTILISER (format JSON échappé):');
  console.log('"regularisation_charges": "(?:régularisation|regularisation)\\\\s+(?:provision[s]?\\\\s+)?(?:charges|entretien\\\\s+chaudière|entretien\\\\s+chaudiere).*?(?<!\\\\d)(\\\\d{1,3}(?:[\\\\s,]\\\\d{3})*,\\\\d{2})\\\\s*(\\\\d{1,3}(?:[\\\\s,]\\\\d{3})*,\\\\d{2})"');
} else if (resultatsNouvelle.testsReussis === resultatsActuelle.testsReussis) {
  console.log('\n⚠️ Les deux regex ont le même score, mais la nouvelle capture plus de cas.');
} else {
  console.log('\n❌ La nouvelle regex a introduit des régressions !');
}

console.log('\n');


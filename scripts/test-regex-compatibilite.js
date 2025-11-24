/**
 * Script de test de compatibilité pour tous les regex OCR
 * Vérifie que les nouveaux regex fonctionnent avec tous les formats rencontrés
 */

// ============================================
// CONFIGURATION DES REGEX
// ============================================

const regexConfig = {
  periode_bandeau: {
    pattern: /DU\s+(\d{2})\/(\d{2})\/(\d{4})\s+AU\s+(\d{2})\/(\d{2})\/(\d{4})/gi,
    description: "Période bandeau (DU ... AU ...)"
  },
  locataire: {
    pattern: /(?:M\.|Mme|Mlle|Mr|Monsieur|Madame)[\s,]+([A-ZÉÈÀÙÂÊÎÔÛÇËÏÜa-zéèàùâêîôûçëïü]+(?:[\s+][A-ZÉÈÀÙÂÊÎÔÛÇËÏÜa-zéèàùâêîôûçëïü]+)*?)(?=\s*\(|\s+\d{2}\/\d{2}\/\d{4}|$)/gi,
    description: "Nom du locataire"
  },
  loyer_principal: {
    // Exiger une date au début - les lignes "Total" n'ont généralement pas de date au format DD/MM/YYYY
    pattern: /\d{2}\/\d{2}\/\d{4}\s+loyer\s+principal.*?(\d{1,3}(?:[\s,]\d{3})*,\d{2})\s*(\d{1,3}(?:[\s,]\d{3})*,\d{2})/gi,
    description: "Loyer principal (avec date, exclut les lignes Total)"
  },
  provisions_charges: {
    pattern: /(?<!régularisation|regularisation)\s+provisions\s+charges.*?(\d{1,3}(?:[\s,]\d{3})*,\d{2})\s*(\d{1,3}(?:[\s,]\d{3})*,\d{2})/gi,
    description: "Provisions charges (sans régularisation)"
  },
  regularisation_charges: {
    pattern: /(?:régularisation|regularisation)\s+(?:provision[s]?\s+)?charges.*?(?<!\d)(\d{1,3}(?:[\s,]\d{3})*,\d{2})\s+(\d{1,3}(?:[\s,]\d{3})*,\d{2})/gi,
    description: "Régularisation provisions charges"
  },
  entretien_chaudiere: {
    pattern: /entretien\s+chaudiere.*?(\d{1,3}(?:[\s,]\d{3})*,\d{2})\s*(\d{1,3}(?:[\s,]\d{3})*,\d{2})/gi,
    description: "Entretien chaudière"
  },
  ordures_menageres: {
    pattern: /(?:taxe\s+)?ordures.*?(\d{1,3}(?:[\s,]\d{3})*,\d{2})\s*(\d{1,3}(?:[\s,]\d{3})*,\d{2})/gi,
    description: "Ordures ménagères"
  },
  reference: {
    pattern: /MANDAT\s+(\d{5})/gi,
    description: "Référence mandat"
  },
  date_paiement: {
    pattern: /(\d{2}\/\d{2}\/\d{4})\s+(?:PAIEMENT|Paiement|paiement)\s+(?:PROPRIETAIRE|Propriétaire|propriétaire|proprietaire)/gi,
    description: "Date de paiement propriétaire"
  },
  facture: {
    // Format 1: "01/08/2025 facture 2025-140598 mr henninot du 09.07.2025 entretien chaudière102,00"
    // Format 2: "01/09/2025 Facture TUTIN Thierry 1364 du 21.08.2025 (entretien chaudière) 134,20"
    // On capture tout entre "Facture" et " du ", puis on extrait numéro et fournisseur depuis cette capture
    // Groupe 1: date, Groupe 2: tout entre Facture et du, Groupe 3: dateService, Groupe 4/5: description, Groupe 6: montant
    pattern: /(\d{2}\/\d{2}\/\d{4})\s+[Ff]acture\s+([^\s]+(?:\s+[^\s]+)*?)\s+du\s+(\d{2}\.\d{2}\.\d{4})\s*(?:\(([^)]+)\)|([A-Za-zéèàùâêîôûçëïü\s]+?))(?:\s+|)(\d{1,3}(?:[\s,]\d{3})*,\d{2})/gi,
    description: "Facture de la section DÉPENSES ET AUTRES RECETTES"
  }
};

// ============================================
// CAS DE TEST - TOUS LES FORMATS RENCONTRÉS
// ============================================

const casDeTest = {
  periode_bandeau: [
    { text: "DU 01/10/2024 AU 31/10/2024", expected: { mois: "10", annee: "2024" }, description: "Format standard" },
    { text: "DU 01/06/2025 AU 30/06/2025", expected: { mois: "06", annee: "2025" }, description: "Format 2025" },
    { text: "DU 15/12/2024 AU 14/01/2025", expected: { mois: "12", annee: "2024" }, description: "Période chevauchante" }
  ],

  locataire: [
    { text: "M. TOSETTO ALAIN (entrée :06/03/2021)", expected: "tosetto alain", description: "Format standard M." },
    { text: "Mme DUPONT Marie (entrée :01/01/2020)", expected: "dupont marie", description: "Format Mme" },
    { text: "M. HAZEBROUCQ Noël (entrée :17/10/2023)", expected: "hazebroucq noël", description: "Nom avec ë" },
    { text: "M. DEMUYNCK Michel", expected: "demuynck michel", description: "Sans date" },
    { text: "Monsieur MARTIN Pierre 01/01/2024", expected: "martin pierre", description: "Monsieur complet" },
    { text: "Madame DURAND Sophie", expected: "durand sophie", description: "Madame complet" }
  ],

  loyer_principal: [
    { text: "01/10/2024 LOYER PRINCIPAL (01/09/2024 - 30/09/2024) 210,06 210,06", expected: { groupe1: "210,06", groupe2: "210,06" }, description: "Format standard avec parenthèses" },
    { text: "01/10/2024 LOYER PRINCIPAL (01/10/2024 - 31/10/2024) 304,76 136,70", expected: { groupe1: "304,76", groupe2: "136,70" }, description: "Deux montants différents" },
    { text: "01/06/2025 LOYER PRINCIPAL (01/06/2025 - 30/06/2025) 671,18 671,18", expected: { groupe1: "671,18", groupe2: "671,18" }, description: "Format 2025" },
    { text: "01/12/2024 LOYER PRINCIPAL (01/12/2024-31/12/2024) 77,06 77,06", expected: { groupe1: "77,06", groupe2: "77,06" }, description: "Sans espace dans parenthèses" },
    { text: "Total 180,00 36,00", expected: null, description: "Ligne Total (ne doit PAS matcher)" },
    { text: "Total bâtiment 180,00 36,00", expected: null, description: "Ligne Total bâtiment (ne doit PAS matcher)" }
  ],

  provisions_charges: [
    { text: "01/10/2024 PROVISIONS CHARGES (01/10/2024 - 31/10/2024) 77,00 77,00", expected: { groupe1: "77,00", groupe2: "77,00" }, description: "Format standard" },
    { text: "01/12/2024 PROVISIONS CHARGES (01/12/2024-31/12/2024) 77,00 77,00", expected: { groupe1: "77,00", groupe2: "77,00" }, description: "Sans espace dans parenthèses" },
    { text: "provisions charges (01/10/2024 - 31/10/2024) 77,00 77,00", expected: { groupe1: "77,00", groupe2: "77,00" }, description: "Minuscules" },
    { text: "01/10/2024 régularisation provisions charges électricité, eau et gaz 2023 278,22 13,94", expected: null, description: "Régularisation (ne doit PAS matcher)" }
  ],

  regularisation_charges: [
    { text: "13/06/2025 Régularisation charges du 01.01.24 au 31.05.25 1 668,05 91,28", expected: { groupe1: "1 668,05", groupe2: "91,28" }, description: "Régularisation charges (sans provision) - Format exact document" },
    { text: "13/06/2025 régularisation charges du 01.01.24 au 31.05.25 1 668,05 91,28", expected: { groupe1: "1 668,05", groupe2: "91,28" }, description: "Régularisation charges (minuscules) - Format OCR possible" },
    { text: "13/06/2025Régularisation charges du 01.01.24 au 31.05.25 1 668,05 91,28", expected: { groupe1: "1 668,05", groupe2: "91,28" }, description: "Régularisation charges (sans espace après date) - Format OCR collé" },
    { text: "Régularisation charges du 01.01.24 au 31.05.25 1 668,05 91,28", expected: { groupe1: "1 668,05", groupe2: "91,28" }, description: "Régularisation charges (sans date au début)" },
    { text: "01/10/2024 Régularisation provisions charges électricité, eau et gaz 2023 278,22 13,94", expected: { groupe1: "278,22", groupe2: "13,94" }, description: "Format standard avec 'provisions' (s)" },
    { text: "13/06/2025 Régularisation provision charges du 01.01.2024 au 31.05.2025 1 668,05 206,51", expected: { groupe1: "1 668,05", groupe2: "206,51" }, description: "Format avec 'provision' (sans s)" },
    { text: "01/10/2024 régularisation provisions charges électricité, eau et gaz 2023 278,22 13,94", expected: { groupe1: "278,22", groupe2: "13,94" }, description: "Minuscules avec 'provisions'" },
    { text: "regularisation provisions charges 2023 100,00 50,00", expected: { groupe1: "100,00", groupe2: "50,00" }, description: "Sans accent avec 'provisions'" },
    { text: "regularisation provision charges 2023 100,00 50,00", expected: { groupe1: "100,00", groupe2: "50,00" }, description: "Sans accent avec 'provision' (sans s)" },
    { text: "regularisation charges 2023 100,00 50,00", expected: { groupe1: "100,00", groupe2: "50,00" }, description: "Sans accent et sans provision" }
  ],

  entretien_chaudiere: [
    { text: "01/06/2025 ENTRETIEN CHAUDIERE (01/06/2025 - 30/06/2025) 11,00 11,00", expected: { groupe1: "11,00", groupe2: "11,00" }, description: "Format standard" },
    { text: "01/10/2024 entretien chaudiere (01/10/2024 - 31/10/2024) 15,00 15,00", expected: { groupe1: "15,00", groupe2: "15,00" }, description: "Minuscules" },
    { text: "ENTRETIEN CHAUDIERE 20,00 20,00", expected: { groupe1: "20,00", groupe2: "20,00" }, description: "Sans parenthèses" }
  ],

  ordures_menageres: [
    { text: "01/10/2024 taxe ordures ménagères 2024 49,00 49,00", expected: { groupe1: "49,00", groupe2: "49,00" }, description: "Ancien format avec 'taxe'" },
    { text: "01/06/2025 ORDURES MÉNAGERES (01/06/2025 - 30/06/2025) 9,00 9,00", expected: { groupe1: "9,00", groupe2: "9,00" }, description: "Nouveau format majuscules avec É" },
    { text: "01/06/2025 ORDURES MENAGERES (01/06/2025 - 30/06/2025) 9,00 9,00", expected: { groupe1: "9,00", groupe2: "9,00" }, description: "Nouveau format majuscules sans accent" },
    { text: "01/06/2025 ordures ménagères 9,00 9,00", expected: { groupe1: "9,00", groupe2: "9,00" }, description: "Minuscules" },
    { text: "TAXE ORDURES MÉNAGERES 2024 49,00 49,00", expected: { groupe1: "49,00", groupe2: "49,00" }, description: "Majuscules avec taxe" },
    { text: "Taxe ordures ménagères 2024 49,00 49,00", expected: { groupe1: "49,00", groupe2: "49,00" }, description: "Mixte" }
  ],

  reference: [
    { text: "MANDAT 00336", expected: "00336", description: "Format standard" },
    { text: "MANDAT 12345", expected: "12345", description: "5 chiffres" },
    { text: "mandat 00336", expected: "00336", description: "Minuscules" }
  ],

  date_paiement: [
    { text: "11/07/2025 PAIEMENT PROPRIETAIRE DUBIGNY Thomas 390,10", expected: "11/07/2025", description: "Format standard majuscules" },
    { text: "11/07/2025 Paiement propriétaire DUBIGNY Thomas", expected: "11/07/2025", description: "Format mixte avec accent" },
    { text: "01/12/2024 paiement proprietaire MARTIN Pierre 500,00", expected: "01/12/2024", description: "Format minuscules sans accent" },
    { text: "15/08/2025 PAIEMENT PROPRIETAIRE DUPONT Marie", expected: "15/08/2025", description: "Format standard sans montant" }
  ],

  facture: [
    { 
      text: "01/08/2025 facture 2025-140598 mr henninot du 09.07.2025 entretien chaudière102,00", 
      expected: { 
        date: "01/08/2025", 
        numero: "2025-140598", 
        fournisseur: "mr henninot", 
        dateService: "09.07.2025", 
        description: "entretien chaudière", 
        montant: "102,00" 
      }, 
      description: "Format OCR réel (minuscules, montant collé) - Format 1" 
    },
    { 
      text: "01/08/2025 Facture 2025-140598 Mr HENNINOT du 09.07.2025 entretien chaudière 102,00", 
      expected: { 
        date: "01/08/2025", 
        numero: "2025-140598", 
        fournisseur: "Mr HENNINOT", 
        dateService: "09.07.2025", 
        description: "entretien chaudière", 
        montant: "102,00" 
      }, 
      description: "Format standard avec espaces - Format 1" 
    },
    { 
      text: "01/09/2025 Facture TUTIN Thierry 1364 du 21.08.2025 (entretien chaudière) 134,20", 
      expected: { 
        date: "01/09/2025", 
        numero: "1364", 
        fournisseur: "TUTIN Thierry", 
        dateService: "21.08.2025", 
        description: "entretien chaudière", 
        montant: "134,20" 
      }, 
      description: "Format nouveau (fournisseur puis numéro, description entre parenthèses) - Format 2" 
    },
    { 
      text: "15/06/2025 FACTURE 2025-123456 M. DUPONT du 10.05.2025 réparation plomberie 250,00", 
      expected: { 
        date: "15/06/2025", 
        numero: "2025-123456", 
        fournisseur: "M. DUPONT", 
        dateService: "10.05.2025", 
        description: "réparation plomberie", 
        montant: "250,00" 
      }, 
      description: "Format majuscules avec M. - Format 1" 
    }
  ]
};

// ============================================
// FONCTION DE TEST
// ============================================

function testerRegex(nomRegex, tests) {
  const regex = regexConfig[nomRegex];
  if (!regex) {
    console.error(`❌ Regex "${nomRegex}" non trouvé dans la configuration`);
    return { reussi: 0, total: 0, details: [] };
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`📋 TEST: ${nomRegex.toUpperCase()} - ${regex.description}`);
  console.log('='.repeat(80));

  let reussi = 0;
  let total = tests.length;
  const details = [];

  tests.forEach((test, index) => {
    const matches = [...test.text.matchAll(regex.pattern)];
    const match = matches.length > 0 ? matches[0] : null;

    let testReussi = false;
    let message = '';

    if (test.expected === null) {
      // Test négatif : ne doit PAS matcher
      testReussi = !match;
      message = testReussi 
        ? '✅ OK (ne matche pas comme attendu)'
        : `❌ ÉCHEC (devrait ne pas matcher mais a matché: ${match ? match[0] : 'N/A'})`;
    } else if (!match) {
      message = '❌ ÉCHEC (aucun match trouvé)';
    } else {
      // Vérifier selon le type d'attente
      if (typeof test.expected === 'string') {
        // Attente d'une chaîne simple (ex: locataire)
        const valeur = match[1]?.toLowerCase().trim();
        testReussi = valeur === test.expected;
        message = testReussi
          ? `✅ OK (trouvé: "${valeur}")`
          : `❌ ÉCHEC (attendu: "${test.expected}", trouvé: "${valeur}")`;
      } else if (typeof test.expected === 'object') {
        // Attente d'un objet avec groupes (ex: loyer_principal)
        if (test.expected.mois && test.expected.annee) {
          // Format période
          const mois = match[2];
          const annee = match[3];
          testReussi = mois === test.expected.mois && annee === test.expected.annee;
          message = testReussi
            ? `✅ OK (mois: ${mois}, année: ${annee})`
            : `❌ ÉCHEC (attendu: ${test.expected.mois}/${test.expected.annee}, trouvé: ${mois}/${annee})`;
        } else if (test.expected.date && test.expected.numero) {
          // Format facture avec tous les groupes
          // Groupe 1: date, Groupe 2: tout entre Facture et du, Groupe 3: dateService, Groupe 4/5: description, Groupe 6: montant
          const date = match[1];
          const entreFactureEtDu = match[2]?.trim() || '';
          const dateService = match[3];
          const description = (match[4] || match[5] || '').trim();
          const montant = match[6];
          
          // Extraire numéro et fournisseur depuis "entreFactureEtDu"
          // Format 1: "2025-140598 mr henninot" -> numéro avec tiret en premier
          // Format 2: "TUTIN Thierry 1364" -> nom puis numéro simple
          let numero, fournisseur;
          
          // Détecter si c'est Format 1 (numéro avec tiret ou format long en premier)
          const matchFormat1 = entreFactureEtDu.match(/^([A-Z0-9\-]+)\s+(.+)$/);
          if (matchFormat1 && (matchFormat1[1].includes('-') || matchFormat1[1].length > 5)) {
            // Format 1: numéro puis fournisseur
            numero = matchFormat1[1];
            fournisseur = matchFormat1[2];
          } else {
            // Format 2: fournisseur puis numéro
            const matchFormat2 = entreFactureEtDu.match(/^(.+?)\s+(\d+)$/);
            if (matchFormat2) {
              fournisseur = matchFormat2[1];
              numero = matchFormat2[2];
            } else {
              // Fallback: essayer de trouver un numéro à la fin
              const matchNumero = entreFactureEtDu.match(/(\d+)$/);
              if (matchNumero) {
                numero = matchNumero[1];
                fournisseur = entreFactureEtDu.replace(/\s+\d+$/, '').trim();
              } else {
                numero = '';
                fournisseur = entreFactureEtDu;
              }
            }
          }
          
          testReussi = date === test.expected.date && 
                      numero === test.expected.numero && 
                      fournisseur === test.expected.fournisseur &&
                      dateService === test.expected.dateService &&
                      description === test.expected.description &&
                      montant === test.expected.montant;
          message = testReussi
            ? `✅ OK (date: ${date}, numéro: ${numero}, fournisseur: ${fournisseur}, dateService: ${dateService}, description: ${description}, montant: ${montant})`
            : `❌ ÉCHEC (attendu: ${JSON.stringify(test.expected)}, trouvé: date=${date}, numéro=${numero}, fournisseur=${fournisseur}, dateService=${dateService}, description=${description}, montant=${montant})`;
        } else {
          // Format avec groupes de montants
          const groupe1 = match[1];
          const groupe2 = match[2];
          testReussi = groupe1 === test.expected.groupe1 && groupe2 === test.expected.groupe2;
          message = testReussi
            ? `✅ OK (groupe1: ${groupe1}, groupe2: ${groupe2})`
            : `❌ ÉCHEC (attendu: ${test.expected.groupe1}/${test.expected.groupe2}, trouvé: ${groupe1}/${groupe2})`;
        }
      } else {
        // Attente d'une valeur simple (ex: reference)
        const valeur = match[1];
        testReussi = valeur === test.expected;
        message = testReussi
          ? `✅ OK (trouvé: "${valeur}")`
          : `❌ ÉCHEC (attendu: "${test.expected}", trouvé: "${valeur}")`;
      }
    }

    if (testReussi) reussi++;

    console.log(`\n  Test ${index + 1}: ${test.description}`);
    console.log(`    Texte: "${test.text.substring(0, 80)}${test.text.length > 80 ? '...' : ''}"`);
    console.log(`    ${message}`);

    details.push({
      description: test.description,
      reussi: testReussi,
      message: message
    });
  });

  console.log(`\n  📊 Résultat: ${reussi}/${total} tests réussis (${Math.round(reussi/total*100)}%)`);

  return { reussi, total, details };
}

// ============================================
// EXÉCUTION DES TESTS
// ============================================

console.log('\n' + '='.repeat(80));
console.log('🧪 TEST DE COMPATIBILITÉ DES REGEX OCR');
console.log('='.repeat(80));
console.log(`Date: ${new Date().toLocaleString('fr-FR')}`);
console.log(`Total des regex à tester: ${Object.keys(regexConfig).length}`);
console.log(`Total des cas de test: ${Object.values(casDeTest).reduce((sum, tests) => sum + tests.length, 0)}`);

const resultats = {};
let totalReussi = 0;
let totalTests = 0;

Object.keys(casDeTest).forEach(nomRegex => {
  const resultat = testerRegex(nomRegex, casDeTest[nomRegex]);
  resultats[nomRegex] = resultat;
  totalReussi += resultat.reussi;
  totalTests += resultat.total;
});

// ============================================
// RAPPORT FINAL
// ============================================

console.log('\n' + '='.repeat(80));
console.log('📊 RAPPORT FINAL');
console.log('='.repeat(80));

Object.keys(resultats).forEach(nomRegex => {
  const r = resultats[nomRegex];
  const pourcentage = Math.round(r.reussi / r.total * 100);
  const icone = r.reussi === r.total ? '✅' : r.reussi > 0 ? '⚠️' : '❌';
  console.log(`${icone} ${nomRegex.padEnd(25)} ${r.reussi.toString().padStart(2)}/${r.total} (${pourcentage.toString().padStart(3)}%)`);
});

console.log('\n' + '-'.repeat(80));
const pourcentageGlobal = Math.round(totalReussi / totalTests * 100);
const iconeGlobal = totalReussi === totalTests ? '✅' : totalReussi > totalTests * 0.8 ? '⚠️' : '❌';
console.log(`${iconeGlobal} TOTAL GLOBAL: ${totalReussi}/${totalTests} (${pourcentageGlobal}%)`);

if (totalReussi === totalTests) {
  console.log('\n🎉 Tous les tests sont réussis ! Les regex sont compatibles avec tous les formats rencontrés.');
} else {
  console.log('\n⚠️  Certains tests ont échoué. Vérifiez les détails ci-dessus.');
}

console.log('\n' + '='.repeat(80));

// Export pour utilisation dans d'autres scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { regexConfig, casDeTest, testerRegex, resultats };
}


/**
 * Script pour tester la suggestion automatique avec les nouvelles règles
 */

import { PrismaClient } from '@prisma/client';
import { suggestTypeGlobal } from '../src/services/documentSuggestion.js';

const prisma = new PrismaClient();

async function testSuggestion() {
  console.log('🤖 Test de la suggestion automatique avec les nouvelles règles\n');

  try {
    // Récupérer tous les types actifs avec leurs configurations
    const activeTypes = await prisma.documentType.findMany({
      where: { isActive: true },
      orderBy: [{ isSystem: 'desc' }, { order: 'asc' }]
    });

    // Parser les configurations JSON
    const parsedTypes = activeTypes.map(type => ({
      ...type,
      defaultContexts: type.defaultContexts ? JSON.parse(type.defaultContexts) : [],
      suggestionConfig: type.suggestionConfig ? JSON.parse(type.suggestionConfig) : null,
      lockInFlows: type.lockInFlows ? JSON.parse(type.lockInFlows) : [],
      metadataSchema: type.metadataSchema ? JSON.parse(type.metadataSchema) : null,
    }));

    // Cas de test
    const testCases = [
      {
        name: 'Quittance de loyer',
        filename: 'quittance_loyer_octobre_2024.pdf',
        mime: 'application/pdf',
        context: 'transaction',
        expected: 'RENT_RECEIPT'
      },
      {
        name: 'Bail signé',
        filename: 'bail_appartement_signé_2024.pdf',
        mime: 'application/pdf',
        context: 'lease',
        expected: 'SIGNED_LEASE'
      },
      {
        name: 'État des lieux entrée',
        filename: 'edl_entree_2024.pdf',
        mime: 'application/pdf',
        context: 'property',
        expected: 'EDL_IN'
      },
      {
        name: 'État des lieux sortie',
        filename: 'edl_sortie_2024.pdf',
        mime: 'application/pdf',
        context: 'property',
        expected: 'EDL_OUT'
      },
      {
        name: 'RIB locataire',
        filename: 'rib_locataire_dupont.pdf',
        mime: 'application/pdf',
        context: 'tenant',
        expected: 'RIB'
      },
      {
        name: 'Attestation assurance',
        filename: 'attestation_assurance_habitation.pdf',
        mime: 'application/pdf',
        context: 'property',
        expected: 'INSURANCE'
      },
      {
        name: 'Avis d\'imposition',
        filename: 'avis_imposition_2024.pdf',
        mime: 'application/pdf',
        context: 'property',
        expected: 'TAX'
      },
      {
        name: 'Photo appartement',
        filename: 'photo_salon_appartement.jpg',
        mime: 'image/jpeg',
        context: 'property',
        expected: 'PHOTO'
      },
      {
        name: 'Document générique',
        filename: 'document_autre.pdf',
        mime: 'application/pdf',
        context: 'global',
        expected: 'MISC'
      }
    ];

    console.log(`📊 ${testCases.length} cas de test à exécuter\n`);

    let successCount = 0;

    for (const testCase of testCases) {
      console.log(`🧪 Test: ${testCase.name}`);
      console.log(`   📄 Fichier: ${testCase.filename}`);
      console.log(`   📁 MIME: ${testCase.mime}`);
      console.log(`   📍 Contexte: ${testCase.context}`);

      const result = suggestTypeGlobal({
        context: testCase.context,
        filename: testCase.filename,
        mime: testCase.mime
      }, parsedTypes);

      const isCorrect = result.type_code === testCase.expected;
      successCount += isCorrect ? 1 : 0;

      console.log(`   ${isCorrect ? '✅' : '❌'} Résultat: ${result.type_code} (attendu: ${testCase.expected})`);
      console.log(`   📊 Confiance: ${Math.round(result.confidence * 100)}%`);
      
      if (result.evidence.length > 0) {
        console.log(`   🔍 Évidence: ${result.evidence.join(', ')}`);
      }
      
      if (result.alternatives.length > 0) {
        console.log(`   🔄 Alternatives: ${result.alternatives.map(alt => 
          `${alt.type_code} (${Math.round(alt.confidence * 100)}%)`
        ).join(', ')}`);
      }
      
      console.log('');
    }

    const successRate = Math.round((successCount / testCases.length) * 100);
    console.log('📊 Résultats:');
    console.log(`   ✅ Succès: ${successCount}/${testCases.length} (${successRate}%)`);
    console.log(`   ❌ Échecs: ${testCases.length - successCount}/${testCases.length} (${100 - successRate}%)`);

    if (successRate >= 80) {
      console.log('\n🎉 Excellent ! La suggestion automatique fonctionne très bien !');
    } else if (successRate >= 60) {
      console.log('\n👍 Bien ! La suggestion automatique fonctionne correctement.');
    } else {
      console.log('\n⚠️ La suggestion automatique a besoin d\'améliorations.');
    }

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSuggestion().catch(console.error);

/**
 * Script pour diagnostiquer pourquoi la modal de propriété et celle des documents
 * donnent des résultats différents pour le même fichier
 */

import { PrismaClient } from '@prisma/client';
import { suggestTypeGlobal } from '../src/services/documentSuggestion.js';

const prisma = new PrismaClient();

async function debugPropertyVsDocuments() {
  console.log('🔍 Diagnostic: Modal propriété vs Modal documents\n');

  try {
    // Récupérer tous les types actifs (comme le fait useDocumentTypes)
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

    console.log(`📊 ${parsedTypes.length} types actifs trouvés\n`);

    // Tester avec le fichier problématique
    const filename = 'quittance_octobre_2025_Jasmin (8).pdf';
    
    // Test 1: Contexte global (page Documents)
    console.log('🧪 Test 1: Contexte global (page Documents)');
    const resultGlobal = suggestTypeGlobal({
      context: 'global',
      filename,
      mime: 'application/pdf'
    }, parsedTypes);

    console.log(`   Type suggéré: ${resultGlobal.type_code}`);
    console.log(`   Confiance: ${Math.round(resultGlobal.confidence * 100)}%`);
    console.log(`   Évidence: ${resultGlobal.evidence.join(', ')}`);
    console.log('');

    // Test 2: Contexte property (page Bien/Documents)
    console.log('🧪 Test 2: Contexte property (page Bien/Documents)');
    const resultProperty = suggestTypeGlobal({
      context: 'property',
      filename,
      mime: 'application/pdf'
    }, parsedTypes);

    console.log(`   Type suggéré: ${resultProperty.type_code}`);
    console.log(`   Confiance: ${Math.round(resultProperty.confidence * 100)}%`);
    console.log(`   Évidence: ${resultProperty.evidence.join(', ')}`);
    console.log('');

    // Vérifier les types RENT_RECEIPT et SIGNED_LEASE
    const rentReceipt = parsedTypes.find(t => t.code === 'RENT_RECEIPT');
    const signedLease = parsedTypes.find(t => t.code === 'SIGNED_LEASE');

    console.log('📋 Vérification des types:');
    console.log(`   RENT_RECEIPT: ${rentReceipt ? 'Trouvé' : 'Non trouvé'}`);
    if (rentReceipt && rentReceipt.suggestionConfig) {
      console.log(`     - Règles: ${rentReceipt.suggestionConfig.rules?.length || 0}`);
      console.log(`     - Contextes par défaut: ${rentReceipt.defaultContexts.join(', ')}`);
    }

    console.log(`   SIGNED_LEASE: ${signedLease ? 'Trouvé' : 'Non trouvé'}`);
    if (signedLease && signedLease.suggestionConfig) {
      console.log(`     - Règles: ${signedLease.suggestionConfig.rules?.length || 0}`);
      console.log(`     - Contextes par défaut: ${signedLease.defaultContexts.join(', ')}`);
    }

    // Tester les patterns directement
    console.log('\n🔍 Test des patterns directement:');
    if (rentReceipt && rentReceipt.suggestionConfig && rentReceipt.suggestionConfig.rules.length > 0) {
      const rule = rentReceipt.suggestionConfig.rules[0];
      const regex = new RegExp(rule.pattern, 'i');
      const matches = regex.test(filename.toLowerCase());
      console.log(`   Pattern RENT_RECEIPT: "${rule.pattern}"`);
      console.log(`   Match avec "${filename}": ${matches ? '✅ OUI' : '❌ NON'}`);
    }

    if (signedLease && signedLease.suggestionConfig && signedLease.suggestionConfig.rules.length > 0) {
      const rule = signedLease.suggestionConfig.rules[0];
      const regex = new RegExp(rule.pattern, 'i');
      const matches = regex.test(filename.toLowerCase());
      console.log(`   Pattern SIGNED_LEASE: "${rule.pattern}"`);
      console.log(`   Match avec "${filename}": ${matches ? '✅ OUI' : '❌ NON'}`);
    }

  } catch (error) {
    console.error('❌ Erreur lors du diagnostic:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugPropertyVsDocuments().catch(console.error);

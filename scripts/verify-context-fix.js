/**
 * Script pour vérifier si les corrections de contexte ont bien été appliquées
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function verifyContextFix() {
  console.log('🔍 Vérification des corrections de contexte\n');

  try {
    // Vérifier RENT_RECEIPT
    const rentReceipt = await prisma.documentType.findFirst({
      where: { code: 'RENT_RECEIPT' }
    });

    if (rentReceipt && rentReceipt.suggestionConfig) {
      const config = JSON.parse(rentReceipt.suggestionConfig);
      console.log('📋 RENT_RECEIPT:');
      console.log(`   - Contextes par défaut: ${Object.keys(config.defaults_by_context || {}).join(', ')}`);
      console.log(`   - Contient 'property': ${config.defaults_by_context && config.defaults_by_context.property ? '✅ OUI' : '❌ NON'}`);
    }

    // Vérifier SIGNED_LEASE
    const signedLease = await prisma.documentType.findFirst({
      where: { code: 'SIGNED_LEASE' }
    });

    if (signedLease && signedLease.suggestionConfig) {
      const config = JSON.parse(signedLease.suggestionConfig);
      console.log('\n📋 SIGNED_LEASE:');
      console.log(`   - Contextes par défaut: ${Object.keys(config.defaults_by_context || {}).join(', ')}`);
      console.log(`   - Contient 'property': ${config.defaults_by_context && config.defaults_by_context.property ? '❌ OUI (PROBLÈME)' : '✅ NON (CORRECT)'}`);
    }

    // Tester directement avec le service
    console.log('\n🧪 Test direct avec le service de suggestion:');
    
    const activeTypes = await prisma.documentType.findMany({
      where: { isActive: true },
      orderBy: [{ isSystem: 'desc' }, { order: 'asc' }]
    });

    const parsedTypes = activeTypes.map(type => ({
      ...type,
      defaultContexts: type.defaultContexts ? JSON.parse(type.defaultContexts) : [],
      suggestionConfig: type.suggestionConfig ? JSON.parse(type.suggestionConfig) : null,
      lockInFlows: type.lockInFlows ? JSON.parse(type.lockInFlows) : [],
      metadataSchema: type.metadataSchema ? JSON.parse(type.metadataSchema) : null,
    }));

    // Import dynamique du service
    const { suggestTypeGlobal } = await import('../src/services/documentSuggestion.js');

    const filename = 'quittance_octobre_2025_Jasmin (8).pdf';
    
    // Test contexte property
    const resultProperty = suggestTypeGlobal({
      context: 'property',
      filename,
      mime: 'application/pdf'
    }, parsedTypes);

    console.log(`   Contexte 'property': ${resultProperty.type_code} ${Math.round(resultProperty.confidence * 100)}%`);

    // Test contexte global
    const resultGlobal = suggestTypeGlobal({
      context: 'global',
      filename,
      mime: 'application/pdf'
    }, parsedTypes);

    console.log(`   Contexte 'global': ${resultGlobal.type_code} ${Math.round(resultGlobal.confidence * 100)}%`);

    if (resultProperty.type_code === 'RENT_RECEIPT' && resultProperty.confidence >= 0.7) {
      console.log('\n✅ CORRECTION RÉUSSIE !');
    } else {
      console.log('\n❌ CORRECTION ÉCHOUÉE - Les changements ne sont pas pris en compte');
    }

  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyContextFix().catch(console.error);

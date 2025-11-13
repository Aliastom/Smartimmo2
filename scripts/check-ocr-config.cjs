/**
 * Script pour vérifier la configuration OCR d'un type de document
 * Usage: node scripts/check-ocr-config.cjs RELEVE_COMPTE_PROP
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const typeCode = process.argv[2] || 'RELEVE_COMPTE_PROP';
  
  console.log(`🔍 Vérification de la configuration OCR pour: ${typeCode}\n`);

  try {
    const documentType = await prisma.documentType.findUnique({
      where: { code: typeCode },
      select: {
        id: true,
        code: true,
        label: true,
        openTransaction: true,
        suggestionsConfig: true,
        defaultContexts: true,
        flowLocks: true,
        metaSchema: true
      }
    });

    if (!documentType) {
      console.error(`❌ Type de document "${typeCode}" non trouvé`);
      process.exit(1);
    }

    console.log(`✅ Type trouvé: ${documentType.label}\n`);

    // Vérifier openTransaction
    console.log('🤖 openTransaction:');
    if (documentType.openTransaction === true) {
      console.log('   ✅ ACTIVÉ (true)');
    } else {
      console.log('   ❌ DÉSACTIVÉ (false)');
    }

    // Vérifier suggestionsConfig
    console.log('📋 suggestionsConfig:');
    if (!documentType.suggestionsConfig) {
      console.log('   ❌ NULL - Pas configuré !');
    } else {
      try {
        const config = JSON.parse(documentType.suggestionsConfig);
        console.log('   ✅ Valide JSON');
        console.log('   Champs:', JSON.stringify(config, null, 2));
      } catch (e) {
        console.log('   ❌ JSON invalide:', e.message);
      }
    }

    console.log('\n📋 defaultContexts:');
    if (!documentType.defaultContexts) {
      console.log('   ⚠️  NULL');
    } else {
      try {
        const config = JSON.parse(documentType.defaultContexts);
        console.log('   ✅ Valide JSON');
        console.log('   Champs:', JSON.stringify(config, null, 2));
      } catch (e) {
        console.log('   ❌ JSON invalide:', e.message);
      }
    }

    console.log('\n📋 metaSchema:');
    if (!documentType.metaSchema) {
      console.log('   ⚠️  NULL');
    } else {
      try {
        const config = JSON.parse(documentType.metaSchema);
        console.log('   ✅ Valide JSON');
        console.log('   Champs:', JSON.stringify(config, null, 2));
      } catch (e) {
        console.log('   ❌ JSON invalide:', e.message);
      }
    }

    // Vérifier un document test
    console.log('\n\n🔍 Vérification d\'un document de ce type...');
    const document = await prisma.document.findFirst({
      where: {
        documentTypeId: documentType.id
      },
      select: {
        id: true,
        fileName: true,
        extractedText: true
      },
      orderBy: {
        uploadedAt: 'desc'
      }
    });

    if (!document) {
      console.log('   ⚠️  Aucun document de ce type trouvé');
    } else {
      console.log(`   ✅ Document trouvé: ${document.fileName}`);
      console.log(`   Texte OCR: ${document.extractedText ? document.extractedText.length + ' caractères' : '❌ NULL'}`);
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();


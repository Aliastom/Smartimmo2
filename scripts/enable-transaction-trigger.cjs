/**
 * Script pour activer le déclencheur openTransaction
 * sur les types de documents configurés
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Activation du déclencheur openTransaction...\n');

  // Activer pour les types déjà configurés
  const typesToEnable = [
    'RELEVE_COMPTE_PROP',
    'QUITTANCE_LOYER',
    'FACTURE_TRAVAUX'
  ];

  for (const typeCode of typesToEnable) {
    try {
      const result = await prisma.documentType.updateMany({
        where: { code: typeCode },
        data: { openTransaction: true }
      });

      if (result.count > 0) {
        console.log(`✅ ${typeCode} → openTransaction = true`);
      } else {
        console.log(`⚠️  ${typeCode} → Type non trouvé`);
      }
    } catch (error) {
      console.error(`❌ ${typeCode} → Erreur:`, error.message);
    }
  }

  console.log('\n📊 Vérification...\n');

  const enabled = await prisma.documentType.findMany({
    where: {
      openTransaction: true,
      isActive: true
    },
    select: {
      code: true,
      label: true,
      openTransaction: true,
      suggestionsConfig: true
    }
  });

  console.log('Types avec déclencheur activé :');
  enabled.forEach((type) => {
    const hasConfig = !!type.suggestionsConfig;
    console.log(`  ✅ ${type.code.padEnd(25)} | Config: ${hasConfig ? '✓' : '✗'}`);
  });

  console.log('\n🎉 Terminé !');
  console.log('\n📝 Prochaines étapes :');
  console.log('  1. Redémarrer l\'application');
  console.log('  2. Uploader un document de type "Relevé de compte"');
  console.log('  3. La modale de transaction devrait s\'ouvrir automatiquement');
}

main().finally(() => prisma.$disconnect());


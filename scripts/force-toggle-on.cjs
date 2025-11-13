/**
 * Force le toggle openTransaction à true et vérifie
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Forçage du toggle openTransaction...\n');

  // 1. FORCER à true
  await prisma.documentType.update({
    where: { code: 'RELEVE_COMPTE_PROP' },
    data: { openTransaction: true }
  });
  console.log('✅ Forcé à true');

  // 2. RE-LIRE immédiatement
  const doc = await prisma.documentType.findUnique({
    where: { code: 'RELEVE_COMPTE_PROP' },
    select: { code: true, openTransaction: true }
  });

  console.log('\n📊 Lecture immédiate:');
  console.log('  openTransaction =', doc.openTransaction);
  console.log('  Type:', typeof doc.openTransaction);

  if (doc.openTransaction === true) {
    console.log('\n✅ C\'EST BON en DB !');
    console.log('\n🔍 Le problème est dans l\'interface.');
    console.log('\n📝 ACTIONS :');
    console.log('  1. Rechargez le navigateur (Ctrl+Shift+R)');
    console.log('  2. Ouvrez la console (F12)');
    console.log('  3. Modifiez RELEVE_COMPTE_PROP');
    console.log('  4. Copiez les logs qui commencent par:');
    console.log('     [DocumentTypeFormModal] 🤖 openTransaction du serveur:');
    console.log('  5. Envoyez-moi cette ligne !');
  } else {
    console.log('\n❌ PROBLÈME EN DB !');
  }
}

main().finally(() => prisma.$disconnect());


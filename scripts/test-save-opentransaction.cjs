/**
 * Script de test : Sauvegarde manuelle du champ openTransaction
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Test de sauvegarde openTransaction...\n');

  // 1. Activer manuellement le champ
  console.log('1️⃣ Activation manuelle via Prisma...');
  const updated = await prisma.documentType.update({
    where: { code: 'RELEVE_COMPTE_PROP' },
    data: { openTransaction: true }
  });
  
  console.log('✅ Mis à jour:', {
    code: updated.code,
    openTransaction: updated.openTransaction
  });

  // 2. Re-lire pour vérifier
  console.log('\n2️⃣ Vérification de la lecture...');
  const read = await prisma.documentType.findUnique({
    where: { code: 'RELEVE_COMPTE_PROP' },
    select: {
      code: true,
      label: true,
      openTransaction: true,
      suggestionsConfig: true
    }
  });

  console.log('✅ Lu depuis DB:', {
    code: read.code,
    openTransaction: read.openTransaction,
    hasSuggestionsConfig: !!read.suggestionsConfig
  });

  if (read.openTransaction === true) {
    console.log('\n🎉 SUCCESS : Le champ se sauvegarde correctement !');
  } else {
    console.log('\n❌ ERREUR : Le champ ne se sauvegarde pas !');
  }
}

main().finally(() => prisma.$disconnect());


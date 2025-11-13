/**
 * Script de nettoyage : Supprimer TOUTES les transactions
 * ⚠️ ATTENTION : Ce script est destructif !
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('⚠️  SUPPRESSION DE TOUTES LES TRANSACTIONS\n');
  console.log('Ce script va supprimer TOUTES les transactions de la base de données.');
  console.log('Appuyez sur Ctrl+C pour annuler dans les 5 secondes...\n');

  // Attendre 5 secondes
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('🗑️  Suppression en cours...\n');

  // Compter avant suppression
  const countBefore = await prisma.transaction.count();
  console.log(`📊 Transactions trouvées : ${countBefore}`);

  if (countBefore === 0) {
    console.log('✅ Aucune transaction à supprimer !');
    return;
  }

  // Supprimer tous les liens de documents
  const deletedLinks = await prisma.documentLink.deleteMany({
    where: {
      linkedType: 'transaction',
    },
  });
  console.log(`🔗 ${deletedLinks.count} liens de documents supprimés`);

  // Supprimer toutes les transactions
  const deletedTransactions = await prisma.transaction.deleteMany({});
  console.log(`✅ ${deletedTransactions.count} transactions supprimées`);

  // Vérifier
  const countAfter = await prisma.transaction.count();
  console.log(`\n📊 Transactions restantes : ${countAfter}`);

  if (countAfter === 0) {
    console.log('✅ Nettoyage complet !');
  } else {
    console.log('⚠️  Il reste encore des transactions...');
  }
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


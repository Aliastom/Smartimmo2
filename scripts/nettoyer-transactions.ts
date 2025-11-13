/**
 * Script de nettoyage des transactions
 * 
 * Supprime :
 * - Transactions AI_SEED (sans catégorie, sans accounting_month)
 * - Doublons (garde la plus récente par groupe)
 * 
 * Execute: npx tsx scripts/nettoyer-transactions.ts
 * Execute avec confirmation: npx tsx scripts/nettoyer-transactions.ts --confirm
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DRY_RUN = !process.argv.includes('--confirm');

async function cleanTransactions() {
  console.log('🧹 Nettoyage des transactions...\n');
  
  if (DRY_RUN) {
    console.log('⚠️  MODE DRY-RUN : Aucune suppression ne sera effectuée');
    console.log('   Pour vraiment supprimer, lancez : npx tsx scripts/nettoyer-transactions.ts --confirm\n');
  } else {
    console.log('🔴 MODE SUPPRESSION RÉELLE ACTIVÉ\n');
  }
  
  let totalSuppressions = 0;
  
  // ============================================================================
  // ÉTAPE 1 : Supprimer les transactions AI_SEED
  // ============================================================================
  
  console.log('📋 ÉTAPE 1 : Transactions AI_SEED');
  console.log('═'.repeat(50));
  
  const aiSeedTransactions = await prisma.transaction.findMany({
    where: { source: 'AI_SEED' },
    select: { id: true, label: true, amount: true },
  });
  
  console.log(`Transactions AI_SEED trouvées : ${aiSeedTransactions.length}`);
  
  if (aiSeedTransactions.length > 0) {
    console.log('\nExemples :');
    aiSeedTransactions.slice(0, 5).forEach(t => {
      console.log(`  - ${t.label} (${t.amount}€)`);
    });
    
    if (!DRY_RUN) {
      const deleted = await prisma.transaction.deleteMany({
        where: { source: 'AI_SEED' },
      });
      console.log(`\n✅ ${deleted.count} transactions AI_SEED supprimées`);
      totalSuppressions += deleted.count;
    } else {
      console.log(`\n⚠️  ${aiSeedTransactions.length} transactions seraient supprimées`);
    }
  }
  
  // ============================================================================
  // ÉTAPE 2 : Supprimer les doublons
  // ============================================================================
  
  console.log('\n\n📋 ÉTAPE 2 : Doublons');
  console.log('═'.repeat(50));
  
  const transactions = await prisma.transaction.findMany({
    select: {
      id: true,
      label: true,
      amount: true,
      date: true,
      propertyId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  
  const grouped = new Map<string, typeof transactions>();
  
  for (const t of transactions) {
    const key = `${t.propertyId}|${t.label}|${t.amount}|${t.date.toISOString().split('T')[0]}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(t);
  }
  
  let doublonsCount = 0;
  const idsToDelete: string[] = [];
  
  for (const [key, duplicates] of grouped.entries()) {
    if (duplicates.length > 1) {
      doublonsCount++;
      
      // Garder la plus récente (première dans le tableau trié par createdAt desc)
      const toKeep = duplicates[0];
      const toDelete = duplicates.slice(1);
      
      console.log(`\n🔁 Groupe ${doublonsCount} : ${duplicates[0].label} (${duplicates[0].amount}€)`);
      console.log(`   ${duplicates.length} transactions, garder 1, supprimer ${toDelete.length}`);
      console.log(`   Garder : ${toKeep.id.slice(0, 8)}... (${toKeep.createdAt.toISOString()})`);
      
      toDelete.forEach(t => {
        console.log(`   Supprimer : ${t.id.slice(0, 8)}... (${t.createdAt.toISOString()})`);
        idsToDelete.push(t.id);
      });
    }
  }
  
  console.log(`\nGroupes de doublons : ${doublonsCount}`);
  console.log(`Transactions à supprimer : ${idsToDelete.length}`);
  
  if (idsToDelete.length > 0 && !DRY_RUN) {
    const deleted = await prisma.transaction.deleteMany({
      where: { id: { in: idsToDelete } },
    });
    console.log(`\n✅ ${deleted.count} doublons supprimés`);
    totalSuppressions += deleted.count;
  } else if (idsToDelete.length > 0) {
    console.log(`\n⚠️  ${idsToDelete.length} doublons seraient supprimés`);
  }
  
  // ============================================================================
  // ÉTAPE 3 : Supprimer les transactions sans accounting_month
  // ============================================================================
  
  console.log('\n\n📋 ÉTAPE 3 : Transactions sans accounting_month');
  console.log('═'.repeat(50));
  
  const sansAccountingMonth = await prisma.transaction.findMany({
    where: { 
      accounting_month: null,
      source: { not: 'AI_SEED' }  // Déjà supprimées en étape 1
    },
    select: { id: true, label: true, amount: true, source: true },
  });
  
  console.log(`Transactions sans accounting_month (hors AI_SEED) : ${sansAccountingMonth.length}`);
  
  if (sansAccountingMonth.length > 0) {
    console.log('\nExemples :');
    sansAccountingMonth.slice(0, 5).forEach(t => {
      console.log(`  - ${t.label} (${t.amount}€) - Source: ${t.source}`);
    });
    
    if (!DRY_RUN) {
      const deleted = await prisma.transaction.deleteMany({
        where: { 
          accounting_month: null,
          source: { not: 'AI_SEED' }
        },
      });
      console.log(`\n✅ ${deleted.count} transactions sans accounting_month supprimées`);
      totalSuppressions += deleted.count;
    } else {
      console.log(`\n⚠️  ${sansAccountingMonth.length} transactions seraient supprimées`);
    }
  }
  
  // ============================================================================
  // RÉSUMÉ
  // ============================================================================
  
  console.log('\n\n📊 RÉSUMÉ DU NETTOYAGE');
  console.log('═'.repeat(50));
  
  if (DRY_RUN) {
    console.log(`Total transactions qui SERAIENT supprimées : ${
      aiSeedTransactions.length + 
      idsToDelete.length + 
      sansAccountingMonth.length
    }`);
    console.log('\n💡 Pour effectuer le nettoyage, lancez :');
    console.log('   npx tsx scripts/nettoyer-transactions.ts --confirm');
  } else {
    console.log(`✅ Total transactions supprimées : ${totalSuppressions}`);
    
    const remaining = await prisma.transaction.count();
    console.log(`📊 Transactions restantes : ${remaining}`);
  }
  
  console.log('\n✨ Nettoyage terminé\n');
}

cleanTransactions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());


/**
 * Script d'analyse des transactions
 * Identifie les transactions en doublon, orphelines, ou problématiques
 * 
 * Execute: npx tsx scripts/analyser-transactions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeTransactions() {
  console.log('🔍 Analyse des transactions...\n');
  
  // 1. Statistiques générales
  console.log('📊 STATISTIQUES GÉNÉRALES');
  console.log('═'.repeat(50));
  
  const totalTransactions = await prisma.transaction.count();
  console.log(`Total transactions : ${totalTransactions}`);
  
  const transactionsByYear = await prisma.transaction.groupBy({
    by: ['accounting_month'],
    _count: true,
    orderBy: { accounting_month: 'desc' },
  });
  
  console.log('\nTransactions par mois comptable :');
  for (const group of transactionsByYear.slice(0, 20)) {
    console.log(`  ${group.accounting_month || 'NULL'} : ${group._count} transactions`);
  }
  
  // 2. Transactions sans catégorie
  console.log('\n\n🏷️  TRANSACTIONS SANS CATÉGORIE');
  console.log('═'.repeat(50));
  
  const sansCategorie = await prisma.transaction.count({
    where: { categoryId: null }
  });
  console.log(`Transactions sans catégorie : ${sansCategorie}`);
  
  if (sansCategorie > 0) {
    const examples = await prisma.transaction.findMany({
      where: { categoryId: null },
      take: 5,
      select: {
        id: true,
        label: true,
        amount: true,
        date: true,
        nature: true,
      },
    });
    console.log('\nExemples :');
    examples.forEach(t => {
      console.log(`  - ${t.label} (${t.amount}€) - Nature: ${t.nature || 'NULL'}`);
    });
  }
  
  // 3. Transactions sans bien (orphelines)
  console.log('\n\n🏚️  TRANSACTIONS ORPHELINES (sans bien)');
  console.log('═'.repeat(50));
  
  // propertyId est non-nullable, donc chercher les biens qui n'existent plus
  const allTransactions = await prisma.transaction.findMany({
    select: {
      id: true,
      propertyId: true,
      label: true,
      amount: true,
    },
  });
  
  const propertyIds = [...new Set(allTransactions.map(t => t.propertyId))];
  const existingProperties = await prisma.property.findMany({
    where: { id: { in: propertyIds } },
    select: { id: true },
  });
  
  const existingPropertyIds = new Set(existingProperties.map(p => p.id));
  const orphelines = allTransactions.filter(t => !existingPropertyIds.has(t.propertyId)).length;
  console.log(`Transactions orphelines : ${orphelines}`);
  
  if (orphelines > 0) {
    const examples = await prisma.transaction.findMany({
      where: { propertyId: null },
      take: 5,
      select: {
        id: true,
        label: true,
        amount: true,
        date: true,
      },
    });
    console.log('\nExemples :');
    examples.forEach(t => {
      console.log(`  - ${t.label} (${t.amount}€)`);
    });
  }
  
  // 4. Doublons potentiels (même label, montant, date, bien)
  console.log('\n\n🔁 DOUBLONS POTENTIELS');
  console.log('═'.repeat(50));
  
  const transactions = await prisma.transaction.findMany({
    select: {
      id: true,
      label: true,
      amount: true,
      date: true,
      propertyId: true,
      accounting_month: true,
    },
    orderBy: { date: 'desc' },
  });
  
  const duplicates: Array<{
    key: string;
    count: number;
    ids: string[];
    label: string;
    amount: number;
  }> = [];
  
  const grouped = new Map<string, { ids: string[]; label: string; amount: number }>();
  
  for (const t of transactions) {
    const key = `${t.propertyId}|${t.label}|${t.amount}|${t.date.toISOString().split('T')[0]}`;
    if (!grouped.has(key)) {
      grouped.set(key, { ids: [], label: t.label, amount: t.amount });
    }
    grouped.get(key)!.ids.push(t.id);
  }
  
  for (const [key, value] of grouped.entries()) {
    if (value.ids.length > 1) {
      duplicates.push({
        key,
        count: value.ids.length,
        ids: value.ids,
        label: value.label,
        amount: value.amount,
      });
    }
  }
  
  console.log(`Groupes de doublons : ${duplicates.length}`);
  console.log(`Total transactions en doublon : ${duplicates.reduce((sum, d) => sum + d.count, 0)}`);
  
  if (duplicates.length > 0) {
    console.log('\nTop 10 doublons :');
    duplicates.slice(0, 10).forEach(d => {
      console.log(`  - "${d.label}" (${d.amount}€) : ${d.count} fois`);
      console.log(`    IDs : ${d.ids.slice(0, 3).join(', ')}${d.ids.length > 3 ? '...' : ''}`);
    });
  }
  
  // 5. Transactions avec accounting_month NULL
  console.log('\n\n📅 TRANSACTIONS SANS MOIS COMPTABLE');
  console.log('═'.repeat(50));
  
  const sansMoisComptable = await prisma.transaction.count({
    where: { accounting_month: null }
  });
  console.log(`Transactions sans accounting_month : ${sansMoisComptable}`);
  
  // 6. Transactions automatiques vs manuelles
  console.log('\n\n🤖 TRANSACTIONS AUTO vs MANUELLES');
  console.log('═'.repeat(50));
  
  const auto = await prisma.transaction.count({
    where: { isAuto: true }
  });
  const manual = await prisma.transaction.count({
    where: { isAuto: false }
  });
  
  console.log(`Transactions automatiques : ${auto}`);
  console.log(`Transactions manuelles : ${manual}`);
  
  // 7. Transactions par source
  console.log('\n\n📥 TRANSACTIONS PAR SOURCE');
  console.log('═'.repeat(50));
  
  const bySources = await prisma.transaction.groupBy({
    by: ['source'],
    _count: true,
  });
  
  bySources.forEach(group => {
    console.log(`  ${group.source || 'NULL'} : ${group._count} transactions`);
  });
  
  // 8. Transactions série (parentTransactionId)
  console.log('\n\n🔗 TRANSACTIONS EN SÉRIE');
  console.log('═'.repeat(50));
  
  const enSerie = await prisma.transaction.count({
    where: { parentTransactionId: { not: null } }
  });
  const parents = await prisma.transaction.count({
    where: { 
      id: { 
        in: (await prisma.transaction.findMany({
          where: { parentTransactionId: { not: null } },
          select: { parentTransactionId: true },
          distinct: ['parentTransactionId'],
        })).map(t => t.parentTransactionId!)
      }
    }
  });
  
  console.log(`Transactions en série : ${enSerie}`);
  console.log(`Transactions parentes : ${parents}`);
  
  // 9. Résumé des problèmes détectés
  console.log('\n\n⚠️  RÉSUMÉ DES PROBLÈMES');
  console.log('═'.repeat(50));
  
  let problemCount = 0;
  
  if (sansCategorie > 0) {
    console.log(`❌ ${sansCategorie} transactions sans catégorie`);
    problemCount++;
  }
  
  if (orphelines > 0) {
    console.log(`❌ ${orphelines} transactions orphelines (sans bien)`);
    problemCount++;
  }
  
  if (duplicates.length > 0) {
    console.log(`❌ ${duplicates.length} groupes de doublons (${duplicates.reduce((sum, d) => sum + d.count, 0)} transactions)`);
    problemCount++;
  }
  
  if (sansMoisComptable > 0) {
    console.log(`⚠️  ${sansMoisComptable} transactions sans mois comptable`);
  }
  
  if (problemCount === 0) {
    console.log('✅ Aucun problème majeur détecté !');
  }
  
  console.log('\n✅ Analyse terminée\n');
}

analyzeTransactions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());


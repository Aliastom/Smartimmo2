/**
 * Script pour voir toutes les transactions
 * Execute: npx tsx scripts/voir-transactions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function viewTransactions() {
  console.log('📋 TOUTES VOS TRANSACTIONS\n');
  
  const transactions = await prisma.transaction.findMany({
    include: {
      Category: {
        select: { label: true, deductible: true, capitalizable: true }
      },
      Property: {
        select: { name: true }
      }
    },
    orderBy: { accounting_month: 'desc' },
  });
  
  console.log(`Total : ${transactions.length} transactions\n`);
  
  // Grouper par bien
  const byProperty = new Map<string, typeof transactions>();
  
  for (const t of transactions) {
    const propertyName = t.Property?.name || 'Sans bien';
    if (!byProperty.has(propertyName)) {
      byProperty.set(propertyName, []);
    }
    byProperty.get(propertyName)!.push(t);
  }
  
  // Afficher par bien
  for (const [propertyName, propertyTransactions] of byProperty.entries()) {
    console.log(`\n🏠 ${propertyName} (${propertyTransactions.length} transactions)`);
    console.log('═'.repeat(80));
    
    for (const t of propertyTransactions) {
      const sign = t.amount >= 0 ? '+' : '';
      const category = t.Category?.label || 'Sans catégorie';
      const deductible = t.Category?.deductible ? '✅ Déductible' : '❌ Non déductible';
      
      console.log(
        `${t.accounting_month?.padEnd(12) || 'NULL'.padEnd(12)} | ` +
        `${sign}${t.amount.toFixed(2).padStart(10)}€ | ` +
        `${t.label.slice(0, 40).padEnd(40)} | ` +
        `${category.padEnd(20)} | ` +
        `${deductible}`
      );
    }
    
    // Totaux par bien
    const recettes = propertyTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    
    const charges = propertyTransactions
      .filter(t => t.amount < 0 && t.Category?.deductible === true)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const chargesNonDed = propertyTransactions
      .filter(t => t.amount < 0 && t.Category?.deductible !== true)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    console.log('\n📊 TOTAUX :');
    console.log(`   Recettes : ${recettes.toFixed(2)}€`);
    console.log(`   Charges déductibles : ${charges.toFixed(2)}€`);
    console.log(`   Charges non déductibles : ${chargesNonDed.toFixed(2)}€`);
    console.log(`   Résultat fiscal : ${(recettes - charges).toFixed(2)}€`);
  }
  
  console.log('\n');
}

viewTransactions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());


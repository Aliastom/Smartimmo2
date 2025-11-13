/**
 * Script de migration : Corriger les accounting_month des transactions filles
 * 
 * Problème : Les transactions avec parentTransactionId (frais de gestion, etc.)
 * créées avant la correction peuvent avoir accounting_month = NULL
 * 
 * Solution : Copier l'accounting_month de la transaction mère
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Correction des accounting_month des transactions filles...\n');

  // Trouver toutes les transactions filles avec accounting_month NULL
  const childTransactions = await prisma.transaction.findMany({
    where: {
      parentTransactionId: { not: null },
      accounting_month: null,
    },
    select: {
      id: true,
      label: true,
      date: true,
      parentTransactionId: true,
    },
  });

  console.log(`📊 Trouvé ${childTransactions.length} transaction(s) fille(s) avec accounting_month NULL\n`);

  if (childTransactions.length === 0) {
    console.log('✅ Aucune correction nécessaire !');
    return;
  }

  let fixed = 0;
  let errors = 0;

  for (const child of childTransactions) {
    try {
      // Récupérer la transaction mère
      const parent = await prisma.transaction.findUnique({
        where: { id: child.parentTransactionId! },
        select: { accounting_month: true },
      });

      if (!parent) {
        console.log(`⚠️  Transaction mère introuvable pour ${child.id}`);
        errors++;
        continue;
      }

      let accountingMonth = parent.accounting_month;

      // Si la mère n'a pas non plus d'accounting_month, calculer depuis sa date
      if (!accountingMonth && child.date) {
        const d = new Date(child.date);
        accountingMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!accountingMonth) {
        console.log(`⚠️  Impossible de déterminer accounting_month pour ${child.id}`);
        errors++;
        continue;
      }

      // Mettre à jour la transaction fille
      await prisma.transaction.update({
        where: { id: child.id },
        data: { accounting_month: accountingMonth },
      });

      console.log(`✅ ${child.label?.substring(0, 50)} → ${accountingMonth}`);
      fixed++;
    } catch (error) {
      console.error(`❌ Erreur pour ${child.id}:`, error);
      errors++;
    }
  }

  console.log(`\n📊 Résumé :`);
  console.log(`   ✅ Corrigées : ${fixed}`);
  console.log(`   ❌ Erreurs : ${errors}`);
  console.log(`   📝 Total : ${childTransactions.length}\n`);
}

main()
  .catch((e) => {
    console.error('❌ Erreur fatale:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


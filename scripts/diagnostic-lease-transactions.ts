/**
 * Diagnostic : Cohérence historique transactions ↔ timeline bail
 *
 * Analyse les transactions de loyer existantes pour :
 * 1. leaseId renseigné
 * 2. accounting_month renseigné
 * 3. nature compatible loyer (RECETTE_LOYER, LOYER, ou contient LOYER)
 *
 * Exécuter : npx tsx scripts/diagnostic-lease-transactions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const RENT_NATURES = new Set(['RECETTE_LOYER', 'LOYER']);
function isRentNature(nature: string | null): boolean {
  if (!nature) return false;
  if (RENT_NATURES.has(nature)) return true;
  return nature.toUpperCase().includes('LOYER');
}

async function main() {
  console.log('═'.repeat(60));
  console.log('DIAGNOSTIC : Transactions de loyer ↔ Timeline bail');
  console.log('═'.repeat(60));

  const allTransactions = await prisma.transaction.findMany({
    select: {
      id: true,
      propertyId: true,
      leaseId: true,
      accounting_month: true,
      nature: true,
      amount: true,
      date: true,
      year: true,
      month: true,
      label: true,
    },
    orderBy: { date: 'desc' },
  });

  const total = allTransactions.length;
  const rentLike = allTransactions.filter((t) => t.amount > 0 && isRentNature(t.nature));
  const rentStrict = allTransactions.filter((t) => RENT_NATURES.has(t.nature ?? ''));

  // 1. Historique existant
  console.log('\n📊 1. HISTORIQUE EXISTANT (transactions de type loyer)');
  console.log('─'.repeat(50));

  const withLeaseId = rentLike.filter((t) => t.leaseId != null && t.leaseId !== '');
  const withAccountingMonth = rentLike.filter(
    (t) => t.accounting_month != null && /^\d{4}-\d{2}$/.test(t.accounting_month)
  );
  const withRentNature = rentLike.filter((t) => isRentNature(t.nature));

  const allThree = rentLike.filter(
    (t) =>
      t.leaseId &&
      t.accounting_month &&
      /^\d{4}-\d{2}$/.test(t.accounting_month) &&
      isRentNature(t.nature)
  );

  const missingLeaseId = rentLike.filter((t) => !t.leaseId || t.leaseId === '');
  const missingAccountingMonth = rentLike.filter(
    (t) => !t.accounting_month || !/^\d{4}-\d{2}$/.test(t.accounting_month ?? '')
  );

  console.log(`Total transactions (toutes)           : ${total}`);
  console.log(`Transactions type loyer (nature)      : ${rentLike.length} (nature RECETTE_LOYER/LOYER ou contient LOYER)`);
  console.log(`Transactions nature stricte           : ${rentStrict.length} (RECETTE_LOYER ou LOYER exact)`);
  console.log('');
  console.log(`✅ Avec leaseId renseigné             : ${withLeaseId.length} (${rentLike.length > 0 ? ((100 * withLeaseId.length) / rentLike.length).toFixed(1) : 0}%)`);
  console.log(`✅ Avec accounting_month renseigné    : ${withAccountingMonth.length} (${rentLike.length > 0 ? ((100 * withAccountingMonth.length) / rentLike.length).toFixed(1) : 0}%)`);
  console.log(`✅ Nature compatible loyer            : ${withRentNature.length} (100%)`);
  console.log(`✅ Les 3 champs OK (timeline ready)   : ${allThree.length}`);
  console.log('');
  console.log(`❌ Sans leaseId (à rattacher)         : ${missingLeaseId.length}`);
  console.log(`❌ Sans accounting_month (à compléter): ${missingAccountingMonth.length}`);

  if (missingLeaseId.length > 0) {
    console.log('\n  Exemples sans leaseId :');
    missingLeaseId.slice(0, 5).forEach((t) => {
      const acc = t.accounting_month || (t.year && t.month ? `${t.year}-${String(t.month).padStart(2, '0')}` : '—');
      console.log(`    - ${t.label?.substring(0, 40)} | ${t.amount}€ | ${t.date.toISOString().slice(0, 10)} | acc_month: ${acc} | prop: ${t.propertyId?.slice(0, 8)}`);
    });
  }

  if (missingAccountingMonth.length > 0 && missingAccountingMonth.length <= 20) {
    console.log('\n  Exemples sans accounting_month :');
    missingAccountingMonth.slice(0, 5).forEach((t) => {
      console.log(`    - ${t.label?.substring(0, 40)} | ${t.amount}€ | date: ${t.date.toISOString().slice(0, 10)} | leaseId: ${t.leaseId ? '✓' : '—'}`);
    });
  }

  // Détail par mois comptable
  const byMonth = new Map<string, number>();
  rentLike.forEach((t) => {
    const ym =
      t.accounting_month ??
      (t.year != null && t.month != null
        ? `${t.year}-${String(t.month).padStart(2, '0')}`
        : t.date
          ? `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`
          : null);
    if (ym) {
      byMonth.set(ym, (byMonth.get(ym) ?? 0) + 1);
    }
  });

  if (byMonth.size > 0) {
    console.log('\n  Répartition par mois (accounting_month ou date) :');
    [...byMonth.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 12)
      .forEach(([ym, count]) => {
        const withLease = rentLike.filter((t) => {
          const txYm =
            t.accounting_month ??
            (t.year != null && t.month != null ? `${t.year}-${String(t.month).padStart(2, '0')}` : null) ??
            (t.date ? `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}` : null);
          return txYm === ym && t.leaseId;
        }).length;
        console.log(`    ${ym} : ${count} tx (dont ${withLease} avec leaseId)`);
      });
  }

  console.log('\n✅ Diagnostic terminé.');
  console.log('   Voir docs/LEASE-TRANSACTIONS-DIAGNOSTIC.md pour le plan de rattrapage.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

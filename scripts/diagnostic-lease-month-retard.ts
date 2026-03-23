/**
 * Diagnostic concret : mois en retard malgré transactions liées
 *
 * Pour un mois donné (ex: septembre 2025) :
 * 1. Liste les transactions de loyer (nature, amount > 0)
 * 2. Affiche leaseId, accounting_month, date, nature
 * 3. Vérifie les transactions sans leaseId
 * 4. Vérifie les transactions avec leaseId mais accounting_month incorrect
 *
 * Usage : npx tsx scripts/diagnostic-lease-month-retard.ts [YYYY-MM]
 * Exemple : npx tsx scripts/diagnostic-lease-month-retard.ts 2025-09
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const RENT_NATURES = new Set(['RECETTE_LOYER', 'LOYER']);
function isRentNature(n: string | null): boolean {
  if (!n) return false;
  if (RENT_NATURES.has(n)) return true;
  return n.toUpperCase().includes('LOYER');
}

async function main() {
  const targetMonth = process.argv[2] || '2025-09';
  if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
    console.error('Usage: npx tsx scripts/diagnostic-lease-month-retard.ts [YYYY-MM]');
    process.exit(1);
  }

  const [year, month] = targetMonth.split('-').map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  console.log('═'.repeat(70));
  console.log(`DIAGNOSTIC : Mois ${targetMonth} (septembre 2025)`);
  console.log('═'.repeat(70));

  // 1. Toutes les transactions de loyer (amount > 0, nature loyer)
  const rentTxs = await prisma.transaction.findMany({
    where: {
      amount: { gt: 0 },
      OR: [
        { nature: 'RECETTE_LOYER' },
        { nature: 'LOYER' },
        { nature: { contains: 'LOYER', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      propertyId: true,
      leaseId: true,
      accounting_month: true,
      date: true,
      nature: true,
      amount: true,
      label: true,
      year: true,
      month: true,
    },
    orderBy: { date: 'desc' },
  });

  console.log(`\n📊 1. TOUTES les transactions type loyer (${rentTxs.length} total)`);
  console.log('─'.repeat(70));

  const forTargetMonth = rentTxs.filter((t) => {
    const acc = t.accounting_month;
    if (acc && acc === targetMonth) return true;
    if (t.year === year && t.month === month) return true;
    const d = new Date(t.date);
    const txYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return txYm === targetMonth;
  });

  const forTargetMonthByAcc = rentTxs.filter((t) => t.accounting_month === targetMonth);
  const forTargetMonthByDate = rentTxs.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  console.log(`\n  Transactions pour ${targetMonth} :`);
  console.log(`    - accounting_month = '${targetMonth}' : ${forTargetMonthByAcc.length}`);
  console.log(`    - date dans le mois : ${forTargetMonthByDate.length}`);
  console.log(`    - (acc_month OU year/month OU date) : ${forTargetMonth.length}`);

  if (forTargetMonth.length > 0) {
    console.log('\n  Détail des transactions pour ce mois :');
    for (const t of forTargetMonth.slice(0, 15)) {
      console.log(`    ┌─ ${t.label?.substring(0, 50)}`);
      console.log(`    │  id: ${t.id} | amount: ${t.amount}€`);
      console.log(`    │  leaseId: ${t.leaseId ?? 'NULL'}`);
      console.log(`    │  accounting_month: ${t.accounting_month ?? 'NULL'}`);
      console.log(`    │  date: ${t.date.toISOString().slice(0, 10)}`);
      console.log(`    │  nature: ${t.nature ?? 'NULL'}`);
      console.log(`    │  year/month: ${t.year ?? '—'}/${t.month ?? '—'}`);
      console.log(`    └─ propertyId: ${t.propertyId}`);
    }
    if (forTargetMonth.length > 15) {
      console.log(`    ... et ${forTargetMonth.length - 15} autres`);
    }
  }

  // 2. Transactions SANS leaseId (visibles en Finances mais pas dans la timeline)
  const sansLeaseId = rentTxs.filter((t) => !t.leaseId || t.leaseId === '');
  console.log(`\n📊 2. Transactions de loyer SANS leaseId (${sansLeaseId.length} total)`);
  console.log('─'.repeat(70));
  console.log('  Ces transactions apparaissent dans l\'écran Finances mais la timeline du bail');
  console.log('  ne les compte pas (filtre leaseId strict).');
  if (sansLeaseId.length > 0) {
    const forMonthSansLease = sansLeaseId.filter((t) => {
      const acc = t.accounting_month;
      if (acc === targetMonth) return true;
      if (t.year === year && t.month === month) return true;
      const d = new Date(t.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
    console.log(`  Pour ${targetMonth} spécifiquement : ${forMonthSansLease.length}`);
    forMonthSansLease.slice(0, 5).forEach((t) => {
      console.log(`    - ${t.label?.substring(0, 45)} | ${t.amount}€ | acc: ${t.accounting_month ?? 'NULL'} | date: ${t.date.toISOString().slice(0, 10)}`);
    });
  }

  // 3. Transactions AVEC leaseId mais accounting_month différent du mois attendu
  const avecLeaseId = rentTxs.filter((t) => t.leaseId && t.leaseId !== '');
  const leaseIdMauvaisAcc = avecLeaseId.filter((t) => {
    const acc = t.accounting_month;
    const d = new Date(t.date);
    const dateYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return acc && acc !== dateYm;
  });

  console.log(`\n📊 3. Transactions AVEC leaseId mais accounting_month ≠ date (${leaseIdMauvaisAcc.length})`);
  console.log('─'.repeat(70));
  if (leaseIdMauvaisAcc.length > 0) {
    leaseIdMauvaisAcc.slice(0, 10).forEach((t) => {
      const d = new Date(t.date);
      const dateYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      console.log(`  - ${t.label?.substring(0, 40)}`);
      console.log(`    leaseId: ${t.leaseId} | accounting_month: ${t.accounting_month} | date → ${dateYm}`);
    });
  }

  // 4. Par bail : quels baux ont des transactions pour ce mois (accounting_month ou date) ?
  const leasesWithTxs = await prisma.lease.findMany({
    where: {
      Transaction_Transaction_leaseIdToLease: {
        some: {
          amount: { gt: 0 },
          OR: [
            { accounting_month: targetMonth },
            { date: { gte: monthStart, lte: monthEnd } },
          ],
        },
      },
    },
    select: {
      id: true,
      propertyId: true,
      startDate: true,
      endDate: true,
      status: true,
      Transaction_Transaction_leaseIdToLease: {
        where: { amount: { gt: 0 } },
        select: {
          id: true,
          accounting_month: true,
          date: true,
          nature: true,
          amount: true,
          label: true,
        },
      },
    },
  });

  console.log(`\n📊 4. Baux ayant des transactions (par leaseId) pour période proche de ${targetMonth}`);
  console.log('─'.repeat(70));
  for (const lease of leasesWithTxs) {
    const txsForMonth = lease.Transaction_Transaction_leaseIdToLease.filter((t) => {
      if (t.accounting_month === targetMonth) return true;
      const d = new Date(t.date);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return ym === targetMonth;
    });
    if (txsForMonth.length === 0) continue;
    console.log(`\n  Bail ${lease.id.slice(0, 12)}... (${lease.status})`);
    console.log(`    Période: ${lease.startDate.toISOString().slice(0, 10)} → ${lease.endDate?.toISOString().slice(0, 10) ?? '—'}`);
    for (const t of txsForMonth) {
      console.log(`    → ${t.label?.substring(0, 40)} | acc: ${t.accounting_month ?? 'NULL'} | date: ${t.date.toISOString().slice(0, 10)} | ${t.amount}€`);
    }
  }

  // 5. Résumé pour le mois cible
  console.log('\n' + '═'.repeat(70));
  console.log('RÉSUMÉ POUR LA TIMELINE');
  console.log('═'.repeat(70));
  console.log(`La timeline utilise : leaseId + (accounting_month OU year/month OU date)`);
  console.log(`Mois cible : ${targetMonth}`);
  console.log(`Transactions avec accounting_month=${targetMonth} : ${forTargetMonthByAcc.length}`);
  console.log(`  - dont avec leaseId : ${forTargetMonthByAcc.filter((t) => t.leaseId).length}`);
  console.log(`  - dont SANS leaseId : ${forTargetMonthByAcc.filter((t) => !t.leaseId).length}`);
  console.log(`Transactions avec date dans le mois (mais pas acc_month=${targetMonth}) : ${forTargetMonthByDate.filter((t) => t.accounting_month !== targetMonth).length}`);
  console.log('  → Si accounting_month est différent, la timeline peut placer la tx au mauvais mois.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

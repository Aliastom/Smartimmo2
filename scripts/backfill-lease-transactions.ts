/**
 * Rattrapage : Rattacher les anciennes transactions de loyer à leur bail/mois
 *
 * - Complète leaseId quand un seul bail actif couvre le mois
 * - Complète accounting_month depuis year/month ou date
 *
 * Exécuter :
 *   npx tsx scripts/backfill-lease-transactions.ts --dry-run   # Simulation
 *   npx tsx scripts/backfill-lease-transactions.ts             # Application
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const RENT_NATURES = new Set(['RECETTE_LOYER', 'LOYER']);
function isRentNature(nature: string | null): boolean {
  if (!nature) return false;
  if (RENT_NATURES.has(nature)) return true;
  return nature.toUpperCase().includes('LOYER');
}

function getMonthFromTx(t: { accounting_month?: string | null; year?: number | null; month?: number | null; date: Date }): string | null {
  if (t.accounting_month && /^\d{4}-\d{2}$/.test(t.accounting_month)) return t.accounting_month;
  if (t.year != null && t.month != null && t.month >= 1 && t.month <= 12) {
    return `${t.year}-${String(t.month).padStart(2, '0')}`;
  }
  const d = t.date;
  if (d) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return null;
}

function monthToBounds(ym: string): { first: Date; last: Date } {
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  return { first, last };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('🔍 Mode DRY-RUN : aucune modification ne sera appliquée.\n');
  }

  const transactions = await prisma.transaction.findMany({
    where: { amount: { gt: 0 } },
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
  });

  const rentTxs = transactions.filter((t) => isRentNature(t.nature));
  const leases = await prisma.lease.findMany({
    where: { status: { in: ['ACTIF', 'ACTIVE', 'SIGNÉ', 'SIGNED'] } },
    select: {
      id: true,
      propertyId: true,
      startDate: true,
      endDate: true,
    },
  });

  let updatedLeaseId = 0;
  let updatedAccountingMonth = 0;
  let skippedAmbiguous = 0;
  let skippedNoLease = 0;
  const errors: string[] = [];

  for (const tx of rentTxs) {
    if (!tx.propertyId) continue;
    const propId = tx.propertyId;
    const ym = getMonthFromTx(tx);

    // 1. Compléter accounting_month si manquant
    if ((!tx.accounting_month || !/^\d{4}-\d{2}$/.test(tx.accounting_month)) && ym) {
      if (!dryRun) {
        try {
          await prisma.transaction.update({
            where: { id: tx.id },
            data: { accounting_month: ym },
          });
          updatedAccountingMonth++;
          console.log(`  accounting_month: ${tx.label?.substring(0, 35)} → ${ym}`);
        } catch (e) {
          errors.push(`accounting_month ${tx.id}: ${(e as Error).message}`);
        }
      } else {
        updatedAccountingMonth++;
        console.log(`  [DRY] accounting_month: ${tx.label?.substring(0, 35)} → ${ym}`);
      }
    }

    // 2. Compléter leaseId si manquant
    if ((!tx.leaseId || tx.leaseId === '') && ym) {
      const { first, last } = monthToBounds(ym);
      const coveringLeases = leases.filter((l) => {
        if (l.propertyId !== propId) return false;
        const start = new Date(l.startDate);
        const end = l.endDate ? new Date(l.endDate) : new Date(9999, 11, 31);
        return start <= first && end >= last;
      });

      if (coveringLeases.length === 0) {
        skippedNoLease++;
      } else if (coveringLeases.length > 1) {
        skippedAmbiguous++;
      } else {
        const leaseId = coveringLeases[0].id;
        if (!dryRun) {
          try {
            await prisma.transaction.update({
              where: { id: tx.id },
              data: { leaseId },
            });
            updatedLeaseId++;
            console.log(`  leaseId: ${tx.label?.substring(0, 35)} → bail ${leaseId.slice(0, 8)}…`);
          } catch (e) {
            errors.push(`leaseId ${tx.id}: ${(e as Error).message}`);
          }
        } else {
          updatedLeaseId++;
          console.log(`  [DRY] leaseId: ${tx.label?.substring(0, 35)} → bail ${leaseId.slice(0, 8)}…`);
        }
      }
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log('RÉSUMÉ');
  console.log('═'.repeat(50));
  console.log(`Transactions loyer analysées   : ${rentTxs.length}`);
  console.log(`accounting_month complétés     : ${updatedAccountingMonth}`);
  console.log(`leaseId rattachés              : ${updatedLeaseId}`);
  console.log(`Ignorées (aucun bail)          : ${skippedNoLease}`);
  console.log(`Ignorées (bail ambigu)         : ${skippedAmbiguous}`);
  if (errors.length > 0) {
    console.log(`Erreurs                       : ${errors.length}`);
    errors.forEach((e) => console.log(`  - ${e}`));
  }
  if (dryRun && (updatedLeaseId > 0 || updatedAccountingMonth > 0)) {
    console.log('\n⚠️  Relancez sans --dry-run pour appliquer les modifications.');
  }
  console.log('\n✅ Terminé. Lancez une sync (page /app?view=sync) pour mettre à jour IndexedDB.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

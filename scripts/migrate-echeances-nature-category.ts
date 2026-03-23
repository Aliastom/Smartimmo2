/**
 * Migration logique : peupler natureCode et defaultCategoryId sur EcheanceRecurrente.
 * Fallback : mapping type → nature, puis NatureDefault pour la catégorie.
 *
 * Usage :
 *   npx tsx scripts/migrate-echeances-nature-category.ts
 *
 * Ne supprime PAS le type ni le mapping existant.
 */

import { PrismaClient } from '@prisma/client';
import { resolveNatureCodeForEcheance } from '@/lib/echeances/echeanceTypeMigration';
import { getSuggestedCategoryId } from '@/utils/categoryUtils';

const prisma = new PrismaClient();

function toEcheanceLike(row: {
  id: string;
  propertyId: string | null;
  leaseId: string | null;
  label: string;
  type: string;
  periodicite: string;
  montant: any;
  recuperable: boolean;
  sens: string;
  startAt: Date;
  endAt: Date | null;
  isActive: boolean;
  natureCode?: string | null;
  defaultCategoryId?: string | null;
}) {
  return {
    ...row,
    montant: Number(row.montant),
    natureCode: row.natureCode ?? undefined,
    defaultCategoryId: row.defaultCategoryId ?? undefined,
  };
}

async function main() {
  console.log('🔄 Migration échéances : natureCode + defaultCategoryId');

  const rows = await prisma.echeanceRecurrente.findMany();

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const echeance = toEcheanceLike(row);

    let natureCode = echeance.natureCode?.trim() || null;
    if (!natureCode) {
      natureCode = resolveNatureCodeForEcheance(echeance);
    }

    let defaultCategoryId = echeance.defaultCategoryId?.trim() || null;
    if (!defaultCategoryId) {
      defaultCategoryId = await getSuggestedCategoryId(natureCode);
    }

    const needsUpdate =
      (row.natureCode !== natureCode) || (row.defaultCategoryId !== defaultCategoryId);

    if (!needsUpdate) {
      skipped++;
      continue;
    }

    await prisma.echeanceRecurrente.update({
      where: { id: row.id },
      data: {
        natureCode: natureCode || undefined,
        defaultCategoryId: defaultCategoryId || undefined,
      },
    });
    updated++;
    console.log(`  ✅ ${row.label} (${row.type}) → nature=${natureCode}, cat=${defaultCategoryId ?? '—'}`);
  }

  console.log(`\n✅ Migration terminée : ${updated} mises à jour, ${skipped} inchangées`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

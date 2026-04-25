import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

function deriveExerciseHint(
  tx: { year: number | null; accounting_month: string | null; date: Date } | null,
  doc: { uploadedAt: Date } | null,
  loan: { startDate: Date } | null,
): number | null {
  if (tx) {
    if (tx.year != null) return tx.year;
    const m = tx.accounting_month?.match(/^(\d{4})-/);
    if (m) return parseInt(m[1], 10);
    return tx.date.getUTCFullYear();
  }
  if (doc) return doc.uploadedAt.getUTCFullYear();
  if (loan) return loan.startDate.getUTCFullYear();
  return null;
}

function deriveEntityType(row: {
  transactionId: string | null;
  documentId: string | null;
  loanId: string | null;
}): 'transaction' | 'document' | 'loan' | 'inconnu' {
  if (row.transactionId) return 'transaction';
  if (row.documentId) return 'document';
  if (row.loanId) return 'loan';
  return 'inconnu';
}

/**
 * Liste des overrides LMNP (scope organisation).
 * Filtre exercice : lecture seule sur Transaction / Document / Loan pour résoudre les ids concernés (aucune écriture).
 */
export async function GET(request: NextRequest) {
  const authError = await protectAdminRoute();
  if (authError) return authError;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const orgId = user.organizationId;

  try {
    const { searchParams } = new URL(request.url);
    const exerciseYearRaw = searchParams.get('exerciseYear')?.trim();
    const entityType = searchParams.get('entityType')?.trim() || 'all';
    const lmnpBucket = searchParams.get('lmnpBucket')?.trim();
    const q = searchParams.get('q')?.trim();

    const where: Prisma.LmnpExportOverrideWhereInput = {
      organizationId: orgId,
    };

    const andParts: Prisma.LmnpExportOverrideWhereInput[] = [];

    if (lmnpBucket) {
      where.lmnpBucket = { contains: lmnpBucket, mode: 'insensitive' };
    }

    if (q) {
      andParts.push({
        OR: [
          { lmnpLabel: { contains: q, mode: 'insensitive' } },
          { lmnpBucket: { contains: q, mode: 'insensitive' } },
          { reason: { contains: q, mode: 'insensitive' } },
          { id: { contains: q, mode: 'insensitive' } },
          { transactionId: { contains: q, mode: 'insensitive' } },
          { documentId: { contains: q, mode: 'insensitive' } },
          { loanId: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    if (entityType === 'transaction') {
      where.transactionId = { not: null };
    } else if (entityType === 'document') {
      where.documentId = { not: null };
    } else if (entityType === 'loan') {
      where.loanId = { not: null };
    }

    const exerciseYear =
      exerciseYearRaw !== undefined && exerciseYearRaw !== ''
        ? parseInt(exerciseYearRaw, 10)
        : NaN;
    const hasExercise = !Number.isNaN(exerciseYear);

    if (hasExercise) {
      const yearStart = new Date(Date.UTC(exerciseYear, 0, 1));
      const yearEnd = new Date(Date.UTC(exerciseYear + 1, 0, 1));

      const [txRows, docRows, loanRows] = await Promise.all([
        prisma.transaction.findMany({
          where: {
            organizationId: orgId,
            OR: [
              { year: exerciseYear },
              { accounting_month: { startsWith: `${exerciseYear}-` } },
              { date: { gte: yearStart, lt: yearEnd } },
            ],
          },
          select: { id: true },
          take: 8000,
        }),
        prisma.document.findMany({
          where: {
            organizationId: orgId,
            uploadedAt: { gte: yearStart, lt: yearEnd },
          },
          select: { id: true },
          take: 8000,
        }),
        prisma.loan.findMany({
          where: {
            organizationId: orgId,
            startDate: { lt: yearEnd },
            OR: [{ endDate: null }, { endDate: { gte: yearStart } }],
          },
          select: { id: true },
          take: 2000,
        }),
      ]);
      const txIds = txRows.map((r) => r.id);
      const docIds = docRows.map((r) => r.id);
      const loanIds = loanRows.map((r) => r.id);

      const allowTx = entityType === 'all' || entityType === 'transaction';
      const allowDoc = entityType === 'all' || entityType === 'document';
      const allowLoan = entityType === 'all' || entityType === 'loan';

      const exerciseOr: Prisma.LmnpExportOverrideWhereInput[] = [];
      if (allowTx && txIds.length) exerciseOr.push({ transactionId: { in: txIds } });
      if (allowDoc && docIds.length) exerciseOr.push({ documentId: { in: docIds } });
      if (allowLoan && loanIds.length) exerciseOr.push({ loanId: { in: loanIds } });

      if (exerciseOr.length === 0) {
        const exerciseYears = await prisma.lmnpExportRun.groupBy({
          by: ['exerciseYear'],
          where: { organizationId: orgId },
          orderBy: { exerciseYear: 'desc' },
        });
        return NextResponse.json({
          success: true,
          data: [],
          meta: { exerciseYears: exerciseYears.map((e) => e.exerciseYear) },
        });
      }

      andParts.push({ OR: exerciseOr });
    }

    if (andParts.length) {
      where.AND = andParts;
    }

    const rows = await prisma.lmnpExportOverride.findMany({
      where,
      include: {
        Transaction: { select: { year: true, accounting_month: true, date: true } },
        Document: { select: { uploadedAt: true } },
        Loan: { select: { startDate: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const data = rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      transactionId: r.transactionId,
      documentId: r.documentId,
      loanId: r.loanId,
      entityType: deriveEntityType(r),
      lmnpBucket: r.lmnpBucket,
      lmnpLabel: r.lmnpLabel,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
      exerciseHint: deriveExerciseHint(r.Transaction, r.Document, r.Loan),
    }));

    const exerciseYears = await prisma.lmnpExportRun.groupBy({
      by: ['exerciseYear'],
      where: { organizationId: orgId },
      orderBy: { exerciseYear: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data,
      meta: { exerciseYears: exerciseYears.map((e) => e.exerciseYear) },
    });
  } catch (e) {
    console.error('[admin/lmnp/overrides GET]', e);
    return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 });
  }
}

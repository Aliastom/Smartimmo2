import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

type ResolutionStatus = 'non_resolu' | 'override_presente';

function buildOverridePresence(
  rows: { entityType: string; entityId: string }[],
  overrides: { transactionId: string | null; documentId: string | null; loanId: string | null }[],
): Map<string, boolean> {
  const tx = new Set<string>();
  const doc = new Set<string>();
  const loan = new Set<string>();
  for (const o of overrides) {
    if (o.transactionId) tx.add(o.transactionId);
    if (o.documentId) doc.add(o.documentId);
    if (o.loanId) loan.add(o.loanId);
  }
  const key = (entityType: string, entityId: string) => `${entityType}:${entityId}`;
  const map = new Map<string, boolean>();
  for (const r of rows) {
    let ok = false;
    if (r.entityType === 'transaction') ok = tx.has(r.entityId);
    else if (r.entityType === 'document') ok = doc.has(r.entityId);
    else if (r.entityType === 'loan') ok = loan.has(r.entityId);
    map.set(key(r.entityType, r.entityId), ok);
  }
  return map;
}

/**
 * Anomalies d'export LMNP + méta pour filtres (scope organisation).
 * Statut de résolution : présence d'un LmnpExportOverride sur la même entité (sans modifier l'anomalie).
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
    const exerciseYearRaw = searchParams.get('exerciseYear');
    const propertyId = searchParams.get('propertyId')?.trim() || undefined;
    const runId = searchParams.get('runId')?.trim() || undefined;
    const severityRaw = searchParams.get('severity')?.trim();

    const runWhere: Prisma.LmnpExportRunWhereInput = {
      organizationId: orgId,
    };
    if (exerciseYearRaw !== null && exerciseYearRaw !== '') {
      const y = parseInt(exerciseYearRaw, 10);
      if (!Number.isNaN(y)) runWhere.exerciseYear = y;
    }
    if (propertyId) runWhere.propertyId = propertyId;
    if (runId) runWhere.id = runId;

    const anomalyWhere: Prisma.LmnpExportAnomalyWhereInput = {
      Run: runWhere,
    };

    if (severityRaw === 'blocking' || severityRaw === 'warning') {
      anomalyWhere.severity = severityRaw;
    }

    const rows = await prisma.lmnpExportAnomaly.findMany({
      where: anomalyWhere,
      include: {
        Run: {
          select: {
            id: true,
            exerciseYear: true,
            propertyId: true,
            createdAt: true,
            Property: { select: { name: true } },
          },
        },
      },
      orderBy: [{ Run: { createdAt: 'desc' } }, { severity: 'desc' }],
      take: 500,
    });

    const txIds: string[] = [];
    const docIds: string[] = [];
    const loanIds: string[] = [];
    for (const r of rows) {
      if (r.entityType === 'transaction') txIds.push(r.entityId);
      else if (r.entityType === 'document') docIds.push(r.entityId);
      else if (r.entityType === 'loan') loanIds.push(r.entityId);
    }

    const orClause: Prisma.LmnpExportOverrideWhereInput[] = [];
    if (txIds.length) orClause.push({ transactionId: { in: txIds } });
    if (docIds.length) orClause.push({ documentId: { in: docIds } });
    if (loanIds.length) orClause.push({ loanId: { in: loanIds } });

    const overrides =
      orClause.length > 0
        ? await prisma.lmnpExportOverride.findMany({
            where: { organizationId: orgId, OR: orClause },
            select: { transactionId: true, documentId: true, loanId: true },
          })
        : [];

    const presence = buildOverridePresence(rows, overrides);

    const resolutionLabel = (entityType: string, entityId: string): ResolutionStatus =>
      presence.get(`${entityType}:${entityId}`) ? 'override_presente' : 'non_resolu';

    const data = rows.map((r) => ({
      id: r.id,
      runId: r.runId,
      entityType: r.entityType,
      entityId: r.entityId,
      severity: r.severity,
      message: r.message,
      resolutionStatus: resolutionLabel(r.entityType, r.entityId),
      run: {
        exerciseYear: r.Run.exerciseYear,
        propertyId: r.Run.propertyId,
        propertyName: r.Run.Property?.name ?? null,
        createdAt: r.Run.createdAt,
      },
    }));

    const [properties, exerciseYearRows, recentRuns] = await Promise.all([
      prisma.property.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 500,
      }),
      prisma.lmnpExportRun.groupBy({
        by: ['exerciseYear'],
        where: { organizationId: orgId },
        orderBy: { exerciseYear: 'desc' },
      }),
      prisma.lmnpExportRun.findMany({
        where: { organizationId: orgId },
        select: {
          id: true,
          exerciseYear: true,
          propertyId: true,
          createdAt: true,
          Property: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 80,
      }),
    ]);

    const exerciseYears = exerciseYearRows.map((e) => e.exerciseYear);

    const meta = {
      properties,
      exerciseYears,
      recentRuns: recentRuns.map((run) => ({
        id: run.id,
        label: `${run.exerciseYear} · ${run.Property?.name ?? run.propertyId} · ${run.createdAt.toISOString().slice(0, 10)}`,
      })),
    };

    return NextResponse.json({ success: true, data, meta });
  } catch (e) {
    console.error('[admin/lmnp/anomalies]', e);
    return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 });
  }
}

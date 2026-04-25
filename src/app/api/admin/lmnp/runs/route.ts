import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * Historique des runs d'export LMNP (liste sans manifeste complet — voir GET /runs/[id]).
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
    const propertyId = searchParams.get('propertyId')?.trim() || undefined;
    const status = searchParams.get('status')?.trim() || undefined;

    const where: Prisma.LmnpExportRunWhereInput = {
      organizationId: orgId,
    };

    if (exerciseYearRaw) {
      const y = parseInt(exerciseYearRaw, 10);
      if (!Number.isNaN(y)) where.exerciseYear = y;
    }
    if (propertyId) where.propertyId = propertyId;
    if (status) where.status = status;

    const rows = await prisma.lmnpExportRun.findMany({
      where,
      select: {
        id: true,
        organizationId: true,
        propertyId: true,
        exerciseYear: true,
        mappingVersion: true,
        status: true,
        coverageRate: true,
        anomalyCount: true,
        createdAt: true,
        createdByUserId: true,
        Property: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const data = rows.map((r) => ({
      runId: r.id,
      id: r.id,
      organizationId: r.organizationId,
      propertyId: r.propertyId,
      propertyName: r.Property?.name ?? null,
      exerciseYear: r.exerciseYear,
      mappingVersion: r.mappingVersion,
      status: r.status,
      coverageRate: r.coverageRate,
      anomalyCount: r.anomalyCount,
      createdAt: r.createdAt.toISOString(),
      createdByUserId: r.createdByUserId,
    }));

    const [properties, exerciseYears] = await Promise.all([
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
    ]);

    const statusValues = await prisma.lmnpExportRun.findMany({
      where: { organizationId: orgId },
      select: { status: true },
      distinct: ['status'],
      orderBy: { status: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data,
      meta: {
        properties,
        exerciseYears: exerciseYears.map((e) => e.exerciseYear),
        statuses: statusValues.map((s) => s.status).filter(Boolean),
      },
    });
  } catch (e) {
    console.error('[admin/lmnp/runs GET]', e);
    return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 });
  }
}

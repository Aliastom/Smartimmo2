import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';

export const dynamic = 'force-dynamic';

/**
 * Détail d'un run LMNP incluant le manifeste JSON (lecture admin).
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authError = await protectAdminRoute();
  if (authError) return authError;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const row = await prisma.lmnpExportRun.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        Property: { select: { name: true } },
        Anomalies: {
          select: {
            id: true,
            entityType: true,
            entityId: true,
            severity: true,
            message: true,
          },
          orderBy: { severity: 'desc' },
          take: 200,
        },
      },
    });

    if (!row) {
      return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    }

    let manifestParsed: unknown = null;
    try {
      manifestParsed = JSON.parse(row.manifestJson);
    } catch {
      manifestParsed = null;
    }

    return NextResponse.json({
      success: true,
      data: {
        runId: row.id,
        id: row.id,
        organizationId: row.organizationId,
        propertyId: row.propertyId,
        propertyName: row.Property?.name ?? null,
        exerciseYear: row.exerciseYear,
        mappingVersion: row.mappingVersion,
        status: row.status,
        coverageRate: row.coverageRate,
        anomalyCount: row.anomalyCount,
        createdAt: row.createdAt.toISOString(),
        createdByUserId: row.createdByUserId,
        manifestJson: row.manifestJson,
        manifestParsed,
        anomalies: row.Anomalies,
      },
    });
  } catch (e) {
    console.error('[admin/lmnp/runs/[id] GET]', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  anomalyId: z.string().min(1),
  lmnpBucket: z.string().min(1),
  lmnpLabel: z.string().min(1),
  reason: z.string().optional().nullable(),
});

/**
 * Crée ou met à jour un LmnpExportOverride à partir d'une anomalie (sans toucher à Transaction).
 */
export async function POST(request: NextRequest) {
  const authError = await protectAdminRoute();
  if (authError) return authError;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
  }

  const { anomalyId, lmnpBucket, lmnpLabel, reason } = parsed.data;
  const orgId = user.organizationId;

  try {
    const anomaly = await prisma.lmnpExportAnomaly.findUnique({
      where: { id: anomalyId },
      include: { Run: { select: { organizationId: true } } },
    });

    if (!anomaly || anomaly.Run.organizationId !== orgId) {
      return NextResponse.json({ error: 'Anomalie introuvable' }, { status: 404 });
    }

    const { entityType, entityId } = anomaly;

    const baseData = {
      organizationId: orgId,
      lmnpBucket,
      lmnpLabel,
      reason: reason ?? null,
    };

    if (entityType === 'transaction') {
      const existing = await prisma.lmnpExportOverride.findFirst({
        where: { organizationId: orgId, transactionId: entityId },
      });
      const row = existing
        ? await prisma.lmnpExportOverride.update({
            where: { id: existing.id },
            data: { lmnpBucket, lmnpLabel, reason: reason ?? null },
          })
        : await prisma.lmnpExportOverride.create({
            data: { ...baseData, transactionId: entityId },
          });
      return NextResponse.json({ success: true, data: row });
    }

    if (entityType === 'document') {
      const existing = await prisma.lmnpExportOverride.findFirst({
        where: { organizationId: orgId, documentId: entityId },
      });
      const row = existing
        ? await prisma.lmnpExportOverride.update({
            where: { id: existing.id },
            data: { lmnpBucket, lmnpLabel, reason: reason ?? null },
          })
        : await prisma.lmnpExportOverride.create({
            data: { ...baseData, documentId: entityId },
          });
      return NextResponse.json({ success: true, data: row });
    }

    if (entityType === 'loan') {
      const existing = await prisma.lmnpExportOverride.findFirst({
        where: { organizationId: orgId, loanId: entityId },
      });
      const row = existing
        ? await prisma.lmnpExportOverride.update({
            where: { id: existing.id },
            data: { lmnpBucket, lmnpLabel, reason: reason ?? null },
          })
        : await prisma.lmnpExportOverride.create({
            data: { ...baseData, loanId: entityId },
          });
      return NextResponse.json({ success: true, data: row });
    }

    return NextResponse.json(
      { error: `Type d'entité non pris en charge pour un override: ${entityType}` },
      { status: 400 },
    );
  } catch (e) {
    console.error('[admin/lmnp/overrides/from-anomaly]', e);
    return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 });
  }
}

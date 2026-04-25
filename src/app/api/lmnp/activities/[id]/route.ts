import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';

export const dynamic = 'force-dynamic';

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  siret: z.string().regex(/^\d{14}$/).optional(),
  fiscalRegime: z.enum(['micro_bic', 'reel_simplifie']).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const body = await request.json().catch(() => null);
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Payload invalide', details: parsed.error.flatten() }, { status: 400 });
    }
    const updated = await prisma.lmnpActivity.updateMany({
      where: { id: params.id, organizationId: user.organizationId },
      data: parsed.data,
    });
    if (updated.count === 0) {
      return NextResponse.json({ success: false, error: 'Activité introuvable' }, { status: 404 });
    }
    const activity = await prisma.lmnpActivity.findUnique({ where: { id: params.id } });
    return NextResponse.json({ success: true, data: activity });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('LmnpActivity_organizationId_siret_key')) {
      return NextResponse.json({ success: false, error: 'Ce SIRET existe déjà pour votre organisation' }, { status: 409 });
    }
    console.error('[LMNP activity PATCH]', error);
    return NextResponse.json({ success: false, error: 'Impossible de modifier l’activité LMNP' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const linkedCount = await prisma.property.count({
      where: { organizationId: user.organizationId, lmnpActivityId: params.id },
    });
    if (linkedCount > 0) {
      return NextResponse.json(
        {
          success: false,
          code: 'LMNP_ACTIVITY_HAS_PROPERTIES',
          error: 'Suppression impossible : des biens sont encore rattachés à cette activité.',
          linkedPropertiesCount: linkedCount,
        },
        { status: 409 },
      );
    }
    const deleted = await prisma.lmnpActivity.deleteMany({
      where: { id: params.id, organizationId: user.organizationId },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ success: false, error: 'Activité introuvable' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[LMNP activity DELETE]', error);
    return NextResponse.json({ success: false, error: 'Impossible de supprimer l’activité LMNP' }, { status: 500 });
  }
}

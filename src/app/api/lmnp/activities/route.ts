import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';

export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  name: z.string().min(1),
  siret: z.string().regex(/^\d{14}$/),
  fiscalRegime: z.enum(['micro_bic', 'reel_simplifie']),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const includeProperties = request.nextUrl.searchParams.get('includeProperties') === 'true';
    const activities = await prisma.lmnpActivity.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        organizationId: true,
        name: true,
        siret: true,
        fiscalRegime: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { Properties: true } },
        ...(includeProperties
          ? {
              Properties: {
                where: { isArchived: false },
                select: {
                  id: true,
                  name: true,
                  address: true,
                  postalCode: true,
                  city: true,
                  fiscalTypeId: true,
                  fiscalRegimeId: true,
                },
                orderBy: { name: 'asc' as const },
              },
            }
          : {}),
      },
    });
    return NextResponse.json({ success: true, data: activities });
  } catch (error) {
    console.error('[LMNP activities GET]', error);
    return NextResponse.json({ success: false, error: 'Impossible de charger les activités LMNP' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json().catch(() => null);
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Payload invalide', details: parsed.error.flatten() }, { status: 400 });
    }
    const created = await prisma.lmnpActivity.create({
      data: {
        organizationId: user.organizationId,
        name: parsed.data.name,
        siret: parsed.data.siret,
        fiscalRegime: parsed.data.fiscalRegime,
      },
    });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue';
    if (msg.includes('LmnpActivity_organizationId_siret_key')) {
      return NextResponse.json({ success: false, error: 'Ce SIRET existe déjà pour votre organisation' }, { status: 409 });
    }
    console.error('[LMNP activities POST]', error);
    return NextResponse.json({ success: false, error: 'Impossible de créer l’activité LMNP' }, { status: 500 });
  }
}

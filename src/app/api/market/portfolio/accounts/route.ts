/* eslint-disable @typescript-eslint/naming-convention -- Route handlers Next.js App Router (GET, POST) */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';

export const dynamic = 'force-dynamic';

function isAuthError(error: unknown): boolean {
  return error instanceof Error && error.message === 'Non authentifié';
}

const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['PEA', 'CTO', 'ASSURANCE_VIE', 'CRYPTO', 'AUTRE']),
  currency: z.string().min(1),
  inflationAnnualRate: z.number().finite().nullable().optional(),
  fiscalProfileId: z.string().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

function toApi(row: {
  id: string;
  organizationId: string;
  name: string;
  kind: string;
  currency: string;
  inflationAnnualRate: number | null;
  fiscalProfileId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    kind: row.kind,
    currency: row.currency,
    inflationAnnualRate: row.inflationAnnualRate,
    fiscalProfileId: row.fiscalProfileId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const rows = await prisma.portfolioAccount.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({ success: true, data: rows.map(toApi) });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[api/market/portfolio/accounts GET]', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des comptes portefeuille' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const raw = await request.json();
    const parsed = accountSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
    }
    const payload = parsed.data;
    const row = await prisma.portfolioAccount.upsert({
      where: { organizationId_id: { organizationId: user.organizationId, id: payload.id } },
      update: {
        name: payload.name,
        kind: payload.kind,
        currency: payload.currency,
        inflationAnnualRate: payload.inflationAnnualRate ?? null,
        fiscalProfileId: payload.fiscalProfileId ?? null,
        ...(payload.updatedAt ? { updatedAt: new Date(payload.updatedAt) } : {}),
      },
      create: {
        id: payload.id,
        organizationId: user.organizationId,
        name: payload.name,
        kind: payload.kind,
        currency: payload.currency,
        inflationAnnualRate: payload.inflationAnnualRate ?? null,
        fiscalProfileId: payload.fiscalProfileId ?? null,
        ...(payload.createdAt ? { createdAt: new Date(payload.createdAt) } : {}),
        ...(payload.updatedAt ? { updatedAt: new Date(payload.updatedAt) } : {}),
      },
    });
    return NextResponse.json({ success: true, data: toApi(row) }, { status: 201 });
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('[api/market/portfolio/accounts POST]', error);
    return NextResponse.json({ error: 'Erreur lors de la sauvegarde du compte portefeuille' }, { status: 500 });
  }
}

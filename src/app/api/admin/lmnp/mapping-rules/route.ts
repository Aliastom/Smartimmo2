import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import type { Prisma } from '@prisma/client';
import { lmnpRuleAdminInclude, toLmnpRuleAdminDto } from './_dto';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  exerciseYear: z.coerce.number().int().min(2000).max(2100),
  propertyId: z.string().optional(),
  natureCode: z.string().optional(),
  categoryId: z.string().optional(),
  lmnpBucket: z.string().min(1),
  lmnpLabel: z.string().min(1),
  priority: z.coerce.number().int().default(100),
  active: z.coerce.boolean().default(true),
  mappingVersion: z.string().min(1).default('1'),
});

function emptyToNull(s: string | undefined): string | null {
  if (s === undefined || s === null) return null;
  const t = s.trim();
  return t === '' ? null : t;
}

/**
 * Liste + méta (biens / catégories pour formulaires) — scope organisation.
 */
export async function GET(request: NextRequest) {
  const authError = await protectAdminRoute();
  if (authError) return authError;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const exerciseYearRaw = searchParams.get('exerciseYear');
    const activeRaw = searchParams.get('active');
    const natureCode = searchParams.get('natureCode')?.trim() || undefined;
    const mappingVersion = searchParams.get('mappingVersion')?.trim() || undefined;

    const where: Prisma.LmnpExportMappingRuleWhereInput = {
      organizationId: user.organizationId,
    };

    if (exerciseYearRaw !== null && exerciseYearRaw !== '') {
      const y = parseInt(exerciseYearRaw, 10);
      if (!Number.isNaN(y)) where.exerciseYear = y;
    }

    if (activeRaw === 'true') where.active = true;
    else if (activeRaw === 'false') where.active = false;

    if (natureCode) where.natureCode = natureCode;
    if (mappingVersion) where.mappingVersion = mappingVersion;

    const [rules, properties, categories, natures, popularNatureCodes] = await Promise.all([
      prisma.lmnpExportMappingRule.findMany({
        where,
        include: lmnpRuleAdminInclude,
        orderBy: [{ priority: 'asc' }, { natureCode: 'asc' }],
        take: 3000,
      }),
      prisma.property.findMany({
        where: { organizationId: user.organizationId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 500,
      }),
      prisma.category.findMany({
        select: { id: true, label: true, slug: true },
        orderBy: { label: 'asc' },
        take: 500,
      }),
      prisma.natureEntity.findMany({
        select: { code: true, label: true },
        orderBy: { label: 'asc' },
        take: 1500,
      }),
      prisma.transaction.groupBy({
        by: ['nature'],
        where: {
          organizationId: user.organizationId,
          nature: { not: null },
        },
        _count: { nature: true },
        orderBy: { _count: { nature: 'desc' } },
        take: 20,
      }),
    ]);

    const data = rules.map(toLmnpRuleAdminDto);

    return NextResponse.json({
      success: true,
      data,
      meta: {
        properties,
        categories,
        natures,
        popularNatureCodes: popularNatureCodes
          .map((x) => ({ code: x.nature }))
          .filter((x): x is { code: string } => typeof x.code === 'string' && x.code.length > 0),
      },
    });
  } catch (e) {
    console.error('[admin/lmnp/mapping-rules GET]', e);
    return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * Création d'une règle LMNP (scope organisation).
 */
export async function POST(request: NextRequest) {
  const authError = await protectAdminRoute();
  if (authError) return authError;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const orgId = user.organizationId;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
  }

  const propertyId = emptyToNull(parsed.data.propertyId);
  const natureCode = emptyToNull(parsed.data.natureCode);
  const categoryId = emptyToNull(parsed.data.categoryId);

  if (propertyId) {
    const p = await prisma.property.findFirst({ where: { id: propertyId, organizationId: orgId }, select: { id: true } });
    if (!p) {
      return NextResponse.json({ error: 'Bien introuvable pour cette organisation' }, { status: 400 });
    }
  }
  if (categoryId) {
    const c = await prisma.category.findFirst({ where: { id: categoryId }, select: { id: true } });
    if (!c) {
      return NextResponse.json({ error: 'Catégorie introuvable' }, { status: 400 });
    }
  }

  try {
    const existing = await prisma.lmnpExportMappingRule.findFirst({
      where: {
        organizationId: orgId,
        exerciseYear: parsed.data.exerciseYear,
        propertyId,
        natureCode,
        categoryId,
        lmnpBucket: parsed.data.lmnpBucket,
        lmnpLabel: parsed.data.lmnpLabel,
        mappingVersion: parsed.data.mappingVersion,
      },
      include: lmnpRuleAdminInclude,
    });
    if (existing) {
      return NextResponse.json({ success: true, skipped: true, data: toLmnpRuleAdminDto(existing) });
    }

    const row = await prisma.lmnpExportMappingRule.create({
      data: {
        organizationId: orgId,
        exerciseYear: parsed.data.exerciseYear,
        propertyId,
        natureCode,
        categoryId,
        lmnpBucket: parsed.data.lmnpBucket,
        lmnpLabel: parsed.data.lmnpLabel,
        priority: parsed.data.priority,
        active: parsed.data.active,
        mappingVersion: parsed.data.mappingVersion,
      },
      include: lmnpRuleAdminInclude,
    });
    return NextResponse.json({ success: true, data: toLmnpRuleAdminDto(row) });
  } catch (e) {
    console.error('[admin/lmnp/mapping-rules POST]', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

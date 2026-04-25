import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { lmnpRuleAdminInclude, toLmnpRuleAdminDto } from '../_dto';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  exerciseYear: z.coerce.number().int().min(2000).max(2100).optional(),
  propertyId: z.union([z.string(), z.null()]).optional(),
  natureCode: z.union([z.string(), z.null()]).optional(),
  categoryId: z.union([z.string(), z.null()]).optional(),
  lmnpBucket: z.string().min(1).optional(),
  lmnpLabel: z.string().min(1).optional(),
  priority: z.coerce.number().int().optional(),
  active: z.boolean().optional(),
  mappingVersion: z.string().min(1).optional(),
});

function emptyToNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

function hasKey(raw: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(raw, key);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authError = await protectAdminRoute();
  if (authError) return authError;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await context.params;
  const orgId = user.organizationId;

  const existing = await prisma.lmnpExportMappingRule.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Règle introuvable' }, { status: 404 });
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const data: Record<string, unknown> = {};

  if (hasKey(raw, 'exerciseYear') && d.exerciseYear !== undefined) {
    data.exerciseYear = d.exerciseYear;
  }
  if (hasKey(raw, 'propertyId')) {
    const propertyId = emptyToNull(d.propertyId);
    data.propertyId = propertyId;
    if (propertyId) {
      const p = await prisma.property.findFirst({ where: { id: propertyId, organizationId: orgId }, select: { id: true } });
      if (!p) {
        return NextResponse.json({ error: 'Bien introuvable pour cette organisation' }, { status: 400 });
      }
    }
  }
  if (hasKey(raw, 'natureCode')) {
    data.natureCode = emptyToNull(d.natureCode);
  }
  if (hasKey(raw, 'categoryId')) {
    const categoryId = emptyToNull(d.categoryId);
    data.categoryId = categoryId;
    if (categoryId) {
      const c = await prisma.category.findFirst({ where: { id: categoryId }, select: { id: true } });
      if (!c) {
        return NextResponse.json({ error: 'Catégorie introuvable' }, { status: 400 });
      }
    }
  }
  if (hasKey(raw, 'lmnpBucket') && d.lmnpBucket !== undefined) data.lmnpBucket = d.lmnpBucket;
  if (hasKey(raw, 'lmnpLabel') && d.lmnpLabel !== undefined) data.lmnpLabel = d.lmnpLabel;
  if (hasKey(raw, 'priority') && d.priority !== undefined) data.priority = d.priority;
  if (hasKey(raw, 'active') && d.active !== undefined) data.active = d.active;
  if (hasKey(raw, 'mappingVersion') && d.mappingVersion !== undefined) data.mappingVersion = d.mappingVersion;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 });
  }

  try {
    const updated = await prisma.lmnpExportMappingRule.update({
      where: { id },
      data: data as any,
      include: lmnpRuleAdminInclude,
    });
    return NextResponse.json({ success: true, data: toLmnpRuleAdminDto(updated) });
  } catch (e) {
    console.error('[admin/lmnp/mapping-rules PATCH]', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const authError = await protectAdminRoute();
  if (authError) return authError;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.lmnpExportMappingRule.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Règle introuvable' }, { status: 404 });
  }

  try {
    await prisma.lmnpExportMappingRule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[admin/lmnp/mapping-rules DELETE]', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

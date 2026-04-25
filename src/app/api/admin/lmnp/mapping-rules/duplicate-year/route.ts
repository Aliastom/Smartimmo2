import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  sourceYear: z.coerce.number().int().min(2000).max(2100),
  targetYear: z.coerce.number().int().min(2000).max(2100),
});

/**
 * Duplique les LmnpExportMappingRule d'un exercice vers un autre (même organisation).
 * Skip si une règle existe déjà sur la cible avec la même clé fonctionnelle :
 * propertyId, natureCode, categoryId, mappingVersion.
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

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
  }

  const { sourceYear, targetYear } = parsed.data;
  if (sourceYear === targetYear) {
    return NextResponse.json({ error: 'sourceYear et targetYear doivent être différents' }, { status: 400 });
  }

  const sourceRules = await prisma.lmnpExportMappingRule.findMany({
    where: { organizationId: orgId, exerciseYear: sourceYear },
    orderBy: [{ priority: 'asc' }, { id: 'asc' }],
  });

  const created: string[] = [];
  const skipped: { sourceRuleId: string; reason: string }[] = [];
  const errors: { sourceRuleId: string; message: string }[] = [];

  for (const r of sourceRules) {
    try {
      const existing = await prisma.lmnpExportMappingRule.findFirst({
        where: {
          organizationId: orgId,
          exerciseYear: targetYear,
          propertyId: r.propertyId,
          natureCode: r.natureCode,
          categoryId: r.categoryId,
          mappingVersion: r.mappingVersion,
        },
      });

      if (existing) {
        skipped.push({
          sourceRuleId: r.id,
          reason: `Règle déjà présente sur ${targetYear} pour la même combinaison (bien / nature / catégorie / version).`,
        });
        continue;
      }

      const row = await prisma.lmnpExportMappingRule.create({
        data: {
          organizationId: orgId,
          exerciseYear: targetYear,
          propertyId: r.propertyId,
          natureCode: r.natureCode,
          categoryId: r.categoryId,
          lmnpBucket: r.lmnpBucket,
          lmnpLabel: r.lmnpLabel,
          priority: r.priority,
          active: r.active,
          mappingVersion: r.mappingVersion,
        },
      });
      created.push(row.id);
    } catch (e) {
      errors.push({
        sourceRuleId: r.id,
        message: e instanceof Error ? e.message : 'Erreur inconnue',
      });
    }
  }

  return NextResponse.json({
    success: true,
    summary: {
      sourceYear,
      targetYear,
      sourceCount: sourceRules.length,
      createdCount: created.length,
      skippedCount: skipped.length,
      errorCount: errors.length,
    },
    createdIds: created,
    skipped,
    errors,
  });
}

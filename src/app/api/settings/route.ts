import { NextRequest, NextResponse } from 'next/server';
import { getSettingsByPrefix, setSetting, clearSettingsCache } from '@/lib/settings/appSettings';
import { z } from 'zod';

// Schema de validation pour SET
const setSettingSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  description: z.string().optional(),
});

/**
 * GET /api/settings?prefix=gestion.
 * Récupère tous les paramètres avec le préfixe donné
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get('prefix') || '';

    const settings = await getSettingsByPrefix(prefix);

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('[API Settings] Error fetching settings:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération des paramètres' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings
 * Met à jour (upsert) un paramètre avec validations pour les codes gestion
 * Body: { key, value, description? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    // Validation Zod
    const validatedData = setSettingSchema.parse(body);
    const { key, value, description } = validatedData;

    // Validations spécifiques pour les codes gestion
    const { prisma } = await import('@/lib/prisma');
    const { getSetting } = await import('@/lib/settings/appSettings');

    // Validation des natures
    if (key === 'gestion.codes.rent.nature' || key === 'gestion.codes.mgmt.nature') {
      const nature = await prisma.natureEntity.findUnique({
        where: { code: value as string },
      });

      if (!nature) {
        return NextResponse.json(
          {
            error: 'ValidationError',
            message: `Nature '${value}' introuvable dans la base de données.`,
          },
          { status: 422 }
        );
      }
    }

    // Validation des catégories (vérifier cohérence avec nature)
    if (key === 'gestion.codes.rent.Category' || key === 'gestion.codes.mgmt.Category') {
      const category = await prisma.category.findUnique({
        where: { slug: value as string },
      });

      if (!category) {
        return NextResponse.json(
          {
            error: 'ValidationError',
            message: `Catégorie '${value}' introuvable dans la base de données.`,
          },
          { status: 422 }
        );
      }

      // Vérifier la cohérence avec la nature associée
      const isRent = key.includes('.rent.');
      const natureKey = isRent ? 'gestion.codes.rent.nature' : 'gestion.codes.mgmt.nature';
      const natureCodeFallback = isRent ? 'RECETTE_LOYER' : 'DEPENSE_GESTION';
      const natureCode = await getSetting<string>(natureKey, natureCodeFallback);

      // Récupérer la nature avec ses règles (allowedType)
      const nature = await prisma.natureEntity.findUnique({
        where: { code: natureCode },
        include: {
          NatureRule: {
            select: { allowedType: true }
          }
        }
      });

      if (!nature) {
        return NextResponse.json(
          {
            error: 'ValidationError',
            message: `Nature '${natureCode}' introuvable. Veuillez d'abord sélectionner une nature valide.`,
          },
          { status: 422 }
        );
      }

      // Vérifier que la catégorie.type est dans les allowedType de la nature
      const allowedTypes = nature.NatureRule.map(r => r.allowedType);
      if (allowedTypes.length === 0) {
        return NextResponse.json(
          {
            error: 'ValidationError',
            message: `La nature '${natureCode}' n'a aucun type de catégorie compatible configuré. Veuillez configurer les règles dans /admin/natures-categories.`,
          },
          { status: 422 }
        );
      }

      if (!allowedTypes.includes(category.type)) {
        return NextResponse.json(
          {
            error: 'ValidationError',
            message: `La catégorie '${value}' (type: ${category.type}) n'est pas compatible avec la nature '${natureCode}'. Types autorisés : ${allowedTypes.join(', ')}.`,
          },
          { status: 422 }
        );
      }
    }

    // Upsert si toutes les validations passent
    await setSetting(key, value, description);

    return NextResponse.json({
      success: true,
      message: 'Paramètre mis à jour avec succès',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Données invalides', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[API Settings] Error updating setting:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la mise à jour du paramètre' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/clear-cache
 * Invalide le cache des settings
 */
export async function POST(request: NextRequest) {
  try {
    clearSettingsCache();

    return NextResponse.json({
      success: true,
      message: 'Cache invalidé avec succès',
    });
  } catch (error) {
    console.error('[API Settings] Error clearing cache:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\'invalidation du cache' },
      { status: 500 }
    );
  }
}



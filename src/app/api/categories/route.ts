import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/categories
 * Récupère la liste des catégories avec recherche, filtre par nature, et pagination
 * Query params:
 * - natureCode: filtre par nature (via le flow: INCOME/EXPENSE)
 * - search: recherche par label ou slug (ILIKE)
 * - limit: nombre de résultats (default 20)
 * - cursor: pagination cursor (optional)
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const natureCode = searchParams.get('natureCode');
    const limit = parseInt(searchParams.get('limit') || '20');
    const cursor = searchParams.get('cursor');

    // Construction de la requête
    const where: any = {
      actif: true, // Seules les catégories actives
    };

    // Filtrer par les types compatibles si un natureCode est fourni
    if (natureCode) {
      // Récupérer la nature avec ses règles (NatureRule)
      const nature = await prisma.natureEntity.findUnique({
        where: { code: natureCode },
        include: {
          NatureRule: {
            select: { allowedType: true }
          }
        }
      });

      if (nature && nature.NatureRule.length > 0) {
        // Filtrer les catégories dont le type est dans les allowedType
        const allowedTypes = nature.NatureRule.map(r => r.allowedType);
        where.type = { in: allowedTypes };
      } else {
        // Si aucune règle n'est trouvée, ne retourner aucune catégorie
        // (plutôt que toutes les catégories, ce qui pourrait être trompeur)
        where.type = { in: [] };
      }
    }

    // Recherche par label ou slug
    if (search) {
      where.OR = [
        { slug: { contains: search } },
        { label: { contains: search } },
      ];
    }

    // Requête avec cursor pagination
    const categories = await prisma.category.findMany({
      where,
      take: limit + 1, // +1 pour savoir s'il y a une page suivante
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      orderBy: {
        label: 'asc',
      },
      select: {
        id: true,
        slug: true,
        label: true,
        type: true,
      },
    });

    // Déterminer s'il y a une page suivante
    const hasNextPage = categories.length > limit;
    const items = hasNextPage ? categories.slice(0, limit) : categories;
    const nextCursor = hasNextPage ? items[items.length - 1].id : null;

    // Mapper slug → code pour cohérence avec l'interface
    const enrichedItems = items.map(cat => ({
      ...cat,
      code: cat.slug, // Utiliser le slug comme code
    }));

    return NextResponse.json({
      items: enrichedItems,
      nextCursor,
    });
  } catch (error) {
    console.error('[API Categories] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des catégories' },
      { status: 500 }
    );
  }
}

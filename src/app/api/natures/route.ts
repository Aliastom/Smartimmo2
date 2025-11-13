import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/natures
 * Récupère la liste des natures avec recherche et pagination
 * Query params:
 * - search: recherche par label ou code (ILIKE)
 * - limit: nombre de résultats (default 20)
 * - cursor: pagination cursor (optional)
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '20');
    const cursor = searchParams.get('cursor');

    // Construction de la requête avec recherche
    const where: any = {};
    
    if (search) {
      where.OR = [
        { code: { contains: search } },
        { label: { contains: search } },
      ];
    }

    // Requête avec cursor pagination
    const natures = await prisma.natureEntity.findMany({
      where,
      take: limit + 1, // +1 pour savoir s'il y a une page suivante
      ...(cursor && { 
        skip: 1, // Skip le cursor
        cursor: { code: cursor } 
      }),
      orderBy: {
        code: 'asc',
      },
      select: {
        code: true,
        label: true,
        flow: true,
      },
    });

    // Déterminer s'il y a une page suivante
    const hasNextPage = natures.length > limit;
    const items = hasNextPage ? natures.slice(0, limit) : natures;
    const nextCursor = hasNextPage ? items[items.length - 1].code : null;

    return NextResponse.json({
      items,
      nextCursor,
    });
  } catch (error) {
    console.error('[API Natures] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des natures' },
      { status: 500 }
    );
  }
}

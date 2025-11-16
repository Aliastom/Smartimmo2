import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const nature = searchParams.get('nature');

    // Construction des filtres
    const where: any = {
      actif: true
    };
    
    if (nature) {
      where.type = nature;
    }

    // Récupération des catégories
    const categories = await prisma.category.findMany({
      where,
      select: {
        id: true,
        slug: true,
        label: true,
        type: true,
        actif: true
      },
      orderBy: {
        label: 'asc'
      }
    });

    return NextResponse.json(categories);

  } catch (error) {
    console.error('Erreur lors de la récupération des catégories comptables:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des catégories comptables' },
      { status: 500 }
    );
  }
}

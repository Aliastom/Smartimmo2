import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const nature = searchParams.get('nature');

    if (!nature) {
      return NextResponse.json(
        { error: 'Nature parameter is required' },
        { status: 400 }
      );
    }

    // Récupérer les règles pour cette nature
    const rules = await prisma.natureRule.findMany({
      where: {
        natureCode: nature,
      },
      select: {
        allowedType: true,
      },
    });

    const allowedTypes = rules.map(rule => rule.allowedType);

    // Si aucune règle trouvée, retourner une réponse vide
    if (allowedTypes.length === 0) {
      return NextResponse.json({
        natureCode: nature,
        allowedCategories: [],
        defaultCategoryId: null,
        hasRules: false,
      });
    }

    // Récupérer les catégories autorisées
    const allowedCategories = await prisma.category.findMany({
      where: {
        type: { in: allowedTypes },
        actif: true,
      },
      select: {
        id: true,
        label: true,
        type: true,
      },
      orderBy: [
        { label: 'asc' },
      ],
    });

    // Récupérer la catégorie par défaut
    const defaultConfig = await prisma.natureDefault.findUnique({
      where: {
        natureCode: nature,
      },
      select: {
        defaultCategoryId: true,
      },
    });

    // Dédupliquer les catégories par ID et par label (au cas où il y aurait des doublons)
    const uniqueCategories = allowedCategories.filter((category, index, self) => 
      index === self.findIndex(c => c.id === category.id)
    );
    

    return NextResponse.json({
      natureCode: nature,
      allowedCategories: uniqueCategories,
      defaultCategoryId: defaultConfig?.defaultCategoryId || null,
      hasRules: true,
    });
  } catch (error) {
    console.error('Error fetching accounting mapping:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounting mapping', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

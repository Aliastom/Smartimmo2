import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // Vérifier que la catégorie existe
    const category = await prisma.category.findUnique({
      where: { id },
      select: { id: true, label: true, type: true }
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Catégorie non trouvée' },
        { status: 404 }
      );
    }

    // Compter les transactions utilisant cette catégorie
    const transactionsCount = await prisma.payment.count({
      where: { categoryId: id }
    });

    // Trouver les natures qui utilisent cette catégorie comme défaut
    const natureDefaults = await prisma.natureDefault.findMany({
      where: { defaultCategoryId: id },
      include: {
        nature: {
          select: { code: true, label: true }
        }
      }
    });

    const isDefaultFor = natureDefaults.map(nd => ({
      natureCode: nd.nature.code,
      natureLabel: nd.nature.label
    }));

    return NextResponse.json({
      Category: {
        id: category.id,
        label: category.label,
        type: category.type
      },
      transactionsCount,
      isDefaultFor,
      hasRefs: transactionsCount > 0 || isDefaultFor.length > 0
    });
  } catch (error: any) {
    console.error('Error checking category usage:', error);
    return NextResponse.json(
      { error: 'Failed to check category usage', details: error.message },
      { status: 500 }
    );
  }
}

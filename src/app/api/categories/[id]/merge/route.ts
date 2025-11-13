import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { targetCategoryId } = body;

    if (!targetCategoryId) {
      return NextResponse.json(
        { error: 'ID de la catégorie cible requis' },
        { status: 400 }
      );
    }

    // Vérifier que les deux catégories existent
    const [sourceCategory, targetCategory] = await Promise.all([
      prisma.category.findUnique({
        where: { id },
        select: { id: true, label: true, type: true, system: true }
      }),
      prisma.category.findUnique({
        where: { id: targetCategoryId },
        select: { id: true, label: true, type: true, actif: true }
      })
    ]);

    if (!sourceCategory) {
      return NextResponse.json(
        { error: 'Catégorie source non trouvée' },
        { status: 404 }
      );
    }

    if (!targetCategory) {
      return NextResponse.json(
        { error: 'Catégorie cible non trouvée' },
        { status: 404 }
      );
    }

    // Empêcher la fusion des catégories système critiques
    const protectedCategories = ['loyer', 'charges-locatives', 'depot-garantie-recu', 'depot-garantie-rendu', 'avoir-regularisation'];
    
    if (sourceCategory.system && protectedCategories.includes(sourceCategory.slug)) {
      return NextResponse.json(
        { error: 'Impossible de fusionner cette catégorie système critique' },
        { status: 403 }
      );
    }

    // Vérifier que les catégories ont le même type
    if (sourceCategory.type !== targetCategory.type) {
      return NextResponse.json(
        { error: 'Les catégories doivent avoir le même type pour être fusionnées' },
        { status: 400 }
      );
    }

    // Vérifier que la catégorie cible est active
    if (!targetCategory.actif) {
      return NextResponse.json(
        { error: 'La catégorie cible doit être active' },
        { status: 400 }
      );
    }

    // Utiliser une transaction pour s'assurer de la cohérence
    const result = await prisma.$transaction(async (tx) => {
      // Migrer les transactions
      const updatedTransactions = await tx.Payment.updateMany({
        where: { categoryId: id },
        data: { categoryId: targetCategoryId }
      });

      // Migrer les NatureDefault
      const updatedDefaults = await tx.natureDefault.updateMany({
        where: { defaultCategoryId: id },
        data: { defaultCategoryId: targetCategoryId }
      });

      // Archiver la catégorie source
      const archivedCategory = await tx.Category.update({
        where: { id },
        data: { actif: false }
      });

      return {
        updatedTransactions: updatedTransactions.count,
        updatedDefaults: updatedDefaults.count,
        archivedCategory
      };
    });

    return NextResponse.json({
      message: 'Fusion terminée avec succès',
      sourceCategory: {
        id: sourceCategory.id,
        label: sourceCategory.label
      },
      targetCategory: {
        id: targetCategory.id,
        label: targetCategory.label
      },
      migrations: {
        transactionsCount: result.updatedTransactions,
        defaultsCount: result.updatedDefaults
      }
    });
  } catch (error: any) {
    console.error('Error merging category:', error);
    return NextResponse.json(
      { error: 'Failed to merge category', details: error.message },
      { status: 500 }
    );
  }
}

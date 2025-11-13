import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { label, type, deductible, capitalizable, actif } = body;

    // Vérifier que la catégorie existe
    const existingCategory = await prisma.category.findUnique({
      where: { id },
      select: { id: true, label: true, type: true, system: true }
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: 'Catégorie non trouvée' },
        { status: 404 }
      );
    }

    // Empêcher la modification des catégories système critiques
    // Seules les catégories vraiment essentielles sont protégées
    const protectedCategories = ['loyer', 'charges-locatives', 'depot-garantie-recu', 'depot-garantie-rendu', 'avoir-regularisation'];
    
    if (existingCategory.system && protectedCategories.includes(existingCategory.slug)) {
      return NextResponse.json(
        { error: 'Impossible de modifier cette catégorie système critique' },
        { status: 403 }
      );
    }

    // Validation du type si fourni
    if (type && !['REVENU', 'DEPENSE', 'NON_DEFINI'].includes(type)) {
      return NextResponse.json(
        { error: 'Type invalide. Doit être REVENU, DEPENSE ou NON_DEFINI' },
        { status: 400 }
      );
    }

    // Préparer les données de mise à jour
    const updateData: any = {};
    if (label !== undefined) updateData.label = label;
    if (type !== undefined) updateData.type = type;
    if (deductible !== undefined) updateData.deductible = Boolean(deductible);
    if (capitalizable !== undefined) updateData.capitalizable = Boolean(capitalizable);
    if (actif !== undefined) updateData.actif = Boolean(actif);

    // Mettre à jour la catégorie
    const updatedCategory = await prisma.category.update({
      where: { id },
      data: updateData
    });

    // Si le type a changé, vérifier la compatibilité avec les natures par défaut
    const warnings: string[] = [];
    if (type && type !== existingCategory.type) {
      // Trouver les natures qui utilisent cette catégorie comme défaut
      const natureDefaults = await prisma.natureDefault.findMany({
        where: { defaultCategoryId: id },
        include: {
          nature: {
            select: { code: true, label: true }
          }
        }
      });

      // Vérifier la compatibilité pour chaque nature
      for (const natureDefault of natureDefaults) {
        const natureRules = await prisma.natureRule.findMany({
          where: { natureCode: natureDefault.natureCode },
          select: { allowedType: true }
        });

        const allowedTypes = natureRules.map(rule => rule.allowedType);
        
        if (!allowedTypes.includes(type)) {
          // La catégorie n'est plus compatible avec cette nature
          await prisma.natureDefault.update({
            where: { natureCode: natureDefault.natureCode },
            data: { defaultCategoryId: null }
          });

          warnings.push(
            `La catégorie par défaut pour "${natureDefault.nature.label}" a été supprimée car elle n'est plus compatible.`
          );
        }
      }
    }

    return NextResponse.json({
      category: updatedCategory,
      warnings
    });
  } catch (error: any) {
    console.error('Error updating category:', error);
    return NextResponse.json(
      { error: 'Failed to update category', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // Vérifier que la catégorie existe
    const category = await prisma.category.findUnique({
      where: { id },
      select: { id: true, label: true, system: true }
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Catégorie non trouvée' },
        { status: 404 }
      );
    }

    // Empêcher la suppression des catégories système critiques
    const protectedCategories = ['loyer', 'charges-locatives', 'depot-garantie-recu', 'depot-garantie-rendu', 'avoir-regularisation'];
    
    if (category.system && protectedCategories.includes(category.slug)) {
      return NextResponse.json(
        { error: 'Impossible de supprimer cette catégorie système critique' },
        { status: 403 }
      );
    }

    // Vérifier les références
    const transactionsCount = await prisma.payment.count({
      where: { categoryId: id }
    });

    const natureDefaultsCount = await prisma.natureDefault.count({
      where: { defaultCategoryId: id }
    });

    if (transactionsCount > 0 || natureDefaultsCount > 0) {
      return NextResponse.json(
        { 
          error: 'Impossible de supprimer une catégorie utilisée',
          details: {
            transactionsCount,
            natureDefaultsCount
          }
        },
        { status: 400 }
      );
    }

    // Supprimer définitivement la catégorie
    await prisma.category.delete({
      where: { id }
    });

    return NextResponse.json({ 
      message: 'Catégorie supprimée définitivement',
      Category: { id: category.id, label: category.label }
    });
  } catch (error: any) {
    console.error('Error deleting category:', error);
    return NextResponse.json(
      { error: 'Failed to delete category', details: error.message },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Empêcher l'archivage des catégories système critiques
    const protectedCategories = ['loyer', 'charges-locatives', 'depot-garantie-recu', 'depot-garantie-rendu', 'avoir-regularisation'];
    
    if (category.system && protectedCategories.includes(category.slug)) {
      return NextResponse.json(
        { error: 'Impossible d\'archiver cette catégorie système critique' },
        { status: 403 }
      );
    }

    // Archiver la catégorie (actif = false)
    const archivedCategory = await prisma.category.update({
      where: { id },
      data: { actif: false }
    });

    // Supprimer les références dans NatureDefault
    const updatedDefaults = await prisma.natureDefault.updateMany({
      where: { defaultCategoryId: id },
      data: { defaultCategoryId: null }
    });

    return NextResponse.json({
      category: archivedCategory,
      removedDefaultsCount: updatedDefaults.count,
      message: `Catégorie archivée. ${updatedDefaults.count} référence(s) par défaut supprimée(s).`
    });
  } catch (error: any) {
    console.error('Error archiving category:', error);
    return NextResponse.json(
      { error: 'Failed to archive category', details: error.message },
      { status: 500 }
    );
  }
}

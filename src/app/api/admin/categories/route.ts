import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    console.log('[CATEGORIES API] Récupération des catégories depuis la BDD...');
    
    // Récupérer les catégories
    const categories = await prisma.category.findMany({
      orderBy: { slug: 'asc' }
    });

    console.log(`[CATEGORIES API] ${categories.length} catégories trouvées`);

    // Transformer les données pour l'interface
    const transformedCategories = categories.map(category => ({
      id: category.id,
      key: category.slug,
      label: category.label,
      type: category.type,
      active: category.actif,
      deductible: category.deductible,
      capitalizable: category.capitalizable
    }));

    return NextResponse.json({
      success: true,
      data: transformedCategories
    });
  } catch (error) {
    console.error('[CATEGORIES API] Erreur:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du chargement des catégories' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const body = await request.json();
    console.log('[CATEGORIES API] Body reçu POST:', body);
    
    const { key, label, type, active = true, deductible = false, capitalizable = false } = body;

    console.log('[CATEGORIES API] Création catégorie:', { key, label, type, deductible, capitalizable });

    // Créer la catégorie
    const category = await prisma.category.create({
      data: {
        slug: key,
        label,
        type,
        actif: active,
        deductible: deductible === true,
        capitalizable: capitalizable === true
      }
    });

    console.log('[CATEGORIES API] Catégorie créée:', category);

    return NextResponse.json({
      success: true,
      data: { 
        key: category.slug, 
        label: category.label,
        deductible: category.deductible,
        capitalizable: category.capitalizable
      }
    });
  } catch (error) {
    console.error('[CATEGORIES API] Erreur création:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la création de la catégorie' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const body = await request.json();
    console.log('[CATEGORIES API] Body reçu:', body);
    
    const { key, label, type, active, deductible, capitalizable } = body;

    console.log('[CATEGORIES API] Modification catégorie:', { key, label, type, active, deductible, capitalizable });

    // Mettre à jour la catégorie
    const updated = await prisma.category.update({
      where: { slug: key },
      data: { 
        label, 
        type, 
        actif: active,
        deductible: deductible === true,  // Force boolean
        capitalizable: capitalizable === true  // Force boolean
      }
    });

    console.log('[CATEGORIES API] Catégorie mise à jour:', updated);

    return NextResponse.json({
      success: true,
      data: { 
        key, 
        label,
        deductible: updated.deductible,
        capitalizable: updated.capitalizable
      }
    });
  } catch (error) {
    console.error('[CATEGORIES API] Erreur modification:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la modification de la catégorie' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json(
        { success: false, error: 'Clé de catégorie manquante' },
        { status: 400 }
      );
    }

    console.log('[CATEGORIES API] Suppression catégorie:', key);

    // Supprimer la catégorie
    await prisma.category.delete({
      where: { slug: key }
    });

    return NextResponse.json({
      success: true,
      data: { key }
    });
  } catch (error) {
    console.error('[CATEGORIES API] Erreur suppression:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la suppression de la catégorie' },
      { status: 500 }
    );
  }
}
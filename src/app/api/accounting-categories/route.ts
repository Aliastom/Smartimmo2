import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const nature = searchParams.get('nature'); // Nature pour filtrer
    const activeOnly = searchParams.get('active') !== '0'; // Par défaut true

    const where: any = {};
    
    // Filtrer par nature compatible (priorité sur type)
    if (nature) {
      // Récupérer les types autorisés pour cette nature
      const rules = await prisma.natureRule.findMany({
        where: {
          natureCode: nature,
        },
        select: {
          allowedType: true,
        },
      });

      if (rules.length > 0) {
        const allowedTypes = rules.map(rule => rule.allowedType);
        where.type = { in: allowedTypes };
      } else {
        // Si aucune règle trouvée, retourner toutes les catégories actives (fallback)
        console.warn(`No rules found for nature: ${nature}`);
      }
    }
    // Sinon, filtrer par type si fourni
    else if (type) {
      where.type = type.toUpperCase();
    }
    
    // Filtrer par actif (par défaut oui)
    if (activeOnly) {
      where.actif = true;
    }

    // IMPORTANT: Exclure les catégories inactives si pas de filtre spécifique
    if (!type && !nature) {
      where.actif = true;
    }

    const categories = await prisma.category.findMany({
      where,
      select: {
        id: true,
        slug: true,
        label: true,
        type: true,
        deductible: true,
        capitalizable: true,
        actif: true,
      },
      orderBy: [
        { system: 'desc' }, // Catégories système en premier
        { type: 'asc' },    // Puis par type
        { label: 'asc' }    // Puis alphabétique
      ],
    });

    return NextResponse.json(categories);
  } catch (error: any) {
    console.error('Error fetching accounting categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounting categories', details: error.message },
      { status: 500 }
    );
  }
}


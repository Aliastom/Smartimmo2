import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('[NATURES API] Récupération des natures depuis la BDD...');
    
    // Récupérer les natures avec leurs règles et mappings
    const natures = await prisma.natureEntity.findMany({
      include: {
        NatureRule: {
          select: {
            allowedType: true
          }
        },
        NatureDefault: {
          include: {
            Category: {
              select: {
                id: true,
                slug: true,
                label: true,
                type: true
              }
            }
          }
        }
      },
      orderBy: { code: 'asc' }
    });

    console.log(`[NATURES API] ${natures.length} natures trouvées`);

    // Transformer les données pour l'interface
    const transformedNatures = natures.map(nature => ({
      key: nature.code,
      label: nature.label,
      flow: nature.flow || (nature.code.startsWith('RECETTE') ? 'INCOME' : 'EXPENSE'),
      active: true, // Par défaut actif
      compatibleTypes: nature.NatureRule.map(rule => rule.allowedType),
      defaultCategory: nature.NatureDefault?.defaultCategoryId || undefined
    }));

    return NextResponse.json({
      success: true,
      data: transformedNatures
    });
  } catch (error) {
    console.error('[NATURES API] Erreur:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du chargement des natures' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, label, flow, compatibleTypes, defaultCategory } = body;

    console.log('[NATURES API] Création nature:', { key, label, flow });

    // Créer la nature
    const nature = await prisma.natureEntity.create({
      data: {
        code: key,
        label,
        flow
      }
    });

    // Créer les règles de compatibilité
    if (compatibleTypes && compatibleTypes.length > 0) {
      await Promise.all(
        compatibleTypes.map((type: string) =>
          prisma.natureRule.create({
            data: {
              natureCode: key,
              allowedType: type
            }
          })
        )
      );
    }

    // Créer le mapping par défaut si fourni
    if (defaultCategory && defaultCategory !== '') {
      // Vérifier que la catégorie existe
      const categoryExists = await prisma.category.findUnique({
        where: { id: defaultCategory }
      });
      
      if (!categoryExists) {
        throw new Error(`Catégorie ${defaultCategory} introuvable`);
      }
      
      await prisma.natureDefault.create({
        data: {
          natureCode: key,
          defaultCategoryId: defaultCategory
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: { key: nature.code, label: nature.label }
    });
  } catch (error) {
    console.error('[NATURES API] Erreur création:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la création de la nature' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, label, flow, compatibleTypes, defaultCategory } = body;

    console.log('[NATURES API] Modification nature:', { key, label, flow });

    // Mettre à jour la nature
    await prisma.natureEntity.update({
      where: { code: key },
      data: { label, flow }
    });

    // Mettre à jour les règles de compatibilité
    if (compatibleTypes !== undefined) {
      // Supprimer les anciennes règles
      await prisma.natureRule.deleteMany({
        where: { natureCode: key }
      });

      // Créer les nouvelles règles
      if (compatibleTypes.length > 0) {
        await Promise.all(
          compatibleTypes.map((type: string) =>
            prisma.natureRule.create({
              data: {
                natureCode: key,
                allowedType: type
              }
            })
          )
        );
      }
    }

    // Mettre à jour le mapping par défaut
    if (defaultCategory !== undefined) {
      console.log('[NATURES API] Mise à jour defaultCategory:', { key, defaultCategory });
      
      // Convertir chaîne vide en null
      const categoryId = defaultCategory === '' ? null : defaultCategory;
      
      if (categoryId === null) {
        // Supprimer le mapping par défaut si null
        await prisma.natureDefault.deleteMany({
          where: { natureCode: key }
        });
        console.log('[NATURES API] Mapping par défaut supprimé');
      } else {
        // Vérifier que la catégorie existe
        const categoryExists = await prisma.category.findUnique({
          where: { id: categoryId }
        });
        
        if (!categoryExists) {
          throw new Error(`Catégorie ${categoryId} introuvable`);
        }
        
        await prisma.natureDefault.upsert({
          where: { natureCode: key },
          update: { defaultCategoryId: categoryId },
          create: { natureCode: key, defaultCategoryId: categoryId }
        });
        console.log('[NATURES API] Mapping par défaut enregistré');
      }
    }

    return NextResponse.json({
      success: true,
      data: { key, label }
    });
  } catch (error) {
    console.error('[NATURES API] Erreur modification:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la modification de la nature' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json(
        { success: false, error: 'Clé de nature manquante' },
        { status: 400 }
      );
    }

    console.log('[NATURES API] Suppression nature:', key);

    // Supprimer en cascade (les règles et mappings seront supprimés automatiquement)
    await prisma.natureEntity.delete({
      where: { code: key }
    });

    return NextResponse.json({
      success: true,
      data: { key }
    });
  } catch (error) {
    console.error('[NATURES API] Erreur suppression:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la suppression de la nature' },
      { status: 500 }
    );
  }
}
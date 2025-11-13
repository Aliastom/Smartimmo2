import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Types pour le mapping Nature ↔ Catégorie
export interface NatureMappingRule {
  allowedTypes: string[];
  defaultCategoryId?: string;
}

export interface NatureMappingRules {
  [natureKey: string]: NatureMappingRule;
}

// GET /api/admin/nature-mapping
export async function GET() {
  try {
    console.log('=== API NATURE MAPPING DEBUG ===');
    console.log('Prisma client disponible:', !!prisma);
    console.log('natureCategoryAllowed disponible:', !!prisma.natureCategoryAllowed);
    console.log('natureCategoryDefault disponible:', !!prisma.natureCategoryDefault);
    
    // Vérifier si les nouveaux modèles existent
    let allowedRules: any[] = [];
    let defaultRules: any[] = [];

    try {
      // Récupérer toutes les règles autorisées
      allowedRules = await prisma.natureCategoryAllowed.findMany({
        select: {
          natureKey: true,
          categoryType: true,
        },
      });

      // Récupérer toutes les catégories par défaut
      defaultRules = await prisma.natureCategoryDefault.findMany({
        select: {
          natureKey: true,
          defaultCategoryId: true,
        },
      });
      
      console.log('API Debug - Règles autorisées trouvées:', allowedRules.length);
      console.log('API Debug - Règles par défaut trouvées:', defaultRules.length);
      console.log('Première règle autorisée:', allowedRules[0]);
    } catch (modelError) {
      console.log('Modèles NatureCategory non disponibles, retour de règles vides');
      console.error('Erreur détaillée:', modelError);
      // Les modèles n'existent pas encore, retourner des règles vides
    }

    // Construire l'objet de règles
    const rules: NatureMappingRules = {};

    // Grouper les types autorisés par natureKey
    allowedRules.forEach(rule => {
      if (!rules[rule.natureKey]) {
        rules[rule.natureKey] = { allowedTypes: [] };
      }
      rules[rule.natureKey].allowedTypes.push(rule.categoryType);
    });

    // Ajouter les catégories par défaut
    defaultRules.forEach(rule => {
      if (rules[rule.natureKey]) {
        rules[rule.natureKey].defaultCategoryId = rule.defaultCategoryId;
      }
    });

    return NextResponse.json({ rules });
  } catch (error) {
    console.error('Erreur lors de la récupération du mapping Nature ↔ Catégorie:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du mapping' },
      { status: 500 }
    );
  }
}

// POST /api/admin/nature-mapping
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rules }: { rules: NatureMappingRules } = body;

    // Validation basique
    if (!rules || typeof rules !== 'object') {
      return NextResponse.json(
        { error: 'Format de règles invalide' },
        { status: 400 }
      );
    }

    // Vérifier si les modèles existent avant de faire la transaction
    try {
      // Vérifier d'abord si les modèles existent en testant une opération simple
      try {
        await prisma.natureCategoryAllowed.count();
        await prisma.natureCategoryDefault.count();
      } catch (countError) {
        throw new Error('Modèles non disponibles - client Prisma non mis à jour');
      }

      // Transaction pour assurer la cohérence
      await prisma.$transaction(async (tx) => {
        // Supprimer toutes les règles existantes
        await tx.natureCategoryAllowed.deleteMany({});
        await tx.natureCategoryDefault.deleteMany({});

        // Insérer les nouvelles règles
        for (const [natureKey, rule] of Object.entries(rules)) {
          // Insérer les types autorisés
          if (rule.allowedTypes && rule.allowedTypes.length > 0) {
            await tx.natureCategoryAllowed.createMany({
              data: rule.allowedTypes.map(categoryType => ({
                natureKey,
                categoryType,
              })),
            });
          }

          // Insérer la catégorie par défaut si définie
          if (rule.defaultCategoryId) {
            await tx.natureCategoryDefault.create({
              data: {
                natureKey,
                defaultCategoryId: rule.defaultCategoryId,
              },
            });
          }
        }
      });
    } catch (modelError) {
      console.error('Erreur lors de la sauvegarde - modèles non disponibles:', modelError);
      return NextResponse.json(
        { 
          error: 'Les modèles de mapping ne sont pas encore disponibles. Le serveur doit être redémarré pour prendre en compte les nouveaux modèles Prisma.',
          details: 'Redémarrez le serveur de développement avec "npm run dev"'
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la sauvegarde du mapping Nature ↔ Catégorie:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la sauvegarde du mapping' },
      { status: 500 }
    );
  }
}

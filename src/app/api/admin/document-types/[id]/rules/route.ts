import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PrismaClient } from '@prisma/client';
import { DocumentExtractionRuleSchema } from '@/types/document-types';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';



// GET /api/admin/document-types/[id]/rules - Récupérer les règles d'un type

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const { id } = params;

    const rules = await prisma.documentExtractionRule.findMany({
      where: { documentTypeId: id },
      orderBy: { priority: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    console.error('Error fetching rules:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération des règles' },
      { status: 500 }
    );
  }
}

// POST /api/admin/document-types/[id]/rules - Créer/Mettre à jour les règles
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const { id } = params;
    const body = await request.json();
    const { rules } = body;

    if (!Array.isArray(rules)) {
      return NextResponse.json(
        { success: false, error: 'Les règles doivent être un tableau' },
        { status: 400 }
      );
    }

    // Valider chaque règle
    const validatedRules = rules.map((rule: any) => 
      DocumentExtractionRuleSchema.parse(rule)
    );

    // Supprimer toutes les règles existantes
    await prisma.documentExtractionRule.deleteMany({
      where: { documentTypeId: id },
    });

    // Créer les nouvelles règles
    const createdRules = await Promise.all(
      validatedRules.map(rule =>
        prisma.documentExtractionRule.create({
          data: {
            documentTypeId: id,
            fieldName: rule.fieldName,
            pattern: rule.pattern,
            postProcess: rule.postProcess || null,
            priority: rule.priority,
          },
        })
      )
    );

    // Invalider le cache de configuration
    await invalidateConfigCache();

    return NextResponse.json({
      success: true,
      data: createdRules,
    });
  } catch (error) {
    console.error('Error saving rules:', error);
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Données invalides', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Erreur lors de la sauvegarde des règles' },
      { status: 500 }
    );
  }
}

// Fonction pour invalider le cache de configuration
async function invalidateConfigCache() {
  try {
    await prisma.appConfig.upsert({
      where: { key: 'document_config_version' },
      update: { 
        value: JSON.stringify({ version: Date.now() }),
        updatedAt: new Date(),
      },
      create: { 
        key: 'document_config_version',
        value: JSON.stringify({ version: Date.now() }),
        description: 'Version de la configuration des documents pour invalidation du cache',
      },
    });
  } catch (error) {
    console.error('Error invalidating config cache:', error);
  }
}

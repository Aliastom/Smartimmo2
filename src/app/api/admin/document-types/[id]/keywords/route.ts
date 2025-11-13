import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PrismaClient } from '@prisma/client';
import { DocumentKeywordSchema } from '@/types/document-types';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';



// GET /api/admin/document-types/[id]/keywords - Récupérer les mots-clés d'un type

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

    const keywords = await prisma.documentKeyword.findMany({
      where: { documentTypeId: id },
      orderBy: { keyword: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: keywords.map(k => ({
        id: k.id,
        keyword: k.keyword, // Le champ s'appelle keyword dans Prisma
        weight: k.weight,
        context: k.context,
      })),
    });
  } catch (error) {
    console.error('Error fetching keywords:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération des mots-clés' },
      { status: 500 }
    );
  }
}

// POST /api/admin/document-types/[id]/keywords - Créer/Mettre à jour les mots-clés
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
    const { keywords } = body;

    if (!Array.isArray(keywords)) {
      return NextResponse.json(
        { success: false, error: 'Les mots-clés doivent être un tableau' },
        { status: 400 }
      );
    }

    // Valider chaque mot-clé
    const validatedKeywords = keywords.map((keyword: any) => 
      DocumentKeywordSchema.parse(keyword)
    );

    // Supprimer tous les mots-clés existants
    await prisma.documentKeyword.deleteMany({
      where: { documentTypeId: id },
    });

    // Créer les nouveaux mots-clés
    const createdKeywords = await Promise.all(
      validatedKeywords.map(keyword =>
        prisma.documentKeyword.create({
          data: {
            documentTypeId: id,
            keyword: keyword.keyword, // Utiliser le champ keyword directement
            weight: keyword.weight,
            context: keyword.context || null,
          },
        })
      )
    );

    // Invalider le cache de configuration
    await invalidateConfigCache();

    return NextResponse.json({
      success: true,
      data: createdKeywords.map(k => ({
        id: k.id,
        keyword: k.keyword, // Le champ s'appelle keyword dans Prisma
        weight: k.weight,
        context: k.context,
      })),
    });
  } catch (error) {
    console.error('Error saving keywords:', error);
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Données invalides', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Erreur lors de la sauvegarde des mots-clés' },
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
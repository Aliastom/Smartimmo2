import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DocumentTypeSchema } from '@/types/document-types';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';

// GET /api/admin/document-types - Liste des types de documents avec métadonnées

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  // TODO: Ajouter protection authentification admin
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const documentTypes = await prisma.documentType.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        _count: {
          select: {
            DocumentKeyword: true,
            TypeSignal: true,
            DocumentExtractionRule: true,
          },
        },
      },
      orderBy: [
        { order: 'asc' },
        { label: 'asc' },
      ],
    });

    // Transformer les données pour éviter les erreurs React
    // Gérer le cas où la table est vide
    const transformedTypes = documentTypes.map(type => ({
      id: type.id,
      code: type.code,
      label: type.label,
      description: type.description,
      isActive: type.isActive,
      autoAssignThreshold: type.autoAssignThreshold,
      keywordsCount: type._count?.DocumentKeyword || 0,
      signalsCount: type._count?.TypeSignal || 0,
      rulesCount: type._count?.DocumentExtractionRule || 0,
      createdAt: type.createdAt.toISOString(),
      updatedAt: type.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: transformedTypes,
    });
  } catch (error) {
    console.error('Error fetching document types:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération des types de documents' },
      { status: 500 }
    );
  }
}

// POST /api/admin/document-types - Créer un nouveau type de document
export async function POST(request: NextRequest) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  // TODO: Ajouter protection authentification admin
  try {
    const body = await request.json();
    
    console.log('[API POST] 📥 Body reçu:', body);
    console.log('[API POST] 🤖 openTransaction dans body:', body.openTransaction);
    
    const validatedData = DocumentTypeSchema.parse(body);
    
    console.log('[API POST] ✅ Données validées:', validatedData);
    console.log('[API POST] 🤖 openTransaction validé:', validatedData.openTransaction);

    // Vérifier que le code n'existe pas déjà
    const existingType = await prisma.documentType.findUnique({
      where: { code: validatedData.code },
    });

    if (existingType) {
      return NextResponse.json(
        { success: false, error: 'Un type de document avec ce code existe déjà' },
        { status: 400 }
      );
    }

    const createData = {
      ...validatedData,
      id: undefined, // Laisse Prisma générer l'ID
      // Convertir les objets JSON en strings pour PostgreSQL
      defaultContexts: validatedData.defaultContexts ? JSON.stringify(validatedData.defaultContexts) : null,
      suggestionsConfig: validatedData.suggestionsConfig ? JSON.stringify(validatedData.suggestionsConfig) : null,
      flowLocks: validatedData.flowLocks ? JSON.stringify(validatedData.flowLocks) : null,
      metaSchema: validatedData.metaSchema ? JSON.stringify(validatedData.metaSchema) : null,
    };
    
    console.log('[API POST] 💾 Données à créer en DB:', createData);
    console.log('[API POST] 🤖 openTransaction final:', createData.openTransaction);
    
    const documentType = await prisma.documentType.create({
      data: createData,
      include: {
        _count: {
          select: {
            DocumentKeyword: true,
            TypeSignal: true,
            DocumentExtractionRule: true,
          },
        },
      },
    });

    // Invalider le cache de configuration
    await invalidateConfigCache();

    return NextResponse.json({
      success: true,
      data: documentType,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating document type:', error);
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Données invalides', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Erreur lors de la création du type de document' },
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
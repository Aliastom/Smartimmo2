import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PrismaClient } from '@prisma/client';
import { DocumentExtractionRuleSchema } from '@/types/admin-documents';



// GET /api/admin/document-types/[id]/extraction-rules - Liste des règles d'extraction d'un type

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Vérifier que le type existe
    const documentType = await prisma.documentType.findUnique({
      where: { id },
    });

    if (!documentType) {
      return NextResponse.json(
        { success: false, error: 'Type de document non trouvé' },
        { status: 404 }
      );
    }

    const extractionRules = await prisma.documentExtractionRule.findMany({
      where: { documentTypeId: id },
      orderBy: { priority: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: extractionRules,
    });
  } catch (error) {
    console.error('Error fetching extraction rules:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération des règles d\'extraction' },
      { status: 500 }
    );
  }
}

// POST /api/admin/document-types/[id]/extraction-rules - Créer une règle d'extraction
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    // Vérifier que le type existe
    const documentType = await prisma.documentType.findUnique({
      where: { id },
    });

    if (!documentType) {
      return NextResponse.json(
        { success: false, error: 'Type de document non trouvé' },
        { status: 404 }
      );
    }

    const validatedData = DocumentExtractionRuleSchema.parse({
      ...body,
      documentTypeId: id,
    });

    // Vérifier que la règle n'existe pas déjà pour ce type et ce champ
    const existingRule = await prisma.documentExtractionRule.findFirst({
      where: {
        documentTypeId: id,
        fieldName: validatedData.fieldName,
        pattern: validatedData.pattern,
      },
    });

    if (existingRule) {
      return NextResponse.json(
        { success: false, error: 'Cette règle d\'extraction existe déjà pour ce type et ce champ' },
        { status: 400 }
      );
    }

    // Valider que la regex est valide
    try {
      new RegExp(validatedData.pattern);
    } catch (regexError) {
      return NextResponse.json(
        { success: false, error: 'Pattern regex invalide' },
        { status: 400 }
      );
    }

    const extractionRule = await prisma.documentExtractionRule.create({
      data: {
        ...validatedData,
        id: undefined, // Laisse Prisma générer l'ID
      },
    });

    // Invalider le cache de configuration
    await invalidateConfigCache();

    return NextResponse.json({
      success: true,
      data: extractionRule,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating extraction rule:', error);
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Données invalides', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Erreur lors de la création de la règle d\'extraction' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/document-types/[id]/extraction-rules - Mettre à jour plusieurs règles d'extraction
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    // Vérifier que le type existe
    const documentType = await prisma.documentType.findUnique({
      where: { id },
    });

    if (!documentType) {
      return NextResponse.json(
        { success: false, error: 'Type de document non trouvé' },
        { status: 404 }
      );
    }

    const { extractionRules } = body;

    if (!Array.isArray(extractionRules)) {
      return NextResponse.json(
        { success: false, error: 'Les règles d\'extraction doivent être un tableau' },
        { status: 400 }
      );
    }

    // Valider toutes les règles d'extraction
    const validatedRules = extractionRules.map((rule: any) => {
      const validatedRule = DocumentExtractionRuleSchema.parse({
        ...rule,
        documentTypeId: id,
      });

      // Valider que la regex est valide
      try {
        new RegExp(validatedRule.pattern);
      } catch (regexError) {
        throw new Error(`Pattern regex invalide: ${validatedRule.pattern}`);
      }

      return validatedRule;
    });

    // Transaction pour mettre à jour toutes les règles d'extraction
    const result = await prisma.$transaction(async (tx) => {
      // Supprimer toutes les règles d'extraction existantes pour ce type
      await tx.documentExtractionRule.deleteMany({
        where: { documentTypeId: id },
      });

      // Créer les nouvelles règles d'extraction
      const newRules = await Promise.all(
        validatedRules.map((rule) =>
          tx.documentExtractionRule.create({
            data: {
              ...rule,
              id: undefined,
            },
          })
        )
      );

      return newRules;
    });

    // Invalider le cache de configuration
    await invalidateConfigCache();

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error updating extraction rules:', error);
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Données invalides', details: error.message },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes('Pattern regex invalide')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Erreur lors de la mise à jour des règles d\'extraction' },
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

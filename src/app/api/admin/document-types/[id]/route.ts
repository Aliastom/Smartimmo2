import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DocumentTypeSchema } from '@/types/document-types';

// GET /api/admin/document-types/[id] - Récupérer un type de document avec ses relations
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const documentType = await prisma.documentType.findUnique({
      where: { id },
      include: {
        DocumentKeyword: {
          orderBy: { keyword: 'asc' },
        },
        TypeSignal: {
          orderBy: { order: 'asc' },
        },
        DocumentExtractionRule: {
          orderBy: { priority: 'asc' },
        },
      },
    });

    if (!documentType) {
      return NextResponse.json(
        { success: false, error: 'Type de document non trouvé' },
        { status: 404 }
      );
    }

    // Parser les champs JSON stockés en String
    const parsedDocumentType = {
      ...documentType,
      defaultContexts: documentType.defaultContexts ? JSON.parse(documentType.defaultContexts) : null,
      suggestionsConfig: documentType.suggestionsConfig ? JSON.parse(documentType.suggestionsConfig) : null,
      flowLocks: documentType.flowLocks ? JSON.parse(documentType.flowLocks) : null,
      metaSchema: documentType.metaSchema ? JSON.parse(documentType.metaSchema) : null,
    };

    console.log('[API GET] 📤 Données envoyées au client:', {
      code: parsedDocumentType.code,
      openTransaction: parsedDocumentType.openTransaction
    });

    return NextResponse.json({
      success: true,
      data: parsedDocumentType,
    });
  } catch (error) {
    console.error('Error fetching document type:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération du type de document' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/document-types/[id] - Mettre à jour un type de document
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    
    console.log('[API PATCH] 📥 Body reçu:', body);
    console.log('[API PATCH] 🤖 openTransaction dans body:', body.openTransaction);
    
    const validatedData = DocumentTypeSchema.parse(body);
    
    console.log('[API PATCH] ✅ Données validées:', validatedData);
    console.log('[API PATCH] 🤖 openTransaction validé:', validatedData.openTransaction);

    // Vérifier que le type existe
    const existingType = await prisma.documentType.findUnique({
      where: { id },
    });

    if (!existingType) {
      return NextResponse.json(
        { success: false, error: 'Type de document non trouvé' },
        { status: 404 }
      );
    }

    // Vérifier que le code n'existe pas déjà (si modifié)
    if (validatedData.code !== existingType.code) {
      const codeExists = await prisma.documentType.findUnique({
        where: { code: validatedData.code },
      });

      if (codeExists) {
        return NextResponse.json(
          { success: false, error: 'Un type de document avec ce code existe déjà' },
          { status: 400 }
        );
      }
    }

    const updateData = {
      ...validatedData,
      id: undefined, // Ne pas modifier l'ID
      // Convertir les objets JSON en strings pour PostgreSQL
      defaultContexts: validatedData.defaultContexts ? JSON.stringify(validatedData.defaultContexts) : null,
      suggestionsConfig: validatedData.suggestionsConfig ? JSON.stringify(validatedData.suggestionsConfig) : null,
      flowLocks: validatedData.flowLocks ? JSON.stringify(validatedData.flowLocks) : null,
      metaSchema: validatedData.metaSchema ? JSON.stringify(validatedData.metaSchema) : null,
    };
    
    console.log('[API PATCH] 💾 Données à écrire en DB:', updateData);
    console.log('[API PATCH] 🤖 openTransaction final:', updateData.openTransaction);
    
    const documentType = await prisma.documentType.update({
      where: { id },
      data: updateData,
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
    });
  } catch (error) {
    console.error('Error updating document type:', error);
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Données invalides', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Erreur lors de la mise à jour du type de document' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/document-types/[id] - Supprimer un type de document
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Vérifier que le type existe
    const existingType = await prisma.documentType.findUnique({
      where: { id },
    });

    if (!existingType) {
      return NextResponse.json(
        { success: false, error: 'Type de document non trouvé' },
        { status: 404 }
      );
    }

    // Supprimer le type (cascade supprimera les relations)
    await prisma.documentType.delete({
      where: { id },
    });

    // Invalider le cache de configuration
    await invalidateConfigCache();

    return NextResponse.json({
      success: true,
      message: 'Type de document supprimé avec succès',
    });
  } catch (error) {
    console.error('Error deleting document type:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la suppression du type de document' },
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
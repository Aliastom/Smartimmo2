import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateDocumentTypeSchema = z.object({
  label: z.string().min(1, 'Label is required').optional(),
  icon: z.string().optional(),
  order: z.number().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentType = await prisma.documentType.findUnique({
      where: { id: params.id },
    });

    if (!documentType) {
      return NextResponse.json(
        { error: 'Document type not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(documentType);
  } catch (error) {
    console.error('Error fetching document type:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document type' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validatedData = updateDocumentTypeSchema.parse(body);

    // Vérifier que le type existe
    const existingType = await prisma.documentType.findUnique({
      where: { id: params.id },
    });

    if (!existingType) {
      return NextResponse.json(
        { error: 'Document type not found' },
        { status: 404 }
      );
    }

    // Empêcher la modification du code pour les types système
    if (existingType.isSystem && body.code) {
      return NextResponse.json(
        { error: 'Cannot modify code of system document types' },
        { status: 400 }
      );
    }

    const documentType = await prisma.documentType.update({
      where: { id: params.id },
      data: validatedData,
    });

    return NextResponse.json(documentType);
  } catch (error) {
    console.error('Error updating document type:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update document type' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Vérifier que le type existe
    const existingType = await prisma.documentType.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { Document: true }
        }
      }
    });

    if (!existingType) {
      return NextResponse.json(
        { error: 'Document type not found' },
        { status: 404 }
      );
    }

    // Interdire la suppression des types système
    if (existingType.isSystem) {
      return NextResponse.json(
        { 
          error: 'Cannot delete system document types',
          code: 'SYSTEM_TYPE_PROTECTED'
        },
        { status: 403 }
      );
    }

    // Vérifier s'il y a des documents qui référencent ce type
    if (existingType._count.Document > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete document type that is referenced by documents',
          code: 'DELETE_BLOCKED',
          documentsCount: existingType._count.Document
        },
        { status: 409 }
      );
    }

    // Soft delete : désactiver au lieu de supprimer physiquement
    const documentType = await prisma.documentType.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return NextResponse.json({ 
      message: 'Document type deactivated successfully',
      documentType
    });
  } catch (error) {
    console.error('Error deleting document type:', error);
    return NextResponse.json(
      { error: 'Failed to delete document type' },
      { status: 500 }
    );
  }
}

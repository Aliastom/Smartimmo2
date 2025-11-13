import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Vérifier que le type existe
    const documentType = await prisma.documentType.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { Document: true }
        }
      }
    });

    if (!documentType) {
      return NextResponse.json(
        { error: 'Document type not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      documentsCount: documentType._count.Document,
      isSystem: documentType.isSystem,
      isActive: documentType.isActive,
    });
  } catch (error) {
    console.error('Error fetching document type usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document type usage' },
      { status: 500 }
    );
  }
}


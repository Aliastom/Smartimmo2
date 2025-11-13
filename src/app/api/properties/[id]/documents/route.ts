import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const propertyId = params.id;
  console.log(`[API] GET /api/properties/${propertyId}/documents`);

  if (!propertyId) {
    return NextResponse.json({ error: 'Property ID is required' }, { status: 400 });
  }

  try {
    // Récupérer les documents liés à la propriété via DocumentLink
    const documents = await prisma.document.findMany({
      where: {
        DocumentLink: {
          some: {
            targetType: 'PROPERTY',
            targetId: propertyId
          }
        }
      },
      select: {
        id: true,
        fileName: true,
        mime: true,
        size: true,
        uploadedAt: true,
        status: true,
        DocumentType: {
          select: {
            id: true,
            label: true,
            code: true
          }
        },
        DocumentLink: {
          select: {
            targetType: true,
            targetId: true,
            role: true,
            entityName: true
          }
        }
      },
      orderBy: {
        uploadedAt: 'desc'
      }
    });

    console.log(`[API] Trouvé ${documents.length} documents liés à la propriété ${propertyId}`);
    return NextResponse.json({ documents });
  } catch (error) {
    console.error(`[API] Erreur lors de la récupération des documents liés à la propriété ${propertyId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch linked documents' }, { status: 500 });
  }
}

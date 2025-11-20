import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { propertyId: string; filename: string } }
) {
  try {
    const user = await requireAuth();
    const { propertyId, filename } = params;

    // Vérifier que la propriété existe et appartient à l'organisation
    const property = await prisma.property.findFirst({
      where: { 
        id: propertyId,
        organizationId: user.organizationId 
      },
      select: { id: true }
    });

    if (!property) {
      return NextResponse.json({ error: 'Propriété non trouvée' }, { status: 404 });
    }

    // Vérifier que la photo existe et appartient à la propriété
    const photo = await prisma.photo.findFirst({
      where: {
        propertyId,
        url: {
          contains: filename
        },
        organizationId: user.organizationId
      },
      select: { id: true, mime: true, fileName: true }
    });

    if (!photo) {
      return NextResponse.json({ error: 'Photo non trouvée' }, { status: 404 });
    }

    // Lire le fichier depuis /tmp
    const tempDir = join(tmpdir(), 'smartimmo', 'photos', propertyId);
    const filePath = join(tempDir, filename);

    try {
      const fileBuffer = await readFile(filePath);
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': photo.mime || 'image/jpeg',
          'Content-Disposition': `inline; filename="${photo.fileName}"`,
          'Content-Length': fileBuffer.length.toString(),
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch (error) {
      console.error('Error reading photo file:', error);
      return NextResponse.json({ error: 'Fichier photo introuvable' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error serving photo:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la photo' },
      { status: 500 }
    );
  }
}


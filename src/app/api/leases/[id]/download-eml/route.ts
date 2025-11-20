import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const leaseId = params.id;
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('file');

    if (!fileName) {
      return NextResponse.json({ error: 'Nom de fichier manquant' }, { status: 400 });
    }

    // Vérifier que le bail existe et appartient à l'organisation
    const lease = await prisma.lease.findUnique({
      where: { id: leaseId },
      select: { id: true, organizationId: true }
    });

    if (!lease) {
      return NextResponse.json({ error: 'Bail non trouvé' }, { status: 404 });
    }

    if (lease.organizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    // Lire le fichier depuis /tmp
    const tempDir = path.join(tmpdir(), 'smartimmo', 'leases');
    const filePath = path.join(tempDir, fileName);

    try {
      const fileBuffer = await readFile(filePath);
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'message/rfc822',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': fileBuffer.length.toString(),
        },
      });
    } catch (error) {
      console.error('Error reading EML file:', error);
      return NextResponse.json({ error: 'Fichier EML introuvable' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error downloading EML:', error);
    return NextResponse.json(
      { error: 'Erreur lors du téléchargement du fichier EML' },
      { status: 500 }
    );
  }
}


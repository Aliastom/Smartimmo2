import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; filename: string } }
) {
  try {
    const user = await requireAuth();
    const { id: paymentId, filename } = params;

    // Vérifier que le paiement existe et appartient à l'organisation
    const payment = await prisma.payment.findFirst({
      where: { 
        id: paymentId,
        organizationId: user.organizationId 
      },
      select: { id: true }
    });

    if (!payment) {
      return NextResponse.json({ error: 'Paiement non trouvé' }, { status: 404 });
    }

    // Vérifier que la pièce jointe existe et appartient au paiement
    const attachment = await prisma.paymentAttachment.findFirst({
      where: {
        paymentId,
        url: {
          contains: filename
        }
      },
      select: { id: true, mimeType: true, filename: true }
    });

    if (!attachment) {
      return NextResponse.json({ error: 'Pièce jointe non trouvée' }, { status: 404 });
    }

    // Lire le fichier depuis /tmp
    const tempDir = join(tmpdir(), 'smartimmo', 'payments', paymentId);
    const decodedFilename = decodeURIComponent(filename);
    const filePath = join(tempDir, decodedFilename);

    try {
      const fileBuffer = await readFile(filePath);
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': attachment.mimeType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${attachment.filename}"`,
          'Content-Length': fileBuffer.length.toString(),
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch (error) {
      console.error('Error reading attachment file:', error);
      return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error serving payment attachment:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la pièce jointe' },
      { status: 500 }
    );
  }
}


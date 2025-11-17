import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { getStorageService } from '@/services/storage.service';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

const replaceDocumentSchema = z.object({
  file: z.object({
    name: z.string().min(1, 'File name is required'),
    mime: z.string().min(1, 'MIME type is required'),
    size: z.number().positive('File size must be positive'),
    base64: z.string().min(1, 'File data is required'),
  }),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const body = await request.json();
    const validatedData = replaceDocumentSchema.parse(body);
    const { file } = validatedData;

    // Vérifier que le document existe
    const existingDocument = await prisma.document.findFirst({
      where: { id: params.id, organizationId },
      include: {
        DocumentType: {
          select: {
            id: true,
            code: true,
            label: true,
            icon: true,
          },
        },
        Property: {
          select: {
            id: true,
            name: true,
          },
        },
        Transaction: {
          select: {
            id: true,
            label: true,
          },
        },
        Lease: {
          select: {
            id: true,
            Tenant: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        Loan: {
          select: {
            id: true,
            bankName: true,
          },
        },
      },
    });

    if (!existingDocument) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Remplacer le fichier dans le stockage (local ou Supabase)
    const buffer = Buffer.from(file.base64, 'base64');
    const storageService = getStorageService();
    
    // Utiliser le bucketKey existant ou générer un nouveau
    let bucketKey: string;
    if (existingDocument.bucketKey) {
      // Normaliser l'ancien bucketKey si nécessaire
      bucketKey = storageService.normalizeBucketKey(
        existingDocument.bucketKey,
        existingDocument.id,
        file.name
      );
    } else {
      // Générer une nouvelle clé
      bucketKey = storageService.generateStorageKey(existingDocument.id, file.name);
    }
    
    // Upload avec upsert (écrase le fichier existant)
    await storageService.uploadWithKey(buffer, bucketKey, file.mime);

    // Mettre à jour le document
    const document = await prisma.document.update({
      where: { id: params.id },
      data: {
        fileName: file.name,
        mime: file.mime,
        size: buffer.length,
        bucketKey,
      },
      include: {
        DocumentType: {
          select: {
            id: true,
            code: true,
            label: true,
            icon: true,
          },
        },
        Property: {
          select: {
            id: true,
            name: true,
          },
        },
        Transaction: {
          select: {
            id: true,
            label: true,
          },
        },
        Lease: {
          select: {
            id: true,
            Tenant: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        Loan: {
          select: {
            id: true,
            bankName: true,
          },
        },
      },
    });

    return NextResponse.json(document);
  } catch (error) {
    console.error('Error replacing document:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to replace document' },
      { status: 500 }
    );
  }
}

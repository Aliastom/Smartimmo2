import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';

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
    const body = await request.json();
    const validatedData = replaceDocumentSchema.parse(body);
    const { file } = validatedData;

    // Vérifier que le document existe
    const existingDocument = await prisma.document.findUnique({
      where: { id: params.id },
      include: {
        DocumentType: {
          select: {
            id: true,
            code: true,
            label: true,
            icon: true,
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

    // Supprimer l'ancien fichier
    try {
      const oldFilePath = join(process.cwd(), 'public', existingDocument.url);
      await unlink(oldFilePath);
    } catch (error) {
      console.warn(`Failed to delete old file ${existingDocument.url}:`, error);
      // Continue même si l'ancien fichier n'existe pas
    }

    // Créer le nouveau fichier
    const buffer = Buffer.from(file.base64, 'base64');
    const fileName = `${Date.now()}-${file.name}`;
    const uploadDir = 'uploads/documents';
    const filePath = join(process.cwd(), 'public', uploadDir, fileName);
    const url = `/${uploadDir}/${fileName}`;

    // Créer le dossier s'il n'existe pas
    await writeFile(join(process.cwd(), 'public', uploadDir), '', { flag: 'a' }).catch(() => {});

    // Sauvegarder le fichier
    await writeFile(filePath, buffer);

    // Mettre à jour le document
    const document = await prisma.document.update({
      where: { id: params.id },
      data: {
        fileName: file.name,
        mime: file.mime,
        size: buffer.length,
        url,
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
        transaction: {
          select: {
            id: true,
            label: true,
          },
        },
        lease: {
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
        loan: {
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

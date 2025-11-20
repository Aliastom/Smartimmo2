import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/getCurrentUser';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

const photoUploadSchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  room: z.string().optional(),
  tag: z.string().optional(),
  file: z.object({
    name: z.string().min(1, 'File name is required'),
    mime: z.string().min(1, 'MIME type is required'),
    size: z.number().positive('File size must be positive'),
    base64: z.string().min(1, 'File data is required'),
  }),
  metadata: z.record(z.any()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const room = searchParams.get('room');
    const tag = searchParams.get('tag');
    const q = searchParams.get('q');

    // Construction du where
    const where: any = { organizationId };
    
    if (propertyId) where.propertyId = propertyId;
    if (room) where.room = room;
    if (tag) where.tag = tag;
    
    if (q) {
      where.OR = [
        { fileName: { contains: q, mode: 'insensitive' } },
        { room: { contains: q, mode: 'insensitive' } },
        { tag: { contains: q, mode: 'insensitive' } },
      ];
    }

    const photos = await prisma.photo.findMany({
      where,
      include: {
        Property: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'desc' },
        { fileName: 'asc' },
      ],
    });

    const total = photos.reduce((sum, photo) => sum + photo.size, 0);

    return NextResponse.json({
      items: photos,
      total,
      count: photos.length,
    });
  } catch (error) {
    console.error('Error fetching photos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch photos' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = photoUploadSchema.parse(body);

    const {
      propertyId,
      room,
      tag,
      file,
      metadata,
    } = validatedData;

    // Vérifier que la propriété existe
    const user = await requireAuth();
    const organizationId = user.organizationId;

    const property = await prisma.property.findFirst({
      where: { id: propertyId, organizationId },
    });

    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }

    // Vérifier la taille du fichier (10 Mo max)
    const sizeInBytes = (file.base64.length * 3) / 4;
    if (sizeInBytes > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: `File too large: ${file.name} (max 10 MB)` },
        { status: 400 }
      );
    }

    // Vérifier le type MIME (images seulement)
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];
    if (!allowedMimes.includes(file.mime)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.name}. Only images are allowed.` },
        { status: 400 }
      );
    }

    // Convertir base64 en buffer
    const base64Data = file.base64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `${timestamp}_${file.name}`;
    
    // Utiliser /tmp pour Vercel (lecture seule sur public/)
    const tempDir = join(tmpdir(), 'smartimmo', 'photos', propertyId);
    await mkdir(tempDir, { recursive: true });
    const filePath = join(tempDir, filename);
    
    // Sauvegarder le fichier
    await writeFile(filePath, buffer);

    // URL de l'API pour servir le fichier
    const url = `/api/photos/${propertyId}/file/${encodeURIComponent(filename)}`;

    // Créer l'entrée en DB
    const photo = await prisma.photo.create({
      data: {
        fileName: file.name,
        mime: file.mime,
        size: buffer.length,
        url,
        propertyId,
        organizationId,
        room,
        tag,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
      include: {
        Property: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(photo, { status: 201 });
  } catch (error) {
    console.error('Error uploading photo:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to upload photo' },
      { status: 500 }
    );
  }
}


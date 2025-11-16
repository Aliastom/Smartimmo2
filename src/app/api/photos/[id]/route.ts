import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { requireAuth } from '@/lib/auth/getCurrentUser';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;

    const photo = await prisma.photo.findFirst({
      where: { id: params.id, organizationId },
      include: {
        Property: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!photo) {
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(photo);
  } catch (error) {
    console.error('Error fetching photo:', error);
    return NextResponse.json(
      { error: 'Failed to fetch photo' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;

    const photo = await prisma.photo.findFirst({
      where: { id: params.id, organizationId },
    });

    if (!photo) {
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 }
      );
    }

    // Supprimer le fichier physique
    try {
      const filePath = join(process.cwd(), 'public', photo.url);
      await unlink(filePath);
    } catch (error) {
      console.warn(`Failed to delete file ${photo.url}:`, error);
      // Continue même si le fichier n'existe pas
    }

    // Supprimer de la DB
    await prisma.photo.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting photo:', error);
    return NextResponse.json(
      { error: 'Failed to delete photo' },
      { status: 500 }
    );
  }
}


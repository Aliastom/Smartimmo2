import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { getStorageService } from '@/services/storage.service';


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
      include: {
        Property: {
          select: {
            id: true
          }
        }
      }
    });

    if (!photo) {
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 }
      );
    }

    // Supprimer le fichier depuis Supabase Storage
    try {
      // Extraire la clé de stockage de l'URL
      // L'URL peut être soit une URL Supabase, soit une URL API
      let storageKey: string | null = null;
      
      if (photo.url.includes('supabase.co')) {
        // URL Supabase : extraire la clé depuis l'URL
        const urlParts = photo.url.split('/');
        const bucketIndex = urlParts.findIndex(part => part === 'storage' || part === 'v1');
        if (bucketIndex !== -1 && bucketIndex + 2 < urlParts.length) {
          storageKey = urlParts.slice(bucketIndex + 2).join('/');
        }
      } else if (photo.url.includes('/api/photos/files/')) {
        // Ancien format API : convertir en clé de stockage
        const urlParts = photo.url.split('/');
        const propertyIdIndex = urlParts.findIndex(part => part === 'files');
        if (propertyIdIndex !== -1 && propertyIdIndex + 2 < urlParts.length) {
          const propertyId = urlParts[propertyIdIndex + 1];
          const filename = decodeURIComponent(urlParts[propertyIdIndex + 2]);
          storageKey = `photos/${propertyId}/${filename}`;
        }
      }
      
      if (storageKey) {
        const storageService = getStorageService();
        await storageService.deleteDocument(storageKey);
      }
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


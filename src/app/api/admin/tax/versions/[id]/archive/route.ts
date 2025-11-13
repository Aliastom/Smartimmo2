/**
 * API Routes - Admin - Archiver une version fiscale
 * POST /api/admin/tax/versions/:id/archive
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/admin/tax/versions/:id/archive
 * Archiver une version fiscale
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Vérifier que la version existe
    const version = await prisma.fiscalVersion.findUnique({
      where: { id },
    });

    if (!version) {
      return NextResponse.json(
        { error: 'Version fiscale non trouvée' },
        { status: 404 }
      );
    }

    // Vérifier qu'il reste au moins une version publiée pour cette année
    const publishedCount = await prisma.fiscalVersion.count({
      where: {
        year: version.year,
        status: 'published',
      },
    });

    if (publishedCount === 1 && version.status === 'published') {
      return NextResponse.json(
        { error: 'Impossible d\'archiver la dernière version publiée de cette année' },
        { status: 403 }
      );
    }

    // Archiver la version
    const archivedVersion = await prisma.fiscalVersion.update({
      where: { id },
      data: {
        status: 'archived',
      },
      include: {
        params: true,
      },
    });

    return NextResponse.json(archivedVersion);
  } catch (error: any) {
    console.error('Error archiving fiscal version:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'archivage de la version fiscale', details: error.message },
      { status: 500 }
    );
  }
}


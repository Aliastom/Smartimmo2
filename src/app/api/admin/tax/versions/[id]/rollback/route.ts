/**
 * API Routes - Admin - Rollback une version fiscale
 * POST /api/admin/tax/versions/:id/rollback
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/admin/tax/versions/:id/rollback
 * Restaurer une version archivée (la remettre en "published")
 * 
 * Body: {
 *   validatedBy: string  // Nom de l'admin qui valide le rollback
 * }
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const { validatedBy } = body;

    if (!validatedBy) {
      return NextResponse.json(
        { error: 'Le champ "validatedBy" est requis' },
        { status: 400 }
      );
    }

    // Vérifier que la version existe et est archivée
    const version = await prisma.fiscalVersion.findUnique({
      where: { id },
      include: { params: true },
    });

    if (!version) {
      return NextResponse.json(
        { error: 'Version fiscale non trouvée' },
        { status: 404 }
      );
    }

    if (version.status !== 'archived') {
      return NextResponse.json(
        { error: 'Seules les versions archivées peuvent être restaurées' },
        { status: 403 }
      );
    }

    // Archiver les versions publiées de la même année
    await prisma.fiscalVersion.updateMany({
      where: {
        year: version.year,
        status: 'published',
      },
      data: {
        status: 'archived',
      },
    });

    // Restaurer la version
    const restoredVersion = await prisma.fiscalVersion.update({
      where: { id },
      data: {
        status: 'published',
        validatedBy,
      },
      include: {
        params: true,
      },
    });

    return NextResponse.json(restoredVersion);
  } catch (error: any) {
    console.error('Error rolling back fiscal version:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la restauration de la version fiscale', details: error.message },
      { status: 500 }
    );
  }
}


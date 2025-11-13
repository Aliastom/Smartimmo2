/**
 * API Routes - Admin - Version fiscale par ID
 * PATCH  /api/admin/tax/versions/:id - Mettre à jour une version draft
 * DELETE /api/admin/tax/versions/:id - Supprimer une version draft
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';

/**
 * PATCH /api/admin/tax/versions/:id
 * Mettre à jour une version fiscale (uniquement en status "draft")
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const { id } = params;
    const body = await req.json();

    // Vérifier que la version existe et est en draft
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

    // Empêcher la modification des versions archivées uniquement
    if (version.status === 'archived') {
      return NextResponse.json(
        { error: 'Les versions archivées ne peuvent pas être modifiées' },
        { status: 403 }
      );
    }

    // Mettre à jour la version
    const updatedVersion = await prisma.fiscalVersion.update({
      where: { id },
      data: {
        source: body.source ?? version.source,
        notes: body.notes ?? version.notes,
        params: body.jsonData
          ? {
              upsert: {
                create: {
                  jsonData: body.jsonData,
                  overrides: body.overrides || null,
                },
                update: {
                  jsonData: body.jsonData,
                  overrides: body.overrides || version.params?.overrides,
                },
              },
            }
          : undefined,
      },
      include: {
        params: true,
      },
    });

    return NextResponse.json(updatedVersion);
  } catch (error: any) {
    console.error('Error updating fiscal version:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la version fiscale', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/tax/versions/:id
 * Supprimer une version fiscale (uniquement en status "draft")
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const { id } = params;

    // Vérifier que la version existe et est en draft
    const version = await prisma.fiscalVersion.findUnique({
      where: { id },
    });

    if (!version) {
      return NextResponse.json(
        { error: 'Version fiscale non trouvée' },
        { status: 404 }
      );
    }

    if (version.status !== 'draft') {
      return NextResponse.json(
        { error: 'Seules les versions en brouillon peuvent être supprimées' },
        { status: 403 }
      );
    }

    // Supprimer la version (cascade sur params)
    await prisma.fiscalVersion.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Version supprimée avec succès' });
  } catch (error: any) {
    console.error('Error deleting fiscal version:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la version fiscale', details: error.message },
      { status: 500 }
    );
  }
}


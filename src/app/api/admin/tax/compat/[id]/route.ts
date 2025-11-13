/**
 * API Routes - Admin - Compatibilité fiscale par ID
 * PATCH  /api/admin/tax/compat/:id  - Mettre à jour une compatibilité
 * DELETE /api/admin/tax/compat/:id  - Supprimer une compatibilité
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * PATCH /api/admin/tax/compat/:id
 * Mettre à jour une compatibilité fiscale
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();

    // Vérifier que la compatibilité existe
    const compatibility = await prisma.fiscalCompatibility.findUnique({
      where: { id },
    });

    if (!compatibility) {
      return NextResponse.json(
        { error: 'Compatibilité fiscale non trouvée' },
        { status: 404 }
      );
    }

    // Mettre à jour la compatibilité
    const updatedCompatibility = await prisma.fiscalCompatibility.update({
      where: { id },
      data: {
        rule: body.rule ?? compatibility.rule,
        note: body.note !== undefined ? body.note : compatibility.note,
      },
    });

    return NextResponse.json(updatedCompatibility);
  } catch (error: any) {
    console.error('Error updating fiscal compatibility:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la compatibilité', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/tax/compat/:id
 * Supprimer une compatibilité fiscale
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Vérifier que la compatibilité existe
    const compatibility = await prisma.fiscalCompatibility.findUnique({
      where: { id },
    });

    if (!compatibility) {
      return NextResponse.json(
        { error: 'Compatibilité fiscale non trouvée' },
        { status: 404 }
      );
    }

    // Supprimer la compatibilité
    await prisma.fiscalCompatibility.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Compatibilité supprimée avec succès' });
  } catch (error: any) {
    console.error('Error deleting fiscal compatibility:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la compatibilité', details: error.message },
      { status: 500 }
    );
  }
}


/**
 * API Routes - Admin - Type fiscal par ID
 * PATCH  /api/admin/tax/types/:id  - Mettre à jour un type fiscal
 * DELETE /api/admin/tax/types/:id  - Supprimer un type fiscal
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';

/**
 * PATCH /api/admin/tax/types/:id
 * Mettre à jour un type fiscal
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

    // Vérifier que le type existe
    const fiscalType = await prisma.fiscalType.findUnique({
      where: { id },
    });

    if (!fiscalType) {
      return NextResponse.json(
        { error: 'Type fiscal non trouvé' },
        { status: 404 }
      );
    }

    // Mettre à jour le type
    const updatedType = await prisma.fiscalType.update({
      where: { id },
      data: {
        label: body.label ?? fiscalType.label,
        category: body.category ?? fiscalType.category,
        description: body.description !== undefined ? body.description : fiscalType.description,
        isActive: body.isActive !== undefined ? body.isActive : fiscalType.isActive,
      },
    });

    return NextResponse.json(updatedType);
  } catch (error: any) {
    console.error('Error updating fiscal type:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du type fiscal', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/tax/types/:id
 * Supprimer un type fiscal
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

    // Vérifier que le type existe
    const fiscalType = await prisma.fiscalType.findUnique({
      where: { id },
    });

    if (!fiscalType) {
      return NextResponse.json(
        { error: 'Type fiscal non trouvé' },
        { status: 404 }
      );
    }

    // Vérifier qu'aucun bien n'utilise ce type
    const propertiesCount = await prisma.property.count({
      where: { fiscalTypeId: id },
    });

    if (propertiesCount > 0) {
      return NextResponse.json(
        { error: `Impossible de supprimer ce type fiscal: ${propertiesCount} bien(s) l'utilisent` },
        { status: 409 }
      );
    }

    // Supprimer le type
    await prisma.fiscalType.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Type fiscal supprimé avec succès' });
  } catch (error: any) {
    console.error('Error deleting fiscal type:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du type fiscal', details: error.message },
      { status: 500 }
    );
  }
}


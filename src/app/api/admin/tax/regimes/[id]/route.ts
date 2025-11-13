/**
 * API Routes - Admin - Régime fiscal par ID
 * PATCH  /api/admin/tax/regimes/:id  - Mettre à jour un régime fiscal
 * DELETE /api/admin/tax/regimes/:id  - Supprimer un régime fiscal
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * PATCH /api/admin/tax/regimes/:id
 * Mettre à jour un régime fiscal
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();

    // Vérifier que le régime existe
    const fiscalRegime = await prisma.fiscalRegime.findUnique({
      where: { id },
    });

    if (!fiscalRegime) {
      return NextResponse.json(
        { error: 'Régime fiscal non trouvé' },
        { status: 404 }
      );
    }

    // Préparer les données de mise à jour
    const updateData: any = {};

    if (body.label !== undefined) updateData.label = body.label;
    if (body.appliesToIds !== undefined) {
      if (!Array.isArray(body.appliesToIds)) {
        return NextResponse.json(
          { error: 'Le champ "appliesToIds" doit être un tableau' },
          { status: 400 }
        );
      }
      updateData.appliesToIds = JSON.stringify(body.appliesToIds);
    }
    if (body.engagementYears !== undefined) updateData.engagementYears = body.engagementYears;
    if (body.eligibility !== undefined) updateData.eligibility = body.eligibility ? JSON.stringify(body.eligibility) : null;
    if (body.calcProfile !== undefined) updateData.calcProfile = body.calcProfile;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    // Mettre à jour le régime
    const updatedRegime = await prisma.fiscalRegime.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedRegime);
  } catch (error: any) {
    console.error('Error updating fiscal regime:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du régime fiscal', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/tax/regimes/:id
 * Supprimer un régime fiscal
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Vérifier que le régime existe
    const fiscalRegime = await prisma.fiscalRegime.findUnique({
      where: { id },
    });

    if (!fiscalRegime) {
      return NextResponse.json(
        { error: 'Régime fiscal non trouvé' },
        { status: 404 }
      );
    }

    // Vérifier qu'aucun bien n'utilise ce régime
    const propertiesCount = await prisma.property.count({
      where: { fiscalRegimeId: id },
    });

    if (propertiesCount > 0) {
      return NextResponse.json(
        { error: `Impossible de supprimer ce régime fiscal: ${propertiesCount} bien(s) l'utilisent` },
        { status: 409 }
      );
    }

    // Supprimer le régime
    await prisma.fiscalRegime.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Régime fiscal supprimé avec succès' });
  } catch (error: any) {
    console.error('Error deleting fiscal regime:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du régime fiscal', details: error.message },
      { status: 500 }
    );
  }
}


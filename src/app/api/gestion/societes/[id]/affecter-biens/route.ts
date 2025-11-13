/**
 * API pour affecter/désaffecter des biens à une société de gestion
 * POST /api/gestion/societes/[id]/affecter-biens
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isGestionDelegueEnabled } from '@/lib/settings/appSettings';

/**
 * POST /api/gestion/societes/[id]/affecter-biens
 * Affecte ou désaffecte des propriétés à une société de gestion
 * Note: On permet l'affectation même si la fonctionnalité est désactivée
 * 
 * Body: {
 *   propertyIds: string[] // IDs des propriétés à affecter à cette société
 *   // Si un ID n'est pas dans la liste, la propriété sera désaffectée de cette société
 * }
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Pas de vérification du feature flag pour l'affectation
    // (on permet la gestion même si désactivé)

    const body = await request.json();

    // Validation
    if (!Array.isArray(body.propertyIds)) {
      return NextResponse.json(
        { error: 'propertyIds doit être un tableau d\'IDs' },
        { status: 400 }
      );
    }

    // Vérifier que la société existe
    const societe = await prisma.managementCompany.findUnique({
      where: { id: params.id },
      include: {
        Property: {
          select: { id: true },
        },
      },
    });

    if (!societe) {
      return NextResponse.json(
        { error: 'Société de gestion non trouvée' },
        { status: 404 }
      );
    }

    // Vérifier que toutes les propriétés existent
    if (body.propertyIds.length > 0) {
      const properties = await prisma.property.findMany({
        where: {
          id: { in: body.propertyIds },
        },
        select: { id: true },
      });

      if (properties.length !== body.propertyIds.length) {
        return NextResponse.json(
          { error: 'Certaines propriétés n\'existent pas' },
          { status: 400 }
        );
      }
    }

    // IDs actuellement affectés à cette société
    const currentPropertyIds = societe.Property.map((p) => p.id);

    // IDs à affecter (nouveaux)
    const toAssign = body.propertyIds.filter((id: string) => !currentPropertyIds.includes(id));

    // IDs à désaffecter (retirés)
    const toUnassign = currentPropertyIds.filter((id) => !body.propertyIds.includes(id));

    // Transaction pour tout faire en une fois
    await prisma.$transaction([
      // Affecter les nouvelles propriétés
      ...toAssign.map((propertyId: string) =>
        prisma.property.update({
          where: { id: propertyId },
          data: { managementCompanyId: params.id },
        })
      ),
      // Désaffecter les propriétés retirées
      ...toUnassign.map((propertyId) =>
        prisma.property.update({
          where: { id: propertyId },
          data: { managementCompanyId: null },
        })
      ),
    ]);

    // Récupérer la société mise à jour
    const updatedSociete = await prisma.managementCompany.findUnique({
      where: { id: params.id },
      include: {
        Property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `${toAssign.length} propriété(s) affectée(s), ${toUnassign.length} propriété(s) désaffectée(s)`,
      societe: updatedSociete,
    });
  } catch (error) {
    console.error('Erreur lors de l\'affectation des propriétés:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'affectation des propriétés' },
      { status: 500 }
    );
  }
}


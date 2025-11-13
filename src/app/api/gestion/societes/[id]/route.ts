/**
 * API pour la gestion d'une société spécifique
 * GET    /api/gestion/societes/[id] - Récupère une société
 * PATCH  /api/gestion/societes/[id] - Met à jour une société
 * DELETE /api/gestion/societes/[id] - Désactive une société
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidModeCalcul } from '@/lib/gestion';
import { isGestionDelegueEnabled } from '@/lib/settings/appSettings';

/**
 * GET /api/gestion/societes/[id]
 * Récupère une société de gestion par son ID
 * Note: On permet la lecture même si la fonctionnalité est désactivée
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Pas de vérification du feature flag pour la lecture
    // (on permet la consultation même si désactivé)

    const societe = await prisma.managementCompany.findUnique({
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

    if (!societe) {
      return NextResponse.json(
        { error: 'Société de gestion non trouvée' },
        { status: 404 }
      );
    }

    return NextResponse.json(societe);
  } catch (error) {
    console.error('Erreur lors de la récupération de la société:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la société de gestion' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/gestion/societes/[id]
 * Met à jour une société de gestion
 * Note: On permet la modification même si la fonctionnalité est désactivée
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Pas de vérification du feature flag pour la modification
    // (on permet la gestion même si désactivé)

    const body = await request.json();

    // Vérifier que la société existe
    const existing = await prisma.managementCompany.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Société de gestion non trouvée' },
        { status: 404 }
      );
    }

    // Validation des champs si fournis
    if (body.modeCalcul && !isValidModeCalcul(body.modeCalcul)) {
      return NextResponse.json(
        { error: 'Mode de calcul invalide' },
        { status: 400 }
      );
    }

    if (body.taux !== undefined && (typeof body.taux !== 'number' || body.taux < 0 || body.taux > 1)) {
      return NextResponse.json(
        { error: 'Le taux doit être un nombre entre 0 et 1' },
        { status: 400 }
      );
    }

    if (body.fraisMin !== undefined && body.fraisMin !== null && (typeof body.fraisMin !== 'number' || body.fraisMin < 0)) {
      return NextResponse.json(
        { error: 'Les frais minimums doivent être un nombre positif' },
        { status: 400 }
      );
    }

    if (body.tauxTva !== undefined && body.tauxTva !== null && (typeof body.tauxTva !== 'number' || body.tauxTva < 0)) {
      return NextResponse.json(
        { error: 'Le taux de TVA doit être un nombre positif' },
        { status: 400 }
      );
    }

    // Préparer les données à mettre à jour
    const updateData: any = {};
    if (body.nom !== undefined) updateData.nom = body.nom;
    if (body.contact !== undefined) updateData.contact = body.contact || null;
    if (body.email !== undefined) updateData.email = body.email || null;
    if (body.telephone !== undefined) updateData.telephone = body.telephone || null;
    if (body.modeCalcul !== undefined) updateData.modeCalcul = body.modeCalcul;
    if (body.taux !== undefined) updateData.taux = body.taux;
    if (body.fraisMin !== undefined) updateData.fraisMin = body.fraisMin ?? null;
    if (body.baseSurEncaissement !== undefined) updateData.baseSurEncaissement = body.baseSurEncaissement;
    if (body.tvaApplicable !== undefined) updateData.tvaApplicable = body.tvaApplicable;
    if (body.tauxTva !== undefined) updateData.tauxTva = body.tauxTva ?? null;
    if (body.actif !== undefined) updateData.actif = body.actif;

    // Mettre à jour la société
    const societe = await prisma.managementCompany.update({
      where: { id: params.id },
      data: updateData,
      include: {
        Property: true,
      },
    });

    return NextResponse.json(societe);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la société:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la société de gestion' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/gestion/societes/[id]
 * Désactive une société de gestion (soft delete)
 * Note: On permet la suppression même si la fonctionnalité est désactivée
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Pas de vérification du feature flag pour la suppression
    // (on permet la gestion même si désactivé)

    // Vérifier que la société existe
    const existing = await prisma.managementCompany.findUnique({
      where: { id: params.id },
      include: {
        Property: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Société de gestion non trouvée' },
        { status: 404 }
      );
    }

    // Soft delete: on désactive la société
    const societe = await prisma.managementCompany.update({
      where: { id: params.id },
      data: { actif: false },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Société de gestion désactivée',
      societe 
    });
  } catch (error) {
    console.error('Erreur lors de la désactivation de la société:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la désactivation de la société de gestion' },
      { status: 500 }
    );
  }
}


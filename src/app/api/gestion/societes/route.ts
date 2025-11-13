/**
 * API pour la gestion des sociétés de gestion
 * GET  /api/gestion/societes - Liste toutes les sociétés
 * POST /api/gestion/societes - Crée une nouvelle société
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isValidModeCalcul } from '@/lib/gestion';
import { isGestionDelegueEnabled } from '@/lib/settings/appSettings';

/**
 * GET /api/gestion/societes
 * Liste toutes les sociétés de gestion
 * Note: On permet la lecture même si la fonctionnalité est désactivée,
 * pour permettre la consultation et la gestion des sociétés existantes.
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Vérifier le statut d'activation (mais ne pas bloquer la lecture)
    const enabled = await isGestionDelegueEnabled();

    const societes = await prisma.managementCompany.findMany({
      include: {
        Property: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
      orderBy: {
        nom: 'asc',
      },
    });

    // Ajouter un compte de propriétés liées
    const societesWithCount = societes.map((societe) => ({
      ...societe,
      propertiesCount: societe.Property.length,
    }));

    // Retourner les sociétés + le statut d'activation de la fonctionnalité
    return NextResponse.json({
      societes: societesWithCount,
      enabled: enabled,
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des sociétés:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des sociétés de gestion' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/gestion/societes
 * Crée une nouvelle société de gestion
 */
export async function POST(request: NextRequest) {
  try {
    // Feature flag check (via settings)
    const enabled = await isGestionDelegueEnabled();
    if (!enabled) {
      return NextResponse.json(
        { error: 'La fonctionnalité de gestion déléguée n\'est pas activée' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validation des champs requis
    if (!body.nom || typeof body.nom !== 'string') {
      return NextResponse.json(
        { error: 'Le nom de la société est requis' },
        { status: 400 }
      );
    }

    if (!body.modeCalcul || !isValidModeCalcul(body.modeCalcul)) {
      return NextResponse.json(
        { error: 'Mode de calcul invalide. Valeurs autorisées: LOYERS_UNIQUEMENT, REVENUS_TOTAUX' },
        { status: 400 }
      );
    }

    if (typeof body.taux !== 'number' || body.taux < 0 || body.taux > 1) {
      return NextResponse.json(
        { error: 'Le taux doit être un nombre entre 0 et 1' },
        { status: 400 }
      );
    }

    // Validation optionnelle des autres champs
    if (body.fraisMin !== undefined && body.fraisMin !== null) {
      if (typeof body.fraisMin !== 'number' || body.fraisMin < 0) {
        return NextResponse.json(
          { error: 'Les frais minimums doivent être un nombre positif' },
          { status: 400 }
        );
      }
    }

    if (body.tvaApplicable && body.tauxTva !== undefined && body.tauxTva !== null) {
      if (typeof body.tauxTva !== 'number' || body.tauxTva < 0) {
        return NextResponse.json(
          { error: 'Le taux de TVA doit être un nombre positif' },
          { status: 400 }
        );
      }
    }

    // Créer la société
    const societe = await prisma.managementCompany.create({
      data: {
        nom: body.nom,
        contact: body.contact || null,
        email: body.email || null,
        telephone: body.telephone || null,
        modeCalcul: body.modeCalcul,
        taux: body.taux,
        fraisMin: body.fraisMin ?? null,
        baseSurEncaissement: body.baseSurEncaissement ?? true,
        tvaApplicable: body.tvaApplicable ?? false,
        tauxTva: body.tauxTva ?? null,
        actif: body.actif ?? true,
      },
      include: {
        Property: true,
      },
    });

    return NextResponse.json(societe, { status: 201 });
  } catch (error) {
    console.error('Erreur lors de la création de la société:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de la société de gestion' },
      { status: 500 }
    );
  }
}


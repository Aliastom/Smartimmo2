/**
 * API Routes - Admin - Régimes fiscaux
 * GET  /api/admin/tax/regimes  - Liste tous les régimes fiscaux
 * POST /api/admin/tax/regimes  - Créer un nouveau régime fiscal
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';

/**
 * GET /api/admin/tax/regimes
 * Liste tous les régimes fiscaux
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const active = searchParams.get('active');
    const typeId = searchParams.get('typeId');

    const regimes = await prisma.fiscalRegime.findMany({
      where: {
        isActive: active !== null ? active === 'true' : undefined,
      },
      orderBy: [
        { label: 'asc' },
      ],
    });

    // Filtrer par type si demandé
    let filteredRegimes = regimes;
    if (typeId) {
      filteredRegimes = regimes.filter((regime) => {
        const appliesTo = JSON.parse(regime.appliesToIds) as string[];
        return appliesTo.includes(typeId);
      });
    }

    return NextResponse.json(filteredRegimes);
  } catch (error: any) {
    console.error('Error fetching fiscal regimes:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des régimes fiscaux', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/tax/regimes
 * Créer un nouveau régime fiscal
 * 
 * Body: {
 *   id: string,                  // ex: "MICRO", "REEL", "MICRO_BIC"
 *   label: string,
 *   appliesToIds: string[],      // ex: ["NU", "MEUBLE"]
 *   engagementYears?: number,
 *   eligibility?: object,
 *   calcProfile: string,
 *   description?: string,
 *   isActive?: boolean
 * }
 */
export async function POST(req: NextRequest) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const body = await req.json();
    const { id, label, appliesToIds, engagementYears, eligibility, calcProfile, description, isActive } = body;

    // Validation
    if (!id || !label || !appliesToIds || !calcProfile) {
      return NextResponse.json(
        { error: 'Champs requis manquants: id, label, appliesToIds, calcProfile' },
        { status: 400 }
      );
    }

    if (!Array.isArray(appliesToIds)) {
      return NextResponse.json(
        { error: 'Le champ "appliesToIds" doit être un tableau' },
        { status: 400 }
      );
    }

    // Vérifier si l'ID existe déjà
    const existing = await prisma.fiscalRegime.findUnique({
      where: { id },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Un régime fiscal avec l'ID "${id}" existe déjà` },
        { status: 409 }
      );
    }

    // Créer le régime fiscal
    const fiscalRegime = await prisma.fiscalRegime.create({
      data: {
        id,
        label,
        appliesToIds: JSON.stringify(appliesToIds),
        engagementYears: engagementYears || null,
        eligibility: eligibility ? JSON.stringify(eligibility) : null,
        calcProfile,
        description: description || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json(fiscalRegime, { status: 201 });
  } catch (error: any) {
    console.error('Error creating fiscal regime:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du régime fiscal', details: error.message },
      { status: 500 }
    );
  }
}


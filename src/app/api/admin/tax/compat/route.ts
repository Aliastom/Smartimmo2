/**
 * API Routes - Admin - Compatibilités fiscales
 * GET  /api/admin/tax/compat  - Liste toutes les compatibilités
 * POST /api/admin/tax/compat  - Créer une nouvelle compatibilité
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';

/**
 * GET /api/admin/tax/compat
 * Liste toutes les compatibilités fiscales
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope');

    const where: any = {};
    
    if (scope) {
      where.scope = scope;
    }

    const compatibilities = await prisma.fiscalCompatibility.findMany({
      where,
      orderBy: [
        { scope: 'asc' },
        { left: 'asc' },
      ],
    });

    return NextResponse.json(compatibilities);
  } catch (error: any) {
    console.error('Error fetching fiscal compatibilities:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des compatibilités', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/tax/compat
 * Créer une nouvelle compatibilité fiscale
 * 
 * Body: {
 *   scope: string,     // "category" | "type"
 *   left: string,
 *   right: string,
 *   rule: string,      // "CAN_MIX" | "GLOBAL_SINGLE_CHOICE" | "MUTUALLY_EXCLUSIVE"
 *   note?: string
 * }
 */
export async function POST(req: NextRequest) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const body = await req.json();
    const { scope, left, right, rule, note } = body;

    // Validation
    if (!scope || !left || !right || !rule) {
      return NextResponse.json(
        { error: 'Champs requis manquants: scope, left, right, rule' },
        { status: 400 }
      );
    }

    // Vérifier si la compatibilité existe déjà
    const existing = await prisma.fiscalCompatibility.findFirst({
      where: { scope, left, right },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Une compatibilité existe déjà pour ${scope} "${left}" et "${right}"` },
        { status: 409 }
      );
    }

    // Créer la compatibilité
    const compatibility = await prisma.fiscalCompatibility.create({
      data: {
        scope,
        left,
        right,
        rule,
        note: note || null,
      },
    });

    return NextResponse.json(compatibility, { status: 201 });
  } catch (error: any) {
    console.error('Error creating fiscal compatibility:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de la compatibilité', details: error.message },
      { status: 500 }
    );
  }
}


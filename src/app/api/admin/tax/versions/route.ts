/**
 * API Routes - Admin - Versions fiscales
 * GET    /api/admin/tax/versions - Liste toutes les versions
 * POST   /api/admin/tax/versions - Créer une nouvelle version (depuis une copie)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/tax/versions
 * Liste toutes les versions fiscales
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const year = searchParams.get('year');

    const where: any = {};
    
    if (status) {
      where.status = status;
    }
    
    if (year) {
      where.year = parseInt(year, 10);
    }

    const versions = await prisma.fiscalVersion.findMany({
      where,
      include: {
        params: true,
      },
      orderBy: [
        { year: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json(versions);
  } catch (error: any) {
    console.error('Error fetching fiscal versions:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des versions fiscales', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/tax/versions
 * Créer une nouvelle version fiscale (depuis une copie)
 * 
 * Body: {
 *   sourceVersionId?: string,  // Version à copier (si non fourni, copie la dernière publiée)
 *   year: number,
 *   code: string,
 *   source: string,
 *   notes?: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sourceVersionId, year, code, source, notes } = body;

    // Validation
    if (!year || !code || !source) {
      return NextResponse.json(
        { error: 'Champs requis manquants: year, code, source' },
        { status: 400 }
      );
    }

    // Vérifier si le code existe déjà
    const existing = await prisma.fiscalVersion.findUnique({
      where: { code },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Une version avec le code "${code}" existe déjà` },
        { status: 409 }
      );
    }

    // Trouver la version source
    let sourceVersion;
    
    if (sourceVersionId) {
      sourceVersion = await prisma.fiscalVersion.findUnique({
        where: { id: sourceVersionId },
        include: { params: true },
      });
    } else {
      // Copier la dernière version publiée
      sourceVersion = await prisma.fiscalVersion.findFirst({
        where: { status: 'published' },
        include: { params: true },
        orderBy: { year: 'desc' },
      });
    }

    if (!sourceVersion) {
      return NextResponse.json(
        { error: 'Aucune version source trouvée' },
        { status: 404 }
      );
    }

    // Créer la nouvelle version
    const newVersion = await prisma.fiscalVersion.create({
      data: {
        code,
        year,
        source,
        status: 'draft',
        notes,
        params: sourceVersion.params
          ? {
              create: {
                jsonData: sourceVersion.params.jsonData,
                overrides: null, // Pas d'overrides sur une nouvelle version
              },
            }
          : undefined,
      },
      include: {
        params: true,
      },
    });

    return NextResponse.json(newVersion, { status: 201 });
  } catch (error: any) {
    console.error('Error creating fiscal version:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de la version fiscale', details: error.message },
      { status: 500 }
    );
  }
}


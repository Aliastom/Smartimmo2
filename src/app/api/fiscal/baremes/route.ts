/**
 * API Route: Liste des barèmes publiés pour une année de déclaration (campagnes DGFiP, ex. 2026)
 * GET /api/fiscal/baremes?year=YYYY
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { TaxParamsService } from '@/services/tax/TaxParamsService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    if (Number.isNaN(year) || year < 2020 || year > 2035) {
      return NextResponse.json(
        { error: 'Paramètre year invalide (2020-2035)' },
        { status: 400 }
      );
    }

    const list = await TaxParamsService.listPublishedByYear(year);
    const baremes = list.map((row) => ({
      code: row.code,
      year: row.year,
      source: row.source,
      updatedAt: row.updatedAt.toISOString(),
    }));

    return NextResponse.json({ baremes });
  } catch (error) {
    console.error('[API fiscal/baremes] GET:', error);
    return NextResponse.json(
      { error: 'Erreur lors du chargement des barèmes' },
      { status: 500 }
    );
  }
}

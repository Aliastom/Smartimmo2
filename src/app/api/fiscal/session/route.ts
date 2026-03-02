/**
 * API Route: Session fiscale (préférences déclaration / barème)
 * GET  /api/fiscal/session - Récupère ou crée la session
 * POST /api/fiscal/session - Met à jour declarationYear et/ou baremeCode
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { getOrCreateFiscalSession, updateFiscalSession } from '@/services/fiscal/FiscalSessionService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireAuth();
    const session = await getOrCreateFiscalSession(user.organizationId);
    console.log('[API FiscalSession] org=' + (user.organizationId?.slice(0, 8) || '?') + '... decl=' + session.declarationYear + ' income=' + session.incomeYear + ' bareme=' + session.baremeCode);
    return NextResponse.json(session);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur lors du chargement de la session fiscale';
    console.error('[API fiscal/session] GET:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json().catch(() => ({}));
    const { declarationYear, baremeCode } = body as { declarationYear?: number; baremeCode?: string };

    if (declarationYear !== undefined && (typeof declarationYear !== 'number' || declarationYear < 2020 || declarationYear > 2035)) {
      return NextResponse.json(
        { error: 'declarationYear invalide (2020-2035)' },
        { status: 400 }
      );
    }
    if (baremeCode !== undefined && typeof baremeCode !== 'string') {
      return NextResponse.json(
        { error: 'baremeCode invalide' },
        { status: 400 }
      );
    }

    const session = await updateFiscalSession(user.organizationId, {
      declarationYear,
      baremeCode,
    });
    return NextResponse.json(session);
  } catch (error) {
    console.error('[API fiscal/session] POST:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la session fiscale' },
      { status: 500 }
    );
  }
}

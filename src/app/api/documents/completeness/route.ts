import { NextRequest, NextResponse } from 'next/server';
import { DocumentsService } from '@/lib/services/documents';
import { requireAuth } from '@/lib/auth/getCurrentUser';

/**
 * GET /api/documents/completeness - Vérifier la complétude des documents pour une entité
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const searchParams = request.nextUrl.searchParams;
    const scope = searchParams.get('scope') as 'property' | 'lease' | 'transaction' | null;
    const entityId = searchParams.get('entityId');

    if (!scope || !entityId) {
      return NextResponse.json(
        { error: 'scope and entityId are required' },
        { status: 400 }
      );
    }

    const result = await DocumentsService.checkCompleteness(scope, entityId, organizationId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error checking document completeness:', error);
    return NextResponse.json(
      { error: 'Failed to check document completeness', details: error.message },
      { status: 500 }
    );
  }
}


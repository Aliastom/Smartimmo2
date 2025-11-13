import { NextRequest, NextResponse } from 'next/server';
import { DocumentsService } from '@/lib/services/documents';

/**
 * GET /api/documents/completeness - Vérifier la complétude des documents pour une entité
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const scope = searchParams.get('scope') as 'property' | 'lease' | 'transaction' | null;
    const entityId = searchParams.get('entityId');

    if (!scope || !entityId) {
      return NextResponse.json(
        { error: 'scope and entityId are required' },
        { status: 400 }
      );
    }

    const result = await DocumentsService.checkCompleteness(scope, entityId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error checking document completeness:', error);
    return NextResponse.json(
      { error: 'Failed to check document completeness', details: error.message },
      { status: 500 }
    );
  }
}


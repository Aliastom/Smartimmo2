import { NextRequest, NextResponse } from 'next/server';
import { DocumentsService } from '@/lib/services/documents';
import { requireAuth } from '@/lib/auth/getCurrentUser';

/**
 * GET /api/documents/stats - Obtenir les statistiques des documents
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId') || undefined;

    const stats = await DocumentsService.getStats(organizationId, propertyId || undefined);

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('Error fetching document stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document stats', details: error.message },
      { status: 500 }
    );
  }
}

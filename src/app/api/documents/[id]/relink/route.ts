import { NextRequest, NextResponse } from 'next/server';
import { DocumentsService } from '@/lib/services/documents';

/**
 * POST /api/documents/[id]/relink - Modifier la liaison d'un document
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { linkedTo, linkedId } = body;

    if (!linkedTo) {
      return NextResponse.json(
        { error: 'linkedTo is required' },
        { status: 400 }
      );
    }

    const document = await DocumentsService.relink(id, {
      linkedTo,
      linkedId,
    });

    return NextResponse.json({
      success: true,
      document,
    });
  } catch (error: any) {
    console.error('Error relinking document:', error);
    return NextResponse.json(
      { error: 'Failed to relink document', details: error.message },
      { status: 500 }
    );
  }
}


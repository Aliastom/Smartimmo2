import { NextRequest, NextResponse } from 'next/server';
import { classificationService } from '@/services/ClassificationService';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';

// GET /api/admin/document-types/test-global/determinism - Tester le déterminisme

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const text = url.searchParams.get('text');
    const iterations = parseInt(url.searchParams.get('iterations') || '5');

    if (!text) {
      return NextResponse.json(
        { success: false, error: 'Paramètre text requis' },
        { status: 400 }
      );
    }

    const isDeterministic = await classificationService.testDeterminism(text, iterations);
    
    return NextResponse.json({
      success: true,
      data: {
        deterministic: isDeterministic,
        iterations,
        text: text.substring(0, 100) + (text.length > 100 ? '...' : '')
      }
    });
  } catch (error) {
    console.error('Error testing determinism:', error);
    
    return NextResponse.json(
      { success: false, error: 'Erreur lors du test de déterminisme' },
      { status: 500 }
    );
  }
}

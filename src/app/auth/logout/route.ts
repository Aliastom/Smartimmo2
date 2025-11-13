import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

/**
 * Route de déconnexion
 * POST /auth/logout
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Logout] Erreur:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la déconnexion' },
      { status: 500 }
    );
  }
}

/**
 * GET /auth/logout - Alternative via URL
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    await supabase.auth.signOut();

    // Rediriger vers la page de login
    return NextResponse.redirect(new URL('/login', request.url));
  } catch (error) {
    console.error('[Logout] Erreur:', error);
    return NextResponse.redirect(new URL('/login?error=logout_failed', request.url));
  }
}


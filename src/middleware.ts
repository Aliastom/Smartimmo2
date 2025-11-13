import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Middleware pour protéger les routes avec Supabase Auth
 * Vérifie la session sur toutes les routes protégées
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Routes publiques (pas de vérification d'auth)
  const publicRoutes = [
    '/login',
    '/auth/callback',
    '/api/auth',
    '/_next',
    '/favicon.ico',
    '/public',
  ];
  
  // Vérifier si la route est publique
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Créer le client Supabase pour lire la session
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Valeurs par défaut pour le build
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Récupérer l'utilisateur
  const { data: { user }, error } = await supabase.auth.getUser();

  // Si pas d'utilisateur, rediriger vers /login
  if (error || !user) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Utilisateur authentifié, continuer
  return response;
}

// Configuration des routes à protéger
export const config = {
  matcher: [
    /*
     * Protéger toutes les routes sauf:
     * - api (sauf /api/auth)
     * - _next/static (fichiers statiques)
     * - _next/image (optimisation d'images)
     * - favicon.ico
     * - login et auth/callback
     */
    '/((?!api|_next/static|_next/image|favicon.ico|login|auth/callback).*)',
  ],
};


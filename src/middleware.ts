import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Middleware pour protéger les routes avec Supabase Auth
 * Vérifie la session sur toutes les routes protégées
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Routes TOUJOURS publiques (pas de vérification d'auth)
  const publicRoutes = [
    '/', // Page d'accueil publique - nécessaire pour l'installation PWA
    '/login',
    '/auth/callback',
    '/auth/logout',
    '/_next',
    '/favicon.ico',
    '/rive',
    // Fichiers PWA - doivent être accessibles sans authentification
    '/manifest.webmanifest',
    '/sw.js',
    '/icons',
    '/robots.txt',
    '/sitemap.xml',
  ];
  
  // Routes API publiques (ne nécessitent pas d'auth)
  const publicApiRoutes = [
    '/api/auth/',
    '/api/ocr', // Si utilisé pour les uploads publics
  ];
  
  // Vérifier si la route est publique
  const staticFileExtensions = [
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.svg',
    '.ico',
    '.css',
    '.js',
    '.txt',
    '.json',
    '.map',
    '.woff',
    '.woff2',
    '.ttf',
    '.otf',
    '.riv',
    '.webmanifest', // Manifest PWA
  ];
  
  // Vérifier si c'est un fichier PWA (service worker ou workbox)
  // Les fichiers workbox peuvent être dans /workbox-*.js ou /_next/static/workbox-*.js
  // IMPORTANT: Ces fichiers DOIVENT être accessibles sans authentification
  const isPwaFile = pathname === '/sw.js' || 
                    pathname === '/sw' ||
                    /^\/workbox-.*\.js$/.test(pathname) ||
                    /^\/workbox-.*$/.test(pathname) ||
                    /^\/_next\/static\/.*\/workbox-.*\.js$/.test(pathname) ||
                    pathname.startsWith('/icons/');

  // Vérifier si c'est la page d'accueil exacte
  const isHomePage = pathname === '/';
  
  const isStaticAsset = staticFileExtensions.some((ext) => pathname.endsWith(ext));
  const isPublicRoute = isHomePage || publicRoutes.some(route => pathname.startsWith(route)) || isStaticAsset || isPwaFile;
  const isPublicApi = publicApiRoutes.some(route => pathname.startsWith(route));
  
  if (isPublicRoute || isPublicApi) {
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
  // Note: Les erreurs de refresh_token sont normales quand l'utilisateur n'est pas connecté
  // Elles sont gérées silencieusement ici
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
     * Protéger toutes les routes SAUF les routes publiques listées ci-dessous.
     * La logique détaillée est gérée dans le middleware ci-dessus.
     * 
     * Routes exclues du matcher (donc publiques) :
     * - _next/* (tous les fichiers statiques Next.js, inclut workbox)
     * - favicon.ico
     * - manifest.webmanifest
     * - sw.js
     * - workbox-*.js (fichiers Workbox à la racine)
     * - icons/* (icônes PWA)
     * - robots.txt, sitemap.xml
     * 
     * Note: La page d'accueil "/" est gérée dans le middleware via isHomePage
     * car le matcher Next.js ne peut pas exclure "/" facilement avec un pattern.
     */
    '/((?!_next|favicon\\.ico|manifest\\.webmanifest|sw\\.js|workbox-.*\\.js|icons|robots\\.txt|sitemap\\.xml).*)',
  ],
};


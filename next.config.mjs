import withPWA from 'next-pwa';

const CACHE_VERSION = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_REF || 'local').slice(0, 12);
const cacheName = (base) => `${base}-${CACHE_VERSION}`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // ❗ Ne bloque pas le build à cause des erreurs ESLint
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ❗ Ne bloque pas le build à cause des erreurs TypeScript
    ignoreBuildErrors: true,
  },
  experimental: {
    typedRoutes: true,
    serverActions: {
      allowedOrigins: ['localhost:3000']
    },
    serverComponentsExternalPackages: ['onnxruntime-node', '@xenova/transformers', 'sharp']
  },
  // Injection automatique des variables Git Vercel pour le badge de version
  env: {
    // Exposer les variables Git Vercel côté client (si disponibles)
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA || '',
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF || '',
    // Horodatage du build et environnement déployé pour debug prod/dev
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    NEXT_PUBLIC_DEPLOY_ENV: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
  },
  // Configuration webpack
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        source: '/workbox-:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Désactiver le cache webpack sur Vercel pour éviter problème de taille
    if (process.env.VERCEL) {
      config.cache = false;
    }
    
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        buffer: false,
      };
      
      // Ignorer complètement les modules IA côté client
      config.resolve.alias = {
        ...config.resolve.alias,
        'onnxruntime-node': false,
        '@xenova/transformers': false,
        'sharp': false,
      };
    }
    
    return config;
  }
}

// Configuration PWA avec next-pwa — App Shell offline-first "béton"
// Voir docs/SERVICE-WORKER-OFFLINE-CONFIG.md pour l'audit complet
// Stratégie : /app TOUJOURS servi depuis precache, JAMAIS de NetworkFirst sur le HTML
const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: false, // Pas de reload forcé — l'UpdateBanner propose le reload manuel
  clientsClaim: true, // Prendre le contrôle dès activation
  cleanupOutdatedCaches: true, // Nettoyer les caches obsolètes (cause ChunkLoadError si absent)
  disable: process.env.NODE_ENV === 'development',
  additionalManifestEntries: [], // /app est ajouté via fallbacks.document, pas d'offline.html
  // Ignorer les query params App Shell pour matcher /app?view=xxx → precache /app
  ignoreURLParametersMatching: [/^view$/, /^propertyId$/, /^tab$/, /^redirect$/, /^utm_/, /^fbclid$/],
  fallbacks: {
    document: '/app', // App Shell unique — buildFallbackWorker l'ajoute au precache
  },
  navigateFallback: '/app',
  navigateFallbackAllowlist: [/^\/app($|\/|\?)/], // /app, /app/, /app?view=xxx, /app/login
  sw: 'sw.js',
  publicExcludes: ['!sw.js', '!workbox-*.js', '!worker-*.js'],
  navigationPreload: false,
  buildExcludes: [
    /middleware-manifest\.json$/,
    /app-build-manifest\.json$/,
  ],
  // Stratégies de cache intelligentes pour ne pas casser Supabase
  runtimeCaching: [
    // ⚠️ CRITIQUE: Ne JAMAIS intercepter les routes API (POST, PUT, DELETE, etc.)
    // Le service worker doit laisser passer toutes les requêtes API directement au réseau
    {
      urlPattern: /^\/api\/.*/,
      handler: 'NetworkOnly',
      options: {
        cacheName: cacheName('api-requests'),
        expiration: {
          maxEntries: 0, // Pas de cache
        },
      },
    },
    // Ne JAMAIS mettre en cache les endpoints d'authentification Supabase
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/v1\//,
      handler: 'NetworkOnly',
      options: {
        cacheName: cacheName('supabase-auth'),
        expiration: {
          maxEntries: 0, // Pas de cache
        },
      },
    },
    // Données Supabase REST : online prioritaire (offline = cache court)
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\//,
      handler: 'NetworkFirst',
      options: {
        cacheName: cacheName('supabase-data'),
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60, // Cache très court (1 minute)
        },
        networkTimeoutSeconds: 10,
      },
    },
    // Stratégie NetworkFirst pour le storage Supabase
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\//,
      handler: 'NetworkFirst',
      options: {
        cacheName: cacheName('supabase-storage'),
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 300, // 5 minutes
        },
        networkTimeoutSeconds: 10,
      },
    },
    // Chunks JS/CSS hashés : même URL = immuable → CacheFirst (nouveau hash = nouvelle entrée)
    {
      urlPattern: /^\/_next\/static\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: cacheName('next-static'),
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 31536000, // 1 an
        },
      },
    },
    // Cache pour les icônes et images statiques
    {
      urlPattern: /^\/icons\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: cacheName('icons'),
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 31536000, // 1 an
        },
      },
    },
    // Cache pour les images uploadées (avec stratégie NetworkFirst pour éviter les problèmes)
    {
      urlPattern: /^\/uploads\/.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: cacheName('uploads'),
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 86400, // 1 jour
        },
        networkTimeoutSeconds: 10,
      },
    },
    // RSC ?_rsc= : NetworkFirst pour éviter une coquille HTML/RSC obsolète après déploiement ;
    // offline → fallback cache Workbox (entrées précédentes).
    {
      urlPattern: ({ url }) => url.searchParams.has('_rsc'),
      handler: 'NetworkFirst',
      options: {
        cacheName: cacheName('rsc-pages'),
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 3600, // 1 h — invalidation rapide après deploy
        },
        networkTimeoutSeconds: 5,
        fetchOptions: {
          mode: 'cors',
          credentials: 'same-origin',
        },
        matchOptions: {
          ignoreSearch: false, // Garder les query params pour les RSC
        },
        plugins: [
          {
            cacheWillUpdate: async ({ response }) => {
              if (response && response.status >= 200 && response.status < 300) {
                return response;
              }
              return null;
            },
            fetchDidFail: async ({ request }) => {
              // En mode offline, chercher dans le cache
              console.log('[SW] Requête RSC échouée, recherche dans le cache:', request.url);
              const cache = await caches.open(cacheName('rsc-pages'));
              
              // Chercher avec l'URL exacte
              let cached = await cache.match(request);
              
              // Si pas trouvé, chercher sans les query params _rsc
              if (!cached) {
                const urlWithoutRsc = new URL(request.url);
                urlWithoutRsc.searchParams.delete('_rsc');
                cached = await cache.match(urlWithoutRsc);
              }
              
              // Si toujours pas trouvé, chercher la page de base
              if (!cached) {
                const baseUrl = new URL(request.url);
                baseUrl.search = '';
                cached = await cache.match(baseUrl);
              }
              
              if (cached) {
                console.log('[SW] ✓ RSC trouvé dans le cache');
                return cached;
              }
              
              console.warn('[SW] ✗ RSC non trouvé dans le cache, retour d\'une réponse vide');
              // Retourner une réponse vide pour permettre au client de fonctionner
              return new Response('', {
                status: 200,
                headers: {
                  'Content-Type': 'text/html; charset=utf-8',
                },
              });
            },
          },
        ],
      },
    },
    // Filet de sécurité pour /app* : navigation ET prefetch (Next.js Link) vers /app?view=xxx
    // Cas intermittents : NavigationRoute matche seulement request.mode === 'navigate'.
    // Les prefetch/fetch ont mode !== 'navigate' → non interceptés → ERR_INTERNET_DISCONNECTED.
    // On matche tout GET /app* sauf _rsc (déjà géré plus haut). Timeout 0 + precacheFallback.
    {
      urlPattern: ({ url }) => {
        const p = url.pathname;
        if (p !== '/app' && !p.startsWith('/app/')) return false;
        return !url.searchParams.has('_rsc'); // RSC géré par la règle dédiée
      },
      handler: 'NetworkFirst',
      options: {
        networkTimeoutSeconds: 0,
        cacheName: cacheName('app-shell-fallback'),
        expiration: { maxEntries: 0 },
        precacheFallback: { fallbackURL: '/app' },
      },
    },
  ],
});

export default pwaConfig(nextConfig)

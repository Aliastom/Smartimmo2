import withPWA from 'next-pwa';

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
  },
  // Configuration webpack
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

// Configuration PWA avec next-pwa — App Shell offline-first
// Voir docs/SERVICE-WORKER-OFFLINE-CONFIG.md pour l'audit complet
const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: false, // Éviter les reloads forcés, laisser l'utilisateur choisir
  clientsClaim: true, // Prendre le contrôle dès activation
  cleanupOutdatedCaches: true, // Nettoyer les caches obsolètes après nouveau build
  disable: process.env.NODE_ENV === 'development',
  additionalManifestEntries: [
    { url: '/offline.html', revision: null },
  ],
  // Ignorer les query params App Shell pour matcher /app?view=xxx → precache /app
  ignoreURLParametersMatching: [/^view$/, /^propertyId$/, /^tab$/, /^redirect$/, /^utm_/, /^fbclid$/],
  fallbacks: {
    // Fallback document : /app pour App Shell (navigation interne via ?view=)
    // Si le precache n'a pas /app, cette page est servie
    document: '/app',
  },
  // Workbox : navigateFallback pour routes /app* — fallback vers /app (doit être précaché)
  navigateFallback: '/app',
  navigateFallbackAllowlist: [/^\/app($|\?)/],
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
        cacheName: 'api-requests',
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
        cacheName: 'supabase-auth',
        expiration: {
          maxEntries: 0, // Pas de cache
        },
      },
    },
    // Stratégie NetworkFirst pour les données Supabase (toujours vérifier en ligne)
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\//,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'supabase-data',
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
        cacheName: 'supabase-storage',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 300, // 5 minutes
        },
        networkTimeoutSeconds: 10,
      },
    },
    // Cache agressif pour les assets statiques Next.js
    {
      urlPattern: /^\/_next\/static\/.*/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-static',
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
        cacheName: 'icons',
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
        cacheName: 'uploads',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 86400, // 1 jour
        },
        networkTimeoutSeconds: 10,
      },
    },
    // Requêtes RSC (React Server Components) de Next.js avec ?_rsc=
    // Ces requêtes sont faites par Next.js pour charger les Server Components
    // En mode offline, on doit les intercepter et servir depuis le cache ou retourner une réponse vide
    {
      urlPattern: ({ url }) => url.searchParams.has('_rsc'),
      handler: 'CacheFirst',
      options: {
        cacheName: 'rsc-pages',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 86400 * 7, // 7 jours
        },
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
              const cache = await caches.open('rsc-pages');
              
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
    // Pages HTML avec stratégie NetworkFirst pour servir depuis le réseau d'abord, puis le cache
    // IMPORTANT: Les pages préchargées lors du full sync seront disponibles ici
    // NetworkFirst tente d'abord le réseau, puis sert le cache si le réseau échoue (offline)
    // Cela permet de garder les pages à jour quand on est en ligne, et de servir depuis le cache offline
    {
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'html-pages',
        networkTimeoutSeconds: 3, // Timeout court pour basculer rapidement sur le cache
        expiration: {
          maxEntries: 100, // Plus de pages en cache pour le mode offline
          maxAgeSeconds: 86400 * 7, // 7 jours pour permettre un mode offline prolongé
        },
        fetchOptions: {
          mode: 'cors',
          credentials: 'same-origin',
        },
        matchOptions: { ignoreSearch: true },
        precacheFallback: { fallbackURL: '/app' }, // Si cache + réseau échouent → servir /app précaché
        plugins: [
          {
            // S'assurer que les réponses HTML sont bien mises en cache
            cacheWillUpdate: async ({ response }) => {
              // Ne mettre en cache que les réponses valides (200-299)
              if (response && response.status >= 200 && response.status < 300) {
                return response;
              }
              return null;
            },
          },
        ],
      },
    },
  ],
});

export default pwaConfig(nextConfig)

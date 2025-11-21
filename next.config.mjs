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

// Configuration PWA avec next-pwa
// ⚠️ IMPORTANT: Ne pas activer en développement pour éviter les conflits
const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: false, // Désactiver skipWaiting automatique pour permettre à l'utilisateur de choisir
  disable: process.env.NODE_ENV === 'development', // Désactiver en dev
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
    // Pages HTML avec stratégie NetworkFirst pour toujours avoir la dernière version
    {
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 300, // 5 minutes
        },
        networkTimeoutSeconds: 10,
      },
    },
  ],
});

export default pwaConfig(nextConfig)

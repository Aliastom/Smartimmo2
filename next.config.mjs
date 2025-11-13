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
  // Configuration minimale pour Tesseract.js + Transformers.js
  webpack: (config, { isServer }) => {
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

export default nextConfig

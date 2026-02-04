import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // ⚠️ SOLUTION: Utiliser 'jsdom' au lieu de 'node' pour fournir un environnement
    // plus proche du navigateur où indexedDB existe naturellement
    // jsdom fournit window, globalThis, indexedDB, etc. de manière plus réaliste
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // ⚠️ CRITIQUE: Éliminer TOUS les effets multi-worker/isolate
    // Utiliser 'forks' au lieu de 'threads' pour éviter complètement l'isolation
    // 'forks' partage le même contexte global entre setupFiles et tests
    // et garantit que setupFiles s'exécute AVANT tout import Dexie
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Un seul fork pour éviter les problèmes de partage
        isolate: false, // ⚠️ Désactiver l'isolation pour partager les globals entre setupFiles et tests
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@domain': resolve(__dirname, './src/domain'),
      '@infra': resolve(__dirname, './src/infra'),
      '@ui': resolve(__dirname, './src/ui'),
    },
  },
});

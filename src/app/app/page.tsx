'use client';

/**
 * App Shell 100% client-side pour le mode offline
 * 
 * Cette page fonctionne complètement offline sans dépendre des Server Components.
 * Toute la navigation est gérée côté client avec des vues internes.
 * Les données sont chargées uniquement depuis IndexedDB via les repositories offline-first.
 */

import React, { Suspense, useEffect } from 'react';
import AppShellClient from './AppShellClient';
import { Loader2 } from 'lucide-react';
import { logToServer } from '@/lib/utils/logger';
import { LocalDbStatusProvider } from '@/contexts/LocalDbStatusContext';

export default function AppPage() {
  // PHASE 1 — Boot AppShell (instantané)
  // Utiliser un ref pour éviter les logs StrictMode
  const phase1LoggedRef = React.useRef(false);
  useEffect(() => {
    if (phase1LoggedRef.current) return;
    phase1LoggedRef.current = true;
    
    const startTime = performance.now();
    logToServer('[PHASE 1] 🚀 Boot AppShell - Démarrage');
    logToServer('[PHASE 1] 📦 HTML pré-généré chargé depuis cache Service Worker');
    logToServer('[PHASE 1] ⚛️  React se monte, arbre de composants créé');
    logToServer('[PHASE 1] 📝 À ce stade → aucune donnée métier n\'est affichée');
    
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    logToServer(`[PHASE 1] ✅ Boot AppShell terminé en ${duration}ms (rien venant du réseau)`);
    
    // PHASE 6 — Mise à jour du cache HTML (background)
    // Note: Cette phase est gérée par le Service Worker en arrière-plan
    // Le Service Worker met à jour:
    // - le cache HTML AppShell
    // - le JS AppShell
    // - les assets (icônes, styles)
    // C'est transparent et ne nécessite pas de rechargement utilisateur
    logToServer('[PHASE 6] 🔄 Mise à jour du cache HTML (background) - Service Worker');
  }, []);

  return (
    <LocalDbStatusProvider>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
          </div>
        }
      >
        <AppShellClient />
      </Suspense>
    </LocalDbStatusProvider>
  );
}



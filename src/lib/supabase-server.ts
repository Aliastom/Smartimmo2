/**
 * Client Supabase pour le serveur
 * Utilisé dans les Server Components, Route Handlers, Server Actions
 * 
 * IMPORTANT: Ne jamais importer ce fichier dans un composant client
 */

import { createServerClient as createServerClientBase } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Crée un client Supabase pour le serveur
 * Gère automatiquement les cookies pour maintenir la session
 */
export async function createServerClient() {
  // Valeurs par défaut pour le build (Next.js ne peut pas accéder aux variables au build time)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

  // Validation seulement au runtime (pas pendant le build)
  if (typeof window !== 'undefined' || process.env.NODE_ENV === 'production') {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.warn('⚠️  Variables Supabase non configurées - Auth désactivé');
    }
  }

  const cookieStore = await cookies();

  return createServerClientBase(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // Ignore les erreurs lors du SSR / génération statique
            // Les cookies ne peuvent être modifiés que dans les Server Actions ou Route Handlers
          }
        },
      },
    }
  );
}


/**
 * Helper pour récupérer l'utilisateur actuellement connecté
 * Utilise Supabase Auth + Prisma pour obtenir les données complètes
 * 
 * OPTIMISATION: Cache en mémoire avec TTL de 30 secondes pour réduire les appels DB
 */

import { createServerClient } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { cache } from 'react';

export type CurrentUser = {
  id: string; // ID Prisma
  supabaseId: string;
  email: string;
  name: string | null;
  role: string;
  emailVerified: Date | null;
  organizationId: string;
};

// Cache en mémoire pour getCurrentUser (TTL: 30 secondes)
// Évite les appels répétés à Supabase + Prisma dans la même requête
const userCache = new Map<string, { user: CurrentUser | null; expires: number }>();
const CACHE_TTL = 30 * 1000; // 30 secondes

function getCachedUser(supabaseId: string): CurrentUser | null | undefined {
  const cached = userCache.get(supabaseId);
  if (cached && cached.expires > Date.now()) {
    return cached.user;
  }
  if (cached) {
    userCache.delete(supabaseId); // Expiré, supprimer
  }
  return undefined;
}

function setCachedUser(supabaseId: string, user: CurrentUser | null): void {
  userCache.set(supabaseId, {
    user,
    expires: Date.now() + CACHE_TTL,
  });
  
  // Nettoyer les entrées expirées toutes les 5 minutes
  if (userCache.size > 100) {
    const now = Date.now();
    for (const [key, value] of userCache.entries()) {
      if (value.expires <= now) {
        userCache.delete(key);
      }
    }
  }
}

/**
 * Récupère l'utilisateur actuellement connecté
 * Retourne null si non authentifié
 * 
 * Utilisé avec cache() pour éviter les appels multiples dans un même rendu
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  try {
    // 1) Récupérer la session Supabase
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    // Ignorer silencieusement les erreurs de refresh token (utilisateur non connecté)
    if (error) {
      // Les erreurs de refresh token sont normales quand l'utilisateur n'est pas connecté
      const isRefreshTokenError = 
        error.message?.includes('refresh_token_not_found') ||
        error.message?.includes('Invalid Refresh Token') ||
        (error as any)?.code === 'refresh_token_not_found';
      
      if (!isRefreshTokenError) {
        // Logger uniquement les autres erreurs
        console.warn('[getCurrentUser] Erreur Supabase:', error.message);
      }
      return null;
    }

    if (!user) {
      return null;
    }

    // ✅ OPTIMISATION: Vérifier le cache avant d'interroger Prisma
    const cached = getCachedUser(user.id);
    if (cached !== undefined) {
      return cached;
    }

    // 2) Récupérer l'utilisateur Prisma correspondant
    const prismaUser = await prisma.user.findFirst({
      where: {
        OR: [
          { supabaseId: user.id },
          { email: user.email || undefined },
        ],
      },
      select: {
        id: true,
        supabaseId: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        organizationId: true,
      },
    });

    if (!prismaUser) {
      console.warn('[getCurrentUser] Utilisateur Supabase sans compte Prisma:', user.id);
      setCachedUser(user.id, null); // Cache le résultat null aussi
      return null;
    }

    // 3) Retourner les données formatées
    const result: CurrentUser = {
      id: prismaUser.id,
      supabaseId: user.id,
      email: prismaUser.email || user.email || '',
      name: prismaUser.name,
      role: prismaUser.role,
      emailVerified: prismaUser.emailVerified,
      organizationId: prismaUser.organizationId,
    };
    
    // ✅ OPTIMISATION: Mettre en cache le résultat
    setCachedUser(user.id, result);
    
    return result;
  } catch (error) {
    // Ignorer silencieusement les erreurs de refresh token
    const isRefreshTokenError = 
      error instanceof Error && (
        error.message?.includes('refresh_token_not_found') ||
        error.message?.includes('Invalid Refresh Token') ||
        (error as any)?.code === 'refresh_token_not_found'
      );
    
    if (!isRefreshTokenError) {
      console.error('[getCurrentUser] Erreur:', error);
    }
    return null;
  }
});

/**
 * Vérifie si l'utilisateur est admin
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === 'ADMIN';
}

/**
 * Require l'authentification - throw une erreur si non connecté
 * Utile pour les Server Actions
 */
export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('Non authentifié');
  }
  
  return user;
}

/**
 * Require le rôle admin - throw une erreur si pas admin
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireAuth();
  
  if (user.role !== 'ADMIN') {
    throw new Error('Accès réservé aux administrateurs');
  }
  
  return user;
}


/**
 * Helper pour récupérer l'utilisateur actuellement connecté
 * Utilise Supabase Auth + Prisma pour obtenir les données complètes
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
      return null;
    }

    // 3) Retourner les données formatées
    return {
      id: prismaUser.id,
      supabaseId: user.id,
      email: prismaUser.email || user.email || '',
      name: prismaUser.name,
      role: prismaUser.role,
      emailVerified: prismaUser.emailVerified,
      organizationId: prismaUser.organizationId,
    };
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


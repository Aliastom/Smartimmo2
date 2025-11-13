/**
 * Helper pour protéger les routes d'administration
 * Vérifie que l'utilisateur est connecté ET est ADMIN
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from './getCurrentUser';

/**
 * Protège une route API en vérifiant que l'utilisateur est ADMIN
 * Retourne null si OK, sinon retourne une réponse d'erreur
 * 
 * Usage dans une route API:
 * ```ts
 * export async function GET() {
 *   const authError = await protectAdminRoute();
 *   if (authError) return authError;
 *   
 *   // ... votre logique admin
 * }
 * ```
 */
export async function protectAdminRoute(): Promise<NextResponse | null> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Accès réservé aux administrateurs' },
        { status: 403 }
      );
    }

    return null; // Pas d'erreur, l'utilisateur est admin
  } catch (error) {
    console.error('[protectAdminRoute] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur d\'authentification' },
      { status: 500 }
    );
  }
}

/**
 * Version qui retourne directement l'utilisateur admin ou throw
 * Pour les Server Actions ou les routes où on veut gérer l'erreur différemment
 */
export async function getAdminUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Non authentifié');
  }

  if (user.role !== 'ADMIN') {
    throw new Error('Accès réservé aux administrateurs');
  }

  return user;
}


/**
 * Helper pour protéger les routes avec gestion des rôles
 * - GET : Accessible aux utilisateurs authentifiés (USER et ADMIN)
 * - POST/PATCH/DELETE : Accessible uniquement aux ADMIN
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from './getCurrentUser';

/**
 * Protège une route API selon la méthode HTTP
 * - GET : USER et ADMIN peuvent lire
 * - POST/PATCH/DELETE : Seuls les ADMIN peuvent écrire
 * 
 * @param method - Méthode HTTP (GET, POST, PATCH, DELETE, etc.)
 * @returns null si OK, sinon retourne une réponse d'erreur
 * 
 * Usage dans une route API:
 * ```ts
 * export async function GET() {
 *   const authError = await protectRouteWithRole('GET');
 *   if (authError) return authError;
 *   // ... votre logique
 * }
 * 
 * export async function POST() {
 *   const authError = await protectRouteWithRole('POST');
 *   if (authError) return authError;
 *   // ... votre logique admin
 * }
 * ```
 */
export async function protectRouteWithRole(method: string): Promise<NextResponse | null> {
  try {
    const user = await getCurrentUser();

    // Toutes les méthodes nécessitent une authentification
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    // GET : Accessible à tous les utilisateurs authentifiés (USER et ADMIN)
    if (method === 'GET') {
      return null; // OK, utilisateur authentifié
    }

    // POST, PATCH, DELETE, PUT : Accessible uniquement aux ADMIN
    if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(method)) {
      if (user.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Accès réservé aux administrateurs' },
          { status: 403 }
        );
      }
      return null; // OK, utilisateur est admin
    }

    // Pour les autres méthodes (OPTIONS, HEAD, etc.), permettre l'accès aux utilisateurs authentifiés
    return null;
  } catch (error) {
    console.error('[protectRouteWithRole] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur d\'authentification' },
      { status: 500 }
    );
  }
}


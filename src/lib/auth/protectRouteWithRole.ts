/**
 * Helper pour protéger les routes avec gestion des rôles
 * - GET : Accessible aux utilisateurs authentifiés (USER et ADMIN) par défaut
 * - POST/PATCH/DELETE : Accessible uniquement aux ADMIN par défaut
 * - Peut être restreint avec le paramètre allowedRoles
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from './getCurrentUser';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Protège une route API selon la méthode HTTP
 * - GET : USER et ADMIN peuvent lire (par défaut)
 * - POST/PATCH/DELETE : Seuls les ADMIN peuvent écrire (par défaut)
 * - allowedRoles : Permet de restreindre l'accès à certains rôles uniquement
 * 
 * @param method - Méthode HTTP (GET, POST, PATCH, DELETE, etc.)
 * @param allowedRoles - Rôles autorisés (par défaut: ['ADMIN', 'USER'] pour GET, ['ADMIN'] pour les autres)
 * @returns null si OK, sinon retourne une réponse d'erreur
 * 
 * Usage dans une route API:
 * ```ts
 * // GET accessible à tous les utilisateurs authentifiés
 * export async function GET() {
 *   const authError = await protectRouteWithRole('GET');
 *   if (authError) return authError;
 *   // ... votre logique
 * }
 * 
 * // GET accessible uniquement aux ADMIN
 * export async function GET() {
 *   const authError = await protectRouteWithRole('GET', ['ADMIN']);
 *   if (authError) return authError;
 *   // ... votre logique admin
 * }
 * 
 * // POST accessible uniquement aux ADMIN (par défaut)
 * export async function POST() {
 *   const authError = await protectRouteWithRole('POST');
 *   if (authError) return authError;
 *   // ... votre logique admin
 * }
 * ```
 */
export async function protectRouteWithRole(
  method: HttpMethod,
  allowedRoles: Array<'ADMIN' | 'USER'> = ['ADMIN', 'USER']
): Promise<NextResponse | null> {
  try {
    const user = await getCurrentUser();

    // Toutes les méthodes nécessitent une authentification
    if (!user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    // Vérifier si le rôle de l'utilisateur est autorisé
    if (!allowedRoles.includes(user.role as 'ADMIN' | 'USER')) {
      return NextResponse.json(
        { error: 'Accès refusé pour ce rôle' },
        { status: 403 }
      );
    }

    // Pour les opérations d'écriture (POST, PUT, PATCH, DELETE), 
    // seuls les ADMIN sont autorisés par défaut (même si allowedRoles contient USER)
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Accès réservé aux administrateurs pour les opérations d\'écriture' },
        { status: 403 }
      );
    }

    return null; // OK, utilisateur est autorisé
  } catch (error) {
    console.error('[protectRouteWithRole] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur d\'authentification' },
      { status: 500 }
    );
  }
}




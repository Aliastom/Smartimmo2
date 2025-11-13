/**
 * Query Executor - Exécute les requêtes SQL en lecture seule de manière sécurisée
 */

import { prisma } from "@/lib/prisma";

/**
 * Exécute une requête SQL et retourne la valeur scalaire
 * @param sql - Requête SQL paramétrée
 * @param params - Paramètres de la requête
 * @returns La valeur numérique du résultat
 */
export async function runScalar(sql: string, params: any[]): Promise<number> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ value: number | bigint }[]>(
      sql,
      ...params
    );
    
    const value = rows?.[0]?.value ?? 0;
    
    // Convertir BigInt en Number si nécessaire
    return typeof value === 'bigint' ? Number(value) : value;
  } catch (error) {
    console.error("[KPI Query] Erreur SQL:", error);
    throw error;
  }
}


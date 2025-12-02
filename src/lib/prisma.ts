import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/**
 * ✅ OPTIMISATION: Configuration Prisma avec connection pooling
 * 
 * Le connection pooling est géré via la DATABASE_URL avec les paramètres:
 * - connection_limit: Nombre max de connexions dans le pool (défaut: Prisma gère automatiquement)
 * - pool_timeout: Timeout pour obtenir une connexion du pool
 * 
 * Pour PostgreSQL, Prisma utilise PgBouncer ou le pool natif selon la configuration.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    // ✅ OPTIMISATION: Désactiver les logs de query en production pour améliorer les performances
    // Les logs sont coûteux en I/O
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

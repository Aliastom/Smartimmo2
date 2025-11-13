/**
 * Rate Limiter - Limitation du nombre de requêtes IA
 * Utilise Redis si disponible, sinon mémoire locale (non persistant)
 */

import type { RateLimitResult, RateLimitConfig } from '../types';

// Configuration depuis ENV
const AI_RATE_LIMIT_RPM = parseInt(process.env.AI_RATE_LIMIT_RPM || '60', 10);
const WINDOW_MS = 60 * 1000; // 1 minute

// Store local (fallback si pas de Redis)
const localStore = new Map<
  string,
  { count: number; resetAt: number }
>();

// Client Redis (optionnel)
let redisClient: any = null;

/**
 * Initialise Redis si disponible
 */
async function initRedis() {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log('[RateLimit] Redis non configuré, utilisation de la mémoire locale');
    return null;
  }

  try {
    const Redis = (await import('ioredis')).default;
    redisClient = new Redis(redisUrl);
    console.log('[RateLimit] Redis connecté');
    return redisClient;
  } catch (error) {
    console.warn('[RateLimit] Impossible de se connecter à Redis:', error);
    return null;
  }
}

/**
 * Vérifie le rate limit pour un identifiant (IP ou userId)
 * @param identifier L'identifiant unique (IP, userId, etc.)
 * @param config Configuration optionnelle
 * @returns Résultat du rate limit
 */
export async function checkRateLimit(
  identifier: string,
  config?: Partial<RateLimitConfig>
): Promise<RateLimitResult> {
  const maxRequests = config?.maxRequests || AI_RATE_LIMIT_RPM;
  const windowMs = config?.windowMs || WINDOW_MS;

  // Tenter d'utiliser Redis
  const redis = await initRedis();

  if (redis) {
    return checkRateLimitRedis(identifier, maxRequests, windowMs, redis);
  } else {
    return checkRateLimitLocal(identifier, maxRequests, windowMs);
  }
}

/**
 * Rate limit avec Redis (distribué)
 */
async function checkRateLimitRedis(
  identifier: string,
  maxRequests: number,
  windowMs: number,
  redis: any
): Promise<RateLimitResult> {
  const key = `ratelimit:ai:${identifier}`;
  const now = Date.now();
  const resetAt = new Date(now + windowMs);

  try {
    // Utiliser Redis INCR + EXPIRE atomique
    const count = await redis.incr(key);

    if (count === 1) {
      // Première requête, définir l'expiration
      await redis.pexpire(key, windowMs);
    }

    const allowed = count <= maxRequests;
    const remaining = Math.max(0, maxRequests - count);

    return {
      allowed,
      remaining,
      resetAt,
    };
  } catch (error) {
    console.error('[RateLimit] Erreur Redis:', error);
    // Fallback : autoriser la requête en cas d'erreur
    return {
      allowed: true,
      remaining: maxRequests,
      resetAt,
    };
  }
}

/**
 * Rate limit avec store local (mémoire)
 */
function checkRateLimitLocal(
  identifier: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  // Récupérer ou créer l'entrée
  let entry = localStore.get(identifier);

  if (!entry || entry.resetAt < now) {
    // Nouvelle fenêtre
    entry = {
      count: 1,
      resetAt: now + windowMs,
    };
    localStore.set(identifier, entry);

    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: new Date(entry.resetAt),
    };
  }

  // Fenêtre existante
  entry.count++;

  const allowed = entry.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - entry.count);

  return {
    allowed,
    remaining,
    resetAt: new Date(entry.resetAt),
  };
}

/**
 * Nettoie le store local (appeler périodiquement)
 */
export function cleanupLocalStore() {
  const now = Date.now();
  for (const [key, entry] of localStore.entries()) {
    if (entry.resetAt < now) {
      localStore.delete(key);
    }
  }
}

// Nettoyage automatique toutes les 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupLocalStore, 5 * 60 * 1000);
}

/**
 * Réinitialise le rate limit pour un identifiant (pour tests)
 * @param identifier L'identifiant
 */
export async function resetRateLimit(identifier: string): Promise<void> {
  const redis = await initRedis();

  if (redis) {
    const key = `ratelimit:ai:${identifier}`;
    await redis.del(key);
  } else {
    localStore.delete(identifier);
  }
}


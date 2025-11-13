/**
 * Client HTTP pour OpenFisca-France
 * Cache 24h pour éviter les appels répétés
 */

import axios from 'axios';

const BASE_URL = process.env.OPENFISCA_BASE_URL || 'http://localhost:5000';

/**
 * Cache simple en mémoire avec TTL 24h
 */
const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Nettoyer le cache périodiquement
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) {
      cache.delete(key);
    }
  }
}, 60 * 60 * 1000); // Toutes les heures

/**
 * GET générique sur l'API OpenFisca
 */
export async function ofGet(path: string, params?: Record<string, any>): Promise<any> {
  const cacheKey = `${path}:${JSON.stringify(params || {})}`;
  
  // Vérifier le cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    console.log(`[OpenFisca] Cache hit: ${cacheKey}`);
    return cached.data;
  }
  
  // Appel HTTP
  try {
    console.log(`[OpenFisca] Fetching: ${BASE_URL}${path}`);
    
    const response = await axios.get(`${BASE_URL}${path}`, {
      params,
      timeout: 15000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SmartImmo/1.0'
      }
    });
    
    const data = response.data;
    
    // Sauvegarder dans le cache
    cache.set(cacheKey, {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS
    });
    
    console.log(`[OpenFisca] Success: ${path}`);
    
    return data;
    
  } catch (error: any) {
    console.error(`[OpenFisca] Error fetching ${path}:`, error.message);
    throw error;
  }
}

/**
 * Healthcheck de l'API OpenFisca
 */
export async function healthcheck(): Promise<boolean> {
  try {
    await axios.get(`${BASE_URL}/spec`, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Récupère la version d'OpenFisca
 */
export async function getVersion(): Promise<string | null> {
  try {
    const spec = await ofGet('/spec');
    return spec?.info?.version || spec?.version || null;
  } catch {
    return null;
  }
}


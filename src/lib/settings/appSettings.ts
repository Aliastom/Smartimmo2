/**
 * Service de gestion des paramètres applicatifs (AppSettings)
 * Système générique réutilisable pour toutes les fonctionnalités.
 * 
 * Fonctionnement :
 * - Lecture de la BDD avec cache en mémoire (TTL 60s)
 * - Fallback automatique vers .env ou constantes si non configuré
 * - Stockage JSON pour flexibilité (string|number|boolean|object)
 */

import { prisma } from '@/lib/prisma';

// Cache en mémoire simple avec TTL
interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 60 * 1000; // 60 secondes

/**
 * Récupère une valeur de configuration depuis la BDD ou le fallback
 * @param key Clé du paramètre (ex: "gestion.enable")
 * @param fallback Valeur par défaut si non trouvée en BDD
 * @returns La valeur typée
 */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  // 1. Vérifier le cache
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[Settings] Cache hit for key: ${key}`);
    return cached.value as T;
  }

  try {
    // 2. Lire depuis la BDD
    const setting = await prisma.appSetting.findUnique({
      where: { key },
    });

    if (setting) {
      // Parser la valeur JSON
      const value = JSON.parse(setting.value) as T;
      
      // Mettre en cache
      cache.set(key, {
        value,
        timestamp: Date.now(),
      });

      console.log(`[Settings] DB value for key: ${key} =`, value);
      return value;
    }

    // 3. Fallback si non trouvé
    console.warn(`[Settings] No DB value for key: ${key}, using fallback:`, fallback);
    return fallback;
  } catch (error) {
    console.error(`[Settings] Error reading key: ${key}:`, error);
    return fallback;
  }
}

/**
 * Définit une valeur de configuration (upsert)
 * @param key Clé du paramètre
 * @param value Valeur à stocker
 * @param description Description optionnelle
 */
export async function setSetting(
  key: string,
  value: unknown,
  description?: string
): Promise<void> {
  try {
    // Convertir en JSON
    const jsonValue = JSON.stringify(value);

    // Upsert dans la BDD
    await prisma.appSetting.upsert({
      where: { key },
      update: {
        value: jsonValue,
        description: description || undefined,
      },
      create: {
        key,
        value: jsonValue,
        description: description || undefined,
      },
    });

    // Invalider le cache pour cette clé
    cache.delete(key);

    console.log(`[Settings] Updated key: ${key} =`, value);
  } catch (error) {
    console.error(`[Settings] Error setting key: ${key}:`, error);
    throw error;
  }
}

/**
 * Supprime une valeur de configuration
 * @param key Clé du paramètre
 */
export async function deleteSetting(key: string): Promise<void> {
  try {
    await prisma.appSetting.delete({
      where: { key },
    });

    cache.delete(key);
    console.log(`[Settings] Deleted key: ${key}`);
  } catch (error) {
    console.error(`[Settings] Error deleting key: ${key}:`, error);
    throw error;
  }
}

/**
 * Récupère tous les paramètres avec un préfixe donné
 * @param prefix Préfixe des clés (ex: "gestion.")
 * @returns Map de clés/valeurs
 */
export async function getSettingsByPrefix(prefix: string): Promise<Record<string, unknown>> {
  try {
    const settings = await prisma.appSetting.findMany({
      where: {
        key: {
          startsWith: prefix,
        },
      },
    });

    const result: Record<string, unknown> = {};
    for (const setting of settings) {
      try {
        result[setting.key] = JSON.parse(setting.value);
      } catch (error) {
        console.error(`[Settings] Error parsing value for key: ${setting.key}:`, error);
        result[setting.key] = setting.value;
      }
    }

    return result;
  } catch (error) {
    console.error(`[Settings] Error getting settings by prefix: ${prefix}:`, error);
    return {};
  }
}

/**
 * Invalide tout le cache (utile après modifications en masse)
 */
export function clearSettingsCache(): void {
  cache.clear();
  console.log('[Settings] Cache cleared');
}

// ============================================================================
// HELPERS SPÉCIFIQUES À LA GESTION DÉLÉGUÉE
// ============================================================================

/**
 * Vérifie si la fonctionnalité "Gestion déléguée" est activée
 * Fallback : ENABLE_GESTION_SOCIETE de .env
 */
export async function isGestionDelegueEnabled(): Promise<boolean> {
  const fallback = process.env.ENABLE_GESTION_SOCIETE === 'true';
  return getSetting<boolean>('gestion.enable', fallback);
}

/**
 * Récupère les codes système utilisés pour la gestion déléguée
 * - rentNature : code de la nature pour reconnaître un LOYER
 * - rentCategory : code de la catégorie par défaut pour un LOYER
 * - mgmtNature : code de la nature pour créer une COMMISSION
 * - mgmtCategory : code de la catégorie pour créer une COMMISSION
 */
export async function getGestionCodes() {
  return {
    rentNature: await getSetting<string>(
      'gestion.codes.rent.nature',
      process.env.RENT_NATURE_CODE || 'RECETTE_LOYER'
    ),
    rentCategory: await getSetting<string>(
      'gestion.codes.rent.Category',
      process.env.RENT_CATEGORY_CODE || 'loyer_principal'
    ),
    mgmtNature: await getSetting<string>(
      'gestion.codes.mgmt.nature',
      process.env.MGMT_FEE_NATURE_CODE || 'DEPENSE_GESTION'
    ),
    mgmtCategory: await getSetting<string>(
      'gestion.codes.mgmt.Category',
      process.env.MGMT_FEE_CATEGORY_CODE || 'frais_gestion'
    ),
  };
}

/**
 * Récupère les valeurs par défaut pour une nouvelle société de gestion
 */
export async function getGestionDefaults() {
  return {
    baseSurEncaissement: await getSetting<boolean>(
      'gestion.defaults.baseSurEncaissement',
      true
    ),
    tvaApplicable: await getSetting<boolean>(
      'gestion.defaults.tvaApplicable',
      false
    ),
    tvaTaux: await getSetting<number>(
      'gestion.defaults.tvaTaux',
      20
    ),
  };
}



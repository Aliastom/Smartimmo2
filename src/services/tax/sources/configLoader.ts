/**
 * Chargeur de configuration des sources de scraping
 * Charge depuis la BDD ou utilise les valeurs par défaut
 */

import { prisma } from '@/lib/prisma';
import { DEFAULT_SOURCES } from './config';

export interface TaxSourcesConfig {
  [key: string]: {
    name: string;
    baseUrl: string;
    status: 'active' | 'inactive';
    urls?: Array<{
      path: string;
      label: string;
      section: string;
      verified: string | null;
      notes?: string;
    }>;
    parameters?: Array<{
      id: string;
      label: string;
      section: string;
    }>;
  };
}

/**
 * Charge la configuration des sources depuis la BDD
 * Fallback sur DEFAULT_SOURCES si rien en BDD
 */
export async function loadSourcesConfig(): Promise<TaxSourcesConfig> {
  try {
    const configs = await prisma.taxSourceConfig.findMany({
      orderBy: { key: 'asc' }
    });

    // Si aucune config en BDD, utiliser les valeurs par défaut
    if (configs.length === 0) {
      console.log('[ConfigLoader] Aucune config en BDD, utilisation valeurs par défaut');
      return DEFAULT_SOURCES;
    }

    // Convertir en format TaxSourcesConfig
    const sources: TaxSourcesConfig = {};
    
    for (const config of configs) {
      try {
        const configData = JSON.parse(config.configJson);
        sources[config.key] = {
          name: config.name,
          baseUrl: config.baseUrl,
          status: config.status as 'active' | 'inactive',
          ...configData
        };
      } catch (error) {
        console.error(`[ConfigLoader] Erreur parsing config ${config.key}:`, error);
        // Fallback sur la valeur par défaut pour cette source
        if (DEFAULT_SOURCES[config.key]) {
          sources[config.key] = DEFAULT_SOURCES[config.key];
        }
      }
    }

    console.log(`[ConfigLoader] ${configs.length} source(s) chargée(s) depuis la BDD`);
    return sources;

  } catch (error) {
    console.error('[ConfigLoader] Erreur chargement config:', error);
    console.log('[ConfigLoader] Fallback sur valeurs par défaut');
    return DEFAULT_SOURCES;
  }
}

/**
 * Sauvegarde la configuration des sources en BDD
 */
export async function saveSourcesConfig(
  sources: TaxSourcesConfig,
  updatedBy: string
): Promise<{ count: number }> {
  const savedConfigs = [];

  for (const [key, sourceConfig] of Object.entries(sources)) {
    const { name, baseUrl, status, ...restConfig } = sourceConfig;

    const saved = await prisma.taxSourceConfig.upsert({
      where: { key },
      create: {
        key,
        name,
        baseUrl,
        status: status || 'active',
        configJson: JSON.stringify(restConfig),
        updatedBy
      },
      update: {
        name,
        baseUrl,
        status: status || 'active',
        configJson: JSON.stringify(restConfig),
        updatedBy
      }
    });

    savedConfigs.push(saved);
  }

  console.log(`[ConfigLoader] ${savedConfigs.length} source(s) sauvegardée(s) par ${updatedBy}`);
  
  return { count: savedConfigs.length };
}


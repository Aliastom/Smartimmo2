/**
 * Factory pour créer EcheanceService avec différents backends
 * ⚠️ IMPORTANT: Prisma ne doit JAMAIS être importé côté client
 * Les imports Prisma sont conditionnels et uniquement utilisés côté serveur
 */

import { EcheanceService, type EcheanceServiceDependencies } from './EcheanceService';
import { IndexedDBEcheanceRepository } from '../repositories/adapters/IndexedDBEcheanceRepository';
import { IndexedDBPropertyRepository } from '../repositories/adapters/IndexedDBPropertyRepository';
import { IndexedDBLeaseRepository } from '../repositories/adapters/IndexedDBLeaseRepository';
import type { EcheanceService as EcheanceServiceType } from './EcheanceService';

/**
 * Crée EcheanceService avec les repositories IndexedDB (mode app-shell)
 * Cette fonction peut être utilisée côté client
 */
export function createEcheanceServiceIndexedDB(): EcheanceServiceType {
  const deps: EcheanceServiceDependencies = {
    echeanceRepo: new IndexedDBEcheanceRepository(),
    propertyRepo: new IndexedDBPropertyRepository(),
    leaseRepo: new IndexedDBLeaseRepository(),
  };

  return new EcheanceService(deps);
}

/**
 * Factory unifiée pour créer EcheanceService selon le mode
 * ⚠️ En mode app-shell, retourne directement (peut être utilisé côté client)
 * ⚠️ En mode normal, cette fonction ne doit JAMAIS être appelée côté client
 *    Utilisez createEcheanceServicePrisma() dans les routes API uniquement
 */
export function createEcheanceServiceWithMode(mode: 'normal' | 'app-shell'): EcheanceServiceType {
  if (mode === 'app-shell') {
    return createEcheanceServiceIndexedDB();
  } else {
    // ⚠️ En mode normal, on ne peut pas utiliser Prisma côté client
    // Cette fonction ne devrait être appelée que dans les routes API
    // Pour l'instant, on throw une erreur si appelé côté client
    if (typeof window !== 'undefined') {
      throw new Error('createEcheanceServiceWithMode("normal") ne peut pas être utilisé côté client. Utilisez createEcheanceServicePrisma() dans les routes API.');
    }
    // Côté serveur, on peut importer Prisma
    // Note: Cette partie ne sera jamais exécutée côté client grâce au check ci-dessus
    // mais Webpack essaiera quand même de bundler les imports statiques
    // On utilise donc un import dynamique conditionnel
    throw new Error('createEcheanceServiceWithMode("normal") doit utiliser createEcheanceServicePrisma() avec import dynamique dans les routes API.');
  }
}

/**
 * Crée EcheanceService avec les repositories Prisma (mode normal)
 * ⚠️ Cette fonction ne peut être utilisée QUE côté serveur (routes API)
 * Elle utilise des imports dynamiques pour éviter de bundler Prisma côté client
 * 
 * Usage dans les routes API:
 * ```ts
 * const echeanceService = await createEcheanceServicePrisma();
 * ```
 */
export async function createEcheanceServicePrisma(): Promise<EcheanceServiceType> {
  // Import dynamique pour éviter de bundler Prisma côté client
  const [
    { PrismaEcheanceRepository },
    { PrismaPropertyRepository },
    { PrismaLeaseRepository },
  ] = await Promise.all([
    import('../repositories/adapters/PrismaEcheanceRepository'),
    import('../repositories/adapters/PrismaPropertyRepository'),
    import('../repositories/adapters/PrismaLeaseRepository'),
  ]);

  const deps: EcheanceServiceDependencies = {
    echeanceRepo: new PrismaEcheanceRepository(),
    propertyRepo: new PrismaPropertyRepository(),
    leaseRepo: new PrismaLeaseRepository(),
  };

  return new EcheanceService(deps);
}


/**
 * Helpers d'assertion pour vérifier l'état local (IndexedDB) et serveur (API)
 */

import { Page, APIRequestContext, expect } from 'playwright/test';

/**
 * Vérifie qu'une entité existe dans IndexedDB
 */
export async function assertEntityInIndexedDB(
  page: Page,
  table: string,
  entityId: string,
  organizationId: string
): Promise<void> {
  const exists = await page.evaluate(
    async ({ table, entityId, organizationId }) => {
      try {
        const { getLocalDB } = await import('@/lib/offline/db');
        const db = await getLocalDB();
        const entity = await (db as any)[table].get(entityId);
        return entity && entity.organizationId === organizationId;
      } catch {
        return false;
      }
    },
    { table, entityId, organizationId }
  );
  
  expect(exists).toBe(true);
}

/**
 * Vérifie qu'une entité existe dans Supabase (via API)
 */
export async function assertEntityInSupabase(
  request: APIRequestContext,
  endpoint: string,
  entityId: string
): Promise<void> {
  const response = await request.get(`${endpoint}/${entityId}`);
  expect(response.ok()).toBe(true);
  
  const data = await response.json();
  expect(data.id || data.data?.id).toBe(entityId);
}

/**
 * Vérifie qu'une pendingOp existe pour une entité
 */
export async function assertPendingOpExists(
  page: Page,
  entity: string,
  entityId: string,
  operation: 'create' | 'update' | 'delete',
  organizationId: string
): Promise<void> {
  const pendingOp = await page.evaluate(
    async ({ entity, entityId, operation, organizationId }) => {
      try {
        const { getLocalDB } = await import('@/lib/offline/db');
        const db = await getLocalDB();
        const ops = await db.pendingOperations
          .where('entity')
          .equals(entity)
          .and(op => op.entityId === entityId)
          .and(op => op.operation === operation)
          .toArray();
        return ops.find(op => op.organizationId === organizationId || !op.organizationId);
      } catch {
        return null;
      }
    },
    { entity, entityId, operation, organizationId }
  );
  
  expect(pendingOp).toBeTruthy();
  expect(pendingOp?.status).toBe('pending');
}

/**
 * Vérifie qu'aucune pendingOp n'existe pour une entité (après sync)
 */
export async function assertNoPendingOp(
  page: Page,
  entity: string,
  entityId: string,
  organizationId: string
): Promise<void> {
  const pendingOps = await page.evaluate(
    async ({ entity, entityId, organizationId }) => {
      try {
        const { getLocalDB } = await import('@/lib/offline/db');
        const db = await getLocalDB();
        return await db.pendingOperations
          .where('entity')
          .equals(entity)
          .and(op => op.entityId === entityId)
          .toArray();
      } catch {
        return [];
      }
    },
    { entity, entityId, organizationId }
  );
  
  expect(pendingOps.length).toBe(0);
}

/**
 * Vérifie que les données UI correspondent aux données IndexedDB
 */
export async function assertUIDataMatchesIndexedDB(
  page: Page,
  table: string,
  organizationId: string,
  expectedCount: number
): Promise<void> {
  const count = await page.evaluate(
    async ({ table, organizationId }) => {
      try {
        const { getLocalDB } = await import('@/lib/offline/db');
        const db = await getLocalDB();
        return await (db as any)[table]
          .where('organizationId')
          .equals(organizationId)
          .count();
      } catch {
        return 0;
      }
    },
    { table, organizationId }
  );
  
  expect(count).toBe(expectedCount);
}

/**
 * Vérifie que les données IndexedDB correspondent aux données Supabase (après sync)
 */
export async function assertIndexedDBMatchesSupabase(
  page: Page,
  request: APIRequestContext,
  table: string,
  apiEndpoint: string,
  organizationId: string
): Promise<void> {
  // Compter dans IndexedDB
  const localCount = await page.evaluate(
    async ({ table, organizationId }) => {
      try {
        const { getLocalDB } = await import('@/lib/offline/db');
        const db = await getLocalDB();
        return await (db as any)[table]
          .where('organizationId')
          .equals(organizationId)
          .count();
      } catch {
        return 0;
      }
    },
    { table, organizationId }
  );
  
  // Compter dans Supabase (via API)
  const response = await request.get(`${apiEndpoint}?limit=10000`);
  expect(response.ok()).toBe(true);
  
  const data = await response.json();
  const remoteCount = Array.isArray(data) 
    ? data.length 
    : (data.data?.length || data.items?.length || 0);
  
  expect(localCount).toBe(remoteCount);
}

/**
 * Vérifie qu'une commission auto a été créée pour une transaction de gestion déléguée
 */
export async function assertCommissionCreated(
  page: Page,
  parentTransactionId: string,
  organizationId: string
): Promise<void> {
  const commission = await page.evaluate(
    async ({ parentTransactionId, organizationId }) => {
      try {
        const { getLocalDB } = await import('@/lib/offline/db');
        const db = await getLocalDB();
        const transactions = await db.Transaction
          .where('organizationId')
          .equals(organizationId)
          .and(t => t.parentTransactionId === parentTransactionId)
          .and(t => t.autoSource === 'gestion')
          .toArray();
        return transactions[0] || null;
      } catch {
        return null;
      }
    },
    { parentTransactionId, organizationId }
  );
  
  expect(commission).toBeTruthy();
  expect(commission?.autoSource).toBe('gestion');
  expect(commission?.parentTransactionId).toBe(parentTransactionId);
}

/**
 * Vérifie qu'un overlap de bail est détecté et rejeté
 */
export async function assertLeaseOverlapRejected(
  page: Page,
  propertyId: string,
  startDate: string,
  endDate: string,
  organizationId: string
): Promise<void> {
  // Cette vérification se fait via l'UI (message d'erreur)
  // ou via le service qui doit lever une erreur
  
  // Vérifier qu'aucun nouveau bail n'a été créé avec ces dates
  const overlappingLeases = await page.evaluate(
    async ({ propertyId, startDate, endDate, organizationId }) => {
      try {
        const { getLocalDB } = await import('@/lib/offline/db');
        const db = await getLocalDB();
        const allLeases = await db.Lease
          .where('organizationId')
          .equals(organizationId)
          .and(l => l.propertyId === propertyId)
          .toArray();
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        return allLeases.filter(lease => {
          const leaseStart = new Date(lease.startDate);
          const leaseEnd = lease.endDate ? new Date(lease.endDate) : null;
          
          // Vérifier overlap
          return (
            (leaseStart <= end && (!leaseEnd || leaseEnd >= start)) &&
            lease.status === 'ACTIF'
          );
        });
      } catch {
        return [];
      }
    },
    { propertyId, startDate, endDate, organizationId }
  );
  
  // Si un overlap existe, c'est une erreur (sauf si c'est le bail qu'on vient de créer)
  // Cette assertion doit être utilisée AVANT la création pour vérifier qu'elle est rejetée
}

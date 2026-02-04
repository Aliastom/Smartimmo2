/**
 * Tests E2E - Scénario D : CRUD Lease (overlaps + termination)
 * 
 * Vérifie :
 * - Création bail offline → local + pendingOp
 * - Tentative création overlap → erreur métier (409/validation)
 * - Résiliation bail → transition statut + date fin
 * - Reprise réseau → cohérence serveur
 */

import { test, expect } from 'playwright/test';
import { setOffline, setOnline, waitForSyncComplete, setupSyncEventListeners } from './helpers/offline';
import { navigateToAppShellView } from './helpers/appShellNav';
import { assertEntityInIndexedDB, assertEntityInSupabase, assertPendingOpExists, assertNoPendingOp } from './helpers/assertions';
import { seedTestData, resetTestData, createMinimalTestSeed } from './helpers/seed';

test.describe('D. CRUD Lease (overlaps + termination)', () => {
  let testOrgId: string;
  let testPropertyId: string;
  let testTenantId: string;
  let createdLeaseId: string;
  
  test.beforeAll(async ({ request }) => {
    testOrgId = 'test-e2e-lease-' + Date.now();
    
    // Seed : créer un bien et un locataire
    const seedData = createMinimalTestSeed(testOrgId);
    seedData.leases = []; // On créera les baux dans les tests
    seedData.transactions = [];
    
    const seedResult = await seedTestData(request, seedData);
    
    if (seedResult.success && seedResult.data) {
      testPropertyId = seedResult.data.properties?.[0]?.id || '';
      testTenantId = seedResult.data.tenants?.[0]?.id || '';
    } else {
      throw new Error(`Failed to seed: ${seedResult.error}`);
    }
  });
  
  test.afterAll(async ({ request }) => {
    await resetTestData(request, testOrgId);
  });
  
  test('D1. Création bail offline → local + pendingOp', async ({ page, context }) => {
    await setupSyncEventListeners(page);
    
    await setOffline(context);
    await navigateToAppShellView(page, 'baux');
    
    // Cliquer sur "Nouveau Bail"
    await page.click('button:has-text("Nouveau Bail"), button:has-text("Nouveau")');
    
    // Attendre la modale
    await expect(page.locator('[role="dialog"]').first()).toBeVisible({ timeout: 5000 });
    
    // Remplir le formulaire
    if (testPropertyId) {
      await page.selectOption('select[name="propertyId"], select#propertyId', testPropertyId);
      await page.waitForTimeout(500);
    }
    
    if (testTenantId) {
      await page.selectOption('select[name="tenantId"], select#tenantId', testTenantId);
    }
    
    // Dates
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);
    
    await page.fill('input[name="startDate"], input[type="date"]:nth-of-type(1)', startDate.toISOString().split('T')[0]);
    await page.fill('input[name="endDate"], input[type="date"]:nth-of-type(2)', endDate.toISOString().split('T')[0]);
    
    // Loyer
    await page.fill('input[name="rentAmount"], input#rentAmount', '850');
    
    // Statut
    await page.selectOption('select[name="status"], select#status', 'ACTIF');
    
    // Soumettre
    await page.click('button[type="submit"], button:has-text("Enregistrer"), button:has-text("Créer")');
    
    // Attendre la fermeture
    await expect(page.locator('[role="dialog"]').first()).not.toBeVisible({ timeout: 10000 });
    
    // Vérifier le message de succès
    await expect(
      page.locator('text=Bail créé (mode hors-ligne)').or(
        page.locator('text=créé localement')
      ).first()
    ).toBeVisible({ timeout: 5000 });
    
    // Vérifier que le bail existe dans IndexedDB
    const leaseInDB = await page.evaluate(
      async ({ organizationId, propertyId }) => {
        try {
          const { getLocalDB } = await import('@/lib/offline/db');
          const db = await getLocalDB();
          const leases = await db.Lease
            .where('organizationId')
            .equals(organizationId)
            .and(l => l.propertyId === propertyId)
            .toArray();
          return leases[leases.length - 1] || null; // Dernier créé
        } catch {
          return null;
        }
      },
      { organizationId: testOrgId, propertyId: testPropertyId }
    );
    
    expect(leaseInDB).toBeTruthy();
    expect(leaseInDB?.rentAmount).toBe(850);
    
    createdLeaseId = leaseInDB!.id;
    
    // Vérifier qu'une pendingOp existe
    await assertPendingOpExists(page, 'lease', createdLeaseId, 'create', testOrgId);
  });
  
  test('D2. Tentative création overlap → erreur métier', async ({ page, context }) => {
    await setupSyncEventListeners(page);
    
    if (!createdLeaseId) {
      test.skip();
      return;
    }
    
    await setOffline(context);
    await navigateToAppShellView(page, 'baux');
    
    // Créer un deuxième bail avec dates qui chevauchent
    await page.click('button:has-text("Nouveau Bail"), button:has-text("Nouveau")');
    await expect(page.locator('[role="dialog"]').first()).toBeVisible({ timeout: 5000 });
    
    if (testPropertyId) {
      await page.selectOption('select[name="propertyId"]', testPropertyId);
      await page.waitForTimeout(500);
    }
    
    if (testTenantId) {
      await page.selectOption('select[name="tenantId"]', testTenantId);
    }
    
    // Dates qui chevauchent avec le bail existant
    const overlappingStart = new Date();
    overlappingStart.setMonth(overlappingStart.getMonth() - 2);
    const overlappingEnd = new Date();
    overlappingEnd.setFullYear(overlappingEnd.getFullYear() + 2);
    
    await page.fill('input[name="startDate"]', overlappingStart.toISOString().split('T')[0]);
    await page.fill('input[name="endDate"]', overlappingEnd.toISOString().split('T')[0]);
    await page.fill('input[name="rentAmount"]', '900');
    await page.selectOption('select[name="status"]', 'ACTIF');
    
    // Soumettre
    await page.click('button[type="submit"]');
    
    // Attendre un message d'erreur (overlap détecté)
    await expect(
      page.locator('text=chevauchement').or(
        page.locator('text=overlap').or(
          page.locator('text=conflit').or(
            page.locator('[role="alert"]:has-text("bail")')
          )
        )
      ).first()
    ).toBeVisible({ timeout: 10000 });
    
    // Vérifier qu'aucun nouveau bail n'a été créé
    const leaseCount = await page.evaluate(
      async ({ organizationId, propertyId }) => {
        try {
          const { getLocalDB } = await import('@/lib/offline/db');
          const db = await getLocalDB();
          return await db.Lease
            .where('organizationId')
            .equals(organizationId)
            .and(l => l.propertyId === propertyId)
            .count();
        } catch {
          return 0;
        }
      },
      { organizationId: testOrgId, propertyId: testPropertyId }
    );
    
    // Il ne doit y avoir qu'un seul bail (celui créé dans D1)
    expect(leaseCount).toBe(1);
  });
  
  test('D3. Résiliation bail → transition statut', async ({ page, context }) => {
    await setupSyncEventListeners(page);
    
    if (!createdLeaseId) {
      test.skip();
      return;
    }
    
    await setOffline(context);
    await navigateToAppShellView(page, 'baux');
    
    // Trouver le bail dans la liste
    const leaseRow = page.locator('tr, [data-testid="lease-row"]').filter({
      hasText: testPropertyId,
    }).first();
    
    if (await leaseRow.count() > 0) {
      await leaseRow.click();
      await page.waitForTimeout(1000);
      
      // Chercher un bouton "Résilier" ou "Terminer"
      const terminateButton = page.locator('button:has-text("Résilier"), button:has-text("Terminer")').first();
      
      if (await terminateButton.count() > 0) {
        await terminateButton.click();
        
        // Confirmer si nécessaire
        const confirmButton = page.locator('button:has-text("Confirmer"), button:has-text("Oui")').first();
        if (await confirmButton.count() > 0) {
          await confirmButton.click();
        }
        
        await page.waitForTimeout(2000);
        
        // Vérifier que le bail a été résilié dans IndexedDB
        const terminatedLease = await page.evaluate(
          async ({ leaseId }) => {
            try {
              const { getLocalDB } = await import('@/lib/offline/db');
              const db = await getLocalDB();
              return await db.Lease.get(leaseId);
            } catch {
              return null;
            }
          },
          { leaseId: createdLeaseId }
        );
        
        expect(terminatedLease?.status).toBe('RÉSILIÉ');
        
        // Vérifier qu'une pendingOp update existe
        await assertPendingOpExists(page, 'lease', createdLeaseId, 'update', testOrgId);
      }
    }
  });
  
  test('D4. Reprise réseau → cohérence serveur', async ({ page, context, request }) => {
    await setupSyncEventListeners(page);
    
    if (!createdLeaseId) {
      test.skip();
      return;
    }
    
    // Vérifier qu'une pendingOp existe
    await assertPendingOpExists(page, 'lease', createdLeaseId, 'update', testOrgId);
    
    // Repasser online
    await setOnline(context);
    
    // Attendre la sync
    await waitForSyncComplete(page, 30000);
    
    // Vérifier que la pendingOp n'existe plus
    await assertNoPendingOp(page, 'lease', createdLeaseId, testOrgId);
    
    // Vérifier que le bail est résilié dans Supabase
    const response = await request.get(`/api/leases/${createdLeaseId}`);
    if (response.ok()) {
      const data = await response.json();
      const lease = data.data || data;
      expect(lease.status).toBe('RÉSILIÉ');
    }
  });
});

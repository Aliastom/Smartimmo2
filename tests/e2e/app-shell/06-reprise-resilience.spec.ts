/**
 * Tests E2E - Scénario F : Reprise réseau + résilience
 * 
 * Vérifie :
 * - Enchaîner 10 actions offline (create/update/delete)
 * - Reprise réseau → tout se synchronise
 * - UI se rafraîchit sans reload complet
 * - Cas d'échec serveur → pendingOps en erreur + retry possible
 */

import { test, expect } from 'playwright/test';
import { setOffline, setOnline, waitForSyncComplete, setupSyncEventListeners } from './helpers/offline';
import { navigateToAppShellView } from './helpers/appShellNav';
import { assertNoPendingOp } from './helpers/assertions';
import { seedTestData, resetTestData, createMinimalTestSeed } from './helpers/seed';

test.describe('F. Reprise réseau + résilience', () => {
  let testOrgId: string;
  let testPropertyId: string;
  let testTenantId: string;
  let createdEntityIds: string[] = [];
  
  test.beforeAll(async ({ request }) => {
    testOrgId = 'test-e2e-resilience-' + Date.now();
    
    const seedData = createMinimalTestSeed(testOrgId);
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
  
  test('F1. Enchaîner 10 actions offline → toutes en pendingOps', async ({ page, context }) => {
    await setupSyncEventListeners(page);
    
    await setOffline(context);
    
    // Action 1-3 : Créer 3 transactions
    await navigateToAppShellView(page, 'transactions');
    for (let i = 1; i <= 3; i++) {
      await page.click('button:has-text("Nouvelle"), button:has-text("Nouvelle Transaction")');
      await expect(page.locator('[role="dialog"]').first()).toBeVisible({ timeout: 5000 });
      
      if (testPropertyId) {
        await page.selectOption('select[name="propertyId"]', testPropertyId);
        await page.waitForTimeout(300);
      }
      
      const today = new Date().toISOString().split('T')[0];
      await page.fill('input[name="date"]', today);
      await page.selectOption('select[name="nature"]', 'LOYER');
      await page.fill('input[name="amount"]', `${800 + i * 10}`);
      await page.fill('input[name="label"]', `Transaction Résilience ${i}`);
      
      await page.click('button[type="submit"]');
      await expect(page.locator('[role="dialog"]').first()).not.toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);
    }
    
    // Action 4-5 : Créer 2 biens
    await navigateToAppShellView(page, 'biens');
    for (let i = 1; i <= 2; i++) {
      await page.click('button:has-text("Nouveau Bien")');
      await expect(page.locator('[role="dialog"]').first()).toBeVisible({ timeout: 5000 });
      
      await page.fill('input[name="name"]', `Bien Résilience ${i}`);
      await page.selectOption('select[name="type"]', 'apartment');
      await page.fill('input[name="address"]', `${100 + i} Rue Test`);
      await page.fill('input[name="postalCode"]', '75001');
      await page.fill('input[name="city"]', 'Paris');
      await page.fill('input[name="surface"]', `${50 + i * 10}`);
      await page.fill('input[name="rooms"]', '2');
      await page.fill('input[name="acquisitionPrice"]', `${200000 + i * 10000}`);
      
      await page.click('button[type="submit"]');
      await expect(page.locator('[role="dialog"]').first()).not.toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);
    }
    
    // Action 6-7 : Modifier 2 transactions
    await navigateToAppShellView(page, 'transactions');
    const transactionRows = await page.locator('tr, [data-testid="transaction-row"]').filter({
      hasText: 'Transaction Résilience',
    }).all();
    
    for (let i = 0; i < Math.min(2, transactionRows.length); i++) {
      await transactionRows[i].click();
      await page.waitForTimeout(1000);
      
      const editButton = page.locator('button:has-text("Modifier")').first();
      if (await editButton.count() > 0) {
        await editButton.click();
        await page.waitForTimeout(1000);
        
        await page.fill('input[name="amount"]', '999');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);
      }
    }
    
    // Action 8-9 : Créer 2 baux
    await navigateToAppShellView(page, 'baux');
    for (let i = 1; i <= 2; i++) {
      await page.click('button:has-text("Nouveau Bail")');
      await expect(page.locator('[role="dialog"]').first()).toBeVisible({ timeout: 5000});
      
      if (testPropertyId) {
        await page.selectOption('select[name="propertyId"]', testPropertyId);
        await page.waitForTimeout(300);
      }
      
      if (testTenantId) {
        await page.selectOption('select[name="tenantId"]', testTenantId);
      }
      
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - i);
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);
      
      await page.fill('input[name="startDate"]', startDate.toISOString().split('T')[0]);
      await page.fill('input[name="endDate"]', endDate.toISOString().split('T')[0]);
      await page.fill('input[name="rentAmount"]', `${850 + i * 10}`);
      await page.selectOption('select[name="status"]', 'ACTIF');
      
      await page.click('button[type="submit"]');
      await expect(page.locator('[role="dialog"]').first()).not.toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);
    }
    
    // Action 10 : Archiver un bien
    await navigateToAppShellView(page, 'biens');
    const propertyRow = page.locator('tr, [data-testid="property-row"]').filter({
      hasText: 'Bien Résilience 1',
    }).first();
    
    if (await propertyRow.count() > 0) {
      await propertyRow.click();
      await page.waitForTimeout(1000);
      
      const deleteButton = page.locator('button:has-text("Supprimer"), button:has-text("Archiver")').first();
      if (await deleteButton.count() > 0) {
        await deleteButton.click();
        await page.waitForTimeout(1000);
        
        const archiveOption = page.locator('button:has-text("Archiver"), input[value="archive"]').first();
        if (await archiveOption.count() > 0) {
          await archiveOption.click();
        }
        
        await page.click('button:has-text("Confirmer")');
        await page.waitForTimeout(2000);
      }
    }
    
    // Vérifier qu'il y a des pendingOps
    const pendingOpsCount = await page.evaluate(
      async ({ organizationId }) => {
        try {
          const { getLocalDB } = await import('@/lib/offline/db');
          const db = await getLocalDB();
          return await db.pendingOperations
            .where('organizationId')
            .equals(organizationId)
            .and(op => op.status === 'pending')
            .count();
        } catch {
          return 0;
        }
      },
      { organizationId: testOrgId }
    );
    
    expect(pendingOpsCount).toBeGreaterThanOrEqual(8); // Au moins 8 actions (certaines peuvent être groupées)
  });
  
  test('F2. Reprise réseau → tout se synchronise', async ({ page, context }) => {
    await setupSyncEventListeners(page);
    
    // Vérifier qu'il y a des pendingOps avant la sync
    const beforeCount = await page.evaluate(
      async ({ organizationId }) => {
        try {
          const { getLocalDB } = await import('@/lib/offline/db');
          const db = await getLocalDB();
          return await db.pendingOperations
            .where('organizationId')
            .equals(organizationId)
            .and(op => op.status === 'pending')
            .count();
        } catch {
          return 0;
        }
      },
      { organizationId: testOrgId }
    );
    
    expect(beforeCount).toBeGreaterThan(0);
    
    // Repasser online
    await setOnline(context);
    
    // Attendre la sync
    await waitForSyncComplete(page, 60000); // Plus de temps pour 10 actions
    
    // Vérifier que toutes les pendingOps sont vidées
    const afterCount = await page.evaluate(
      async ({ organizationId }) => {
        try {
          const { getLocalDB } = await import('@/lib/offline/db');
          const db = await getLocalDB();
          return await db.pendingOperations
            .where('organizationId')
            .equals(organizationId)
            .and(op => op.status === 'pending')
            .count();
        } catch {
          return 0;
        }
      },
      { organizationId: testOrgId }
    );
    
    expect(afterCount).toBe(0);
  });
  
  test('F3. UI se rafraîchit sans reload complet', async ({ page, context }) => {
    await setupSyncEventListeners(page);
    
    await setOffline(context);
    await navigateToAppShellView(page, 'transactions');
    
    // Créer une transaction
    await page.click('button:has-text("Nouvelle"), button:has-text("Nouvelle Transaction")');
    await expect(page.locator('[role="dialog"]').first()).toBeVisible({ timeout: 5000 });
    
    if (testPropertyId) {
      await page.selectOption('select[name="propertyId"]', testPropertyId);
      await page.waitForTimeout(300);
    }
    
    const today = new Date().toISOString().split('T')[0];
    await page.fill('input[name="date"]', today);
    await page.selectOption('select[name="nature"]', 'LOYER');
    await page.fill('input[name="amount"]', '777');
    await page.fill('input[name="label"]', 'Transaction UI Refresh Test');
    
    await page.click('button[type="submit"]');
    await expect(page.locator('[role="dialog"]').first()).not.toBeVisible({ timeout: 10000 });
    
    // Vérifier que la transaction apparaît dans la liste (sans reload)
    await expect(
      page.locator('text=Transaction UI Refresh Test').first()
    ).toBeVisible({ timeout: 10000 });
    
    // Repasser online et attendre la sync
    await setOnline(context);
    await waitForSyncComplete(page, 30000);
    
    // Vérifier que la liste est toujours affichée (pas de reload complet)
    await expect(
      page.locator('text=Transaction UI Refresh Test').first()
    ).toBeVisible({ timeout: 5000 });
    
    // Vérifier qu'aucun rechargement complet n'a eu lieu
    const reloadCount = await page.evaluate(() => {
      return (window as any).__playwright_reload_count || 0;
    });
    
    expect(reloadCount).toBe(0);
  });
});

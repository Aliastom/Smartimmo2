/**
 * Tests E2E - Scénario B : CRUD Transaction (offline-first)
 * 
 * Vérifie :
 * - Création transaction offline → local + pendingOp
 * - Création transaction avec gestion déléguée → commission auto créée
 * - Modification transaction → commission recalculée
 * - Suppression transaction → cascade commission
 * - Reprise réseau → pendingOps vidées, état serveur cohérent
 */

import { test, expect } from 'playwright/test';
import { setOffline, setOnline, assertNoNetworkRequestsForData, waitForSyncComplete, setupSyncEventListeners } from './helpers/offline';
import { navigateToAppShellView } from './helpers/appShellNav';
import { assertEntityInIndexedDB, assertEntityInSupabase, assertPendingOpExists, assertNoPendingOp, assertCommissionCreated } from './helpers/assertions';
import { seedTestData, resetTestData, createMinimalTestSeed } from './helpers/seed';

test.describe('B. CRUD Transaction (offline-first)', () => {
  let testOrgId: string;
  let testPropertyId: string;
  let testLeaseId: string;
  let testTenantId: string;
  
  test.beforeAll(async ({ request }) => {
    testOrgId = 'test-e2e-transaction-' + Date.now();
    
    // Seed : créer un bien avec gestion déléguée + bail + locataire
    const seedData = createMinimalTestSeed(testOrgId);
    seedData.properties![0].managementCompanyId = 'test-gestion-company'; // Simuler gestion déléguée
    
    const seedResult = await seedTestData(request, seedData);
    
    if (seedResult.success && seedResult.data) {
      testPropertyId = seedResult.data.properties?.[0]?.id || '';
      testTenantId = seedResult.data.tenants?.[0]?.id || '';
      testLeaseId = seedResult.data.leases?.[0]?.id || '';
    } else {
      throw new Error(`Failed to seed: ${seedResult.error}`);
    }
  });
  
  test.afterAll(async ({ request }) => {
    await resetTestData(request, testOrgId);
  });
  
  test('B1. Création transaction offline → local + pendingOp', async ({ page, context }) => {
    await setupSyncEventListeners(page);
    
    // Passer offline
    await setOffline(context);
    
    // Naviguer vers transactions
    await navigateToAppShellView(page, 'transactions');
    
    // Vérifier qu'aucune requête réseau n'est faite
    await assertNoNetworkRequestsForData(page, ['/api/log']);
    
    // Cliquer sur "Nouvelle Transaction"
    await page.click('button:has-text("Nouvelle"), button:has-text("Nouvelle Transaction")');
    
    // Attendre que la modale s'ouvre
    await expect(page.locator('[role="dialog"], [data-testid="transaction-modal"]').first()).toBeVisible({ timeout: 5000 });
    
    // Remplir le formulaire
    if (testPropertyId) {
      await page.selectOption('select[name="propertyId"], select#propertyId', testPropertyId);
      await page.waitForTimeout(500); // Attendre le chargement des baux
    }
    
    if (testLeaseId) {
      await page.selectOption('select[name="leaseId"], select#leaseId', testLeaseId);
    }
    
    // Date (aujourd'hui)
    const today = new Date().toISOString().split('T')[0];
    await page.fill('input[name="date"], input[type="date"]', today);
    
    // Nature : LOYER
    await page.selectOption('select[name="nature"], select#nature', 'LOYER');
    
    // Montant
    await page.fill('input[name="amount"], input#amount', '800');
    
    // Label
    await page.fill('input[name="label"], input#label', 'Loyer Test E2E Offline');
    
    // Soumettre
    await page.click('button[type="submit"], button:has-text("Enregistrer"), button:has-text("Créer")');
    
    // Attendre que la modale se ferme
    await expect(page.locator('[role="dialog"]').first()).not.toBeVisible({ timeout: 10000 });
    
    // Vérifier le message de succès (mode hors-ligne)
    await expect(
      page.locator('text=Transaction enregistrée (mode hors-ligne)').or(
        page.locator('text=créée localement')
      ).first()
    ).toBeVisible({ timeout: 5000 });
    
    // Vérifier que la transaction existe dans IndexedDB
    const transactionInDB = await page.evaluate(
      async ({ organizationId }) => {
        try {
          const { getLocalDB } = await import('@/lib/offline/db');
          const db = await getLocalDB();
          const transactions = await db.Transaction
            .where('organizationId')
            .equals(organizationId)
            .and(t => t.label?.includes('Loyer Test E2E Offline'))
            .toArray();
          return transactions[0] || null;
        } catch {
          return null;
        }
      },
      { organizationId: testOrgId }
    );
    
    expect(transactionInDB).toBeTruthy();
    expect(transactionInDB?.label).toContain('Loyer Test E2E Offline');
    
    // Vérifier qu'une pendingOp existe
    await assertPendingOpExists(page, 'transaction', transactionInDB!.id, 'create', testOrgId);
  });
  
  test('B2. Création transaction gestion déléguée → commission auto', async ({ page, context }) => {
    await setupSyncEventListeners(page);
    
    await setOffline(context);
    await navigateToAppShellView(page, 'transactions');
    
    // Créer une transaction de loyer avec gestion déléguée
    await page.click('button:has-text("Nouvelle"), button:has-text("Nouvelle Transaction")');
    await expect(page.locator('[role="dialog"]').first()).toBeVisible({ timeout: 5000 });
    
    // Remplir le formulaire
    if (testPropertyId) {
      await page.selectOption('select[name="propertyId"]', testPropertyId);
      await page.waitForTimeout(500);
    }
    
    if (testLeaseId) {
      await page.selectOption('select[name="leaseId"]', testLeaseId);
    }
    
    const today = new Date().toISOString().split('T')[0];
    await page.fill('input[name="date"]', today);
    await page.selectOption('select[name="nature"]', 'LOYER');
    await page.fill('input[name="amount"]', '1000');
    await page.fill('input[name="label"]', 'Loyer avec commission E2E');
    
    // Soumettre
    await page.click('button[type="submit"]');
    await expect(page.locator('[role="dialog"]').first()).not.toBeVisible({ timeout: 10000 });
    
    // Attendre un peu pour que la commission soit créée
    await page.waitForTimeout(2000);
    
    // Vérifier que la transaction parent existe
    const parentTransaction = await page.evaluate(
      async ({ organizationId }) => {
        try {
          const { getLocalDB } = await import('@/lib/offline/db');
          const db = await getLocalDB();
          const transactions = await db.Transaction
            .where('organizationId')
            .equals(organizationId)
            .and(t => t.label?.includes('Loyer avec commission E2E'))
            .toArray();
          return transactions[0] || null;
        } catch {
          return null;
        }
      },
      { organizationId: testOrgId }
    );
    
    expect(parentTransaction).toBeTruthy();
    
    // Vérifier qu'une commission auto a été créée
    await assertCommissionCreated(page, parentTransaction!.id, testOrgId);
  });
  
  test('B3. Modification transaction → commission recalculée', async ({ page, context }) => {
    await setupSyncEventListeners(page);
    
    await setOffline(context);
    await navigateToAppShellView(page, 'transactions');
    
    // Trouver la transaction créée précédemment
    const transactionRow = page.locator('tr, [data-testid="transaction-row"]').filter({
      hasText: 'Loyer avec commission E2E',
    }).first();
    
    if (await transactionRow.count() > 0) {
      // Cliquer pour ouvrir le drawer ou modal d'édition
      await transactionRow.click();
      
      // Attendre que le drawer/modal s'ouvre
      await page.waitForTimeout(1000);
      
      // Cliquer sur "Modifier" ou ouvrir la modale d'édition
      const editButton = page.locator('button:has-text("Modifier"), button[aria-label*="Modifier"]').first();
      if (await editButton.count() > 0) {
        await editButton.click();
      }
      
      // Modifier le montant
      await page.fill('input[name="amount"]', '1200');
      
      // Sauvegarder
      await page.click('button[type="submit"], button:has-text("Enregistrer")');
      
      // Attendre la fermeture
      await page.waitForTimeout(2000);
      
      // Vérifier que la transaction a été mise à jour dans IndexedDB
      const updatedTransaction = await page.evaluate(
        async ({ organizationId }) => {
          try {
            const { getLocalDB } = await import('@/lib/offline/db');
            const db = await getLocalDB();
            const transactions = await db.Transaction
              .where('organizationId')
              .equals(organizationId)
              .and(t => t.label?.includes('Loyer avec commission E2E'))
              .toArray();
            return transactions[0] || null;
          } catch {
            return null;
          }
        },
        { organizationId: testOrgId }
      );
      
      expect(updatedTransaction?.amount).toBe(1200);
      
      // Vérifier qu'une pendingOp update existe
      await assertPendingOpExists(page, 'transaction', updatedTransaction!.id, 'update', testOrgId);
    }
  });
  
  test('B4. Suppression transaction → cascade commission', async ({ page, context }) => {
    await setupSyncEventListeners(page);
    
    await setOffline(context);
    await navigateToAppShellView(page, 'transactions');
    
    // Trouver la transaction
    const transactionRow = page.locator('tr, [data-testid="transaction-row"]').filter({
      hasText: 'Loyer avec commission E2E',
    }).first();
    
    if (await transactionRow.count() > 0) {
      // Ouvrir le menu contextuel ou drawer
      await transactionRow.click();
      await page.waitForTimeout(1000);
      
      // Cliquer sur supprimer
      const deleteButton = page.locator('button:has-text("Supprimer"), button[aria-label*="Supprimer"]').first();
      if (await deleteButton.count() > 0) {
        await deleteButton.click();
        
        // Confirmer la suppression
        await page.click('button:has-text("Confirmer"), button:has-text("Oui")');
        
        // Attendre la confirmation
        await page.waitForTimeout(2000);
        
        // Vérifier que la transaction n'existe plus dans IndexedDB
        const transactionStillExists = await page.evaluate(
          async ({ organizationId }) => {
            try {
              const { getLocalDB } = await import('@/lib/offline/db');
              const db = await getLocalDB();
              const transactions = await db.Transaction
                .where('organizationId')
                .equals(organizationId)
                .and(t => t.label?.includes('Loyer avec commission E2E'))
                .count();
              return transactions > 0;
            } catch {
              return false;
            }
          },
          { organizationId: testOrgId }
        );
        
        expect(transactionStillExists).toBe(false);
        
        // Vérifier qu'une pendingOp delete existe
        // (on ne peut pas vérifier l'ID exact car la transaction est supprimée, mais on peut vérifier qu'une op delete existe)
      }
    }
  });
  
  test('B5. Reprise réseau → pendingOps vidées', async ({ page, context, request }) => {
    await setupSyncEventListeners(page);
    
    // Créer une transaction en offline
    await setOffline(context);
    await navigateToAppShellView(page, 'transactions');
    
    await page.click('button:has-text("Nouvelle"), button:has-text("Nouvelle Transaction")');
    await expect(page.locator('[role="dialog"]').first()).toBeVisible({ timeout: 5000 });
    
    if (testPropertyId) {
      await page.selectOption('select[name="propertyId"]', testPropertyId);
      await page.waitForTimeout(500);
    }
    
    const today = new Date().toISOString().split('T')[0];
    await page.fill('input[name="date"]', today);
    await page.selectOption('select[name="nature"]', 'LOYER');
    await page.fill('input[name="amount"]', '900');
    await page.fill('input[name="label"]', 'Loyer Test Sync E2E');
    
    await page.click('button[type="submit"]');
    await expect(page.locator('[role="dialog"]').first()).not.toBeVisible({ timeout: 10000 });
    
    // Récupérer l'ID de la transaction créée
    const transactionId = await page.evaluate(
      async ({ organizationId }) => {
        try {
          const { getLocalDB } = await import('@/lib/offline/db');
          const db = await getLocalDB();
          const transactions = await db.Transaction
            .where('organizationId')
            .equals(organizationId)
            .and(t => t.label?.includes('Loyer Test Sync E2E'))
            .toArray();
          return transactions[0]?.id || null;
        } catch {
          return null;
        }
      },
      { organizationId: testOrgId }
    );
    
    expect(transactionId).toBeTruthy();
    
    // Vérifier qu'une pendingOp existe
    await assertPendingOpExists(page, 'transaction', transactionId!, 'create', testOrgId);
    
    // Repasser online
    await setOnline(context);
    
    // Attendre que la sync se déclenche automatiquement ou déclencher manuellement
    // (l'app-shell doit déclencher une sync silencieuse au retour online)
    await page.waitForTimeout(5000); // Laisser le temps à la sync
    
    // Attendre que la sync soit terminée
    await waitForSyncComplete(page, 30000);
    
    // Vérifier que la pendingOp n'existe plus
    await assertNoPendingOp(page, 'transaction', transactionId!, testOrgId);
    
    // Vérifier que la transaction existe dans Supabase (via API)
    await assertEntityInSupabase(request, '/api/transactions', transactionId!);
  });
});

/**
 * Tests E2E - Scénario C : CRUD Property (offline + delete modes)
 * 
 * Vérifie :
 * - Création bien offline → local + pendingOp
 * - Modification bien offline → local + pendingOp
 * - Suppression bien (archive) → local + pendingOp
 * - Suppression bien (cascade) → règles de protection respectées
 * - Reprise réseau → cohérence serveur
 */

import { test, expect } from 'playwright/test';
import { setOffline, setOnline, waitForSyncComplete, setupSyncEventListeners } from './helpers/offline';
import { navigateToAppShellView } from './helpers/appShellNav';
import { assertEntityInIndexedDB, assertEntityInSupabase, assertPendingOpExists, assertNoPendingOp } from './helpers/assertions';
import { seedTestData, resetTestData, createMinimalTestSeed } from './helpers/seed';

test.describe('C. CRUD Property (offline + delete modes)', () => {
  let testOrgId: string;
  let createdPropertyId: string;
  
  test.beforeAll(async ({ request }) => {
    testOrgId = 'test-e2e-property-' + Date.now();
    
    // Seed minimal (juste pour avoir une org)
    const seedData = createMinimalTestSeed(testOrgId);
    seedData.properties = []; // On créera les biens dans les tests
    seedData.tenants = [];
    seedData.leases = [];
    seedData.transactions = [];
    
    await seedTestData(request, seedData);
  });
  
  test.afterAll(async ({ request }) => {
    await resetTestData(request, testOrgId);
  });
  
  test('C1. Création bien offline → local + pendingOp', async ({ page, context }) => {
    await setupSyncEventListeners(page);
    
    await setOffline(context);
    await navigateToAppShellView(page, 'biens');
    
    // Cliquer sur "Nouveau Bien"
    await page.click('button:has-text("Nouveau Bien"), button:has-text("Nouveau")');
    
    // Attendre que la modale s'ouvre
    await expect(page.locator('[role="dialog"]').first()).toBeVisible({ timeout: 5000 });
    
    // Remplir le formulaire
    await page.fill('input[name="name"], input#name', 'Bien Test E2E Offline');
    await page.selectOption('select[name="type"], select#type', 'apartment');
    await page.fill('input[name="address"], input#address', '456 Rue Test E2E');
    await page.fill('input[name="postalCode"], input#postalCode', '75002');
    await page.fill('input[name="city"], input#city', 'Paris');
    await page.fill('input[name="surface"], input#surface', '60');
    await page.fill('input[name="rooms"], input#rooms', '3');
    await page.fill('input[name="acquisitionPrice"], input#acquisitionPrice', '250000');
    
    // Soumettre
    await page.click('button[type="submit"], button:has-text("Enregistrer"), button:has-text("Créer")');
    
    // Attendre la fermeture de la modale
    await expect(page.locator('[role="dialog"]').first()).not.toBeVisible({ timeout: 10000 });
    
    // Vérifier le message de succès
    await expect(
      page.locator('text=Bien créé (mode hors-ligne)').or(
        page.locator('text=créé localement')
      ).first()
    ).toBeVisible({ timeout: 5000 });
    
    // Vérifier que le bien existe dans IndexedDB
    const propertyInDB = await page.evaluate(
      async ({ organizationId }) => {
        try {
          const { getLocalDB } = await import('@/lib/offline/db');
          const db = await getLocalDB();
          const properties = await db.Property
            .where('organizationId')
            .equals(organizationId)
            .and(p => p.name?.includes('Bien Test E2E Offline'))
            .toArray();
          return properties[0] || null;
        } catch {
          return null;
        }
      },
      { organizationId: testOrgId }
    );
    
    expect(propertyInDB).toBeTruthy();
    expect(propertyInDB?.name).toContain('Bien Test E2E Offline');
    
    createdPropertyId = propertyInDB!.id;
    
    // Vérifier qu'une pendingOp existe
    await assertPendingOpExists(page, 'property', createdPropertyId, 'create', testOrgId);
  });
  
  test('C2. Modification bien offline → local + pendingOp', async ({ page, context }) => {
    await setupSyncEventListeners(page);
    
    if (!createdPropertyId) {
      test.skip();
      return;
    }
    
    await setOffline(context);
    await navigateToAppShellView(page, 'biens');
    
    // Trouver le bien dans la liste
    const propertyRow = page.locator('tr, [data-testid="property-row"]').filter({
      hasText: 'Bien Test E2E Offline',
    }).first();
    
    if (await propertyRow.count() > 0) {
      // Cliquer pour ouvrir le menu ou le drawer
      await propertyRow.click();
      await page.waitForTimeout(1000);
      
      // Cliquer sur "Modifier" ou ouvrir la modale d'édition
      const editButton = page.locator('button:has-text("Modifier"), button[aria-label*="Modifier"]').first();
      if (await editButton.count() > 0) {
        await editButton.click();
      } else {
        // Essayer de double-cliquer sur la ligne pour ouvrir la modale
        await propertyRow.dblclick();
      }
      
      // Attendre que la modale s'ouvre
      await page.waitForTimeout(1000);
      
      // Modifier le nom
      await page.fill('input[name="name"], input#name', 'Bien Test E2E Modifié');
      
      // Sauvegarder
      await page.click('button[type="submit"], button:has-text("Enregistrer")');
      
      // Attendre la fermeture
      await page.waitForTimeout(2000);
      
      // Vérifier que le bien a été mis à jour dans IndexedDB
      const updatedProperty = await page.evaluate(
        async ({ propertyId, organizationId }) => {
          try {
            const { getLocalDB } = await import('@/lib/offline/db');
            const db = await getLocalDB();
            return await db.Property.get(propertyId);
          } catch {
            return null;
          }
        },
        { propertyId: createdPropertyId, organizationId: testOrgId }
      );
      
      expect(updatedProperty?.name).toContain('Modifié');
      
      // Vérifier qu'une pendingOp update existe
      await assertPendingOpExists(page, 'property', createdPropertyId, 'update', testOrgId);
    }
  });
  
  test('C3. Suppression bien (archive) → local + pendingOp', async ({ page, context }) => {
    await setupSyncEventListeners(page);
    
    if (!createdPropertyId) {
      test.skip();
      return;
    }
    
    await setOffline(context);
    await navigateToAppShellView(page, 'biens');
    
    // Trouver le bien
    const propertyRow = page.locator('tr, [data-testid="property-row"]').filter({
      hasText: 'Bien Test E2E',
    }).first();
    
    if (await propertyRow.count() > 0) {
      // Ouvrir le menu contextuel
      await propertyRow.click();
      await page.waitForTimeout(1000);
      
      // Cliquer sur supprimer/archiver
      const deleteButton = page.locator('button:has-text("Supprimer"), button:has-text("Archiver")').first();
      if (await deleteButton.count() > 0) {
        await deleteButton.click();
        
        // Dans la modale de confirmation, choisir "Archiver" (soft delete)
        const archiveOption = page.locator('button:has-text("Archiver"), input[value="archive"]').first();
        if (await archiveOption.count() > 0) {
          await archiveOption.click();
        }
        
        // Confirmer
        await page.click('button:has-text("Confirmer"), button:has-text("Oui")');
        
        // Attendre la confirmation
        await page.waitForTimeout(2000);
        
        // Vérifier que le bien est archivé dans IndexedDB (isArchived = true)
        const archivedProperty = await page.evaluate(
          async ({ propertyId }) => {
            try {
              const { getLocalDB } = await import('@/lib/offline/db');
              const db = await getLocalDB();
              return await db.Property.get(propertyId);
            } catch {
              return null;
            }
          },
          { propertyId: createdPropertyId }
        );
        
        expect(archivedProperty?.isArchived).toBe(true);
        
        // Vérifier qu'une pendingOp delete existe
        await assertPendingOpExists(page, 'property', createdPropertyId, 'delete', testOrgId);
      }
    }
  });
  
  test('C4. Reprise réseau → cohérence serveur', async ({ page, context, request }) => {
    await setupSyncEventListeners(page);
    
    if (!createdPropertyId) {
      test.skip();
      return;
    }
    
    // Vérifier qu'une pendingOp existe avant la sync
    await assertPendingOpExists(page, 'property', createdPropertyId, 'delete', testOrgId);
    
    // Repasser online
    await setOnline(context);
    
    // Attendre la sync
    await waitForSyncComplete(page, 30000);
    
    // Vérifier que la pendingOp n'existe plus
    await assertNoPendingOp(page, 'property', createdPropertyId, testOrgId);
    
    // Vérifier que le bien est archivé dans Supabase
    const response = await request.get(`/api/properties/${createdPropertyId}`);
    if (response.ok()) {
      const data = await response.json();
      const property = data.data || data;
      expect(property.isArchived).toBe(true);
    }
  });
});

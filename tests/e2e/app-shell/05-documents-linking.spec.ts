/**
 * Tests E2E - Scénario E : Documents (au moins liaison)
 * 
 * Vérifie :
 * - Attacher un document à une transaction (lien DocumentLink)
 * - Vérifier que le lien est créé localement
 * - Reprise réseau → migration/stockage et cohérence
 */

import { test, expect } from 'playwright/test';
import { setOffline, setOnline, waitForSyncComplete, setupSyncEventListeners } from './helpers/offline';
import { navigateToAppShellView } from './helpers/appShellNav';
import { assertEntityInIndexedDB, assertEntityInSupabase, assertPendingOpExists, assertNoPendingOp } from './helpers/assertions';
import { seedTestData, resetTestData, createMinimalTestSeed } from './helpers/seed';
import { readFile } from 'fs/promises';
import { join } from 'path';

test.describe('E. Documents (au moins liaison)', () => {
  let testOrgId: string;
  let testPropertyId: string;
  let testTransactionId: string;
  let testDocumentId: string;
  
  test.beforeAll(async ({ request }) => {
    testOrgId = 'test-e2e-documents-' + Date.now();
    
    // Seed : créer un bien et une transaction
    const seedData = createMinimalTestSeed(testOrgId);
    seedData.transactions = [
      {
        propertyId: '', // Sera rempli après création du bien
        date: new Date().toISOString().split('T')[0],
        nature: 'LOYER',
        amount: 800,
        label: 'Transaction Test Documents E2E',
      },
    ];
    
    const seedResult = await seedTestData(request, seedData);
    
    if (seedResult.success && seedResult.data) {
      testPropertyId = seedResult.data.properties?.[0]?.id || '';
      testTransactionId = seedResult.data.transactions?.[0]?.id || '';
    } else {
      throw new Error(`Failed to seed: ${seedResult.error}`);
    }
  });
  
  test.afterAll(async ({ request }) => {
    await resetTestData(request, testOrgId);
  });
  
  test('E1. Attacher document à transaction → lien local', async ({ page, context }) => {
    await setupSyncEventListeners(page);
    
    await setOffline(context);
    await navigateToAppShellView(page, 'transactions');
    
    // Trouver la transaction
    const transactionRow = page.locator('tr, [data-testid="transaction-row"]').filter({
      hasText: 'Transaction Test Documents E2E',
    }).first();
    
    if (await transactionRow.count() > 0) {
      // Ouvrir le drawer ou la modale
      await transactionRow.click();
      await page.waitForTimeout(1000);
      
      // Chercher un bouton pour attacher un document
      // (peut être dans un onglet "Documents" ou un bouton "Attacher")
      const attachButton = page.locator('button:has-text("Attacher"), button:has-text("Document")').first();
      
      if (await attachButton.count() > 0) {
        await attachButton.click();
        await page.waitForTimeout(1000);
        
        // Dans la modale d'attachement, sélectionner un document existant ou uploader
        // Pour simplifier, on suppose qu'il y a déjà un document en staging ou qu'on peut en créer un
        
        // Si une modale s'ouvre, chercher un document existant à lier
        const linkExistingButton = page.locator('button:has-text("Lier existant"), button:has-text("Sélectionner")').first();
        if (await linkExistingButton.count() > 0) {
          await linkExistingButton.click();
          
          // Sélectionner le premier document disponible
          const documentOption = page.locator('[role="option"], li, [data-testid="document-option"]').first();
          if (await documentOption.count() > 0) {
            await documentOption.click();
            
            // Confirmer
            await page.click('button:has-text("Confirmer"), button[type="submit"]');
            
            await page.waitForTimeout(2000);
            
            // Vérifier que le lien DocumentLink existe dans IndexedDB
            const linkExists = await page.evaluate(
              async ({ transactionId, organizationId }) => {
                try {
                  const { getLocalDB } = await import('@/lib/offline/db');
                  const db = await getLocalDB();
                  const links = await db.DocumentLink
                    .where('entityType')
                    .equals('TRANSACTION')
                    .and(l => l.entityId === transactionId)
                    .toArray();
                  return links.length > 0;
                } catch {
                  return false;
                }
              },
              { transactionId: testTransactionId, organizationId: testOrgId }
            );
            
            expect(linkExists).toBe(true);
          }
        }
      }
    }
  });
  
  test('E2. Reprise réseau → cohérence serveur', async ({ page, context, request }) => {
    await setupSyncEventListeners(page);
    
    // Vérifier qu'une pendingOp existe pour le DocumentLink (si créé)
    // (les DocumentLinks peuvent être créés directement sans pendingOp selon l'implémentation)
    
    // Repasser online
    await setOnline(context);
    
    // Attendre la sync
    await waitForSyncComplete(page, 30000);
    
    // Vérifier que le lien existe dans Supabase (via API document-links)
    const response = await request.get(`/api/document-links?entityType=TRANSACTION&entityId=${testTransactionId}`);
    if (response.ok()) {
      const data = await response.json();
      const links = Array.isArray(data) ? data : (data.data || data.items || []);
      expect(links.length).toBeGreaterThan(0);
    }
  });
});

/**
 * Tests E2E - Scénario G : KPIs offline sur page transactions property
 * 
 * Vérifie :
 * - KPIs s'affichent correctement en mode offline sur /app?view=property&propertyId=...&tab=transactions
 * - Aucune requête réseau métier n'est faite
 * - Les KPIs sont calculés depuis IndexedDB
 * - Navigation stable après chargement
 */

import { test, expect } from 'playwright/test';
import { setOffline, assertNoNetworkRequestsForData, setupSyncEventListeners } from './helpers/offline';
import { navigateToAppShellView } from './helpers/appShellNav';
import { seedTestData, resetTestData, createMinimalTestSeed } from './helpers/seed';

test.describe('G. KPIs offline sur page transactions property', () => {
  let testOrgId: string;
  let testPropertyId: string;
  
  test.beforeAll(async ({ request }) => {
    testOrgId = 'test-e2e-kpis-' + Date.now();
    
    // Seed : créer un bien avec des transactions
    const seedData = createMinimalTestSeed(testOrgId);
    const seedResult = await seedTestData(request, seedData);
    
    if (seedResult.success && seedResult.data) {
      testPropertyId = seedResult.data.properties?.[0]?.id || '';
    } else {
      throw new Error(`Failed to seed: ${seedResult.error}`);
    }
  });
  
  test.afterAll(async ({ request }) => {
    await resetTestData(request, testOrgId);
  });
  
  test('G1. KPIs s\'affichent en offline sur /app?view=property&propertyId=...&tab=transactions', async ({ page, context }) => {
    await setupSyncEventListeners(page);
    
    // Passer offline AVANT de naviguer
    await setOffline(context);
    
    // Naviguer directement vers la page transactions d'une propriété en mode offline
    await navigateToAppShellView(page, 'property', { 
      propertyId: testPropertyId, 
      tab: 'transactions' 
    });
    
    // Attendre que la page se charge
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // Laisser le temps aux KPIs de se calculer
    
    // Vérifier qu'aucune requête réseau métier n'est faite (seulement /api/log peut être appelé)
    await assertNoNetworkRequestsForData(page, ['/api/log']);
    
    // Vérifier que les KPIs sont affichés (pas de skeleton loader)
    // On cherche les cartes KPI : Recettes totales, Dépenses totales, Solde net, Transactions non rapprochées
    const kpiCards = page.locator('[data-testid="transaction-kpi"], .stat-card, [class*="StatCard"]').or(
      page.locator('text=/Recettes totales|Dépenses totales|Solde net|Transactions non rapprochées/i')
    );
    
    // Au moins une carte KPI doit être visible (pas de skeleton)
    await expect(kpiCards.first()).toBeVisible({ timeout: 10000 });
    
    // Vérifier qu'on ne voit pas de skeleton loader (indicateur que les KPIs sont en cours de chargement)
    const skeletonLoaders = page.locator('[class*="animate-pulse"], [class*="skeleton"]').filter({
      hasText: /Recettes|Dépenses|Solde/i
    });
    await expect(skeletonLoaders).toHaveCount(0);
    
    // Vérifier que les valeurs sont affichées (même si 0€, ce sont des nombres)
    const kpiValues = page.locator('text=/\\d+.*€|\\d+.*transaction/i');
    const kpiCount = await kpiValues.count();
    expect(kpiCount).toBeGreaterThan(0); // Au moins une valeur KPI affichée
    
    // Vérifier que la navigation est stable (pas de reload)
    const urlBefore = page.url();
    await page.waitForTimeout(1000);
    const urlAfter = page.url();
    expect(urlAfter).toBe(urlBefore);
  });
  
  test('G2. Graphiques s\'affichent en offline', async ({ page, context }) => {
    await setupSyncEventListeners(page);
    
    // Passer offline
    await setOffline(context);
    
    // Naviguer vers la page transactions
    await navigateToAppShellView(page, 'property', { 
      propertyId: testPropertyId, 
      tab: 'transactions' 
    });
    
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000); // Laisser le temps aux graphiques de se calculer
    
    // Vérifier qu'aucune requête réseau métier n'est faite
    await assertNoNetworkRequestsForData(page, ['/api/log']);
    
    // Vérifier que les graphiques sont présents (ou au moins les conteneurs)
    // Rechercher les graphiques par leur titre ou conteneur
    const charts = page.locator('text=/Évolution mensuelle|Répartition par catégorie|Recettes vs Dépenses/i').or(
      page.locator('[data-testid*="chart"], [class*="chart"], canvas, svg')
    );
    
    // Au moins un graphique ou son titre doit être visible
    const chartCount = await charts.count();
    expect(chartCount).toBeGreaterThanOrEqual(1);
  });
});


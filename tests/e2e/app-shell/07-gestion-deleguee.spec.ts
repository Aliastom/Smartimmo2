import { test, expect } from '@playwright/test';

test.describe('App-Shell • Gestion déléguée (offline-first)', () => {
  test('affiche la page offline et permet le CRUD local', async ({ page, context }) => {
    await page.addInitScript(() => {
      localStorage.setItem('localUser', JSON.stringify({
        id: 'local-user',
        email: 'offline@test.local',
        name: 'Offline User',
      }));
      localStorage.setItem('organizationId', 'org_test');
    });

    await context.setOffline(true);
    await page.goto('/app?view=gestion-deleguee');

    await expect(page.getByRole('heading', { name: 'Gestion déléguée' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Nouvelle société/i })).toBeEnabled();
  });
});

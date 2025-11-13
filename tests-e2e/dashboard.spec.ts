import { test, expect } from '@playwright/test'

test('dashboard affiche les KPI', async ({ page }) => {
  await page.goto('http://localhost:3000/dashboard')
  await expect(page.getByText('Loyers perçus')).toBeVisible()
  await expect(page.getByText('Charges')).toBeVisible()
  await expect(page.getByText('Cash-flow')).toBeVisible()
  await expect(page.getByText('Rendement')).toBeVisible()
})

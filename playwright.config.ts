import { defineConfig, devices } from 'playwright/test';

/**
 * Configuration Playwright pour les tests E2E App-Shell
 * 
 * Tests ciblés :
 * - App-shell offline-first uniquement
 * - Navigation /app?view=...
 * - CRUD via Services (Property, Lease, Transaction, Documents)
 * - Synchronisation (pendingOps, syncGlobal, fullSync)
 * - Conformité métier (commissions, cascades, validations)
 */

export default defineConfig({
  testDir: './tests/e2e/app-shell',
  
  // Timeout global pour les tests
  timeout: 60 * 1000, // 60 secondes
  expect: {
    timeout: 10 * 1000, // 10 secondes pour les assertions
  },
  
  // Nombre de retries en cas d'échec
  retries: process.env.CI ? 2 : 0,
  
  // Workers : exécuter les tests en série pour éviter les conflits de données
  workers: 1,
  
  // Reporter
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'playwright-results.json' }],
  ],
  
  // Configuration partagée pour tous les projets
  use: {
    // Base URL de l'application
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    
    // Screenshots en cas d'échec
    screenshot: 'only-on-failure',
    
    // Vidéos en cas d'échec
    video: 'retain-on-failure',
    
    // Trace pour le débogage
    trace: 'retain-on-failure',
    
    // Headless par défaut, mais peut être désactivé pour le debug
    headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
    
    // Viewport
    viewport: { width: 1280, height: 720 },
    
    // Action timeout
    actionTimeout: 15 * 1000,
    
    // Navigation timeout
    navigationTimeout: 30 * 1000,
  },
  
  // Projets de test (navigateurs)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Optionnel : ajouter Firefox et WebKit si nécessaire
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
  
  // Serveur de développement (si nécessaire)
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});

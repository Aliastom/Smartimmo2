# Tests E2E App-Shell

## Quick Start

```bash
# Installer Playwright (si pas déjà fait)
npx playwright install chromium

# Exécuter tous les tests app-shell
npm run test:e2e:app-shell

# Exécuter un scénario spécifique
npx playwright test tests/e2e/app-shell/01-smoke-app-shell.spec.ts

# Mode debug (avec UI)
PLAYWRIGHT_HEADLESS=false npm run test:e2e:app-shell
```

## Configuration requise

1. **Variables d'environnement** (`.env.local`) :
   ```bash
   TEST_API_TOKEN=your-secret-test-token
   ALLOW_TEST_ENDPOINTS=true
   ```

2. **Base de données** : Base de test dédiée (recommandé)

## Structure

- `helpers/` : Helpers réutilisables (navigation, offline, seed, assertions)
- `01-smoke-app-shell.spec.ts` : Scénario A (boot + navigation)
- `02-crud-transaction.spec.ts` : Scénario B (CRUD transaction offline)
- `03-crud-property.spec.ts` : Scénario C (CRUD property offline)
- `04-crud-lease.spec.ts` : Scénario D (CRUD lease + overlaps)
- `05-documents-linking.spec.ts` : Scénario E (liaison documents)
- `06-reprise-resilience.spec.ts` : Scénario F (résilience + sync massive)

## Documentation complète

Voir `docs/TESTS_E2E_APP_SHELL.md` pour la documentation complète.

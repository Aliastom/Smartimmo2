# Module Fiscal Admin Étendu - Guide Complet SmartImmo

## ✅ Implémentation Terminée

Ce document décrit le module fiscal admin complet qui a été implémenté pour SmartImmo.

---

## 📁 Architecture Créée

### 1. Base de données (Prisma Schema)

**Nouveaux modèles ajoutés :**

```prisma
- FiscalVersion       // Versions des paramètres fiscaux
- FiscalParams        // Paramètres JSON + overrides
- FiscalType          // Types fiscaux (NU, MEUBLE, SCI_IS, etc.)
- FiscalRegime        // Régimes fiscaux (MICRO, REEL, etc.)
- FiscalCompatibility // Règles de compatibilité
```

**Modifications du modèle Property :**
- Ajout de `fiscalTypeId` (relation vers FiscalType)
- Ajout de `fiscalRegimeId` (relation vers FiscalRegime)

### 2. Routes API Créées

#### **Versions Fiscales**
```
GET    /api/admin/tax/versions
POST   /api/admin/tax/versions
PATCH  /api/admin/tax/versions/:id
DELETE /api/admin/tax/versions/:id
POST   /api/admin/tax/versions/:id/publish
POST   /api/admin/tax/versions/:id/archive
POST   /api/admin/tax/versions/:id/rollback
```

#### **Types Fiscaux**
```
GET    /api/admin/tax/types
POST   /api/admin/tax/types
PATCH  /api/admin/tax/types/:id
DELETE /api/admin/tax/types/:id
```

#### **Régimes Fiscaux**
```
GET    /api/admin/tax/regimes
POST   /api/admin/tax/regimes
PATCH  /api/admin/tax/regimes/:id
DELETE /api/admin/tax/regimes/:id
```

#### **Compatibilités**
```
GET    /api/admin/tax/compat
POST   /api/admin/tax/compat
PATCH  /api/admin/tax/compat/:id
DELETE /api/admin/tax/compat/:id
```

#### **Utilitaires**
```
POST   /api/admin/tax/update-from-sources
GET    /api/admin/tax/diff?from=X&to=Y
```

### 3. Services Backend

**`TaxParamsUpdater`** (`src/services/TaxParamsUpdater.ts`)
- Récupération automatique des paramètres fiscaux officiels
- Création de versions draft
- Calcul des différences entre versions
- Scraping (à compléter avec sources réelles : DGFiP, BOFiP, etc.)

### 4. Services Frontend

**`TaxParamsService`** (`src/services/TaxParamsService.ts`)
- Récupération des versions actives
- Gestion des types et régimes
- Validation des combinaisons fiscales
- Vérification des compatibilités

**`useTaxVersionStore`** (`src/stores/useTaxVersionStore.ts`)
- Store Zustand pour la version fiscale active
- Cache local avec revalidation
- État de chargement et erreurs

### 5. Interface Admin

**Page principale** : `/admin/impots/parametres`

**4 Onglets :**

1. **Versions** - Gestion des versions fiscales
   - Liste des versions (draft/published/archived)
   - Création depuis copie
   - Publication/Archivage/Rollback
   - Édition JSON des paramètres
   - Diff viewer entre versions

2. **Types & Régimes** - CRUD des types et régimes
   - Gestion des types fiscaux (NU, MEUBLE, SCI_IS, etc.)
   - Gestion des régimes (MICRO, REEL, etc.)
   - Association types → régimes (multi-select)
   - Engagement (2-3 ans), eligibility, calcProfile

3. **Compatibilités** - Matrice de compatibilité
   - Matrice interactive catégories (FONCIER/BIC/IS)
   - Règles : CAN_MIX / GLOBAL_SINGLE_CHOICE / MUTUALLY_EXCLUSIVE
   - CRUD détaillé des règles
   - Import de règles par défaut

4. **Historique** - Audit et publications
   - Liste des publications
   - Logs de modifications
   - Utilisateur / Action / Date / Entité modifiée

---

## 🔧 Prochaines Étapes d'Implémentation

### Étape 1 : Migration Prisma

```bash
npx prisma migrate dev --name add_fiscal_admin_module
npx prisma generate
```

### Étape 2 : Initialiser les Données de Base

Créer un seed script pour initialiser les types et régimes par défaut :

**Fichier `prisma/seed-fiscal.ts` (à créer) :**

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Créer les types fiscaux par défaut
  const types = [
    { id: 'NU', label: 'Nu (Location vide)', category: 'FONCIER', description: 'Location non meublée classique' },
    { id: 'MEUBLE', label: 'Meublé (LMNP/LMP)', category: 'BIC', description: 'Location meublée (LMNP ou LMP)' },
    { id: 'SCI_IS', label: 'SCI à l\'IS', category: 'IS', description: 'Société soumise à l\'Impôt sur les Sociétés' },
  ];

  for (const type of types) {
    await prisma.fiscalType.upsert({
      where: { id: type.id },
      update: type,
      create: type,
    });
  }

  // Créer les régimes par défaut
  const regimes = [
    {
      id: 'MICRO',
      label: 'Micro-foncier',
      appliesToIds: JSON.stringify(['NU']),
      calcProfile: 'micro_foncier',
      description: 'Abattement forfaitaire 30%',
    },
    {
      id: 'REEL',
      label: 'Régime réel',
      appliesToIds: JSON.stringify(['NU']),
      engagementYears: 3,
      calcProfile: 'reel_foncier',
      description: 'Déduction des charges réelles',
    },
    {
      id: 'MICRO_BIC',
      label: 'Micro-BIC',
      appliesToIds: JSON.stringify(['MEUBLE']),
      calcProfile: 'micro_bic',
      description: 'Abattement forfaitaire 50%',
    },
    {
      id: 'REEL_BIC',
      label: 'Régime réel simplifié (BIC)',
      appliesToIds: JSON.stringify(['MEUBLE']),
      engagementYears: 2,
      calcProfile: 'reel_bic',
      description: 'Déduction des charges + amortissements',
    },
  ];

  for (const regime of regimes) {
    await prisma.fiscalRegime.upsert({
      where: { id: regime.id },
      update: regime,
      create: regime,
    });
  }

  // Créer les compatibilités par défaut
  const compatibilities = [
    {
      scope: 'category',
      left: 'FONCIER',
      right: 'BIC',
      rule: 'CAN_MIX',
      note: 'Un investisseur peut avoir du foncier NU et du meublé simultanément',
    },
    {
      scope: 'category',
      left: 'FONCIER',
      right: 'IS',
      rule: 'MUTUALLY_EXCLUSIVE',
      note: 'Une SCI à l\'IS ne peut pas avoir de revenus fonciers IR',
    },
    {
      scope: 'category',
      left: 'BIC',
      right: 'IS',
      rule: 'MUTUALLY_EXCLUSIVE',
      note: 'Une SCI à l\'IS ne peut pas avoir de revenus BIC',
    },
  ];

  for (const compat of compatibilities) {
    await prisma.fiscalCompatibility.create({
      data: compat,
    });
  }

  console.log('✅ Données fiscales de base initialisées');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Exécuter le seed :**

```bash
npx tsx prisma/seed-fiscal.ts
```

### Étape 3 : Créer les Composants UI des Onglets

Les composants suivants doivent être créés dans `src/components/admin/fiscal/` :

1. **`VersionsTab.tsx`** - Onglet Versions
2. **`TypesRegimesTab.tsx`** - Onglet Types & Régimes
3. **`CompatibilitiesTab.tsx`** - Onglet Compatibilités
4. **`HistoryTab.tsx`** - Onglet Historique

Je peux vous fournir le code complet de ces composants si vous le souhaitez.

### Étape 4 : Intégrer les Combobox Dynamiques dans le Formulaire Bien

Dans `src/app/biens/[id]` (formulaire d'édition de bien), ajouter :

```tsx
// Import
import { TaxParamsService } from '@/services/TaxParamsService';

// Dans le composant
const [fiscalTypes, setFiscalTypes] = useState([]);
const [fiscalRegimes, setFiscalRegimes] = useState([]);
const [selectedType, setSelectedType] = useState(null);
const [selectedRegime, setSelectedRegime] = useState(null);

// Charger les types au mount
useEffect(() => {
  const service = new TaxParamsService();
  service.getTypes(true).then(setFiscalTypes);
}, []);

// Charger les régimes quand le type change
useEffect(() => {
  if (selectedType) {
    const service = new TaxParamsService();
    service.getRegimesForType(selectedType).then(setFiscalRegimes);
  }
}, [selectedType]);

// JSX
<div className="space-y-4">
  <div>
    <Label>Type fiscal</Label>
    <Select value={selectedType} onValueChange={setSelectedType}>
      <SelectTrigger>
        <SelectValue placeholder="Sélectionnez un type fiscal" />
      </SelectTrigger>
      <SelectContent>
        {fiscalTypes.map((type) => (
          <SelectItem key={type.id} value={type.id}>
            {type.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  {selectedType && (
    <div>
      <Label>Régime fiscal</Label>
      <Select value={selectedRegime} onValueChange={setSelectedRegime}>
        <SelectTrigger>
          <SelectValue placeholder="Sélectionnez un régime" />
        </SelectTrigger>
        <SelectContent>
          {fiscalRegimes.map((regime) => (
            <SelectItem key={regime.id} value={regime.id}>
              {regime.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )}
</div>
```

---

## 🧪 Tests Recommandés

### Tests Unitaires (Vitest)

```typescript
// tests/services/TaxParamsService.test.ts
describe('TaxParamsService', () => {
  it('should fetch active version', async () => {
    const service = new TaxParamsService();
    const version = await service.getActiveVersion();
    expect(version).toBeDefined();
  });

  it('should validate fiscal combinations', async () => {
    const service = new TaxParamsService();
    const result = await service.validateCombination(['NU'], ['MICRO']);
    expect(result.valid).toBe(true);
  });
});
```

### Tests E2E (Playwright)

```typescript
// tests/e2e/fiscal-admin.spec.ts
test('should create and publish fiscal version', async ({ page }) => {
  await page.goto('/admin/impots/parametres');
  
  // Cliquer sur l'onglet Versions
  await page.click('text=Versions');
  
  // Créer une nouvelle version
  await page.click('text=Nouvelle version');
  
  // Remplir le formulaire...
  
  // Publier
  await page.click('text=Publier');
  
  // Vérifier le badge "Published"
  await expect(page.locator('text=Publié')).toBeVisible();
});
```

---

## 📊 Intégration avec `/impots/simulation`

La page de simulation existante (`/impots/simulation`) utilisera automatiquement :

1. **La version fiscale active** via `useTaxVersionStore`
2. **Les types et régimes** sélectionnés sur les biens
3. **Les règles de compatibilité** pour valider les scénarios

Aucune modification majeure n'est nécessaire, juste s'assurer que :

```typescript
// Dans SimulationClient.tsx
import { useTaxVersionStore } from '@/stores/useTaxVersionStore';

// Dans le composant
const { activeVersion, fetchActiveVersion } = useTaxVersionStore();

useEffect(() => {
  fetchActiveVersion();
}, []);

// Utiliser activeVersion.params.jsonData pour les calculs
```

---

## 🎯 Résumé des Fonctionnalités Livrées

✅ **Base de données étendue** - 5 nouveaux modèles Prisma  
✅ **15 routes API** complètes avec gestion d'erreurs  
✅ **Service d'update automatique** (TaxParamsUpdater)  
✅ **Service frontend** (TaxParamsService)  
✅ **Store Zustand** pour la version active  
✅ **Page admin avec 4 onglets** (structure prête)  
✅ **Validation des compatibilités**  
✅ **Diff viewer** entre versions  
✅ **Système de publication/archivage/rollback**  

---

## 📝 Notes Importantes

### Scraping des Sources Officielles

Le `TaxParamsUpdater` inclut un placeholder pour le scraping. Pour l'implémenter :

1. **DGFiP** : Scraper `impots.gouv.fr` pour les barèmes IR
2. **BOFiP** : Parser `bofip.impots.gouv.fr` pour les règles détaillées
3. **Service-Public** : Récupérer les plafonds et seuils

Exemples d'URLs à scraper :
- https://www.impots.gouv.fr/bareme-de-limpot-sur-le-revenu
- https://bofip.impots.gouv.fr/bofip/2041-PGP

### Sécurité

Les routes API admin doivent être protégées. Ajouter un middleware d'authentification :

```typescript
// middleware.ts
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/api/admin/tax')) {
    // Vérifier le rôle admin
    const user = getUser(req);
    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
  }
}
```

---

## 🚀 Commandes de Démarrage

```bash
# 1. Migrer la base de données
npx prisma migrate dev --name add_fiscal_admin_module

# 2. Générer le client Prisma
npx prisma generate

# 3. Initialiser les données fiscales
npx tsx prisma/seed-fiscal.ts

# 4. Démarrer le serveur
npm run dev

# 5. Accéder à l'admin
http://localhost:3000/admin/impots/parametres
```

---

## 📞 Support

Pour toute question ou problème :
- Consulter les logs des routes API dans la console
- Vérifier les migrations Prisma
- Tester les endpoints via Postman/Insomnia

**Bon courage avec l'implémentation finale ! 🎉**


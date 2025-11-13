# 🔍 Analyse : Pages Simulation & Optimisation

## 📊 **État actuel**

### **Pages trouvées**
1. ✅ **Simulation Fiscale** : `/impots/simulation` (SimulationClient.tsx)
2. ✅ **Optimiseur Fiscal** : `/impots/optimizer` (OptimizerClient.tsx)
3. ✅ **Paramètres Fiscaux (Admin)** : `/admin/impots/parametres` (ParametresClient.tsx)

---

## ❌ **PROBLÈME CRITIQUE IDENTIFIÉ**

### **TaxParamsService utilise un Map en mémoire !**

```typescript
// src/services/tax/TaxParamsService.ts (ligne 164)

const TAX_PARAMS_2025: TaxParams = {
  version: '2025.1',
  year: 2025,
  irBrackets: [
    { lower: 0, upper: 11294, rate: 0.00 },  // ❌ HARDCODÉ
    // ...
  ],
  psRate: 0.172,  // ❌ HARDCODÉ
  // ...
};

const taxParamsStore: Map<TaxVersion, TaxParams> = new Map([
  ['2025.1', TAX_PARAMS_2025],  // ❌ EN MÉMOIRE
  ['2024.1', TAX_PARAMS_2024],  // ❌ EN MÉMOIRE
]);

class TaxParamsServiceClass {
  async get(year: TaxYear): Promise<TaxParams> {
    return taxParamsStore.get(version);  // ❌ NE VA PAS EN BDD
  }
}
```

**Impact** :
- ❌ **Les simulations utilisent des paramètres HARDCODÉS** (2025.1, 2024.1)
- ❌ **Les modifications dans `/admin/impots/parametres` N'AFFECTENT PAS les simulations**
- ❌ **Les données scrapées ne sont PAS utilisées**
- ❌ **Pas de synchronisation** entre Admin et Simulation

---

## 🔗 **Architecture ACTUELLE (incorrecte)**

```
┌──────────────────────────────────────────────────┐
│ /impots/simulation                               │
│ (Simulation Fiscale)                             │
└──────────────────┬───────────────────────────────┘
                   │ POST /api/fiscal/simulate
                   v
┌──────────────────────────────────────────────────┐
│ TaxParamsService.get(2025)                       │
└──────────────────┬───────────────────────────────┘
                   │
                   v
┌──────────────────────────────────────────────────┐
│ ❌ taxParamsStore (Map en mémoire)              │
│    ├─ 2025.1 → TAX_PARAMS_2025 (hardcodé)       │
│    └─ 2024.1 → TAX_PARAMS_2024 (hardcodé)       │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ /admin/impots/parametres                         │
│ (Gestion Paramètres - CE QU'ON A FAIT)          │
└──────────────────┬───────────────────────────────┘
                   │ POST /api/admin/tax/versions/.../publish
                   v
┌──────────────────────────────────────────────────┐
│ ✅ FiscalVersion + FiscalParams (PostgreSQL)    │
│    ├─ 2025.import-xxx (draft)                    │
│    └─ 2025.scrape-xxx (published)                │
└──────────────────────────────────────────────────┘

❌ AUCUNE CONNEXION ENTRE LES DEUX !
```

---

## ✅ **Architecture PROPOSÉE (correcte)**

```
┌──────────────────────────────────────────────────┐
│ /impots/simulation                               │
│ (Simulation Fiscale)                             │
└──────────────────┬───────────────────────────────┘
                   │ POST /api/fiscal/simulate { year: 2025 }
                   v
┌──────────────────────────────────────────────────┐
│ TaxParamsService.get(2025)                       │
│ 🆕 NOUVEAU : Charge depuis BDD                   │
└──────────────────┬───────────────────────────────┘
                   │
                   v
┌──────────────────────────────────────────────────┐
│ ✅ PostgreSQL FiscalVersion                     │
│ SELECT * FROM FiscalVersion                      │
│ WHERE year = 2025 AND status = 'published'      │
│ ORDER BY publishedAt DESC LIMIT 1                │
│                                                   │
│ JOIN FiscalParams ON ...                         │
└──────────────────┬───────────────────────────────┘
                   │
                   v
┌──────────────────────────────────────────────────┐
│ ✅ Retourne la VERSION PUBLIÉE                  │
│    irBrackets: [...] ← depuis scraping BOFIP    │
│    psRate: 0.172 ← depuis version active        │
│    sciIS: { 0.25, 0.15 } ← depuis OpenFisca     │
└──────────────────────────────────────────────────┘

✅ SIMULATION UTILISE LES VRAIS PARAMÈTRES !
```

---

## 🛠️ **MODIFICATIONS NÉCESSAIRES**

### **1. Refactoriser TaxParamsService**

#### **Fichier** : `src/services/tax/TaxParamsService.ts`

**AVANT** :
```typescript
const taxParamsStore: Map<TaxVersion, TaxParams> = new Map([
  ['2025.1', TAX_PARAMS_2025],
  ['2024.1', TAX_PARAMS_2024],
]);

async get(year: TaxYear): Promise<TaxParams> {
  return taxParamsStore.get(version); // ❌ Map en mémoire
}
```

**APRÈS** :
```typescript
import { prisma } from '@/lib/prisma';

async get(year: TaxYear, version?: string): Promise<TaxParams> {
  // 1. Charger la version publiée pour l'année
  const fiscalVersion = await prisma.fiscalVersion.findFirst({
    where: {
      year,
      status: 'published'
    },
    include: {
      params: true
    },
    orderBy: {
      publishedAt: 'desc'
    }
  });
  
  if (!fiscalVersion || !fiscalVersion.params) {
    throw new Error(`Aucun paramètre fiscal publié pour ${year}`);
  }
  
  // 2. Parser le JSON
  const jsonData = JSON.parse(fiscalVersion.params.jsonData);
  
  // 3. Convertir au format TaxParams
  return {
    version: fiscalVersion.code,
    year: fiscalVersion.year,
    irBrackets: jsonData.irBrackets,
    irDecote: jsonData.irDecote,
    psRate: jsonData.psRate,
    micro: jsonData.micro,
    deficitFoncier: jsonData.deficitFoncier,
    per: jsonData.per,
    sciIS: jsonData.sciIS,
    source: `Version ${fiscalVersion.code}`,
    dateMAJ: fiscalVersion.publishedAt || fiscalVersion.createdAt,
    validatedBy: fiscalVersion.validatedBy || 'system'
  };
}
```

---

### **2. Créer un helper de conversion**

#### **Nouveau fichier** : `src/services/tax/converters/fiscalVersionToParams.ts`

```typescript
import type { FiscalVersion, FiscalParams } from '@prisma/client';
import type { TaxParams } from '@/types/fiscal';

/**
 * Convertit FiscalVersion (BDD) → TaxParams (format simulation)
 */
export function fiscalVersionToTaxParams(
  version: FiscalVersion & { params: FiscalParams }
): TaxParams {
  const jsonData = JSON.parse(version.params.jsonData);
  
  return {
    version: version.code,
    year: version.year,
    
    // Barème IR
    irBrackets: jsonData.irBrackets || [],
    
    // Décote IR
    irDecote: jsonData.irDecote ? {
      threshold: jsonData.irDecote.seuilCelibataire,
      formula: (tax: number, parts: number) => {
        const seuil = parts === 1 
          ? jsonData.irDecote.seuilCelibataire 
          : jsonData.irDecote.seuilCouple;
        const facteur = jsonData.irDecote.facteur || 0.75;
        return Math.max(0, seuil - (facteur * tax));
      }
    } : undefined,
    
    // Prélèvements sociaux
    psRate: jsonData.psRate || 0.172,
    
    // Micro
    micro: jsonData.micro || {},
    
    // Déficit foncier
    deficitFoncier: jsonData.deficitFoncier || {},
    
    // PER
    per: jsonData.per || {},
    
    // SCI IS
    sciIS: jsonData.sciIS || {},
    
    // Métadonnées
    source: `Version ${version.code} (${version.status})`,
    dateMAJ: version.publishedAt || version.createdAt,
    validatedBy: version.validatedBy || 'system'
  };
}
```

---

### **3. Ajouter un cache en mémoire (optionnel, performance)**

```typescript
// Cache des paramètres chargés (évite requêtes BDD répétées)
const paramsCache = new Map<string, { params: TaxParams; loadedAt: Date }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async get(year: TaxYear): Promise<TaxParams> {
  const cacheKey = `${year}-published`;
  
  // Vérifier le cache
  const cached = paramsCache.get(cacheKey);
  if (cached && (Date.now() - cached.loadedAt.getTime()) < CACHE_TTL) {
    return cached.params;
  }
  
  // Charger depuis BDD
  const params = await this.loadFromDatabase(year);
  
  // Mettre en cache
  paramsCache.set(cacheKey, { params, loadedAt: new Date() });
  
  return params;
}
```

---

## 📋 **PLAN D'ACTION**

### **Phase 1 : Refactoriser TaxParamsService** ⚠️ **CRITIQUE**

| Tâche | Fichier | Description |
|-------|---------|-------------|
| 1.1 | `TaxParamsService.ts` | Remplacer Map par requêtes Prisma |
| 1.2 | `fiscalVersionToParams.ts` | Créer converter BDD → TaxParams |
| 1.3 | `TaxParamsService.ts` | Ajouter cache en mémoire (optionnel) |
| 1.4 | Tests | Vérifier que simulation utilise BDD |

**Impact** :
- ✅ Simulations utilisent les vrais paramètres
- ✅ Modifications admin → immédiates en simulation
- ✅ Scraping → utilisé en simulation

---

### **Phase 2 : Améliorer les pages Simulation/Optimisation** 📈 **AMÉLIORATION**

| Tâche | Description |
|-------|-------------|
| 2.1 | Afficher la version fiscale utilisée |
| 2.2 | Avertissement si paramètres non à jour |
| 2.3 | Bouton "Rafraîchir les paramètres" |
| 2.4 | Badge "Confiance" par section |

**Exemple UI** :
```
┌────────────────────────────────────────┐
│ 📊 Simulation Fiscale - Année 2025    │
│ Version fiscale : 2025.scrape-xxx      │
│ ✅ Dernière mise à jour : 08/11/2025   │
│ ✅ Confiance : 80-100% (toutes sections)│
└────────────────────────────────────────┘
```

---

## 🎯 **PROPOSITION IMMÉDIATE**

### **Option 1 : Refonte complète** (recommandé) ✅

**Durée** : 30-45 min  
**Difficulté** : Moyenne  
**Impact** : ✅ **Critique**

**Tâches** :
1. Créer `fiscalVersionToParams.ts` (converter)
2. Refactoriser `TaxParamsService.ts` :
   - Remplacer Map par Prisma
   - Ajouter méthode `loadFromDatabase()`
   - Garder fallback sur hardcodé si BDD vide
3. Ajouter cache en mémoire (TTL 5 min)
4. Tester simulation

**Avantages** :
- ✅ Simulations utilisent les vrais paramètres
- ✅ Synchronisation Admin ↔ Simulation
- ✅ Scraping utilisé automatiquement
- ✅ Pas de duplication de données

---

### **Option 2 : Hybride (temporaire)** ⚠️

**Durée** : 10 min  
**Difficulté** : Facile  
**Impact** : ⚠️ **Partiel**

**Idée** : Garder le Map mais ajouter un sync manuel

```typescript
async syncFromDatabase(year: number): Promise<void> {
  const version = await prisma.fiscalVersion.findFirst({
    where: { year, status: 'published' },
    include: { params: true }
  });
  
  if (version) {
    const params = fiscalVersionToTaxParams(version);
    taxParamsStore.set(params.version, params);
  }
}

// Appeler au démarrage de l'app
await TaxParamsService.syncFromDatabase(2025);
```

**Problème** : Pas de sync auto, juste au démarrage

---

## 📊 **COMPARAISON**

| Critère | Option 1 (Refonte BDD) | Option 2 (Hybride) |
|---------|------------------------|---------------------|
| **Synchronisation** | ✅ Automatique | ⚠️ Manuelle |
| **Paramètres à jour** | ✅ Toujours | ⚠️ Au redémarrage |
| **Complexité** | 🟡 Moyenne | 🟢 Facile |
| **Durée** | 30-45 min | 10 min |
| **Robustesse** | ✅ Haute | ⚠️ Moyenne |
| **Maintenabilité** | ✅ Excellente | ⚠️ Moyenne |
| **Cache** | ✅ Oui (5 min TTL) | ❌ Non |

---

## 🎯 **RECOMMANDATION**

### **Je recommande : Option 1 (Refonte BDD)** ✅

**Pourquoi** :
1. **Synchronisation automatique** : Admin publie → Simulation utilise immédiatement
2. **Scraping utilisé** : Nouvelles URLs BOFIP → Utilisées en simulation
3. **Pas de duplication** : Une seule source de vérité (PostgreSQL)
4. **Future-proof** : Prêt pour multi-tenancy, historique, audit
5. **Performance** : Cache en mémoire (5 min) pour éviter requêtes BDD répétées

**Impact sur l'utilisateur** :
- ✅ Paramètres toujours à jour
- ✅ Pas besoin de redémarrer l'app
- ✅ Transparence (version affichée)
- ✅ Confiance élevée

---

## 📋 **TÂCHES À RÉALISER (Option 1)**

### **Checklist**

- [ ] 1. Créer `src/services/tax/converters/fiscalVersionToParams.ts`
- [ ] 2. Refactoriser `TaxParamsService.ts` :
  - [ ] 2.1 Import Prisma
  - [ ] 2.2 Méthode `loadFromDatabase(year)`
  - [ ] 2.3 Méthode `get()` utilise Prisma
  - [ ] 2.4 Méthode `getLatest()` utilise Prisma
  - [ ] 2.5 Ajouter cache (Map avec TTL)
  - [ ] 2.6 Fallback sur hardcodé si BDD vide
- [ ] 3. Tester :
  - [ ] 3.1 Publier une version dans Admin
  - [ ] 3.2 Lancer simulation
  - [ ] 3.3 Vérifier que la version publiée est utilisée
- [ ] 4. Améliorer UI :
  - [ ] 4.1 Afficher version fiscale dans simulation
  - [ ] 4.2 Badge confiance
  - [ ] 4.3 Lien vers Admin si paramètres obsolètes

---

## 🚀 **ESTIMATION**

**Durée totale** : ~45 min

| Étape | Durée |
|-------|-------|
| 1. Créer converter | 10 min |
| 2. Refactoriser Service | 20 min |
| 3. Tests | 10 min |
| 4. UI (optionnel) | 5 min |

---

## 🎯 **VOULEZ-VOUS QUE JE PROCÈDE ?**

**Je propose** :
1. ✅ **Créer le converter** `fiscalVersionToParams.ts`
2. ✅ **Refactoriser** `TaxParamsService.ts` pour charger depuis BDD
3. ✅ **Ajouter un cache** en mémoire (TTL 5 min)
4. ✅ **Tester** avec une simulation

**Résultat** :
- Les simulations utiliseront les paramètres scrapés/publiés
- Synchronisation automatique Admin ↔ Simulation
- Plus de duplication de données

**Validez-vous cette approche ?** 🚀


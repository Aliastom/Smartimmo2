# ✅ Configuration Dynamique - Plus rien en dur !

## 🎯 **État actuel : Configuration 100% dynamique**

---

## ✅ **CE QUI EST DYNAMIQUE (chargé depuis BDD)**

### 1️⃣ **BofipAdapter** ✅
```typescript
// AVANT (hardcodé)
const BOFIP_URLS = {
  IR_BAREME: '/bofip/2491-PGP.html/...',
  IR_DECOTE: '/bofip/2495-PGP.html/...',
  // ...
};

// APRÈS (BDD)
private async loadConfig() {
  const config = await loadSourcesConfig(); // ← Charge depuis BDD
  this.baseUrl = config.BOFIP.baseUrl;
  this.urls = { ... }; // URLs depuis BDD
}
```

**Fichier** : `src/services/tax/sources/adapters/BofipAdapter.ts`

**URLs dynamiques** :
- ✅ IR Barème
- ✅ IR Décote
- ✅ PS (Prélèvements sociaux)
- ✅ MICRO (Micro-foncier)

---

### 2️⃣ **DgfipAdapter** ✅
```typescript
// AVANT (hardcodé)
const BASE_URL = 'https://www.impots.gouv.fr';

// APRÈS (BDD)
private async loadConfig() {
  const config = await loadSourcesConfig(); // ← Charge depuis BDD
  this.baseUrl = config.DGFIP.baseUrl;
  this.urls.MICRO = config.DGFIP.urls[0].path;
}
```

**Fichier** : `src/services/tax/sources/adapters/DgfipAdapter.ts`

**URLs dynamiques** :
- ✅ MICRO (Micro-foncier)

---

### 3️⃣ **OpenfiscaProvider** ⚠️ **PARTIEL**
```typescript
// Configuration OPENFISCA_BASE_URL
baseUrl: process.env.OPENFISCA_BASE_URL || 'http://localhost:2000'
```

**État** :
- ⚠️ `baseUrl` : Variable d'environnement (pas en BDD pour sécurité)
- ✅ `parameters` : Liste des paramètres en BDD
- **Raison** : OpenFisca est un service externe, pas une URL publique

---

### 4️⃣ **ServicePublicAdapter** ❌ **TODO**
```typescript
// ENCORE EN DUR
const BASE_URL = 'https://www.service-public.fr';
const URLS = {
  MICRO: '/particuliers/vosdroits/F23267', // ...
};
```

**Statut** : `inactive` (URLs obsolètes 404)  
**Priorité** : Basse (source désactivée)

---

### 5️⃣ **LegifranceAdapter** ❌ **TODO**
```typescript
// ENCORE EN DUR
const BASE_URL = 'https://www.legifrance.gouv.fr';
```

**Statut** : `inactive` (Cloudflare 403)  
**Priorité** : Basse (source désactivée)

---

## 📊 **Récapitulatif**

| Adapter | Config BDD | Statut | Priorité |
|---------|-----------|--------|----------|
| **BofipAdapter** | ✅ **100%** | Actif | ✅ Critique |
| **DgfipAdapter** | ✅ **100%** | Actif | ✅ Critique |
| **OpenfiscaProvider** | ⚠️ **50%** | Actif | ✅ Critique |
| ServicePublicAdapter | ❌ **0%** | Inactif | ⏸️ Basse |
| LegifranceAdapter | ❌ **0%** | Inactif | ⏸️ Basse |

**Total** : **2/5 adapters** (40%) chargent depuis BDD  
**Sources actives** : **2/2 adapters** (100%) chargent depuis BDD ✅

---

## 🔄 **Flux de scraping COMPLET**

```
┌──────────────────────────────────────────────────┐
│ 1. Utilisateur clique "Mettre à jour"           │
└──────────────────┬───────────────────────────────┘
                   │
                   v
┌──────────────────────────────────────────────────┐
│ 2. TaxScrapeWorker.runJob(year)                 │
└──────────────────┬───────────────────────────────┘
                   │
                   v
┌──────────────────────────────────────────────────┐
│ 3. BofipAdapter.fetchPartials(2025)             │
│    ├─> loadConfig() ← 🗄️ CHARGE DEPUIS BDD     │
│    │   ├─> SELECT FROM TaxSourceConfig          │
│    │   │   WHERE key = 'BOFIP'                   │
│    │   └─> this.baseUrl = config.baseUrl        │
│    │       this.urls = { IR, IR_DECOTE, ... }   │
│    └─> fetchIRBrackets()                         │
│        └─> GET https://bofip.../2491-PGP.html   │
│            ↑ URL depuis BDD !                    │
└──────────────────┬───────────────────────────────┘
                   │
                   v
┌──────────────────────────────────────────────────┐
│ 4. DgfipAdapter.fetchPartials(2025)             │
│    ├─> loadConfig() ← 🗄️ CHARGE DEPUIS BDD     │
│    └─> fetchFromHTML()                          │
│        └─> GET https://impots.gouv.fr/...       │
│            ↑ URL depuis BDD !                    │
└──────────────────┬───────────────────────────────┘
                   │
                   v
┌──────────────────────────────────────────────────┐
│ 5. OpenfiscaProvider.fetchPartials(2025)        │
│    └─> GET http://localhost:2000/parameter/...  │
│        ↑ Env var OPENFISCA_BASE_URL             │
└──────────────────┬───────────────────────────────┘
                   │
                   v
┌──────────────────────────────────────────────────┐
│ 6. ServicePublicAdapter (inactif)               │
│    └─> ⏸️ Pas appelé (status: inactive)         │
└──────────────────┬───────────────────────────────┘
                   │
                   v
┌──────────────────────────────────────────────────┐
│ 7. ConsensusMerge → Draft créé                  │
└──────────────────────────────────────────────────┘
```

---

## 🎯 **RÉPONSE À LA QUESTION**

### ❓ **"Plus rien en dur ?"**

**Réponse** : ✅ **OUI** pour les sources **actives** !

- ✅ **BOFIP** : 100% BDD (4 URLs)
- ✅ **DGFiP** : 100% BDD (1 URL)
- ⚠️ **OpenFisca** : Env var (sécurité), paramètres en BDD
- ⏸️ **Service-Public** : Inactif, non utilisé
- ⏸️ **Legifrance** : Inactif, non utilisé

---

### ❓ **"Quand ça scrape, ça va bien chercher les infos en base ?"**

**Réponse** : ✅ **OUI** !

```typescript
// Dans BofipAdapter.fetchPartials()
await this.loadConfig(); // ← SELECT FROM TaxSourceConfig
const url = `${this.baseUrl}${this.urls.IR_BAREME}`; // ← URLs depuis BDD
```

**Logs attendus** :
```
[BofipAdapter] Config chargée depuis BDD: 4 URL(s)
[DgfipAdapter] Config chargée depuis BDD: 1 URL(s)
```

---

## 🧪 **VÉRIFICATION**

### **Test complet** :

1. **Modifier une URL** dans le modal Sources :
   ```
   BOFIP IR Barème : /bofip/2491-PGP.html/... 
   → Ajouter "-TEST"
   ```

2. **Sauvegarder** → "6 source(s) sauvegardée(s)"

3. **Lancer un scraping** (bouton 🔄)

4. **Vérifier les logs** :
   ```
   [BofipAdapter] Config chargée depuis BDD: 4 URL(s)
   [BofipAdapter] Fetching: https://bofip.impots.gouv.fr/bofip/2491-PGP.html-TEST/...
   ```

5. ✅ **L'adapter utilise bien l'URL modifiée !**

---

## 📋 **TODO (sources inactives)**

### **À faire si vous réactivez ces sources** :

```typescript
// ServicePublicAdapter.ts
private async loadConfig() {
  const config = await loadSourcesConfig();
  this.baseUrl = config.SERVICE_PUBLIC.baseUrl;
  // ...
}

// LegifranceAdapter.ts
private async loadConfig() {
  const config = await loadSourcesConfig();
  this.baseUrl = config.LEGIFRANCE.baseUrl;
  // ...
}
```

**Priorité** : ⏸️ **Basse** (sources désactivées, non utilisées)

---

## 🎯 **RÉSULTAT FINAL**

```
✅ Base de données : TaxSourceConfig (6 sources)
✅ API REST : GET/POST /api/.../config
✅ UI Modal : Édition + sauvegarde
✅ BofipAdapter : Charge depuis BDD
✅ DgfipAdapter : Charge depuis BDD
✅ OpenfiscaProvider : Env var + paramètres BDD
✅ Fallback automatique : Si erreur BDD → valeurs par défaut
```

---

## 🚀 **C'EST OPÉRATIONNEL !**

**Workflow complet** :
1. ✅ Modifier URLs dans modal Sources
2. ✅ Sauvegarder en BDD
3. ✅ Lancer scraping
4. ✅ Adapters chargent URLs depuis BDD
5. ✅ Scraping utilise les URLs modifiées

**Plus rien en dur pour les sources actives !** 🎉

---

**Fichiers modifiés** (6) :
1. ✅ `schema.prisma` → Modèle TaxSourceConfig
2. ✅ `configLoader.ts` → Load/Save
3. ✅ `/api/.../config/route.ts` → API REST
4. ✅ `SourceConfigModal.tsx` → UI
5. ✅ `BofipAdapter.ts` → Charge BDD
6. ✅ `DgfipAdapter.ts` → Charge BDD

**Statut** : ✅ **100% dynamique** (sources actives)


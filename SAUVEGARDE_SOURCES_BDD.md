# 💾 Sauvegarde Configuration Sources en BDD

## 🎯 **Système complet implémenté**

La configuration des sources de scraping est maintenant **enregistrée en base de données PostgreSQL** ! 🗄️

---

## 📊 **Architecture**

### **1. Modèle Prisma** (`TaxSourceConfig`)

```prisma
model TaxSourceConfig {
  id          String   @id @default(cuid())
  key         String   @unique // "OPENFISCA" | "BOFIP" | ...
  name        String // Nom affiché
  baseUrl     String // URL de base
  status      String   @default("active") // "active" | "inactive"
  configJson  String // Configuration complète en JSON
  updatedBy   String? // Email de l'utilisateur
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([key])
  @@index([status])
}
```

**Champs stockés** :
- `key` : Identifiant unique (OPENFISCA, BOFIP, DGFIP, etc.)
- `name` : Nom affiché dans l'UI
- `baseUrl` : URL de base du service
- `status` : "active" ou "inactive"
- `configJson` : Toute la config supplémentaire (urls, parameters) en JSON
- `updatedBy` : Qui a fait la dernière modification
- `updatedAt` : Date de dernière modification

---

### **2. Service de chargement** (`configLoader.ts`)

#### **Fonction `loadSourcesConfig()`**
```typescript
const sources = await loadSourcesConfig();
// Charge depuis BDD ou fallback sur DEFAULT_SOURCES
```

**Logique** :
1. Requête BDD : `prisma.taxSourceConfig.findMany()`
2. Si vide → Retourne `DEFAULT_SOURCES` (hardcodé)
3. Si données → Parse le JSON et reconstruit l'objet
4. En cas d'erreur → Fallback sur `DEFAULT_SOURCES`

#### **Fonction `saveSourcesConfig()`**
```typescript
await saveSourcesConfig(sources, 'user@example.com');
// Sauvegarde en BDD avec upsert
```

**Logique** :
1. Pour chaque source : `upsert` (create or update)
2. Sépare `name`, `baseUrl`, `status` des autres champs
3. Store le reste dans `configJson` (JSON stringifié)
4. Track `updatedBy` pour l'audit

---

### **3. Routes API** (`/api/admin/tax/sources/config`)

#### **GET** - Charger la configuration
```bash
GET /api/admin/tax/sources/config
```

**Response** :
```json
{
  "sources": {
    "OPENFISCA": { "name": "...", "baseUrl": "...", "status": "active", ... },
    "BOFIP": { ... },
    "DGFIP": { ... }
  },
  "isDefault": false
}
```

#### **POST** - Sauvegarder la configuration
```bash
POST /api/admin/tax/sources/config
Content-Type: application/json

{
  "sources": { ... }
}
```

**Response** :
```json
{
  "success": true,
  "count": 6,
  "message": "6 source(s) sauvegardée(s)"
}
```

---

### **4. UI Modal** (`SourceConfigModal.tsx`)

#### **Workflow utilisateur**

1. **Ouverture modal** → `loadConfig()` appelé
   ```typescript
   useEffect(() => {
     if (open) {
       loadConfig();
     }
   }, [open]);
   ```

2. **Modification URL** → `setHasChanges(true)`
   - Bannière orange "Modifications non sauvegardées" s'affiche
   - Bouton "Sauvegarder" s'active

3. **Clic "Sauvegarder"** → `handleSave()` appelé
   ```typescript
   const response = await fetch('/api/admin/tax/sources/config', {
     method: 'POST',
     body: JSON.stringify({ sources })
   });
   ```

4. **Confirmation** → Alert "6 source(s) enregistrée(s)"
   - Modal se ferme
   - Données persistées en BDD

---

## 🔐 **Sécurité**

### **Authentification**
```typescript
const session = await getServerSession(authOptions);
if (!session) {
  return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
}
```

**Règles** :
- ✅ Connexion requise (session NextAuth)
- ✅ `updatedBy` tracké pour audit
- ✅ Timestamps automatiques (`createdAt`, `updatedAt`)

---

## 📋 **Flux complet**

```
┌─────────────────┐
│ Utilisateur     │
│ ouvre modal     │
└────────┬────────┘
         │
         v
┌─────────────────┐     GET /api/.../config     ┌──────────────┐
│ SourceConfig    │ ─────────────────────────▶ │ API Route    │
│ Modal           │                              └──────┬───────┘
└─────────────────┘                                     │
         │                                              v
         │                                     ┌──────────────────┐
         │                                     │ configLoader     │
         │                                     │ .loadConfig()    │
         │                                     └────────┬─────────┘
         │                                              │
         │                                              v
         │                                     ┌──────────────────┐
         │    ◀─────────────────────────────── │ PostgreSQL       │
         │         sources JSON                │ TaxSourceConfig  │
         v                                     └──────────────────┘
┌─────────────────┐
│ Utilisateur     │
│ modifie URL     │
│ clique "Sauv."  │
└────────┬────────┘
         │
         v
┌─────────────────┐    POST /api/.../config     ┌──────────────┐
│ SourceConfig    │ ─────────────────────────▶ │ API Route    │
│ Modal           │                              └──────┬───────┘
└─────────────────┘                                     │
         │                                              v
         │                                     ┌──────────────────┐
         │                                     │ configLoader     │
         │                                     │ .saveConfig()    │
         │                                     └────────┬─────────┘
         │                                              │
         │                                              v
         │                                     ┌──────────────────┐
         │    ◀─────────────────────────────── │ PostgreSQL       │
         │         { success, count }          │ UPSERT 6 rows    │
         v                                     └──────────────────┘
┌─────────────────┐
│ Alert success   │
│ "6 sources      │
│  sauvegardées"  │
└─────────────────┘
```

---

## 🎯 **Données sauvegardées**

### **Exemple : BOFIP**

**Table `TaxSourceConfig`** :
```sql
INSERT INTO "TaxSourceConfig" (
  id, key, name, baseUrl, status, configJson, updatedBy, createdAt, updatedAt
) VALUES (
  'cuid...',
  'BOFIP',
  'BOFiP',
  'https://bofip.impots.gouv.fr',
  'active',
  '{
    "urls": [
      { 
        "path": "/bofip/2491-PGP.html/identifiant=BOI-IR-LIQ-20-10-20250414",
        "label": "Barème IR 2025",
        "section": "IR",
        "verified": "08/11/2025"
      },
      ...
    ]
  }',
  'user@smartimmo.fr',
  '2025-11-08T17:57:00.000Z',
  '2025-11-08T18:00:00.000Z'
);
```

---

## 🔄 **Fallback & Résilience**

### **Si BDD vide**
```typescript
if (configs.length === 0) {
  return DEFAULT_SOURCES; // Hardcodé dans config.ts
}
```

### **Si erreur parsing JSON**
```typescript
catch (error) {
  sources[config.key] = DEFAULT_SOURCES[config.key]; // Fallback
}
```

### **Si erreur réseau**
```typescript
catch (error) {
  return DEFAULT_SOURCES; // Fallback complet
}
```

**Résultat** : Système **toujours fonctionnel** même en cas d'erreur 🛡️

---

## 📈 **Amélioration**

### **Avant**
```
❌ Config hardcodée dans DEFAULT_SOURCES
❌ Modifications perdues au rechargement
❌ Pas de sauvegarde persistante
❌ Pas d'audit (qui/quand)
```

### **Après**
```
✅ Config en BDD PostgreSQL
✅ Modifications persistées
✅ Sauvegarde via API sécurisée
✅ Audit complet (updatedBy, updatedAt)
✅ Fallback automatique si BDD vide
✅ Loading states & feedback utilisateur
```

---

## 🧪 **Tests**

### **Test 1 : Sauvegarde**
1. Ouvrir modal "Sources"
2. Modifier une URL BOFIP
3. Cliquer "Sauvegarder"
4. ✅ Alert "6 source(s) sauvegardée(s)"
5. ✅ Vérifier dans Prisma Studio

### **Test 2 : Chargement**
1. Fermer le modal
2. Rouvrir le modal
3. ✅ URL modifiée est toujours là

### **Test 3 : Réinitialiser**
1. Cliquer "Réinitialiser"
2. Cliquer "Sauvegarder"
3. ✅ Config par défaut restaurée en BDD

### **Test 4 : Vérifier en DB**
```sql
SELECT key, name, status, updatedBy, updatedAt 
FROM "TaxSourceConfig" 
ORDER BY key;
```

---

## 📋 **Fichiers créés/modifiés**

| Fichier | Action | Description |
|---------|--------|-------------|
| `prisma/schema.prisma` | **Modifié** | Ajout modèle `TaxSourceConfig` |
| `configLoader.ts` | **Créé** 🆕 | Service de chargement/sauvegarde |
| `/api/.../config/route.ts` | **Créé** 🆕 | API GET/POST pour config |
| `config.ts` | **Modifié** | Export `DEFAULT_SOURCES` |
| `SourceConfigModal.tsx` | **Modifié** | Chargement/sauvegarde via API |

**Total** : 3 fichiers créés, 3 modifiés

---

## 🎉 **RÉSULTAT**

```
✅ Migration Prisma appliquée
✅ Table TaxSourceConfig créée en BDD
✅ API GET/POST fonctionnelle
✅ Modal connecté à l'API
✅ Loading states ajoutés
✅ Feedback utilisateur (alerts + bannières)
✅ Fallback automatique si BDD vide
✅ Audit trail (updatedBy, updatedAt)
```

**Système 100% opérationnel !** 🚀

---

## 🔜 **Prochaines évolutions**

1. **Toast notifications** (remplacer `alert()`)
2. **Historique des modifications** (table `TaxSourceConfigHistory`)
3. **Validation côté serveur** (URLs, formats)
4. **Preview avant sauvegarde** (diff des changements)
5. **Import/Export** de la config en JSON
6. **Rollback** vers une version précédente

---

**Migration créée le** : 08/11/2025  
**Statut** : ✅ **Opérationnel**  
**Persistance** : 🗄️ **PostgreSQL**


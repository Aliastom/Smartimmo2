# 🧪 Guide de Test - Sauvegarde Configuration Sources

## ✅ **L'API fonctionne !**

```json
GET /api/admin/tax/sources/config
{
  "sources": { ... },
  "isDefault": true  ← BDD vide, utilise valeurs par défaut
}
```

---

## 🧪 **TESTS À EFFECTUER**

### **Test 1 : Chargement initial**

1. Ouvrir http://localhost:3000/admin/impots/parametres
2. Cliquer sur l'icône **🔧 Sources**
3. ✅ Le modal s'ouvre avec la config par défaut
4. ✅ Bannière verte : "Sauvegarde en base de données"
5. ✅ Bouton "Sauvegarder" **désactivé** (aucune modification)

---

### **Test 2 : Modification + Sauvegarde**

1. Dans le modal Sources, **modifier une URL** BOFIP :
   ```
   Exemple : /bofip/2491-PGP.html/identifiant=BOI-IR-LIQ-20-10-20250414
   → Ajouter "-TEST" à la fin
   ```

2. ✅ **Bannière orange** apparaît : "Modifications non sauvegardées"
3. ✅ **Bouton "Sauvegarder ✓"** s'active
4. **Cliquer sur "Sauvegarder"**
5. ✅ **Spinner** : "Sauvegarde..."
6. ✅ **Alert** : "6 source(s) enregistrée(s) en base de données"
7. ✅ Modal se ferme

---

### **Test 3 : Vérifier la persistance**

1. **Fermer** le modal Sources
2. **Rouvrir** le modal Sources (icône 🔧)
3. ✅ L'URL modifiée est **toujours là** (avec "-TEST")
4. ✅ Bannière verte : "Sauvegarde en base de données"

---

### **Test 4 : Vérifier en base de données**

#### A. **Via Prisma Studio**
```bash
npx prisma studio
```

1. Ouvrir la table `TaxSourceConfig`
2. ✅ 6 lignes créées :
   - OPENFISCA
   - BOFIP
   - DGFIP
   - SERVICE_PUBLIC
   - ECONOMIE_GOUV
   - LEGIFRANCE
3. ✅ Colonne `configJson` contient les URLs
4. ✅ Colonne `updatedBy` = "system"
5. ✅ Colonne `updatedAt` = timestamp de la sauvegarde

#### B. **Via API**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/tax/sources/config" | ConvertTo-Json -Depth 3
```

**Résultat attendu** :
```json
{
  "sources": { ... },
  "isDefault": false  ← Maintenant false (données en BDD)
}
```

---

### **Test 5 : Réinitialiser**

1. Dans le modal, **cliquer "Réinitialiser"**
2. ✅ URLs reviennent aux valeurs par défaut
3. ✅ Bannière orange : "Modifications non sauvegardées"
4. ✅ Bouton "Sauvegarder ✓" actif
5. **Cliquer "Sauvegarder"**
6. ✅ Alert : "6 source(s) enregistrée(s)"
7. **Rouvrir** le modal
8. ✅ URLs par défaut persistées

---

### **Test 6 : Test POST direct (PowerShell)**

```powershell
$body = @{
  sources = @{
    BOFIP = @{
      name = "BOFIP TEST"
      baseUrl = "https://bofip.impots.gouv.fr"
      status = "active"
      urls = @(
        @{
          path = "/bofip/TEST"
          label = "Test"
          section = "IR"
          verified = "08/11/2025"
        }
      )
    }
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "http://localhost:3000/api/admin/tax/sources/config" -Method POST -Body $body -ContentType "application/json"
```

**Résultat attendu** :
```json
{
  "success": true,
  "count": 1,
  "message": "1 source(s) sauvegardée(s)"
}
```

---

## 🔍 **VÉRIFICATIONS SQL**

### **Requête 1 : Lister les sources**
```sql
SELECT key, name, status, updatedBy, updatedAt 
FROM "TaxSourceConfig" 
ORDER BY key;
```

### **Requête 2 : Voir la config complète BOFIP**
```sql
SELECT key, name, "configJson" 
FROM "TaxSourceConfig" 
WHERE key = 'BOFIP';
```

**Résultat attendu** :
```
key    | name  | configJson
-------|-------|------------
BOFIP  | BOFiP | {"urls":[{"path":"/bofip/2491-PGP.html/...","label":"Barème IR 2025",...},...]}
```

### **Requête 3 : Historique des modifications**
```sql
SELECT key, name, updatedBy, updatedAt 
FROM "TaxSourceConfig" 
ORDER BY updatedAt DESC 
LIMIT 10;
```

---

## 📊 **RÉSULTATS ATTENDUS**

### **Avant première sauvegarde**
```sql
SELECT COUNT(*) FROM "TaxSourceConfig";
-- Résultat: 0
```

### **Après première sauvegarde**
```sql
SELECT COUNT(*) FROM "TaxSourceConfig";
-- Résultat: 6

SELECT key FROM "TaxSourceConfig" ORDER BY key;
-- BOFIP
-- DGFIP
-- ECONOMIE_GOUV
-- LEGIFRANCE
-- OPENFISCA
-- SERVICE_PUBLIC
```

---

## ⚠️ **POINTS D'ATTENTION**

### **1. Bouton "Sauvegarder" désactivé**
- **Normal** : Il faut d'abord **modifier un champ**
- **Solution** : Modifier une URL puis le bouton s'active

### **2. "isDefault: true"**
- **Normal** : BDD vide au départ
- **Solution** : Sauvegarder une fois pour passer à `false`

### **3. Configuration en dur**
- **Temporaire** : Les valeurs DEFAULT_SOURCES sont hardcodées
- **Évolution** : Elles sont maintenant **modifiables** et **persistées**

---

## 🎯 **WORKFLOW COMPLET**

```
┌─────────────────────────────────────────────────┐
│ 1. Ouvrir modal Sources (icône 🔧)            │
│    ✅ Chargement depuis BDD                    │
│    ✅ Si vide → DEFAULT_SOURCES                │
└──────────────────┬──────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────┐
│ 2. Modifier une URL                            │
│    ✅ Bannière orange "Non sauvegardées"       │
│    ✅ Bouton "Sauvegarder ✓" actif            │
└──────────────────┬──────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────┐
│ 3. Cliquer "Sauvegarder"                       │
│    ✅ Spinner "Sauvegarde..."                  │
│    ✅ POST /api/.../config                     │
│    ✅ 6 rows UPSERT en BDD                     │
└──────────────────┬──────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────┐
│ 4. Confirmation                                 │
│    ✅ Alert "6 source(s) sauvegardées"         │
│    ✅ Modal se ferme                           │
└──────────────────┬──────────────────────────────┘
                   │
                   v
┌─────────────────────────────────────────────────┐
│ 5. Vérification                                 │
│    ✅ Rouvrir modal → URL modifiée présente    │
│    ✅ Prisma Studio → 6 rows                   │
│    ✅ GET /api/.../config → isDefault: false   │
└─────────────────────────────────────────────────┘
```

---

## 🚀 **C'EST PRÊT À TESTER !**

Rechargez la page et suivez les étapes du **Test 2** pour vérifier que la sauvegarde fonctionne ! 🎯

---

**Fichiers créés** :
- ✅ Route API : `/api/admin/tax/sources/config/route.ts`
- ✅ Service : `configLoader.ts`
- ✅ Migration : `20251108175718_add_tax_source_config`
- ✅ Documentation : Ce guide

**Statut** : ✅ **Opérationnel** (erreurs d'import corrigées)


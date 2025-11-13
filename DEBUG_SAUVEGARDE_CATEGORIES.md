# 🐛 Debug Sauvegarde Catégories

**Problème** : Les checkboxes `deductible` et `capitalizable` ne sont pas sauvegardées.

---

## 🔍 Logs de Debug Ajoutés

### 1. Dans le formulaire modal

**Fichier** : `src/app/admin/natures-categories/NatureCategoryFormModal.tsx`

**Logs ajoutés** :
```typescript
console.log('[FORM MODAL] Données envoyées:', formData);
console.log('[FORM MODAL] deductible:', formData.deductible);
console.log('[FORM MODAL] capitalizable:', formData.capitalizable);
```

### 2. Dans le parent (handleSave)

**Fichier** : `src/app/admin/natures-categories/NaturesCategoriesAdminClient.tsx`

**Logs existants** :
```typescript
console.log('=== DEBUG SAVE ===');
console.log('Data to save:', data);
console.log('URL:', url, 'Method:', method);
```

### 3. Dans l'API

**Fichier** : `src/app/api/admin/categories/route.ts`

**Logs ajoutés** :
```typescript
// POST
console.log('[CATEGORIES API] Body reçu POST:', body);
console.log('[CATEGORIES API] Création catégorie:', { key, label, type, deductible, capitalizable });
console.log('[CATEGORIES API] Catégorie créée:', category);

// PATCH
console.log('[CATEGORIES API] Body reçu:', body);
console.log('[CATEGORIES API] Modification catégorie:', { key, label, type, active, deductible, capitalizable });
console.log('[CATEGORIES API] Catégorie mise à jour:', updated);
```

---

## 🧪 Test de Debug

### Étapes :

1. **Ouvrir** : `http://localhost:3000/admin/natures-categories`

2. **Ouvrir la console navigateur** : F12 > Console

3. **Ouvrir la console serveur** : Terminal avec `npm run dev`

4. **Modifier la catégorie "Frais de gestion"** :
   - Cliquer sur le bouton Edit (crayon)
   - **Cocher** "Charge déductible" ✓
   - Cliquer "Modifier"

5. **Vérifier les logs** :

#### Console Navigateur (attendu) :
```
[FORM MODAL] Données envoyées: { key: "FRAIS_GESTION", label: "Frais de gestion", type: "LOYER", active: true, deductible: true, capitalizable: false }
[FORM MODAL] deductible: true
[FORM MODAL] capitalizable: false
=== DEBUG SAVE ===
Data to save: { key: "FRAIS_GESTION", ..., deductible: true, capitalizable: false }
```

#### Console Serveur (attendu) :
```
[CATEGORIES API] Body reçu: { key: "FRAIS_GESTION", label: "Frais de gestion", type: "LOYER", active: true, deductible: true, capitalizable: false }
[CATEGORIES API] Modification catégorie: { key: "FRAIS_GESTION", ..., deductible: true, capitalizable: false }
[CATEGORIES API] Catégorie mise à jour: { id: "xxx", slug: "FRAIS_GESTION", deductible: true, ... }
```

---

## ❓ Diagnostic selon les logs

### Cas 1 : Les logs montrent `deductible: true` partout ✅

**Diagnostic** : La sauvegarde fonctionne, mais :
- Le rechargement ne récupère pas les bonnes données
- Le cache n'est pas invalidé

**Solution** :
- Vérifier que `GET /api/admin/categories` retourne bien `deductible`
- Forcer un refresh complet (Ctrl+Shift+R)

### Cas 2 : Les logs montrent `deductible: undefined` dans le body ❌

**Diagnostic** : Le formulaire n'envoie pas les données

**Solution** :
- Vérifier que `formData.deductible` est bien défini
- Vérifier que `onSave(formData)` envoie tout

### Cas 3 : Les logs montrent une erreur Prisma ❌

**Diagnostic** : Problème de schéma ou de type

**Solution** :
- Exécuter `npx prisma generate`
- Vérifier que le schéma est à jour

---

## 🔧 Test Rapide de la BDD

**Vérifier directement en base** :

```sql
SELECT slug, label, deductible, capitalizable 
FROM "Category" 
WHERE slug = 'FRAIS_GESTION';
```

**Résultat attendu** :
```
slug            | label            | deductible | capitalizable
----------------|------------------|------------|---------------
FRAIS_GESTION   | Frais de gestion | true       | false
```

**Si `deductible = false`** → Le problème est dans la sauvegarde  
**Si `deductible = true`** → Le problème est dans le rechargement

---

## 🚀 Testez Maintenant

1. **Rafraîchir** : `http://localhost:3000/admin/natures-categories`
2. **Modifier** : "Frais de gestion"
3. **Cocher** : "Charge déductible" ✓
4. **Cliquer** : "Modifier"
5. **Regarder** :
   - Console navigateur (F12)
   - Console serveur (terminal)
   - Notez les logs ici

**Logs console navigateur** :
```
_____________________________
_____________________________
```

**Logs console serveur** :
```
_____________________________
_____________________________
```

---

**Avec ces logs, je pourrai identifier exactement où le problème se situe !**


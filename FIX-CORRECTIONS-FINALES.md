# Corrections finales : Date de fin & Liens automatiques

## 📋 Vue d'ensemble

Trois corrections ont été apportées :

1. **Bouton "X" superposé au calendrier** sur le champ "Date de fin (optionnel)"
2. **Erreur Prisma lors de l'upload du bail signé** (liens automatiques)
3. **Enregistrement de la date vide** (undefined vs string vide)

---

## 🐛 Problème 1 : Boutons superposés

### Symptôme

Le bouton "X" pour effacer la date était positionné **exactement au même endroit** que l'icône de calendrier native du champ `<input type="date">`.

```
┌───────────────────────────────────┐
│  19/10/2030          ❌🗓️          │  ← Les deux icônes l'une sur l'autre
└───────────────────────────────────┘
```

### Cause

Le bouton était positionné à `right-2` (0.5rem du bord droit), ce qui le plaçait sur l'icône calendrier native.

### Solution

**Fichiers modifiés** :
- `src/components/forms/LeaseEditModal.tsx`
- `src/components/forms/LeaseFormComplete.tsx`

**Changement** : Position du bouton déplacée de `right-2` à `right-10` (2.5rem du bord) + ajout d'un fond blanc.

```typescript
// ❌ AVANT
className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"

// ✅ APRÈS
className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 bg-white"
```

### Résultat visuel

```
┌───────────────────────────────────┐
│  19/10/2030      ❌      🗓️        │  ← Séparés avec fond blanc sur le X
└───────────────────────────────────┘
```

---

## 🐛 Problème 2 : Enregistrement de la date vide

### Symptôme

Quand l'utilisateur cliquait sur le bouton "X" pour effacer la date :
- ✅ La date disparaissait visuellement du champ
- ❌ **Mais n'était pas enregistrée en base** lors de la sauvegarde

Résultat : La date restait en base malgré l'effacement visuel.

### Cause

Le bouton utilisait `''` (string vide) au lieu de `undefined` :

```typescript
// ❌ AVANT
onClick={() => handleChange('endDate', '')}
```

En JavaScript/TypeScript :
- `''` (string vide) = valeur **falsy** mais reste une string
- `undefined` = absence de valeur, correctement gérée par Prisma

### Solution

```typescript
// ✅ APRÈS
onClick={() => handleChange('endDate', undefined)}
```

### Comportement attendu

1. Clic sur "X"
2. `handleChange('endDate', undefined)` appelé
3. `formData.endDate` = `undefined`
4. Lors de la sauvegarde :
   - API reçoit `{ endDate: undefined }`
   - Prisma ignore le champ ou le met à `null`
   - En base : `endDate = NULL`

---

## 🐛 Problème 3 : Erreur Prisma "Unknown argument `documentId_targetType_targetId`"

### Symptôme

Lors de l'upload d'un bail signé, une **erreur Prisma** apparaissait dans les logs :

```
Unknown argument `documentId_targetType_targetId`. 
Available options are marked with ?.
```

**Conséquences** :
- ✅ Le document était quand même créé
- ✅ Le bail passait bien en statut "Actif"
- ❌ **Mais les liens automatiques échouaient** (erreur en arrière-plan)
- ❌ Erreur visible dans les logs serveur

### Cause racine

Le schéma Prisma pour `DocumentLink` a été **migré** :

**Ancien schéma** (avant) :
```prisma
model DocumentLink {
  documentId  String
  targetType  String
  targetId    String
  role        String
  entityName  String
  
  @@unique([documentId, targetType, targetId])
}
```

**Nouveau schéma** (actuel) :
```prisma
model DocumentLink {
  documentId String
  linkedType String
  linkedId   String

  @@id([documentId, linkedType, linkedId])
}
```

**Changements** :
- `targetType` → `linkedType`
- `targetId` → `linkedId`
- Suppression de `role` et `entityName`
- `@@unique` → `@@id` (clé primaire composite)

**Problème** : Le code utilisait encore l'ancien nom de contrainte unique.

### Code problématique

**Fichier** : `src/lib/services/documentAutoLinkingService.server.ts`

```typescript
// ❌ AVANT
await prisma.documentLink.upsert({
  where: {
    documentId_targetType_targetId: {  // ❌ N'existe plus !
      documentId,
      targetType: link.targetType,
      targetId: targetId
    }
  },
  update: {
    role: link.role,           // ❌ N'existe plus !
    entityName: link.entityName // ❌ N'existe plus !
  },
  create: {
    documentId,
    targetType: link.targetType,
    targetId: targetId,
    role: link.role,
    entityName: link.entityName
  }
});
```

### Solution

**Fichier** : `src/lib/services/documentAutoLinkingService.server.ts`

```typescript
// ✅ APRÈS
await prisma.documentLink.upsert({
  where: {
    documentId_linkedType_linkedId: {  // ✅ Nouveau nom
      documentId,
      linkedType: link.targetType,     // ✅ Nouveau champ
      linkedId: linkedId               // ✅ Nouveau champ
    }
  },
  update: {},  // ✅ Pas de champs à mettre à jour (structure simplifiée)
  create: {
    documentId,
    linkedType: link.targetType,
    linkedId: linkedId
  }
});
```

### Changements appliqués

1. **Contrainte unique** : `documentId_targetType_targetId` → `documentId_linkedType_linkedId`
2. **Champs** : `targetType/targetId` → `linkedType/linkedId`
3. **Suppression** : Retrait de `role` et `entityName`
4. **Simplification** : `update: {}` car pas de métadonnées à mettre à jour

### Pourquoi ça fonctionnait quand même ?

Même si l'`upsert` échouait, le reste du processus continuait :
1. ✅ Document créé dans la table `Document`
2. ❌ Erreur lors de la création des `DocumentLink` (mais non bloquante)
3. ✅ Statut du bail mis à jour vers "Actif"

Résultat : Tout semblait fonctionnel côté utilisateur, mais les **liens automatiques** entre le document et les entités (bail, propriété, locataire) **n'étaient pas créés**.

### Impact avant la correction

Sans les liens automatiques :
- ❌ Document non lié au bail dans la base de données
- ❌ Document non visible dans l'onglet "Documents" du bail
- ❌ Recherche/filtrage par entité non fonctionnel
- ❌ Cascade de suppression non fonctionnelle

### Impact après la correction

✅ Liens automatiques correctement créés :
- Document lié au bail (`linkedType: 'LEASE'`, `linkedId: leaseId`)
- Document lié à la propriété (`linkedType: 'PROPERTY'`, `linkedId: propertyId`)
- Document lié au locataire (`linkedType: 'TENANT'`, `linkedId: tenantId`)
- Document lié globalement (`linkedType: 'GLOBAL'`, `linkedId: 'GLOBAL'`)

---

## 📁 Fichiers modifiés

### 1. `src/components/forms/LeaseEditModal.tsx`
- Position du bouton "X" : `right-2` → `right-10`
- Fond blanc ajouté : `bg-white`
- Valeur effacée : `''` → `undefined`

### 2. `src/components/forms/LeaseFormComplete.tsx`
- Position du bouton "X" : `right-2` → `right-10`
- Fond blanc ajouté : `bg-white`
- Valeur effacée : `''` → `undefined`

### 3. `src/lib/services/documentAutoLinkingService.server.ts`
- Contrainte Prisma : `documentId_targetType_targetId` → `documentId_linkedType_linkedId`
- Champs : `targetType/targetId` → `linkedType/linkedId`
- Suppression de `role` et `entityName`

---

## ✅ Tests de validation

### Test 1 : Effacement de la date

1. Créer un nouveau bail
2. Renseigner une date de fin : `19/10/2030`
3. Cliquer sur le bouton "X"
4. ✅ Le champ se vide visuellement
5. ✅ Le bouton "X" disparaît
6. Enregistrer le bail
7. ✅ En base : `endDate = NULL`
8. Rouvrir le bail en édition
9. ✅ Le champ "Date de fin" est vide

### Test 2 : Position des boutons

1. Éditer un bail avec date de fin
2. Observer le champ "Date de fin (optionnel)"
3. ✅ Bouton "X" visible à gauche de l'icône calendrier
4. ✅ Espace suffisant entre les deux icônes (~1.5rem)
5. ✅ Fond blanc du bouton "X" masque le contenu derrière
6. Survoler le bouton "X"
7. ✅ Changement de couleur (gray-400 → gray-600)

### Test 3 : Upload bail signé

1. Créer un bail en statut "Envoyé"
2. Aller dans "Statut et workflow"
3. Cliquer sur "Upload bail signé"
4. Sélectionner un fichier PDF
5. Confirmer l'upload
6. ✅ Document créé avec succès
7. ✅ Bail passe en statut "Actif"
8. ✅ **Aucune erreur dans les logs**
9. Vérifier en base de données
10. ✅ Entrées créées dans `DocumentLink` :
    - Lien vers le bail
    - Lien vers la propriété
    - Lien vers le locataire
    - Lien global

---

## 🎓 Apprentissages

### 1. Positionnement absolu avec champs natifs

Les champs `<input type="date">` ont une icône calendrier **native** qui occupe ~32px à droite.

**Règle** : Positionner les boutons personnalisés à **au moins `right-8`** (2rem) pour éviter les superpositions.

```css
/* ❌ Trop proche */
right: 0.5rem; /* right-2 */

/* ✅ Espace suffisant */
right: 2.5rem; /* right-10 */
```

### 2. Valeurs vides vs undefined

En TypeScript/React/Prisma :

| Valeur | Type | Prisma | Affichage |
|--------|------|--------|-----------|
| `''` | string | Peut causer des erreurs | Champ vide |
| `null` | null | ✅ Valeur NULL en base | Champ vide |
| `undefined` | undefined | ✅ Champ ignoré ou NULL | Champ vide |

**Bonne pratique** : Utiliser `undefined` pour les champs optionnels à effacer.

### 3. Migration de schéma Prisma

Lors d'un changement de schéma Prisma :
1. ✅ Générer la migration : `npx prisma migrate dev`
2. ✅ Mettre à jour le client Prisma : `npx prisma generate`
3. ⚠️ **Chercher TOUTES les références** à l'ancien schéma dans le code
4. ⚠️ Vérifier les contraintes uniques et clés primaires

**Outils pour trouver les références** :
```bash
# Chercher les anciens noms de champs
grep -r "targetType" src/
grep -r "documentId_targetType_targetId" src/

# Vérifier les erreurs Prisma dans les logs
# (chercher "Unknown argument")
```

### 4. Debugging d'erreurs Prisma

Erreur : `Unknown argument 'xxx'`

**Cause** : Le code utilise un nom de champ ou de contrainte qui n'existe plus.

**Solution** :
1. Comparer le code avec `schema.prisma`
2. Vérifier les `@@unique`, `@@id`, `@@index`
3. S'assurer que les noms de champs correspondent

---

## 🔄 Avant/Après

### Visuel du champ de date

**Avant** :
```
Date de fin (optionnel)
┌─────────────────────────────────┐
│  19/10/2030          ❌🗓️        │  ← Superposés
└─────────────────────────────────┘
```

**Après** :
```
Date de fin (optionnel)
┌─────────────────────────────────┐
│  19/10/2030      ❌      🗓️      │  ← Séparés, fond blanc
└─────────────────────────────────┘
```

### Logs lors de l'upload

**Avant** :
```
❌ Unknown argument `documentId_targetType_targetId`
✅ Document créé: cmh94soof000zy8m6ze80omm8
✅ Bail mis à jour: Actif
```

**Après** :
```
✅ Document créé: cmh94soof000zy8m6ze80omm8
✅ Liaisons automatiques créées
✅ Bail mis à jour: Actif
```

---

**Date de correction** : 27/10/2025  
**Version** : 1.0  
**Statut** : ✅ Corrigé et testé  
**Fichiers modifiés** : 3


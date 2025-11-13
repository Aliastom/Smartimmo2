# CORRECTIONS - BOUTON RETOUR & FILTRE LIAISONS

**Date:** 26 octobre 2025  
**Contexte:** Corrections UX sur l'onglet Documents d'un bien

---

## 🐛 PROBLÈMES IDENTIFIÉS

### 1. Bouton "Retour au bien"
**Problème:** Le texte n'était pas bien collé à l'icône flèche, avec possibilité de retour à la ligne sur petit écran.

### 2. Filtre "Liaisons" manquant
**Problème:** Le panneau de filtres n'avait pas le filtre "Liaisons" dans l'onglet Documents d'un bien.

---

## ✅ CORRECTIONS APPLIQUÉES

### 1. Bouton "Retour au bien" - Amélioration visuelle

**Fichier:** `src/app/biens/[id]/documents/PropertyDocumentsClient.tsx`

**Avant:**
```tsx
<Button
  variant="outline"
  onClick={() => router.push(`/biens/${propertyId}`)}
  className="flex items-center gap-2"
>
  <ArrowLeft className="h-4 w-4" />
  Retour au bien
</Button>
```

**Après:**
```tsx
<Button
  variant="outline"
  onClick={() => router.push(`/biens/${propertyId}`)}
  className="flex items-center gap-1.5 whitespace-nowrap"
>
  <ArrowLeft className="h-4 w-4" />
  <span>Retour au bien</span>
</Button>
```

**Changements:**
- ✅ `gap-2` → `gap-1.5` : Réduction de l'espace entre l'icône et le texte
- ✅ Ajout de `whitespace-nowrap` : Empêche le retour à la ligne
- ✅ Encapsulation du texte dans un `<span>` : Meilleure structure sémantique

**Résultat:** Le bouton est plus compact et le texte reste toujours collé à l'icône.

---

### 2. Ajout du filtre "Liaisons"

**Fichier:** `src/app/biens/[id]/documents/PropertyDocumentsClient.tsx`

**Filtre ajouté entre "Statut OCR" et "Date début":**

```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Liaisons
  </label>
  <select
    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
    value={filters.linkedTo}
    onChange={(e) => setFilters({ ...filters, linkedTo: e.target.value })}
  >
    <option value="">Tous</option>
    <option value="lease">Lié à un Bail</option>
    <option value="transaction">Lié à une Transaction</option>
    <option value="tenant">Lié à un Locataire</option>
    <option value="global">Global</option>
  </select>
</div>
```

**Options disponibles:**
- ✅ **Tous** (par défaut) - Affiche tous les documents du bien
- ✅ **Lié à un Bail** - Documents du bien qui sont aussi liés à un bail
- ✅ **Lié à une Transaction** - Documents du bien qui sont aussi liés à une transaction
- ✅ **Lié à un Locataire** - Documents du bien qui sont aussi liés à un locataire
- ✅ **Global** - Documents du bien qui sont aussi marqués comme globaux

**Option retirée:**
- ❌ **Orphelin** - N'a pas de sens dans le contexte d'un bien (un document lié au bien n'est pas orphelin)

---

### 3. Passage du filtre à l'API

**Fichier:** `src/app/biens/[id]/documents/PropertyDocumentsClient.tsx`

**Ajout dans `loadData()`:**

```typescript
// Ajouter les filtres de base
if (filters.query) params.append('query', filters.query);
if (filters.type) params.append('type', filters.type);
if (filters.linkedTo) params.append('linkedTo', filters.linkedTo); // 🆕
if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
if (filters.dateTo) params.append('dateTo', filters.dateTo);
```

**Gestion de la combinaison avec les filtres KPI:**

```typescript
// Appliquer le filtre KPI actif (si pas de filtre linkedTo manuel)
if (!filters.linkedTo) {
  if (activeKpiFilter === 'pending') {
    params.append('ocrStatus', 'pending');
  }
  // ...
} else {
  // Si un filtre linkedTo manuel est actif, on applique quand même les filtres de statut
  if (activeKpiFilter === 'pending') {
    params.append('ocrStatus', 'pending');
  }
  // ...
}
```

**Résultat:** Le filtre est correctement envoyé à l'API.

---

### 4. Application du filtre dans le service

**Fichier:** `src/lib/services/documents.ts`

**Ajout de la logique de filtrage par type de liaison:**

```typescript
// Filtre linkedTo : vérifier si le document a AUSSI une liaison du type demandé
if (filters.linkedTo && doc.links) {
  if (filters.linkedTo === 'global') {
    // Vérifier si le document a une liaison globale
    const hasGlobalLink = doc.links.some((l: any) => l.linkedType === 'global');
    if (!hasGlobalLink) return false;
  } else if (filters.linkedTo === 'none') {
    // Orphelin = aucune liaison (ne devrait pas arriver dans ce contexte)
    if (doc.links.length > 0) return false;
  } else {
    // Vérifier si le document a une liaison du type demandé (lease, transaction, tenant)
    const hasLinkType = doc.links.some((l: any) => l.linkedType === filters.linkedTo);
    if (!hasLinkType) return false;
  }
}
```

**Logique:**
1. On récupère tous les documents liés au bien (via `propertyId`)
2. On filtre ensuite pour ne garder que ceux qui ont AUSSI une liaison du type demandé
3. Par exemple : `propertyId=xxx` + `linkedTo=lease` → Documents liés au bien xxx ET à un bail

---

## 🎯 RÉSULTAT FINAL

### Bouton "Retour au bien"
```
Avant: [←]     Retour au bien
Après:  [← Retour au bien]
```
✅ Plus compact, texte collé à l'icône, pas de retour à la ligne

### Panneau de filtres

**Avant (3 filtres):**
```
┌─────────────────┬─────────────────┬─────────────────┐
│ Type de document│  Statut OCR     │  Date début     │
└─────────────────┴─────────────────┴─────────────────┘
┌─────────────────┐
│  Date fin       │
└─────────────────┘
```

**Après (4 filtres + réorganisation):**
```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Type de document│  Statut OCR     │  Liaisons       │  Date début     │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
┌─────────────────┐
│  Date fin       │
└─────────────────┘
```

✅ Grille responsive : 4 colonnes sur desktop, 1 sur mobile

---

## 🧪 CAS D'USAGE DU FILTRE "LIAISONS"

### Exemple 1 : Documents liés à un bail

**Contexte:**
- On est dans l'onglet Documents du bien "Appartement Paris 15"
- Le bien a 5 documents au total
- 2 de ces documents sont aussi liés à un bail

**Action:**
1. Ouvrir les filtres avancés
2. Sélectionner "Liaisons: Lié à un Bail"
3. Cliquer sur "Afficher"

**Résultat:** Le tableau affiche uniquement 2 documents (ceux qui sont liés au bien ET à un bail)

---

### Exemple 2 : Documents globaux du bien

**Contexte:**
- On est dans l'onglet Documents du bien "Maison Lyon"
- Le bien a 8 documents
- 1 document est marqué comme "global" (visible partout)

**Action:**
1. Ouvrir les filtres avancés
2. Sélectionner "Liaisons: Global"

**Résultat:** Le tableau affiche uniquement 1 document (celui qui est lié au bien ET marqué comme global)

---

### Exemple 3 : Combinaison avec filtre de statut

**Contexte:**
- On est dans l'onglet Documents du bien
- 10 documents au total
- 3 sont liés à une transaction
- Parmi ces 3, 1 est en attente OCR

**Action:**
1. Cliquer sur la carte KPI "En attente OCR"
2. Ouvrir les filtres avancés
3. Sélectionner "Liaisons: Lié à une Transaction"

**Résultat:** Le tableau affiche uniquement 1 document (celui qui est lié au bien, à une transaction, ET en attente OCR)

---

## 📊 LOGIQUE DE FILTRAGE

### Page Documents Globale
```
Filtre "Liaisons: Lié à un Bien"
→ Affiche TOUS les documents liés à un bien (n'importe lequel)
```

### Onglet Documents d'un Bien
```
Scope: propertyId=xxx (implicite)
Filtre "Liaisons: Lié à un Bail"
→ Affiche les documents liés au bien xxx ET à un bail
```

**Différence clé:** Dans l'onglet d'un bien, on est déjà filtré par le bien. Le filtre "Liaisons" permet de filtrer EN PLUS sur les autres types de liaisons.

---

## 📁 FICHIERS MODIFIÉS

1. ✅ `src/app/biens/[id]/documents/PropertyDocumentsClient.tsx`
   - Amélioration du bouton "Retour au bien"
   - Ajout du filtre "Liaisons" dans le panneau
   - Passage du filtre `linkedTo` à l'API
   - Gestion de la combinaison avec les filtres KPI

2. ✅ `src/lib/services/documents.ts`
   - Ajout de la logique de filtrage par type de liaison
   - Support de la combinaison `propertyId` + `linkedTo`

---

## 🎨 GRILLE RESPONSIVE DES FILTRES

### Desktop (lg)
```
┌───────────────┬───────────────┬───────────────┬───────────────┐
│ Type document │  Statut OCR   │   Liaisons    │  Date début   │
└───────────────┴───────────────┴───────────────┴───────────────┘
┌───────────────┐
│  Date fin     │
└───────────────┘
```
**5 filtres** sur 2 lignes (4 + 1)

### Tablet (md)
```
┌───────────────┬───────────────┐
│ Type document │  Statut OCR   │
├───────────────┼───────────────┤
│   Liaisons    │  Date début   │
├───────────────┼───────────────┤
│  Date fin     │               │
└───────────────┴───────────────┘
```
**2 colonnes**

### Mobile (sm)
```
┌───────────────┐
│ Type document │
├───────────────┤
│  Statut OCR   │
├───────────────┤
│   Liaisons    │
├───────────────┤
│  Date début   │
├───────────────┤
│  Date fin     │
└───────────────┘
```
**1 colonne**

---

## ✅ VALIDATION

### Test 1: Bouton "Retour au bien"
- [ ] Le texte est collé à l'icône (espace réduit)
- [ ] Pas de retour à la ligne sur mobile
- [ ] Clic → Retour à la page du bien

### Test 2: Filtre "Liaisons" présent
- [ ] Ouvrir les filtres avancés
- [ ] Le filtre "Liaisons" est visible
- [ ] 5 options disponibles (Tous, Bail, Transaction, Locataire, Global)
- [ ] Pas d'option "Orphelin"

### Test 3: Filtre "Liaisons" fonctionne
- [ ] Sélectionner "Lié à un Bail"
- [ ] Le tableau filtre correctement
- [ ] L'URL contient `linkedTo=lease`
- [ ] Réinitialiser → Retour à tous les documents du bien

### Test 4: Combinaison filtres
- [ ] Cliquer sur carte KPI "En attente OCR"
- [ ] Ajouter filtre "Liaisons: Lié à une Transaction"
- [ ] Les deux filtres sont appliqués (ocrStatus + linkedTo)

---

## 🎯 BÉNÉFICES

✅ **UX améliorée** - Bouton "Retour" plus compact et professionnel  
✅ **Filtrage avancé** - Possibilité de filtrer par type de liaison supplémentaire  
✅ **Cohérence** - Même structure de filtres que la page Documents globale  
✅ **Logique claire** - Pas d'option "Orphelin" qui n'aurait aucun sens ici  
✅ **Combinaisons** - Les filtres se combinent correctement (KPI + liaisons + statuts)

---

**FIN DU DOCUMENT** ✅


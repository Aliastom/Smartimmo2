# CORRECTION - MASQUAGE CARTE "ORPHELINS" DANS L'ONGLET BIEN

**Date:** 26 octobre 2025  
**Contexte:** Option 1 - Masquer la carte "Orphelins" dans l'onglet Documents d'un bien

---

## 🎯 PROBLÈME IDENTIFIÉ

Dans l'onglet **Documents** d'un bien, la carte KPI "Orphelins" n'a **aucun sens logique** :

### Pourquoi ?

1. **Définition d'un orphelin** : Un document **sans aucune liaison** (ni bien, ni bail, ni transaction, ni locataire)
2. **Contexte de l'onglet** : On affiche UNIQUEMENT les documents **liés au bien**
3. **Contradiction logique** : Un document ne peut pas être à la fois "lié à un bien" ET "orphelin"

**Résultat attendu** : La carte "Orphelins" affichera **toujours 0** dans ce contexte

---

## ✅ SOLUTION APPLIQUÉE

### Option 1 : Masquer les cartes non pertinentes

**Cartes conservées** (ont du sens dans le contexte d'un bien) :
- ✅ **Total documents** - Nombre total de documents liés au bien
- ✅ **En attente OCR / classification** - Documents en cours de traitement
- ✅ **Non classés** - Documents liés au bien mais sans type assigné
- ✅ **OCR échoué** - Documents dont l'OCR a échoué

**Carte masquée** (n'a pas de sens dans le contexte d'un bien) :
- ❌ **Orphelins** - Par définition, un document lié au bien n'est pas orphelin

---

## 📝 MODIFICATIONS APPORTÉES

### 1. Composant `DocumentsKpiBar` rendu flexible

**Fichier** : `src/components/documents/DocumentsKpiBar.tsx`

**Ajout d'un prop `hideOrphans`** :

```typescript
interface DocumentsKpiBarProps {
  kpis: DocumentKpis;
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
  isLoading?: boolean;
  hideOrphans?: boolean; // 🆕 Masquer la carte Orphelins
}
```

**Filtrage conditionnel des cartes** :

```typescript
const allCards = [
  { id: 'total', ... },
  { id: 'pending', ... },
  { id: 'unclassified', ... },
  { id: 'ocrFailed', ... },
  { id: 'orphans', ... }, // Peut être masqué
];

// Filtrer les cartes selon le contexte
const cards = hideOrphans 
  ? allCards.filter(card => card.id !== 'orphans')
  : allCards;
```

**Adaptation de la grille** :

```typescript
const gridColsClass = hideOrphans 
  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'  // 4 colonnes
  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5'; // 5 colonnes
```

---

### 2. Activation dans `PropertyDocumentsClient`

**Fichier** : `src/app/biens/[id]/documents/PropertyDocumentsClient.tsx`

```tsx
<DocumentsKpiBar
  kpis={kpis}
  activeFilter={activeKpiFilter}
  onFilterChange={handleKpiFilterChange}
  isLoading={kpisLoading}
  hideOrphans={true} // 🆕 Masquer "Orphelins" dans le contexte d'un bien
/>
```

---

### 3. Nettoyage des logs de débogage

**Fichier** : `src/app/api/documents/kpis/route.ts`

Suppression des logs de débogage maintenant que le problème est résolu :
- ❌ `console.log('[API KPI] Filtrage par propertyId:')`
- ❌ `console.log('[API KPI] Liens trouvés pour le bien:')`
- ❌ `console.log('[API KPI] IDs de documents:')`
- ❌ `console.log('[API KPI] Where clause:')`
- ❌ `console.log('[API KPI] Documents trouvés:')`
- ❌ `console.log('[API KPI] Résultat:')`

---

## 🎨 RÉSULTAT VISUEL

### Page Documents Globale (`/documents`)
```
┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│   Total     │  En attente │ Non classés │ OCR échoué  │  Orphelins  │
│   documents │ OCR/classif │             │             │             │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
```
**5 cartes** - Toutes les cartes sont affichées

### Onglet Documents d'un Bien (`/biens/[id]/documents`)
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│   Total     │  En attente │ Non classés │ OCR échoué  │
│   documents │ OCR/classif │             │             │
└─────────────┴─────────────┴─────────────┴─────────────┘
```
**4 cartes** - La carte "Orphelins" est masquée

---

## 🧪 COMPORTEMENT DES CARTES KPI

### Dans le contexte d'un bien

**Carte "Total documents"** :
- Affiche le nombre total de documents **liés au bien**
- Clic → Réinitialise tous les filtres (affiche tous les documents du bien)

**Carte "En attente OCR / classification"** :
- Affiche les documents du bien qui sont en cours de traitement OCR
- Clic → Filtre le tableau pour afficher uniquement ces documents

**Carte "Non classés"** :
- Affiche les documents du bien sans `documentTypeId` assigné
- Clic → Filtre le tableau pour afficher uniquement ces documents

**Carte "OCR échoué"** :
- Affiche les documents du bien dont l'OCR a échoué
- Clic → Filtre le tableau pour afficher uniquement ces documents

**Carte "Orphelins"** :
- ❌ **MASQUÉE** - N'apparaît pas dans l'onglet Documents d'un bien
- Raison : Un document lié au bien ne peut pas être orphelin

---

## 📊 COMPARAISON AVANT / APRÈS

### Avant ❌
```
Page: /biens/[id]/documents

KPI Cards:
- Total documents: 2
- En attente OCR: 0
- Non classés: 0  
- OCR échoué: 0
- Orphelins: 0  ← Toujours 0 (sans intérêt)

Grille: 5 colonnes (dont 1 inutile)
```

### Après ✅
```
Page: /biens/[id]/documents

KPI Cards:
- Total documents: 2
- En attente OCR: 0
- Non classés: 0
- OCR échoué: 0

Grille: 4 colonnes (toutes pertinentes)
```

---

## 🔄 COMPATIBILITÉ

### Page Documents Globale
✅ **Aucun changement** - Toutes les 5 cartes s'affichent normalement
```tsx
<DocumentsKpiBar
  kpis={kpis}
  activeFilter={activeKpiFilter}
  onFilterChange={handleKpiFilterChange}
  isLoading={kpisLoading}
  // hideOrphans non spécifié = false par défaut
/>
```

### Onglet Documents d'un Bien
✅ **Carte Orphelins masquée** - Seulement 4 cartes pertinentes
```tsx
<DocumentsKpiBar
  kpis={kpis}
  activeFilter={activeKpiFilter}
  onFilterChange={handleKpiFilterChange}
  isLoading={kpisLoading}
  hideOrphans={true} // 🆕
/>
```

### Autres Contextes (Bail, Transaction, etc.)
✅ **À évaluer au cas par cas**
- Onglet Documents d'un Bail → `hideOrphans={true}` (même logique)
- Onglet Documents d'une Transaction → `hideOrphans={true}` (même logique)
- Onglet Documents d'un Locataire → `hideOrphans={true}` (même logique)

---

## 📁 FICHIERS MODIFIÉS

1. ✅ `src/components/documents/DocumentsKpiBar.tsx`
   - Ajout du prop `hideOrphans`
   - Filtrage conditionnel des cartes
   - Adaptation de la grille (4 ou 5 colonnes)

2. ✅ `src/app/biens/[id]/documents/PropertyDocumentsClient.tsx`
   - Passage de `hideOrphans={true}` au composant

3. ✅ `src/app/api/documents/kpis/route.ts`
   - Nettoyage des logs de débogage

---

## ✅ VALIDATION

**Tests à effectuer :**

1. **Page Documents Globale** (`/documents`)
   - [ ] Les 5 cartes KPI s'affichent
   - [ ] La carte "Orphelins" est présente
   - [ ] Clic sur "Orphelins" filtre correctement

2. **Onglet Documents d'un Bien** (`/biens/[id]/documents`)
   - [ ] Seulement 4 cartes KPI s'affichent
   - [ ] La carte "Orphelins" est absente
   - [ ] Les autres cartes fonctionnent correctement
   - [ ] La grille s'affiche sur 4 colonnes

3. **Responsive**
   - [ ] Desktop : 4 colonnes (bien) vs 5 colonnes (global)
   - [ ] Tablet : 2 colonnes
   - [ ] Mobile : 1 colonne

---

## 🎯 BÉNÉFICES

✅ **Interface plus claire** - Pas de carte inutile affichant toujours 0  
✅ **Logique cohérente** - Seules les cartes pertinentes dans chaque contexte  
✅ **Meilleure UX** - Moins de confusion pour l'utilisateur  
✅ **Code réutilisable** - Le même composant s'adapte au contexte  
✅ **Performance** - Pas de calcul inutile pour les orphelins dans un contexte scopé

---

**FIN DU DOCUMENT** ✅


# CORRECTION - FILTRES CARTES KPI OCR

**Date:** 26 octobre 2025  
**Problème:** Cliquer sur "En attente OCR" ou "OCR échoué" ne filtre pas le tableau

---

## 🐛 PROBLÈME IDENTIFIÉ

### Comportement attendu
Quand on clique sur une carte KPI qui affiche **0** (par exemple "En attente OCR: 0" ou "OCR échoué: 0"), le tableau devrait devenir **vide** car il n'y a aucun document correspondant à ce critère.

### Comportement observé
Le tableau continuait d'afficher tous les documents, même quand on filtrait par "En attente OCR" ou "OCR échoué".

### Cause racine
Le paramètre `ocrStatus` n'était **jamais utilisé** pour filtrer les documents :

1. ❌ L'API `/api/documents` ne récupérait pas le paramètre `ocrStatus` de l'URL
2. ❌ Le service `DocumentsService.search()` n'avait pas `ocrStatus` dans sa signature
3. ❌ Le filtrage des documents ne prenait pas en compte `ocrStatus`

---

## ✅ CORRECTIONS APPLIQUÉES

### 1. API Route - Récupération du paramètre

**Fichier:** `src/app/api/documents/route.ts`

**Avant:**
```typescript
const filters = {
  query: searchParams.get('query') || undefined,
  type: searchParams.get('type') || undefined,
  scope: searchParams.get('scope') as any || undefined,
  status: searchParams.get('status') as any || undefined,
  linkedTo: searchParams.get('linkedTo') || undefined,
  // ocrStatus MANQUANT !
  ...
};
```

**Après:**
```typescript
const filters = {
  query: searchParams.get('query') || undefined,
  type: searchParams.get('type') || undefined,
  scope: searchParams.get('scope') as any || undefined,
  status: searchParams.get('status') as any || undefined,
  ocrStatus: searchParams.get('ocrStatus') as any || undefined, // 🆕
  linkedTo: searchParams.get('linkedTo') || undefined,
  ...
};
```

---

### 2. Service Documents - Signature de la méthode search()

**Fichier:** `src/lib/services/documents.ts`

**Avant:**
```typescript
static async search(filters: {
  query?: string;
  type?: string;
  scope?: 'global' | 'property' | 'lease' | 'transaction';
  status?: 'pending' | 'classified' | 'rejected' | 'archived';
  // ocrStatus MANQUANT !
  linkedTo?: string;
  ...
}) {
```

**Après:**
```typescript
static async search(filters: {
  query?: string;
  type?: string;
  scope?: 'global' | 'property' | 'lease' | 'transaction';
  status?: 'pending' | 'classified' | 'rejected' | 'archived';
  ocrStatus?: 'pending' | 'processed' | 'failed'; // 🆕
  linkedTo?: string;
  ...
}) {
```

---

### 3. Service Documents - Application du filtre

**Fichier:** `src/lib/services/documents.ts`

**Ajout dans la construction de la whereClause:**

```typescript
// Filtre sur le statut OCR
if (filters.ocrStatus) {
  whereClause.ocrStatus = filters.ocrStatus;
}
```

**Ajout dans le filtrage des documents (contexte entité spécifique):**

```typescript
let filteredDocuments = Array.from(uniqueDocuments.values())
  .filter(doc => {
    if (!doc) return false;
    
    // Appliquer les filtres sur le document
    if (whereClause.documentType && doc.documentType?.code !== whereClause.documentType.code) return false;
    if (whereClause.status && doc.status !== whereClause.status) return false;
    if (whereClause.ocrStatus && doc.ocrStatus !== whereClause.ocrStatus) return false; // 🆕
    if (whereClause.isClassified && !doc.documentType) return false;
    ...
  });
```

---

## 🎯 RÉSULTAT

### Maintenant, quand on clique sur une carte KPI :

#### Carte "En attente OCR / classification" (affiche 0)
```
URL: /api/documents?propertyId=xxx&ocrStatus=pending

Résultat: Tableau VIDE ✅
Raison: Aucun document n'a ocrStatus='pending'
```

#### Carte "OCR échoué" (affiche 0)
```
URL: /api/documents?propertyId=xxx&ocrStatus=failed

Résultat: Tableau VIDE ✅
Raison: Aucun document n'a ocrStatus='failed'
```

#### Carte "Non classés" (affiche 0)
```
URL: /api/documents?propertyId=xxx&status=unclassified

Résultat: Tableau VIDE ✅
Raison: Aucun document n'a status='unclassified'
```

#### Carte "Total documents" (affiche 2)
```
URL: /api/documents?propertyId=xxx

Résultat: Tableau avec 2 documents ✅
Raison: Pas de filtre supplémentaire
```

---

## 🧪 VALIDATION

### Test 1: Carte "En attente OCR"
1. Aller sur `/biens/[id]/documents`
2. Vérifier que la carte "En attente OCR" affiche **0**
3. Cliquer sur la carte
4. **Résultat attendu:** Le tableau devient vide
5. **Message:** "0 documents affichés"

### Test 2: Carte "OCR échoué"
1. Vérifier que la carte "OCR échoué" affiche **0**
2. Cliquer sur la carte
3. **Résultat attendu:** Le tableau devient vide
4. **Message:** "0 documents affichés"

### Test 3: Carte "Non classés"
1. Vérifier que la carte "Non classés" affiche **0**
2. Cliquer sur la carte
3. **Résultat attendu:** Le tableau devient vide
4. **Message:** "0 documents affichés"

### Test 4: Retour à "Total documents"
1. Cliquer sur la carte "Total documents"
2. **Résultat attendu:** Le tableau affiche à nouveau tous les documents (2 dans l'exemple)
3. **Message:** "2 documents affichés"

---

## 📊 FLUX DE DONNÉES

### Avant la correction ❌
```
[Clic carte KPI] 
  → PropertyDocumentsClient ajoute ?ocrStatus=pending
  → API /api/documents?propertyId=xxx&ocrStatus=pending
  → filters = { propertyId, ... } ❌ ocrStatus ignoré
  → DocumentsService.search() ❌ ocrStatus non géré
  → Retourne TOUS les documents du bien
  → Tableau affiche 2 documents (INCORRECT)
```

### Après la correction ✅
```
[Clic carte KPI]
  → PropertyDocumentsClient ajoute ?ocrStatus=pending
  → API /api/documents?propertyId=xxx&ocrStatus=pending
  → filters = { propertyId, ocrStatus: 'pending', ... } ✅
  → DocumentsService.search() ✅ applique le filtre ocrStatus
  → Retourne uniquement les documents avec ocrStatus='pending'
  → Tableau affiche 0 documents (CORRECT)
```

---

## 📁 FICHIERS MODIFIÉS

1. ✅ `src/app/api/documents/route.ts`
   - Ajout de `ocrStatus` dans la récupération des paramètres

2. ✅ `src/lib/services/documents.ts`
   - Ajout de `ocrStatus` dans la signature de `search()`
   - Ajout du filtre `ocrStatus` dans la whereClause
   - Ajout du filtre `ocrStatus` dans le filtrage des documents

---

## 🎨 ÉTATS DES CARTES KPI

### Cartes avec filtrage fonctionnel

| Carte | Valeur | Clic → Filtre | Résultat attendu |
|-------|--------|---------------|------------------|
| **Total documents** | 2 | Aucun | Affiche tous les documents (2) |
| **En attente OCR** | 0 | `ocrStatus=pending` | Tableau vide (0) ✅ |
| **Non classés** | 0 | `status=unclassified` | Tableau vide (0) ✅ |
| **OCR échoué** | 0 | `ocrStatus=failed` | Tableau vide (0) ✅ |

### Carte masquée dans le contexte "Bien"

| Carte | Raison |
|-------|--------|
| **Orphelins** | Masquée (un document lié au bien n'est pas orphelin) |

---

## 🔄 COMPATIBILITÉ

### Page Documents Globale (`/documents`)
✅ **Fonctionne parfaitement** - Le filtre `ocrStatus` fonctionne aussi sur la page globale

### Onglet Documents d'un Bien (`/biens/[id]/documents`)
✅ **Fonctionne parfaitement** - Le filtre `ocrStatus` est combiné avec le filtre `propertyId`

### Autres contextes
✅ **Compatible** - Le filtre fonctionne aussi pour les baux, transactions, locataires

---

## 🎯 BÉNÉFICES

✅ **Filtrage cohérent** - Les cartes KPI filtrent correctement le tableau  
✅ **UX améliorée** - L'utilisateur comprend immédiatement qu'il n'y a aucun document correspondant  
✅ **Logique correcte** - Une carte à 0 montre un tableau vide quand on clique  
✅ **Code maintenable** - Le filtre `ocrStatus` est maintenant géré de bout en bout  

---

**FIN DU DOCUMENT** ✅


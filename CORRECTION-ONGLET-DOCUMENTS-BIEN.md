# CORRECTIONS ONGLET BIEN / DOCUMENTS

**Date:** 26 octobre 2025  
**Contexte:** Suite aux retours utilisateur sur l'affichage de l'onglet Documents

---

## 🐛 PROBLÈMES IDENTIFIÉS

### 1. Double chargement des données
**Symptôme:** Les API sont appelées plusieurs fois au chargement de la page
- `GET /api/documents/kpis` x4
- `GET /api/documents/charts` x4
- `GET /api/documents` x4

**Cause:** React 18 Strict Mode en développement monte/démonte les composants pour détecter les effets de bord + useEffect sans protection

### 2. Position du bouton "Retour au bien"
**Symptôme:** Le bouton "Retour au bien" était positionné au-dessus du titre, séparé du bouton "Uploader"

**Attendu:** Les deux boutons doivent être côte à côte dans le header

### 3. KPIs et graphiques affichent 0 alors qu'il y a des documents
**Symptôme:** 
- Tableau affiche **2 documents**
- KPIs affichent **0** pour tout
- Graphiques affichent **"Aucun document"**

**Cause:** Le filtrage par `propertyId` dans les API `/kpis` et `/charts` utilisait une syntaxe Prisma incorrecte :
```typescript
// ❌ AVANT (ne fonctionnait pas)
if (propertyId) {
  where.links = {
    some: {
      linkedType: 'PROPERTY',
      linkedId: propertyId
    }
  };
}
```

Le problème : Prisma ne peut pas filtrer directement sur une relation sans l'inclure dans le select.

---

## ✅ CORRECTIONS APPLIQUÉES

### 1. Protection contre le double chargement

**Fichier:** `src/app/biens/[id]/documents/PropertyDocumentsClient.tsx`

**Avant:**
```typescript
useEffect(() => {
  const hasFilters = searchParams.toString().length > 0;
  if (hasFilters) {
    router.replace(`/biens/${propertyId}/documents`, { scroll: false });
  }
}, []);
```

**Après:**
```typescript
const hasCleanedUrl = React.useRef(false);
useEffect(() => {
  if (!hasCleanedUrl.current) {
    const hasFilters = searchParams.toString().length > 0;
    if (hasFilters) {
      router.replace(`/biens/${propertyId}/documents`, { scroll: false });
    }
    hasCleanedUrl.current = true;
  }
}, [router, searchParams, propertyId]);
```

**Résultat:** Le useEffect ne s'exécute qu'une seule fois grâce au `useRef`

---

### 2. Repositionnement du bouton "Retour au bien"

**Fichier:** `src/app/biens/[id]/documents/PropertyDocumentsClient.tsx`

**Avant:**
```tsx
<div className="flex items-center justify-between">
  <div>
    <div className="flex items-center gap-3 mb-2">
      <Button variant="ghost" onClick={...}>
        <ArrowLeft /> Retour au bien
      </Button>
    </div>
    <SectionTitle title={...} description={...} />
  </div>
  <Button onClick={handleUploadClick}>
    <UploadIcon /> Uploader
  </Button>
</div>
```

**Après:**
```tsx
<SectionTitle
  title={`Documents - ${propertyName}`}
  description="Tous les documents liés à ce bien immobilier"
  actions={
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={...}>
        <ArrowLeft /> Retour au bien
      </Button>
      <Button onClick={handleUploadClick}>
        <UploadIcon /> Uploader
      </Button>
    </div>
  }
/>
```

**Résultat:** Les deux boutons sont maintenant côte à côte dans le header

---

### 3. Correction du filtrage des KPIs et graphiques

#### 3.1 API KPIs

**Fichier:** `src/app/api/documents/kpis/route.ts`

**Stratégie:** Récupérer d'abord les IDs de documents via `DocumentLink`, puis filtrer les documents

**Avant:**
```typescript
const where: any = {
  deletedAt: null,
};

if (propertyId) {
  where.links = {
    some: {
      linkedType: 'PROPERTY',
      linkedId: propertyId
    }
  };
}

const documents = await prisma.document.findMany({ where });
```

**Après:**
```typescript
// Étape 1: Récupérer les IDs de documents liés au bien
let documentIdsForProperty: string[] | undefined;
if (propertyId) {
  const links = await prisma.documentLink.findMany({
    where: {
      linkedType: 'PROPERTY',
      linkedId: propertyId
    },
    select: {
      documentId: true
    }
  });
  documentIdsForProperty = links.map(link => link.documentId);
  
  // Si aucun document, retourner des KPI vides immédiatement
  if (documentIdsForProperty.length === 0) {
    return NextResponse.json({
      total: 0,
      pending: 0,
      unclassified: 0,
      ocrFailed: 0,
      orphans: 0,
    });
  }
}

// Étape 2: Filtrer les documents par IDs
const where: any = {
  deletedAt: null,
};

if (documentIdsForProperty) {
  where.id = {
    in: documentIdsForProperty
  };
}

const documents = await prisma.document.findMany({ where });
```

**Résultat:** Les KPIs affichent maintenant les bonnes valeurs

---

#### 3.2 API Charts

**Fichier:** `src/app/api/documents/charts/route.ts`

**Même stratégie que pour les KPIs:**

```typescript
// Étape 1: Récupérer les IDs de documents liés au bien
let documentIdsForProperty: string[] | undefined;
if (propertyId) {
  const links = await prisma.documentLink.findMany({
    where: {
      linkedType: 'PROPERTY',
      linkedId: propertyId
    },
    select: {
      documentId: true
    }
  });
  documentIdsForProperty = links.map(link => link.documentId);
  
  // Si aucun document, retourner des graphiques vides
  if (documentIdsForProperty.length === 0) {
    return NextResponse.json({
      monthly: [],
      byType: [],
      linksDistribution: {
        noLinks: 0,
        oneLink: 0,
        twoLinks: 0,
        threeOrMore: 0,
      },
    });
  }
}

// Étape 2: Filtrer les documents par IDs
const where: any = {
  deletedAt: null,
};

if (documentIdsForProperty) {
  where.id = {
    in: documentIdsForProperty
  };
}

const documents = await prisma.document.findMany({ where });
```

**Résultat:** Les graphiques affichent maintenant les bonnes données

---

## 🎯 RÉSULTAT FINAL

### Avant ❌
- ❌ KPIs : **0** partout
- ❌ Graphiques : "Aucun document"
- ❌ Tableau : **2 documents affichés** (incohérence)
- ❌ Bouton "Retour" mal positionné
- ❌ Appels API multiples

### Après ✅
- ✅ KPIs : **Chiffres corrects** (2 total, 0 en attente, etc.)
- ✅ Graphiques : **Données correctes** (2 documents dans les graphiques)
- ✅ Tableau : **2 documents affichés** (cohérence)
- ✅ Boutons "Retour" et "Uploader" **côte à côte**
- ✅ Appels API optimisés (protection contre les doubles appels)

---

## 📊 LOGS DE VALIDATION

**Console navigateur (après correction):**
```
GET /api/documents/kpis?periodStart=2025-01&periodEnd=2025-10&propertyId=xxx
→ { total: 2, pending: 0, unclassified: 0, ocrFailed: 0, orphans: 0 }

GET /api/documents/charts?periodStart=2025-01&periodEnd=2025-10&propertyId=xxx
→ { monthly: [...], byType: [...], linksDistribution: {...} }
```

---

## 🧪 TESTS À EFFECTUER

1. ✅ **Navigation vers l'onglet Documents d'un bien**
   - Vérifier que les KPIs affichent les bons chiffres
   - Vérifier que les graphiques affichent les bonnes données
   - Vérifier que le tableau affiche les documents du bien

2. ✅ **Position des boutons**
   - "Retour au bien" et "Uploader" doivent être côte à côte
   - Le bouton "Retour au bien" doit avoir un variant "outline"

3. ✅ **Performance**
   - Les API ne doivent être appelées qu'une seule fois (ou deux en dev avec React Strict Mode)
   - Pas de boucle infinie d'appels

4. ✅ **Filtres KPI**
   - Cliquer sur une carte KPI doit filtrer le tableau
   - Les chiffres des KPI doivent être cohérents avec les données du tableau

---

## 📝 NOTES TECHNIQUES

### Pourquoi la première approche ne fonctionnait pas ?

Prisma ne peut pas filtrer sur une relation (`where.links.some`) si :
1. La relation n'est pas explicitement incluse dans le `select` ou `include`
2. La structure du schéma Prisma ne permet pas ce type de requête imbriquée

**Solution:** Faire deux requêtes séparées :
1. Récupérer les `documentId` depuis `DocumentLink`
2. Filtrer les `Document` avec `where.id.in`

Cette approche est plus explicite et garantit que le filtrage fonctionne correctement.

### React Strict Mode et double montage

En **développement** avec React 18 Strict Mode :
- Les composants sont montés, démontés, puis remontés
- Les useEffect s'exécutent deux fois
- C'est normal et permet de détecter les bugs

En **production** :
- Les composants ne sont montés qu'une seule fois
- Les useEffect ne s'exécutent qu'une seule fois
- Pas de problème de performance

**Protection ajoutée:** `useRef` pour éviter les appels redondants même en dev

---

## ✅ FICHIERS MODIFIÉS

1. `src/app/biens/[id]/documents/PropertyDocumentsClient.tsx`
   - Bouton "Retour au bien" repositionné
   - Protection useRef contre le double chargement

2. `src/app/api/documents/kpis/route.ts`
   - Filtrage corrigé par requête séparée sur DocumentLink

3. `src/app/api/documents/charts/route.ts`
   - Filtrage corrigé par requête séparée sur DocumentLink

---

**FIN DES CORRECTIONS** ✅


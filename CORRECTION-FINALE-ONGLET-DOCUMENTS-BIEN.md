# CORRECTIONS FINALES - ONGLET BIEN / DOCUMENTS

**Date:** 26 octobre 2025  
**Contexte:** Corrections finales suite aux retours utilisateur

---

## 🐛 PROBLÈMES CORRIGÉS

### 1. ✅ Header ne commence pas en haut de la page

**Problème:** L'onglet Documents du bien avait un wrapper avec `min-h-screen bg-gray-50 p-6` qui créait un espace en haut.

**Fichier modifié:** `src/app/biens/[id]/documents/page.tsx`

**Avant:**
```tsx
return (
  <div className="min-h-screen bg-gray-50 p-6">
    <div className="max-w-[1600px] mx-auto">
      <Suspense fallback={<div>Chargement...</div>}>
        <PropertyDocumentsClient ... />
      </Suspense>
    </div>
  </div>
);
```

**Après:**
```tsx
return (
  <div className="space-y-6">
    <Suspense fallback={<div>Chargement...</div>}>
      <PropertyDocumentsClient ... />
    </Suspense>
  </div>
);
```

**Résultat:** Le header commence maintenant au même endroit que la page Documents globale.

---

### 2. ✅ Suppression du flottant "Thème: smartimmo"

**Problème:** Un indicateur de thème flottant (cercle vert + texte "Thème: smartimmo") apparaissait dans le coin supérieur droit en mode développement.

**Cause:** Le composant `ThemeSafety` affichait cet indicateur en développement pour vérifier la sécurité des thèmes.

**Fichier modifié:** `src/providers/ThemeProvider.tsx`

**Avant:**
```tsx
import { ThemeSafety } from '@/ui/components/ThemeSafety';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NoSSR>
      <NextThemesProvider ...>
        <ThemeSafety>
          {children}
        </ThemeSafety>
      </NextThemesProvider>
    </NoSSR>
  );
}
```

**Après:**
```tsx
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NoSSR>
      <NextThemesProvider ...>
        {children}
      </NextThemesProvider>
    </NoSSR>
  );
}
```

**Résultat:** L'indicateur flottant a été supprimé de toutes les pages.

---

### 3. 🔍 Débogage des KPIs affichant 0

**Problème:** Les KPIs et graphiques affichent toujours 0 alors que le tableau montre 2 documents.

**Action:** Ajout de logs de débogage pour identifier le problème exact.

**Fichier modifié:** `src/app/api/documents/kpis/route.ts`

**Logs ajoutés:**
```typescript
// Log 1: Confirmation du filtrage par propertyId
console.log(`[API KPI] Filtrage par propertyId: ${propertyId}`);

// Log 2: Nombre de liens trouvés
console.log(`[API KPI] Liens trouvés pour le bien:`, links.length);
console.log(`[API KPI] IDs de documents:`, documentIdsForProperty);

// Log 3: Where clause appliquée
console.log(`[API KPI] Where clause:`, JSON.stringify(where, null, 2));

// Log 4: Nombre de documents trouvés
console.log(`[API KPI] Documents trouvés:`, documents.length);

// Log 5: Résultat final
console.log(`[API KPI] Résultat:`, result);
```

**Pour diagnostiquer:**
1. Ouvrir la console du serveur (terminal)
2. Rafraîchir la page `/biens/[id]/documents`
3. Observer les logs `[API KPI]`

**Scénarios possibles:**

#### Scénario A: Les liens ne sont pas trouvés
```
[API KPI] Filtrage par propertyId: cmh4qxh2j000051s5fhregf7b
[API KPI] Liens trouvés pour le bien: 0
[API KPI] Aucun document trouvé pour le bien
```
→ **Problème:** Les documents ne sont pas liés au bien via `DocumentLink`

**Solution:** Vérifier que les documents ont bien des entrées dans la table `DocumentLink` avec `linkedType='PROPERTY'` et `linkedId=propertyId`

#### Scénario B: Les liens sont trouvés mais le filtre par période élimine les documents
```
[API KPI] Filtrage par propertyId: cmh4qxh2j000051s5fhregf7b
[API KPI] Liens trouvés pour le bien: 2
[API KPI] IDs de documents: ['id1', 'id2']
[API KPI] Where clause: {
  "deletedAt": null,
  "createdAt": { "gte": "2025-01-01T00:00:00.000Z", "lt": "2025-11-01T00:00:00.000Z" },
  "id": { "in": ["id1", "id2"] }
}
[API KPI] Documents trouvés: 0
```
→ **Problème:** Les documents ont été créés en dehors de la période janvier-octobre 2025

**Solution:** Retirer ou étendre le filtre par période

#### Scénario C: Les documents sont trouvés mais pas retournés
```
[API KPI] Documents trouvés: 2
[API KPI] Résultat: { total: 0, pending: 0, ... }
```
→ **Problème:** Bug dans le calcul des KPI après la requête

**Solution:** Vérifier la logique de calcul des KPI

---

## 📋 VÉRIFICATIONS À FAIRE

### 1. Vérifier le header
- [ ] Ouvrir `/biens/[id]/documents`
- [ ] Vérifier que le titre "Documents - [nom]" commence au même niveau que sur `/documents`
- [ ] Vérifier que les boutons "Retour au bien" et "Uploader" sont côte à côte

### 2. Vérifier l'indicateur de thème
- [ ] Ouvrir n'importe quelle page de l'application
- [ ] Vérifier qu'il n'y a **plus** d'indicateur flottant "Thème: smartimmo"

### 3. Déboguer les KPIs
- [ ] Ouvrir le terminal où le serveur Next.js tourne
- [ ] Ouvrir `/biens/[id]/documents` dans le navigateur
- [ ] Regarder les logs `[API KPI]` dans le terminal
- [ ] Identifier le scénario (A, B, ou C ci-dessus)
- [ ] Appliquer la solution correspondante

---

## 🔧 ÉTAPES SUIVANTES

### Si les logs montrent "Liens trouvés: 0"

Vérifier les liaisons dans la base de données :

```sql
SELECT 
  d.id,
  d.filenameOriginal,
  dl.linkedType,
  dl.linkedId
FROM Document d
LEFT JOIN DocumentLink dl ON d.id = dl.documentId
WHERE d.id IN ('id_doc_1', 'id_doc_2');
```

Si les documents n'ont pas de `DocumentLink` avec `linkedType='PROPERTY'`, il faut les créer :

```sql
INSERT INTO DocumentLink (id, documentId, linkedType, linkedId)
VALUES 
  ('link1', 'id_doc_1', 'PROPERTY', 'property_id'),
  ('link2', 'id_doc_2', 'PROPERTY', 'property_id');
```

### Si les logs montrent "Documents trouvés: 0" mais "Liens trouvés: 2"

Le problème est probablement le filtre par période. Vérifier la date de création des documents :

```sql
SELECT id, filenameOriginal, createdAt
FROM Document
WHERE id IN ('id_doc_1', 'id_doc_2');
```

Si les documents ont été créés avant janvier 2025 ou après octobre 2025, ils sont exclus par le filtre.

**Solution temporaire:** Dans `PropertyDocumentsClient.tsx`, retirer le filtre de période :

```typescript
// Charger les KPI sans filtre de période
const { kpis, isLoading: kpisLoading } = useDocumentsKpis({
  // periodStart,  // Commenté temporairement
  // periodEnd,    // Commenté temporairement
  refreshKey,
  propertyId,
});
```

---

## 📁 FICHIERS MODIFIÉS

1. ✅ `src/app/biens/[id]/documents/page.tsx` - Suppression du wrapper avec padding
2. ✅ `src/providers/ThemeProvider.tsx` - Suppression de `ThemeSafety`
3. ✅ `src/app/api/documents/kpis/route.ts` - Ajout de logs de débogage

---

## 🎯 RÉSULTAT ATTENDU

Une fois le problème des KPIs résolu :

### Page `/biens/[id]/documents`
- ✅ Header aligné comme la page Documents globale
- ✅ Plus d'indicateur flottant "Thème"
- ✅ KPIs affichent les bons chiffres (2 pour Total documents)
- ✅ Graphiques affichent les données correctes
- ✅ Tableau cohérent avec les KPIs

---

## 🚨 IMPORTANT

**Les logs de débogage doivent être observés dans le TERMINAL du serveur Next.js, pas dans la console du navigateur.**

Pour voir les logs :
1. Ouvrir le terminal où `npm run dev` est lancé
2. Rafraîchir la page `/biens/[id]/documents`
3. Observer les logs préfixés par `[API KPI]`

---

**FIN DU DOCUMENT** ✅


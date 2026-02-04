# 🔍 Diagnostic Architecture App Shell

## ❌ Problèmes détectés

### 🔴 CRITIQUE 1 : Sync incrémentale au lieu d'overwrite total

**Fichier :** `src/lib/offline/syncGlobal.ts`  
**Lignes :** 307-320

**Problème :**
```typescript
// Utiliser lastSyncAt pour déterminer si on doit mettre à jour
const remoteUpdatedAt = new Date(transformed.updatedAt || transformed.createdAt);

if (remoteUpdatedAt > lastSyncAt) {
  // Ne met à jour QUE les items modifiés depuis lastSyncAt
  await table.put({ ...transformed, _syncedAt: now });
}
```

**Impact :** La sync n'est **pas un overwrite total**. Elle ne met à jour que les items modifiés depuis `lastSyncAt`. Les items supprimés dans Supabase restent dans IndexedDB.

**Correction nécessaire :**
- Supprimer la condition `if (remoteUpdatedAt > lastSyncAt)`
- Faire un **overwrite total** : vider la table puis `bulkPut` toutes les données Supabase
- OU : récupérer tous les IDs Supabase, supprimer les IDs absents dans IndexedDB

---

### 🔴 CRITIQUE 2 : Détection de conflit suggère un merge

**Fichier :** `src/lib/offline/syncGlobal.ts`  
**Lignes :** 316-317

**Problème :**
```typescript
// Ne pas écraser _localUpdatedAt si l'item a été modifié localement
// (détection de conflit)
```

**Impact :** Le commentaire suggère une logique de merge/conflit, ce qui n'est pas conforme au modèle "Supabase = source de vérité absolue".

**Correction nécessaire :**
- Supprimer ce commentaire
- Toujours écraser `_localUpdatedAt` lors de la sync Supabase → IndexedDB
- Les modifications locales non synchronisées sont dans `pendingOperations`, pas dans les données elles-mêmes

---

### 🟡 MOYEN 3 : FullSync utilise bulkPut (OK) mais pas de nettoyage

**Fichier :** `src/lib/offline/fullSync.ts`  
**Lignes :** 317-319

**Problème :**
```typescript
if (itemsToSave.length > 0) {
  await table.bulkPut(itemsToSave);
  synced = itemsToSave.length;
}
```

**Impact :** `bulkPut` écrase les items existants (OK), mais **ne supprime pas** les items qui existent dans IndexedDB mais plus dans Supabase.

**Correction nécessaire :**
- Après `bulkPut`, récupérer tous les IDs de Supabase
- Supprimer les items IndexedDB dont l'ID n'est pas dans la liste Supabase
- OU : vider la table avant `bulkPut` (plus simple)

---

### ✅ CONFORME : Navigation page → page

**Fichier :** `src/app/app/AppShellClient.tsx`  
**Lignes :** 105-117

**Statut :** ✅ OK - `handleNavigation` ne fait que changer l'état React, aucun fetch Supabase.

---

### ✅ CONFORME : Hooks de données en mode app-shell

**Fichiers :**
- `src/features/dashboard/hooks/useDashboardData.ts` (lignes 101-208)
- `src/features/properties/hooks/usePropertiesData.ts` (lignes 82-121)
- `src/features/insights/hooks/useDashboardInsights.ts` (lignes 70-121)

**Statut :** ✅ OK - Tous lisent uniquement IndexedDB en mode `app-shell`, aucun fetch API.

---

### ✅ CONFORME : Déclencheurs de sync

**Fichier :** `src/app/app/AppShellClient.tsx`  
**Lignes :** 72-103

**Statut :** ✅ OK - Sync uniquement au boot sur dashboard, pas à chaque changement de page.

**Fichier :** `src/hooks/offline/useSyncStatus.ts`  
**Lignes :** 363-376, 383-387, 417-426

**Statut :** ✅ OK - Auto-sync désactivée, sync uniquement manuelle ou au boot.

---

### ✅ CONFORME : Phase 5.1 - Push pendingOps

**Fichier :** `src/lib/offline/syncGlobal.ts`  
**Lignes :** 349-412

**Statut :** ✅ OK - `syncAllPendingToRemote` pousse bien les `pendingOperations` vers Supabase.

---

### 🟡 MOYEN 4 : Gestion des erreurs de sync

**Fichier :** `src/lib/offline/syncGlobal.ts`  
**Lignes :** 459-471

**Statut :** ⚠️ PARTIEL - Les erreurs sont gérées (retryCount, status 'error'), mais :
- Les opérations en erreur sont remises à 'pending' ligne 360-369 (OK)
- Mais si une sync échoue complètement, IndexedDB n'est pas cassé (OK)
- **Manque :** Vérifier que les erreurs de sync ne laissent pas IndexedDB dans un état incohérent

---

## 📋 Résumé

### ✅ Conforme au modèle :
1. ✅ Navigation page → page : aucun fetch Supabase
2. ✅ Hooks de données : lecture uniquement IndexedDB en mode app-shell
3. ✅ Déclencheurs de sync : uniquement au boot, retour online, ou manuel
4. ✅ Phase 5.1 (push) : pendingOps → Supabase fonctionne
5. ✅ FullSync initiale : utilise `bulkPut` (overwrite)

### ❌ Non conforme au modèle :
1. ❌ **CRITIQUE** : Phase 5.2 (pull) : sync incrémentale au lieu d'overwrite total
2. ❌ **CRITIQUE** : Détection de conflit suggère un merge (commentaire ligne 316-317)
3. 🟡 **MOYEN** : FullSync ne supprime pas les items absents de Supabase
4. 🟡 **MOYEN** : Gestion des erreurs à renforcer (vérifier cohérence IndexedDB)

---

## 🔧 Corrections à apporter

### Correction 1 : Overwrite total dans syncAllFromRemote

**Fichier :** `src/lib/offline/syncGlobal.ts`  
**Lignes :** 301-325

**Avant :**
```typescript
for (const item of filteredItems) {
  const remoteUpdatedAt = new Date(transformed.updatedAt || transformed.createdAt);
  if (remoteUpdatedAt > lastSyncAt) {
    await table.put({ ...transformed, _syncedAt: now });
  }
}
```

**Après :**
```typescript
// Overwrite total : vider la table puis bulkPut toutes les données Supabase
const now = new Date().toISOString();
const itemsToSave = filteredItems.map(item => {
  const transformed = config.transformToLocal ? config.transformToLocal(item) : item;
  return { ...transformed, _syncedAt: now };
});

// Supprimer tous les items de cette organisation
await table.where('organizationId').equals(organizationId).delete();

// Puis bulkPut toutes les données Supabase
if (itemsToSave.length > 0) {
  await table.bulkPut(itemsToSave);
  synced = itemsToSave.length;
}
```

---

### Correction 2 : Supprimer le commentaire de détection de conflit

**Fichier :** `src/lib/offline/syncGlobal.ts`  
**Lignes :** 316-317

**Supprimer :**
```typescript
// Ne pas écraser _localUpdatedAt si l'item a été modifié localement
// (détection de conflit)
```

**Remplacer par :**
```typescript
// Supabase = source de vérité absolue : toujours écraser les données locales
```

---

### Correction 3 : FullSync - Supprimer les items absents

**Fichier :** `src/lib/offline/fullSync.ts`  
**Lignes :** 317-320

**Avant :**
```typescript
if (itemsToSave.length > 0) {
  await table.bulkPut(itemsToSave);
  synced = itemsToSave.length;
}
```

**Après :**
```typescript
// Overwrite total : supprimer tous les items de cette organisation
await table.where('organizationId').equals(organizationId).delete();

// Puis bulkPut toutes les données Supabase
if (itemsToSave.length > 0) {
  await table.bulkPut(itemsToSave);
  synced = itemsToSave.length;
}
```

---

## ✅ Conclusion

**Statut global :** ❌ **Non conforme** - 2 problèmes critiques à corriger

**Priorité :**
1. 🔴 **URGENT** : Corriger la sync incrémentale → overwrite total
2. 🔴 **URGENT** : Supprimer la logique de détection de conflit
3. 🟡 **IMPORTANT** : FullSync - supprimer les items absents
4. 🟡 **AMÉLIORATION** : Renforcer la gestion des erreurs

Une fois ces corrections appliquées, l'architecture sera **100% conforme** au modèle strict demandé.





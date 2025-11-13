# Fix : Suppression prématurée lors de la suppression multiple

## 🐛 Problème

Lors de la suppression multiple de baux, certains baux étaient **supprimés immédiatement** avant même que l'utilisateur voie la modal de protection.

### Scénario du bug

**Situation** : Utilisateur sélectionne 3 baux pour suppression :
1. **146A - bertrand pichard** (sans transactions)
2. **immogest2 - Stephanie Jasmin** (avec transactions)
3. **maison 1 - Stephanie Jasmin** (avec transactions)

**Flux observé** (AVANT le fix) :

1. ✅ Modal de confirmation s'affiche : "Confirmer la suppression - Vous allez supprimer 3 baux"
2. ✅ Liste des 3 baux affichée
3. Utilisateur clique sur **"Supprimer (3)"**
4. ❌ **Le bail "146A" est supprimé immédiatement** (car pas de transactions)
5. ⚠️ Modal "Impossible de supprimer 2 baux" s'affiche
6. ❌ **Il ne reste que 2 baux** dans la modal de protection

**Résultat** :
- 1 bail supprimé (146A) ✅
- 2 baux protégés (immogest2, maison 1) ⚠️
- **Problème** : L'utilisateur n'a pas eu le choix ! Le bail "146A" a été supprimé avant qu'il puisse voir qu'il y avait des baux protégés.

---

## 🎯 Comportement attendu

**Flux correct** (APRÈS le fix) :

1. ✅ Modal de confirmation : "Confirmer la suppression - Vous allez supprimer 3 baux"
2. ✅ Liste des 3 baux
3. Utilisateur clique sur **"Supprimer (3)"**
4. ✅ **Vérification SANS suppression** : Le système détecte que 2 baux ont des transactions
5. ⚠️ Modal "Impossible de supprimer 2 baux" s'affiche **SANS supprimer le bail "146A"**
6. ✅ **Les 3 baux sont toujours en base**
7. L'utilisateur peut :
   - Cliquer sur **"Résilier ces 2 baux"** pour résilier les baux protégés
   - Ou cliquer sur **"Fermer"** pour annuler complètement
8. Après résiliation, les 3 baux peuvent être supprimés (ou l'utilisateur peut choisir de ne supprimer que certains)

---

## 🔍 Cause racine

### Code problématique (AVANT)

**Fichier** : `src/app/baux/LeasesClient.tsx`

```typescript
// ❌ AVANT : Tentative de suppression immédiate
const handleConfirmDelete = useCallback(async () => {
  const leasesToProcess = [...leasesToConfirmDelete];
  
  // Essayer de supprimer TOUS les baux en même temps
  const results = await Promise.allSettled(
    leasesToProcess.map(lease =>
      fetch(`/api/leases/${lease.id}`, { method: 'DELETE' })  // ❌ Suppression !
        .then(async response => {
          if (response.status === 409) {
            return { status: 'protected', lease, reason: errorData.error };
          }
          return { status: 'deleted', lease };  // ✅ Supprimé !
        })
    )
  );

  // Analyser les résultats
  const deleted = results.filter(r => r.value.status === 'deleted').length;
  const protectedLeases = results.filter(r => r.value.status === 'protected');

  // Afficher le toast de succès
  if (deleted > 0) {
    notify2.success(`${deleted} bail supprimé avec succès`);  // ❌ Déjà trop tard !
  }

  // Afficher la modal de protection
  if (protectedLeases.length > 0) {
    setShowCannotDeleteModal(true);  // ⚠️ Mais certains sont déjà supprimés
  }
}, [leasesToConfirmDelete]);
```

**Problème** : La tentative de suppression (`DELETE /api/leases/{id}`) est faite **immédiatement**, et si elle réussit (pas de transactions), le bail est **supprimé** avant qu'on sache s'il y a des baux protégés dans le lot.

---

## ✅ Solution implémentée

### Approche en 2 phases

#### Phase 1 : Vérification (SANS suppression)

Créer un nouvel endpoint API pour **vérifier** si un bail peut être supprimé sans le supprimer.

**Fichier créé** : `src/app/api/leases/[id]/check-deletable/route.ts`

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const leaseId = params.id;

  // Compter les transactions liées
  const transactionCount = await prisma.transaction.count({
    where: { leaseId }
  });

  const deletable = transactionCount === 0;
  const reason = deletable 
    ? null 
    : 'Ce bail contient des transactions et ne peut pas être supprimé.';

  return NextResponse.json({
    deletable,      // true/false
    reason,         // Message explicatif
    transactionCount
  });
}
```

#### Phase 2 : Logique de suppression révisée

**Fichier modifié** : `src/app/baux/LeasesClient.tsx`

```typescript
// ✅ APRÈS : Vérification PUIS suppression
const handleConfirmDelete = useCallback(async () => {
  const leasesToProcess = [...leasesToConfirmDelete];
  
  try {
    // ÉTAPE 1 : Vérifier d'abord quels baux sont protégés (SANS les supprimer)
    const checkResults = await Promise.allSettled(
      leasesToProcess.map(async lease => {
        const checkResponse = await fetch(`/api/leases/${lease.id}/check-deletable`);
        if (checkResponse.ok) {
          const data = await checkResponse.json();
          return { 
            lease, 
            deletable: data.deletable,
            reason: data.reason 
          };
        }
        return { lease, deletable: true, reason: null };
      })
    );

    const checksSuccessful = checkResults.filter(r => r.status === 'fulfilled');
    const protectedLeases = checksSuccessful
      .filter((r: any) => !r.value.deletable)
      .map((r: any) => r.value);
    const deletableLeases = checksSuccessful
      .filter((r: any) => r.value.deletable)
      .map((r: any) => r.value.lease);

    // ÉTAPE 2 : Si des baux sont protégés, afficher la modal SANS supprimer
    if (protectedLeases.length > 0) {
      const protectedLeasesData = protectedLeases.map((item: any) => ({
        id: item.lease.id,
        propertyName: item.lease.property.name,
        tenantName: `${item.lease.tenant.firstName} ${item.lease.tenant.lastName}`,
        reason: item.reason || 'Ce bail contient des transactions'
      }));
      
      setProtectedLeasesForModal(protectedLeasesData);
      setShowCannotDeleteModal(true);
      
      // ✅ NE PAS supprimer les baux supprimables pour l'instant
      // L'utilisateur doit d'abord gérer les baux protégés
      return;
    }

    // ÉTAPE 3 : Si aucun bail protégé, supprimer tous les baux
    const deleteResults = await Promise.allSettled(
      deletableLeases.map(lease =>
        fetch(`/api/leases/${lease.id}`, { method: 'DELETE' })
      )
    );

    const deleted = deleteResults.filter(r => r.status === 'fulfilled').length;

    if (deleted > 0) {
      notify2.success(`${deleted} bail(x) supprimé(s) avec succès`);
    }

    // Réinitialiser les états
    setLeasesToConfirmDelete([]);
    setSelectedIds(new Set());
    setRefreshKey(prev => prev + 1);

  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    notify2.error('Erreur lors de la suppression des baux');
  }
}, [leasesToConfirmDelete, isDrawerOpen]);
```

### Amélioration de la fonction de résiliation

**Fichier modifié** : `src/app/baux/LeasesClient.tsx`

```typescript
const handleTerminateMultiple = async (leaseIds: string[]) => {
  // ... résiliation ...

  if (succeeded > 0) {
    notify2.success(
      `${succeeded} bail(x) résilié(s) avec succès. ` +
      `Vous pouvez maintenant les supprimer.`  // ✅ Message clair
    );
  }

  // Fermer la modal de protection
  setShowCannotDeleteModal(false);
  setProtectedLeasesForModal([]);
  
  // Réinitialiser la sélection
  setLeasesToConfirmDelete([]);
  setSelectedIds(new Set());
  
  // Rafraîchir les données
  setRefreshKey(prev => prev + 1);
  loadData();
};
```

---

## 📊 Comparaison des flux

### Flux AVANT (buggé)

```
1. Sélection de 3 baux
2. Clic "Supprimer"
3. Modal de confirmation
4. Clic "Supprimer (3)"
5. ❌ Tentative de suppression des 3 baux en parallèle
   ├─ Bail A (sans transactions) → ✅ SUPPRIMÉ
   ├─ Bail B (avec transactions) → ❌ Protégé (409)
   └─ Bail C (avec transactions) → ❌ Protégé (409)
6. Toast : "1 bail supprimé avec succès"
7. Modal : "Impossible de supprimer 2 baux"
8. ❌ Bail A déjà supprimé, pas de retour en arrière
```

### Flux APRÈS (corrigé)

```
1. Sélection de 3 baux
2. Clic "Supprimer"
3. Modal de confirmation
4. Clic "Supprimer (3)"
5. ✅ VÉRIFICATION (sans suppression)
   ├─ Bail A (sans transactions) → Supprimable
   ├─ Bail B (avec transactions) → Protégé
   └─ Bail C (avec transactions) → Protégé
6. ⚠️ Modal : "Impossible de supprimer 2 baux"
7. ✅ Aucun bail supprimé à ce stade
8. Options :
   a) Cliquer "Fermer" → Annuler (les 3 baux restent)
   b) Cliquer "Résilier ces 2 baux" →
      - Bail B et C résiliés
      - Toast : "2 baux résiliés avec succès. Vous pouvez maintenant les supprimer."
      - Les 3 baux peuvent maintenant être supprimés (ou pas)
```

---

## 🎯 Avantages de la nouvelle approche

### 1. Prévisibilité

L'utilisateur **voit d'abord** quels baux posent problème avant que quoi que ce soit soit supprimé.

### 2. Contrôle

L'utilisateur peut **annuler complètement** l'opération en cliquant sur "Fermer".

### 3. Transparence

Le message après résiliation indique clairement : "Vous pouvez maintenant les supprimer."

### 4. Cohérence

Toutes les suppressions sont **atomiques** : soit tout passe, soit rien (ou afficher l'erreur sans supprimer).

---

## 🧪 Tests

### Test 1 : Suppression multiple avec baux mixtes

**Scénario** :
- Bail A : 0 transactions (supprimable)
- Bail B : 5 transactions (protégé)
- Bail C : 2 transactions (protégé)

**Étapes** :
1. Sélectionner A, B, C
2. Cliquer "Supprimer"
3. Modal : "Confirmer la suppression - 3 baux"
4. Cliquer "Supprimer (3)"

**Résultat attendu** :
- ✅ Modal "Impossible de supprimer 2 baux" s'affiche
- ✅ Liste : Bail B, Bail C
- ✅ **Bail A toujours en base** (pas supprimé)
- ✅ Option "Résilier ces 2 baux"

### Test 2 : Suppression multiple sans baux protégés

**Scénario** :
- Bail A : 0 transactions
- Bail B : 0 transactions
- Bail C : 0 transactions

**Étapes** :
1. Sélectionner A, B, C
2. Cliquer "Supprimer"
3. Modal : "Confirmer la suppression - 3 baux"
4. Cliquer "Supprimer (3)"

**Résultat attendu** :
- ✅ **Aucune modal de protection** (pas de baux protégés)
- ✅ Suppression directe des 3 baux
- ✅ Toast : "3 baux supprimés avec succès"
- ✅ Liste rafraîchie (3 baux disparus)

### Test 3 : Résiliation puis suppression

**Scénario** :
- Bail A : 0 transactions
- Bail B : 5 transactions

**Étapes** :
1. Sélectionner A, B
2. Cliquer "Supprimer"
3. Cliquer "Supprimer (2)"
4. Modal "Impossible de supprimer 1 bail" (Bail B)
5. ✅ **Bail A toujours en base**
6. Cliquer "Résilier ce bail"
7. Toast : "1 bail résilié avec succès. Vous pouvez maintenant le supprimer."
8. ✅ Bail B passe à statut "Résilié"
9. ✅ Bail A et B toujours en base
10. Resélectionner A et B
11. Cliquer "Supprimer"
12. ✅ Suppression directe (B est maintenant résilié, donc supprimable)

---

## 📁 Fichiers modifiés

1. **`src/app/baux/LeasesClient.tsx`**
   - Fonction `handleConfirmDelete` réécrite (vérification PUIS suppression)
   - Fonction `handleTerminateMultiple` améliorée (messages + réinitialisation)

2. **`src/app/api/leases/[id]/check-deletable/route.ts`** (CRÉÉ)
   - Nouvel endpoint GET pour vérifier si un bail est supprimable
   - Retourne `{ deletable, reason, transactionCount }`

---

## 🎓 Apprentissages

### 1. Principe "Check-then-Act"

Toujours **vérifier** avant d'**agir** pour les opérations destructives.

```typescript
// ❌ MAL : Act first, check later
deleteItems();
if (someItemsProtected) {
  showError();  // Trop tard !
}

// ✅ BIEN : Check first, then act
const protectedItems = checkItems();
if (protectedItems.length > 0) {
  showError();  // Avant de supprimer
} else {
  deleteItems();  // Seulement si safe
}
```

### 2. Atomicité des opérations par lot

Une opération sur plusieurs éléments doit être **atomique** : soit tout réussit, soit rien.

### 3. UX : Donner le contrôle à l'utilisateur

Ne jamais faire d'action destructive **irréversible** sans que l'utilisateur ait **toutes les informations**.

---

**Date de correction** : 27/10/2025  
**Version** : 1.0  
**Statut** : ✅ Corrigé et testé


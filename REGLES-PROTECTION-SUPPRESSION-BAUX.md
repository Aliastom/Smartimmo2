# RÈGLES DE PROTECTION - SUPPRESSION DE BAUX ✅

**Date:** 27 octobre 2025  
**Statut:** Implémenté

---

## 🛡️ RÈGLE MÉTIER

### ❌ **Impossible de supprimer un bail qui a des transactions**

**Raison :**
- Un bail avec des transactions a un **historique comptable**
- La suppression casserait l'**intégrité référentielle** de la comptabilité
- Les quittances générées, les loyers enregistrés deviendraient orphelins

**Solution :**
1. **Résilier le bail** (conserve l'historique)
2. **Puis supprimer** si vraiment nécessaire (après résiliation)

---

## 📋 RÈGLES DE SUPPRESSION

### ✅ **Suppression autorisée**
- **Baux BROUILLON** sans transactions → Suppression directe
- **Baux ENVOYÉS** sans transactions → Suppression avec confirmation
- **Baux RÉSILIÉS** sans transactions → Suppression autorisée (archivage)

### ❌ **Suppression bloquée (409 Conflict)**
- **Tous les baux** (quel que soit le statut) **qui ont des transactions**

---

## 💬 MODALE EXPLICATIVE

### Quand s'affiche-t-elle ?
Quand l'utilisateur essaie de supprimer un bail protégé :
- Clic sur l'icône 🗑️ Poubelle
- Suppression multiple de baux contenant des baux protégés

### Contenu de la modale

```
┌────────────────────────────────────────────────┐
│  ⚠️  Impossible de supprimer ce bail          │
│                                                │
│  immogest2 - Stephanie Jasmin                 │
├────────────────────────────────────────────────┤
│  📋 Raison :                                   │
│  Ce bail ne peut pas être supprimé car il     │
│  contient des transactions. Résiliez-le à     │
│  la place.                                     │
├────────────────────────────────────────────────┤
│  📚 Que faire ?                                │
│                                                │
│  Pour conserver l'historique et l'intégrité   │
│  comptable :                                   │
│                                                │
│  1. Ouvrez le bail en édition                 │
│  2. Allez dans l'onglet "Statut et workflow"  │
│  3. Cliquez sur "Résilier le bail"            │
│  4. Une fois résilié, vous pourrez le         │
│     supprimer si besoin                        │
├────────────────────────────────────────────────┤
│              [Fermer]  [Résilier ce bail →]   │
└────────────────────────────────────────────────┘
```

---

## 🔧 IMPLÉMENTATION

### Composant créé
**`src/components/leases/CannotDeleteLeaseModal.tsx`**

**Props :**
```tsx
interface CannotDeleteLeaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResignLease?: () => void;
  leaseName: string;     // "Bien - Locataire"
  reason: string;        // Message d'erreur de l'API
}
```

### Gestion de l'erreur 409

#### Suppression simple (`handleDeleteLease`)
```tsx
if (response.status === 409) {
  const errorData = await response.json();
  setCannotDeleteLeaseName(`${lease.property.name} - ${lease.tenant.firstName}`);
  setCannotDeleteReason(errorData.error);
  setShowCannotDeleteModal(true);
  return;
}
```

#### Suppression multiple (`handleConfirmDeleteMultiple`)
```tsx
const results = await Promise.allSettled(...);

// Comptabiliser les résultats
const deleted = results.filter(r => r.value.status === 'deleted').length;
const protected = results.filter(r => r.value.status === 'protected');

if (deleted > 0) {
  notify2.success(`${deleted} bail(x) supprimé(s)`);
}

if (protected.length > 0) {
  // Afficher la modale pour le premier
  setShowCannotDeleteModal(true);
  
  // Toast pour les autres
  if (protected.length > 1) {
    notify2.warning(`${protected.length} bail(x) protégé(s)`);
  }
}
```

---

## 🎯 WORKFLOW UTILISATEUR

### Scénario 1 : Bail BROUILLON sans transactions
```
Clic [🗑️] → Confirmation → ✅ Supprimé
```

### Scénario 2 : Bail ACTIF avec transactions
```
Clic [🗑️] → Confirmation → ❌ Erreur 409
            ↓
    Modale explicative s'affiche
            ↓
    [Résilier ce bail →] OU [Fermer]
```

### Scénario 3 : Suppression multiple (2 baux : 1 OK, 1 protégé)
```
Sélection de 2 baux → Clic [Supprimer]
            ↓
   1 bail supprimé ✅
   1 bail protégé ❌
            ↓
    Toast : "1 bail supprimé"
    Modale : "Impossible de supprimer immogest2"
    Toast warning : "1 bail n'a pas pu être supprimé"
```

---

## 📊 RÈGLE BACKEND (déjà en place)

**API Route :** `DELETE /api/leases/[id]`

```tsx
// Vérifier s'il y a des transactions liées
if (existingLease.transactions.length > 0) {
  return NextResponse.json({
    error: 'Ce bail ne peut pas être supprimé car il contient des transactions. Résiliez-le à la place.'
  }, { status: 409 });
}
```

---

## ✅ FICHIERS MODIFIÉS

1. **`src/components/leases/CannotDeleteLeaseModal.tsx`** (créé)
   - Modale explicative avec design orange (warning)
   - Bouton "Résilier ce bail"

2. **`src/app/baux/LeasesClient.tsx`** (modifié)
   - États : `showCannotDeleteModal`, `cannotDeleteReason`, `cannotDeleteLeaseName`
   - `handleDeleteLease` : Gestion du 409
   - `handleConfirmDeleteMultiple` : Gestion du 409 avec compteurs
   - Modale ajoutée dans le JSX

---

## 🧪 TESTS

### Test 1 : Suppression bail BROUILLON
1. Créer un bail en BROUILLON (sans transactions)
2. Clic sur 🗑️
3. ✅ Suppression réussie

### Test 2 : Suppression bail ACTIF avec transactions
1. Avoir un bail ACTIF avec des loyers enregistrés
2. Clic sur 🗑️ → Confirmation
3. ✅ Modale orange s'affiche
4. ✅ Message : "Ce bail contient des transactions..."
5. ✅ Bouton "Résilier ce bail" visible

### Test 3 : Suppression multiple mixte
1. Sélectionner 2 baux (1 BROUILLON, 1 ACTIF avec transactions)
2. Clic [Supprimer] → Confirmation
3. ✅ Toast : "1 bail supprimé avec succès"
4. ✅ Modale : Bail protégé détaillé
5. ✅ Toast warning : "1 bail n'a pas pu être supprimé"

---

**🎉 Les baux avec transactions sont maintenant protégés avec une modale explicative claire !**


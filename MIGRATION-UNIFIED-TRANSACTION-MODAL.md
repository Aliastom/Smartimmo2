# Migration vers la Modal Transaction Unifiée

## Vue d'ensemble

Ce document décrit comment migrer de l'ancienne modal transaction vers la nouvelle modal unifiée qui gère les deux contextes (Bien → Transactions et Transactions globale).

## Composants créés

### 1. Composant principal
- `src/components/forms/UnifiedTransactionModal.tsx` - Modal unifiée
- `src/hooks/useUnifiedTransactionModal.ts` - Hook de gestion
- `src/components/forms/UnifiedTransactionModalWrapper.tsx` - Wrapper avec hook

### 2. Composants d'exemple
- `src/components/properties/PropertyTransactionsWithUnifiedModal.tsx` - Pour le contexte Bien
- `src/components/transactions/GlobalTransactionsWithUnifiedModal.tsx` - Pour le contexte global

### 3. Documentation
- `UNIFIED-TRANSACTION-MODAL-GUIDE.md` - Guide d'utilisation complet
- `scripts/test-unified-transaction-modal.ts` - Script de test

## Étapes de migration

### Étape 1 : Remplacer dans PropertyDetailClient.tsx

**Avant :**
```typescript
// Dans src/app/biens/[id]/PropertyDetailClient.tsx
{transactionFormOpen && (
  <TransactionFormTabs
    isOpen={transactionFormOpen}
    onClose={() => setTransactionFormOpen(false)}
    onSubmit={handleTransactionSubmit}
    title="Nouvelle Transaction"
    propertyId={property.id}
    defaultPropertyId={property.id}
    properties={[property]}
    tenants={tenants}
    leases={stableLeases}
  />
)}
```

**Après :**
```typescript
// Dans src/app/biens/[id]/PropertyDetailClient.tsx
import { useUnifiedTransactionModal } from '@/hooks/useUnifiedTransactionModal';
import UnifiedTransactionModal from '@/components/forms/UnifiedTransactionModal';

// Dans le composant
const {
  isOpen: transactionModalOpen,
  context: transactionContext,
  mode: transactionMode,
  transactionId,
  title: transactionTitle,
  openForProperty,
  openForEdit,
  close: closeTransactionModal,
  handleSubmit: handleTransactionSubmit
} = useUnifiedTransactionModal({ onSuccess: () => router.refresh() });

// Remplacer les handlers
const handleCreateTransaction = () => {
  openForProperty(property.id);
};

const handleCreateTransactionFromLease = (leaseId: string) => {
  openForProperty(property.id, leaseId, true);
};

const handleEditTransaction = (transaction: any) => {
  openForEdit(transaction.id, {
    type: 'property',
    propertyId: property.id
  });
};

// Remplacer la modal
<UnifiedTransactionModal
  isOpen={transactionModalOpen}
  onClose={closeTransactionModal}
  onSubmit={handleTransactionSubmit}
  context={transactionContext}
  mode={transactionMode}
  transactionId={transactionId}
  title={transactionTitle}
/>
```

### Étape 2 : Remplacer dans TransactionsClient.tsx

**Avant :**
```typescript
// Dans src/app/transactions/TransactionsClient.tsx
// Utilisation de l'ancienne modal
```

**Après :**
```typescript
// Dans src/app/transactions/TransactionsClient.tsx
import { useUnifiedTransactionModal } from '@/hooks/useUnifiedTransactionModal';
import UnifiedTransactionModal from '@/components/forms/UnifiedTransactionModal';

// Dans le composant
const {
  isOpen: transactionModalOpen,
  context: transactionContext,
  mode: transactionMode,
  transactionId,
  title: transactionTitle,
  openForGlobal,
  openForEdit,
  close: closeTransactionModal,
  handleSubmit: handleTransactionSubmit
} = useUnifiedTransactionModal({ onSuccess: () => router.refresh() });

// Handlers
const handleCreateTransaction = () => {
  openForGlobal();
};

const handleEditTransaction = (transaction: any) => {
  openForEdit(transaction.id, {
    type: 'global'
  });
};

// Modal
<UnifiedTransactionModal
  isOpen={transactionModalOpen}
  onClose={closeTransactionModal}
  onSubmit={handleTransactionSubmit}
  context={transactionContext}
  mode={transactionMode}
  transactionId={transactionId}
  title={transactionTitle}
/>
```

### Étape 3 : Mettre à jour les imports

Remplacer tous les imports de l'ancienne modal :
```typescript
// Supprimer
import TransactionFormTabs from '@/components/forms/TransactionFormTabs';
import TransactionEditModal from '@/components/forms/TransactionEditModal';

// Ajouter
import { useUnifiedTransactionModal } from '@/hooks/useUnifiedTransactionModal';
import UnifiedTransactionModal from '@/components/forms/UnifiedTransactionModal';
```

### Étape 4 : Adapter les handlers

**Ancien handler :**
```typescript
const handleTransactionSubmit = async (data: any) => {
  // Logique de soumission
};
```

**Nouveau handler :**
```typescript
const {
  handleSubmit: handleTransactionSubmit
} = useUnifiedTransactionModal({ onSuccess: () => router.refresh() });
```

## Avantages de la migration

### ✅ Fonctionnalités unifiées
- Une seule modal pour les deux contextes
- Logique de préremplissage intelligente
- Verrouillages contextuels

### ✅ Meilleure UX
- Badges "auto" et "verrouillé" pour la transparence
- Aperçu en temps réel
- Tooltips d'aide
- Validations en temps réel

### ✅ Code plus maintenable
- Logique centralisée
- Hook réutilisable
- Composants d'exemple
- Documentation complète

### ✅ Fonctionnalités avancées
- Génération automatique du libellé
- Répartition automatique sur plusieurs mois
- Filtrage intelligent des catégories
- Cohérence des données

## Tests de régression

### Avant la migration
1. Tester l'ancienne modal dans le contexte Bien
2. Tester l'ancienne modal dans le contexte global
3. Tester l'édition de transactions
4. Noter les comportements attendus

### Après la migration
1. Vérifier que tous les cas fonctionnent
2. Tester les nouveaux badges "auto" et "verrouillé"
3. Vérifier la génération automatique du libellé
4. Tester les validations
5. Vérifier l'aperçu en temps réel

## Rollback

En cas de problème, il est possible de revenir à l'ancienne modal en :
1. Restaurant les imports originaux
2. Restaurant les handlers originaux
3. Restaurant les composants de modal originaux

## Support

Pour toute question sur la migration ou l'utilisation de la nouvelle modal :
1. Consulter `UNIFIED-TRANSACTION-MODAL-GUIDE.md`
2. Exécuter `npx tsx scripts/test-unified-transaction-modal.ts`
3. Examiner les composants d'exemple fournis

## Prochaines étapes

1. **Migration progressive** : Commencer par un contexte, puis l'autre
2. **Tests utilisateurs** : Valider l'UX avec les utilisateurs
3. **Optimisations** : Améliorer les performances si nécessaire
4. **Extensions** : Ajouter de nouvelles fonctionnalités selon les besoins


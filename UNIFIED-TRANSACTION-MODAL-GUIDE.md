# Guide d'utilisation de la Modal Transaction Unifiée

## Vue d'ensemble

La modal transaction unifiée (`UnifiedTransactionModal`) permet de gérer la création et l'édition de transactions dans deux contextes différents :

- **Contexte A** : Depuis l'onglet Transactions d'un Bien
- **Contexte B** : Depuis la page Transactions (globale)

## Fonctionnalités principales

### ✅ Règles d'ouverture et préremplissage

#### Contexte A - "Bien → Transactions"
- **Bien** : Prérempli avec le bien courant, **verrouillé**
- **Bail** : 
  - Si un seul bail ACTIF → auto-sélectionné
  - Sinon → liste déroulante filtrée (ACTIF en priorité)
  - Si modal vient d'un bail → **prérempli et verrouillé**
- **Locataire** :
  - Si Bail défini → auto-prérempli avec le(s) locataire(s) du bail
  - Si pas de Bail → select filtré sur occupants actuels du bien
  - Verrouillé si Bail verrouillé
- **Nature** : Si Bail défini → pré-sélectionner "Loyer (recette)"
- **Montant** : Si Nature="Loyer" && Bail défini → proposer `loyer + charges`
- **Libellé** : Auto-généré selon les règles définies

#### Contexte B - "Transactions (globale)"
- **Bien** : Vide, **obligatoire**
- **Bail** : Vide, filtré après choix du Bien (prioriser ACTIF)
- **Locataire** : Si Bail choisi → auto-prérempli comme en (A)
- Autres champs : Mêmes règles que (A) après sélection

### ✅ Mode édition
- **Bien** : **Verrouillé** (éviter changement de rattachement)
- **Bail** : Modifiable si transaction non liée contractuellement
- **Locataire** : Suit la logique de Bail
- Tous les autres champs conservent leurs valeurs existantes

### ✅ Réactivité et dépendances
- Changer **Bien** → réinitialise Bail, Locataire, Catégorie, Libellé, Montant
- Changer **Bail** → recalcule Locataire, Nature, Montant, Libellé
- Changer **Nature** → filtre Catégorie, réinitialise Montant
- Changer **Date/Période** → recalcule Libellé
- Badges "auto" indiquent les champs auto-remplis

### ✅ Validations
- **Bien** : Requis
- **Date** : Requise
- **Nature** : Requise
- **Catégorie** : Requise et compatible avec Nature
- **Montant** : Requis, > 0
- **Cohérence** : Bail appartient au Bien, Locataire appartient au Bail

## Utilisation

### 1. Hook personnalisé

```typescript
import { useUnifiedTransactionModal } from '@/hooks/useUnifiedTransactionModal';

const {
  isOpen,
  context,
  mode,
  transactionId,
  title,
  openForProperty,
  openForGlobal,
  openForEdit,
  close,
  handleSubmit
} = useUnifiedTransactionModal({ onSuccess: () => router.refresh() });
```

### 2. Contexte "Bien → Transactions"

```typescript
// Créer une transaction pour un bien
const handleCreateTransaction = () => {
  openForProperty(propertyId);
};

// Créer une transaction pour un bail spécifique
const handleCreateTransactionFromLease = (leaseId: string) => {
  openForProperty(propertyId, leaseId, true);
};

// Éditer une transaction existante
const handleEditTransaction = (transaction: any) => {
  openForEdit(transaction.id, {
    type: 'property',
    propertyId: propertyId
  });
};
```

### 3. Contexte "Transactions globale"

```typescript
// Créer une transaction globale
const handleCreateTransaction = () => {
  openForGlobal();
};

// Éditer une transaction existante
const handleEditTransaction = (transaction: any) => {
  openForEdit(transaction.id, {
    type: 'global'
  });
};
```

### 4. Rendu de la modal

```typescript
<UnifiedTransactionModal
  isOpen={isOpen}
  onClose={close}
  onSubmit={handleSubmit}
  context={context}
  mode={mode}
  transactionId={transactionId}
  title={title}
/>
```

## Composants d'exemple

### PropertyTransactionsWithUnifiedModal
Composant complet pour gérer les transactions d'un bien avec :
- Bouton "Nouvelle transaction"
- Liste des baux avec boutons pour créer des transactions
- Liste des transactions existantes avec actions d'édition/suppression

### GlobalTransactionsWithUnifiedModal
Composant complet pour la page transactions globale avec :
- Filtres de recherche et par bien
- Statistiques (total, recettes, dépenses, solde net)
- Liste des transactions avec actions

## Structure des données

### TransactionFormData
```typescript
interface TransactionFormData {
  // Informations essentielles
  propertyId: string;
  leaseId: string;
  tenantId: string;
  date: string;
  natureId: string;
  categoryId: string;
  label: string;
  amount: number;
  reference: string;
  
  // Paiement
  paymentDate: string;
  paymentMethod: string;
  notes: string;
  
  // Période
  periodStart: string; // Format: "2025-10" (YYYY-MM)
  monthsCovered: number;
  autoDistribution: boolean;
}
```

### TransactionContext
```typescript
interface TransactionContext {
  type: 'property' | 'global';
  propertyId?: string;
  leaseId?: string;
  isFromLease?: boolean;
}
```

## API Endpoints requis

La modal nécessite les endpoints suivants :

- `GET /api/properties` - Liste des propriétés
- `GET /api/properties/{id}/leases` - Baux d'une propriété
- `GET /api/accounting/categories?nature={natureId}` - Catégories compatibles
- `GET /api/transactions/{id}` - Transaction existante (mode édition)
- `POST /api/transactions` - Créer une transaction
- `PUT /api/transactions/{id}` - Modifier une transaction
- `DELETE /api/transactions/{id}` - Supprimer une transaction

## Tests d'acceptation

### ✅ Contexte "Bien → Transactions"
- [x] Bien verrouillé et prérempli
- [x] Bail auto-sélectionné si unique ACTIF
- [x] Nature/Locataire/Montant/Libellé proposés si Bail défini
- [x] Badges "auto" et "verrouillé" affichés correctement

### ✅ Contexte "Transactions globale"
- [x] Pas de préremplissage de Bien
- [x] Dépendances actives après sélection
- [x] Filtrage des baux par bien sélectionné

### ✅ Mode édition
- [x] Bien verrouillé
- [x] Champs rechargés avec valeurs existantes
- [x] Règles de verrouillage bail/locataire respectées

### ✅ Réactivité
- [x] Libellé auto se met à jour tant que non modifié manuellement
- [x] Champs dépendants se réinitialisent correctement
- [x] Badges "auto" disparaissent après modification manuelle

### ✅ Validations
- [x] Messages d'erreur clairs
- [x] Bouton "Enregistrer" désactivé si validations KO
- [x] Cohérence entre Bail/Bien et Locataire/Bail

## Personnalisation

### Ajouter de nouvelles natures de transaction
Modifier le tableau `TRANSACTION_NATURES` dans `UnifiedTransactionModal.tsx`

### Ajouter de nouveaux modes de paiement
Modifier le tableau `PAYMENT_METHODS` dans `UnifiedTransactionModal.tsx`

### Personnaliser la génération de libellé
Modifier la fonction `generateLabel()` dans `UnifiedTransactionModal.tsx`

### Ajouter de nouvelles validations
Modifier la fonction `validateForm()` dans `UnifiedTransactionModal.tsx`


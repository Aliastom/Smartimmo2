# 📄 App Shell - Gestion des Documents Liés aux Transactions

## 🎯 Objectif

Rendre l'affichage des documents liés aux transactions **100% homogène** en mode App Shell, en utilisant **uniquement IndexedDB** comme source de données locale.

## 📊 Architecture

### Sources de données

1. **Supabase (source de vérité distante)**
   - Table `Document` : métadonnées des documents
   - Table `DocumentLink` : liaisons polymorphiques (transaction, property, lease, tenant, global)
   - Supabase Storage : stockage des fichiers (téléchargement via signed URL)

2. **IndexedDB (source locale App Shell)**
   - Table `documents` : métadonnées synchronisées depuis Supabase
   - Table `documentLinks` : liaisons synchronisées depuis Supabase
   - **Aucun cache blob** : les fichiers sont téléchargés à la demande depuis Supabase Storage

### Schémas locaux

#### Table `documents` (IndexedDB)
```typescript
interface LocalDocument {
  id: string;
  organizationId: string;
  filenameOriginal: string;
  fileName: string;
  mime: string;
  size: number;
  url: string;
  documentTypeId?: string | null;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  // ... autres champs
}
```

#### Table `documentLinks` (IndexedDB)
```typescript
interface LocalDocumentLink {
  documentId: string;
  linkedType: string; // 'transaction' | 'property' | 'lease' | 'tenant' | 'global'
  linkedId: string; // ID de l'entité liée (null pour 'global')
  entityName?: string | null;
  _syncedAt?: string;
}
```

**Clé composite** : `[documentId, linkedType, linkedId]`

## 🔄 Flux de synchronisation

### Pull overwrite (Supabase → IndexedDB)

1. **Documents** (`/api/documents`)
   - Overwrite total : supprimer tous les documents de l'organisation, puis bulkPut
   - Filtre : `organizationId` + `includeDeleted=true`

2. **DocumentLinks** (`/api/document-links`)
   - Overwrite total : supprimer tous les liens des documents de l'organisation, puis bulkPut
   - Filtre : via les `documentIds` de l'organisation (car DocumentLink n'a pas `organizationId` directement)

### Ordre de synchronisation

1. D'abord synchroniser `documents` (métadonnées)
2. Ensuite synchroniser `documentLinks` (liaisons)

Cela garantit que les métadonnées existent avant de créer les liens.

## 🛠️ Service unifié

### `documentLinksService.ts`

Service centralisé pour lire les documents liés depuis IndexedDB uniquement.

#### Fonctions principales

- `getLinkedDocumentsForTransaction(transactionId, organizationId)` : Récupère tous les documents liés à une transaction
- `getDocumentCountForTransaction(transactionId, organizationId)` : Compte les documents liés
- `hasDocumentForTransaction(transactionId, organizationId)` : Vérifie si au moins un document est lié
- `getLinkedDocumentsForTransactions(transactionIds[], organizationId)` : Version batch (optimisation)
- `getDocumentCountsForTransactions(transactionIds[], organizationId)` : Version batch (optimisation)

### Hook React : `useTransactionDocuments`

```typescript
const { documents, count, hasDocument, loading, error, hasMissingDocuments } = 
  useTransactionDocuments(transactionId, enabled);
```

**Comportement** :
- En mode App Shell : lit uniquement depuis IndexedDB
- Écoute les événements `sync:refresh`, `documents:refresh`, `transactions:refresh`
- Détecte les documents manquants (liens présents mais métadonnées absentes)

## 📍 Points d'affichage

### 1. Badge/compteur DOC dans les listes de transactions

**Fichier** : `src/components/transactions/TransactionsTable.tsx`

**Source de données** :
- Mode normal : API `/api/transactions` (inclut `hasDocument` et `documentsCount`)
- Mode App Shell : `useTransactionsData` → `documentLinksService.getDocumentCountsForTransactions()`

**Affichage** :
- ✅ Coche verte + nombre si `hasDocument === true`
- ⚠️ Triangle jaune si `hasDocument === false`

### 2. Section "Documents liés" dans le drawer détail transaction

**Fichier** : `src/components/transactions/TransactionDrawer.tsx`

**Source de données** :
- Mode normal : `transaction.Document` (depuis l'API)
- Mode App Shell : `useTransactionDocuments()` → `documentLinksService.getLinkedDocumentsForTransaction()`

**Affichage** :
- Liste des documents avec nom, type, date
- Bouton "Voir" pour télécharger depuis Supabase Storage
- Message d'avertissement si `hasMissingDocuments === true`

### 3. Onglet "Documents" dans le modal d'édition transaction

**Fichier** : `src/components/transactions/TransactionModalV2.tsx`

**Source de données** :
- Mode normal : API `/api/transactions/${id}/documents`
- Mode App Shell : `useTransactionDocuments()` → `documentLinksService.getLinkedDocumentsForTransaction()`

**Affichage** :
- Liste des documents avec actions (voir, supprimer le lien)
- Upload de nouveaux documents

### 4. Autres vues

- **Page Transactions globale** : Utilise `useTransactionsData` qui calcule `hasDocument` et `documentsCount` via `documentLinksService`
- **Page Transactions d'un bien** : Même logique, filtrée par `propertyId`

## 🔐 Règles strictes

### En mode App Shell

1. **Interdiction** d'appeler Supabase directement pour les données métier
2. **Obligation** d'utiliser `documentLinksService` ou `useTransactionDocuments`
3. **Téléchargement** : uniquement via Supabase Storage (signed URL) au clic utilisateur

### En mode normal

- Utilisation de l'API Next.js classique
- Pas de changement de comportement

## ⚠️ Gestion des états manquants

### Documents non synchronisés

Si `documentLinks` indique N documents mais que les métadonnées `documents` ne sont pas présentes :

1. **Détection** : Comparer le nombre de liens vs le nombre de documents trouvés
2. **Affichage** : Message explicite "Documents liés non synchronisés" au lieu d'un vide silencieux
3. **Action** : Inviter l'utilisateur à synchroniser

**Implémentation** :
- `hasMissingDocuments` dans `useTransactionDocuments`
- Affichage d'un badge d'avertissement dans l'UI

## 🔄 React Query / Rendering

### Harmonisation des query keys

**Ancien système** (à éviter) :
```typescript
['transactions', transactionId, 'documents'] // ❌ Dépend d'objets non stables
```

**Nouveau système** (App Shell) :
- Pas de React Query en mode App Shell
- Utilisation directe d'IndexedDB via hooks/services
- Écoute des événements `sync:refresh` pour rafraîchir

**Mode normal** :
- React Query avec keys stables : `['transactions', transactionId, 'documents']`
- Invalidation après sync

## 📝 Points de vigilance

### 1. Clé composite documentLinks

La table `documentLinks` utilise une clé composite `[documentId, linkedType, linkedId]`.

**Impact** :
- Suppression : doit utiliser `table.delete([documentId, linkedType, linkedId])`
- Insertion : `bulkPut` fonctionne normalement

### 2. Filtrage par organisation

`DocumentLink` n'a pas de champ `organizationId` directement.

**Solution** :
- Filtrer via les `documentIds` de l'organisation
- Récupérer d'abord les documents de l'org, puis filtrer les liens

### 3. Ordre de synchronisation

**Critique** : Toujours synchroniser `documents` avant `documentLinks`.

**Raison** : Les liens référencent des documents qui doivent exister.

### 4. Compatibilité ancien système

Les documents peuvent encore avoir `transactionId` directement (ancien système).

**Migration** :
- Le service `documentLinksService` utilise uniquement `documentLinks`
- Les anciens champs `transactionId` dans `documents` sont ignorés en App Shell
- La sync crée les `documentLinks` depuis Supabase (source de vérité)

## 🧪 Tests recommandés

1. **Sync complète** : Vérifier que `documents` + `documentLinks` sont bien synchronisés
2. **Affichage** : Vérifier que les badges DOC sont cohérents en App Shell
3. **Drawer** : Vérifier que les documents s'affichent correctement
4. **Modal** : Vérifier que l'onglet Documents fonctionne
5. **États manquants** : Tester avec des liens sans métadonnées

## 📚 Fichiers modifiés

### Nouveaux fichiers
- `src/lib/offline/services/documentLinksService.ts` : Service unifié
- `src/hooks/offline/useTransactionDocuments.ts` : Hook React
- `src/app/api/document-links/route.ts` : Endpoint API pour sync
- `docs/app-shell-documents.md` : Cette documentation

### Fichiers modifiés
- `src/lib/offline/db.ts` : Ajout table `documentLinks` (version 8)
- `src/lib/offline/syncGlobal.ts` : Ajout sync pour `documents` et `documentLinks`
- `src/features/transactions/hooks/useTransactionsData.ts` : Utilise `documentLinksService`
- `src/features/transactions/TransactionsPageCore.tsx` : Utilise `documentLinksService`
- `src/components/transactions/TransactionDrawer.tsx` : Utilise `useTransactionDocuments`

## ✅ Checklist de validation

- [x] Table `documentLinks` créée dans IndexedDB (version 8)
- [x] Service unifié `documentLinksService` créé
- [x] Hook `useTransactionDocuments` créé
- [x] Sync `documents` + `documentLinks` implémentée (avec logique spéciale pour clé composite)
- [x] `useTransactionsData` utilise le nouveau service
- [x] `TransactionsPageCore` utilise le nouveau service
- [x] `TransactionDrawer` utilise le nouveau hook
- [x] `TransactionModalV2` utilise le nouveau hook en mode app-shell
- [x] Endpoint API `/api/document-links` créé
- [x] Détection des documents manquants implémentée
- [x] Affichage des états manquants dans l'UI
- [x] Documentation complète

## 🚀 Prochaines étapes (optionnel)

1. **Tests E2E** : Vérifier la cohérence dans tous les scénarios
2. **Migration données** : S'assurer que tous les `documentLinks` existants sont bien synchronisés
3. **Performance** : Optimiser les requêtes batch pour les grandes listes de transactions
4. **Amélioration UX** : Ajouter un bouton "Synchroniser maintenant" quand des documents manquants sont détectés










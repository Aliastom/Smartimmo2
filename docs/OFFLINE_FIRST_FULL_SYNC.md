# 📱 Mode Offline-First Complet - Documentation

## Vue d'ensemble

Smartimmo fonctionne maintenant en **mode offline-first complet** : toutes les données d'une organisation sont disponibles hors ligne, modifiables hors ligne, puis synchronisées automatiquement vers Supabase dès que le réseau revient.

## 🏗️ Architecture

### 1. Base de données locale (IndexedDB)

Toutes les données sont stockées localement dans IndexedDB via Dexie :

**Tables de données métier :**
- `properties` - Biens immobiliers
- `leases` - Baux
- `tenants` - Locataires
- `loans` - Prêts
- `payments` - Paiements (loyers/charges)
- `transactions` - Transactions
- `echeances` - Échéances récurrentes

**Tables de métadonnées :**
- `pendingOperations` - Opérations en attente de synchronisation
- `syncMeta` - Métadonnées de synchronisation par table

**Tables de cache (données de référence) :**
- `fiscalTypes` - Types fiscaux
- `fiscalRegimes` - Régimes fiscaux
- `fiscalCompatibilities` - Compatibilités fiscales
- `managementCompanies` - Sociétés de gestion
- `natures` - Natures de transaction
- `accountingCategories` - Catégories comptables
- `documentTypes` - Types de documents
- `signals` - Signaux

### 2. Repositories Offline-First

Chaque entité métier a son repository offline-first :

- `PropertyRepositoryOffline` - Biens
- `LeaseRepositoryOffline` - Baux
- `TenantRepositoryOffline` - Locataires
- `LoanRepositoryOffline` - Prêts
- `PaymentRepositoryOffline` - Paiements
- `TransactionRepositoryOffline` - Transactions

Tous héritent de `BaseOfflineRepository` qui fournit :
- Lecture depuis IndexedDB (instantané)
- Écriture locale + enregistrement dans `pendingOperations`
- Synchronisation automatique en arrière-plan

### 3. Services de synchronisation

**`GlobalSyncService`** (`src/lib/offline/syncGlobal.ts`) :
- Synchronise toutes les entités depuis Supabase → IndexedDB
- Synchronise toutes les opérations en attente depuis IndexedDB → Supabase
- Gère les erreurs et retries

**`initialFullSync`** (`src/lib/offline/fullSync.ts`) :
- Télécharge toutes les données d'une organisation au premier chargement
- Exécuté automatiquement après connexion si pas encore fait
- Non bloquant pour l'UI

### 4. Hooks et composants UI

**`useSyncStatus`** :
- Statut de synchronisation global
- Compteurs d'opérations en attente/erreur
- Statut full sync
- Fonction `sync()` pour forcer la synchronisation

**`useFullSync`** :
- Gère la synchronisation initiale complète
- Permet de vérifier/réinitialiser la full sync

**`SyncStatusIndicator`** :
- Affiche le statut en temps réel
- Bouton pour forcer la synchronisation
- Tooltip avec détails (dernière sync, erreurs, etc.)

## 🔄 Flux de synchronisation

### Synchronisation initiale (Full Sync)

1. **Déclenchement automatique** :
   - Après connexion réussie
   - Au premier chargement de l'app
   - Si `hasInitialFullSyncDone(organizationId)` retourne `false`

2. **Processus** :
   ```
   Pour chaque table configurée :
   1. Appel API → Récupération de toutes les données de l'organisation
   2. Transformation des données (dates, types, etc.)
   3. Sauvegarde dans IndexedDB (bulkPut)
   4. Mise à jour syncMeta avec lastSyncAt
   
   5. Marquer fullSync_<organizationId> comme done
   ```

3. **Non bloquant** :
   - L'utilisateur peut naviguer pendant la sync
   - Les données déjà synchronisées sont disponibles immédiatement

### Synchronisation incrémentale (Delta Sync)

Après la full sync, seules les modifications sont synchronisées :

**Supabase → IndexedDB :**
```
Pour chaque table :
1. Lire lastSyncAt depuis syncMeta
2. Appel API : SELECT * FROM table WHERE organizationId = ? AND updatedAt > lastSyncAt
3. Upsert/Delete dans IndexedDB
4. Mettre à jour lastSyncAt
```

**IndexedDB → Supabase :**
```
1. Parcourir pendingOperations avec status = 'pending'
2. Pour chaque opération :
   - Marquer comme 'syncing'
   - Appel API (POST/PUT/DELETE)
   - Si succès → marquer comme 'synced'
   - Si erreur → incrémenter retryCount, revenir à 'pending' (max 3 tentatives)
3. Supprimer les opérations 'synced' après 24h
```

## 📝 Utilisation dans le code

### Lire des données

```typescript
import { getLeaseRepositoryOffline } from '@/lib/offline/repositories/LeaseRepositoryOffline';

const repo = getLeaseRepositoryOffline();

// Récupérer tous les baux (depuis IndexedDB - instantané)
const leases = await repo.getAll(organizationId);

// Avec filtres
const activeLeases = await repo.getAll(organizationId, { status: 'ACTIF' });

// Récupérer un bail spécifique
const lease = await repo.getById(leaseId, organizationId);
```

### Créer/Modifier des données

```typescript
// Créer un nouveau bail
const newLease = await repo.upsert({
  organizationId,
  propertyId: '...',
  tenantId: '...',
  type: 'residential',
  startDate: '2025-01-01',
  rentAmount: 1200,
  // ... autres champs
}, organizationId);

// Modifier un bail existant
await repo.upsert({
  id: leaseId,
  rentAmount: 1300, // Modification
}, organizationId);
```

### Supprimer des données

```typescript
// Soft delete (archivage)
await repo.delete(leaseId, organizationId, 'soft');

// Hard delete (suppression complète)
await repo.delete(leaseId, organizationId, 'hard');
```

### Forcer la synchronisation

```typescript
import { useSyncStatus } from '@/hooks/offline/useSyncStatus';

const { sync } = useSyncStatus(organizationId);

// Forcer une synchronisation manuelle
await sync();
```

## 🎯 Stratégie de résolution de conflits

**Actuellement : Last-Write-Wins**

1. Les enregistrements sont identifiés par `id`
2. Comparaison de `updatedAt` local vs distant
3. La version la plus récente l'emporte
4. Les conflits sont journalisés dans `pendingOperations.errorMessage`

**Futur :** Structure préparée pour une résolution manuelle plus fine

## 🔐 Filtrage par organisation

**Important** : Toutes les requêtes filtrent systématiquement par `organizationId` pour éviter les mélanges de données entre organisations.

**Exemple :**
```typescript
// ✅ Correct
const leases = await repo.getAll(organizationId);

// ❌ Incorrect (ne filtre pas par org)
const leases = await repo.getAll('');
```

## ⚙️ Configuration

### Variables d'environnement

Aucune nouvelle variable nécessaire. Le système utilise les variables existantes :
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Déclenchement automatique

La full sync se déclenche automatiquement :
- 2 secondes après le chargement de l'app
- Après connexion réussie
- Si `fullSyncDone` est `false`

Pour forcer une nouvelle full sync :
```typescript
import { resetFullSync } from '@/lib/offline/fullSync';
await resetFullSync(organizationId);
```

## 🧪 Tests manuels

### Scénario 1 : Full Offline

1. **Ouvrir l'app en ligne** → Attendre la full sync
2. **Vérifier IndexedDB** : DevTools → Application → IndexedDB
   - Toutes les tables doivent être remplies
3. **Passer en offline** : DevTools → Network → Offline
4. **Tester la navigation** :
   - ✅ Les pages doivent se charger depuis le cache
   - ✅ Les listes doivent afficher les données locales
5. **Créer/Modifier/Supprimer** :
   - ✅ Les modifications sont visibles immédiatement
   - ✅ Les opérations sont dans `pendingOperations`

### Scénario 2 : Retour en ligne

1. **Après modifications offline** → Réactiver le réseau
2. **Vérifier la sync automatique** :
   - ✅ L'indicateur affiche "Synchronisation..."
   - ✅ Les opérations passent de 'pending' à 'synced'
   - ✅ Les données sont bien dans Supabase

### Scénario 3 : Full Sync initiale

1. **Nouvelle installation** ou **resetFullSync(orgId)**
2. **Ouvrir l'app** → Full sync démarre automatiquement
3. **Vérifier les logs console** :
   ```
   [FullSync] Démarrage full sync pour organizationId: ...
   [FullSync] ✅ properties: X enregistrements synchronisés
   [FullSync] ✅ leases: X enregistrements synchronisés
   ...
   ```

## 📦 Fichiers créés/modifiés

### Nouveaux fichiers

- `src/lib/offline/repositories/BaseOfflineRepository.ts` - Base générique
- `src/lib/offline/repositories/LeaseRepositoryOffline.ts`
- `src/lib/offline/repositories/TenantRepositoryOffline.ts`
- `src/lib/offline/repositories/LoanRepositoryOffline.ts`
- `src/lib/offline/repositories/PaymentRepositoryOffline.ts`
- `src/lib/offline/repositories/TransactionRepositoryOffline.ts`
- `src/lib/offline/fullSync.ts` - Service de full sync
- `src/lib/offline/syncGlobal.ts` - Service de sync global
- `src/hooks/offline/useFullSync.ts` - Hook pour full sync

### Fichiers modifiés

- `src/lib/offline/db.ts` - Ajout de toutes les tables IndexedDB
- `src/lib/offline/types.ts` - Types pour les nouvelles entités
- `src/hooks/offline/useSyncStatus.ts` - Intégration full sync + sync globale
- `src/components/offline/SyncStatusIndicator.tsx` - Affichage enrichi

## 🚀 Prochaines étapes

Pour ajouter une nouvelle entité au système offline-first :

1. **Ajouter la table dans IndexedDB** (`src/lib/offline/db.ts`)
   - Interface TypeScript pour `LocalXXX`
   - Table dans `SmartimmoLocalDB`

2. **Créer le repository** (`src/lib/offline/repositories/XXXRepositoryOffline.ts`)
   - Hérite de `BaseOfflineRepository`
   - Configure `entityName`, `tableName`, `apiRoute`

3. **Ajouter à la config de sync** (`src/lib/offline/syncGlobal.ts`)
   - Ajouter dans `ENTITY_CONFIGS`
   - Définir les transformations si nécessaire

4. **Ajouter à la full sync** (`src/lib/offline/fullSync.ts`)
   - Ajouter dans `TABLE_CONFIGS`
   - Définir les transformations si nécessaire

5. **Utiliser dans les composants**
   ```typescript
   import { getXXXRepositoryOffline } from '@/lib/offline/repositories/XXXRepositoryOffline';
   const repo = getXXXRepositoryOffline();
   const items = await repo.getAll(organizationId);
   ```

## ✅ Critères de réussite

- ✅ Full sync télécharge toutes les données d'une organisation
- ✅ Navigation offline fonctionne sur toutes les pages principales
- ✅ CRUD offline fonctionne pour toutes les entités
- ✅ Synchronisation automatique au retour en ligne
- ✅ Gestion des erreurs et retries
- ✅ Indicateur de statut informatif
- ✅ Pas de régression sur le fonctionnement existant





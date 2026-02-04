# 📱 Architecture Offline-First - Smartimmo

## Vue d'ensemble

Smartimmo intègre désormais un **mode offline-first** permettant l'utilisation complète de l'application même sans connexion réseau. Les données sont stockées localement dans le navigateur (IndexedDB) et synchronisées automatiquement avec Supabase dès que la connexion est rétablie.

## Architecture

### 1. Base de données locale (IndexedDB)

**Fichier :** `src/lib/offline/db.ts`

La base de données locale utilise **Dexie** (wrapper simplifié autour d'IndexedDB) avec les tables suivantes :

- **`properties`** : Stocke les biens immobiliers localement
- **`pendingOperations`** : Queue des opérations à synchroniser vers le serveur
- **`syncMeta`** : Métadonnées de synchronisation (lastSyncAt, erreurs, etc.)

### 2. Service de synchronisation

**Fichier :** `src/lib/offline/sync.ts`

Le `PropertySyncService` gère deux types de synchronisation :

- **`syncFromRemote()`** : Télécharge les modifications depuis Supabase vers la DB locale
- **`syncPendingToRemote()`** : Envoie les opérations locales en attente vers Supabase

### 3. Repository offline-first

**Fichier :** `src/lib/offline/repositories/PropertyRepositoryOffline.ts`

Le `PropertyRepositoryOffline` implémente le pattern offline-first :

- **Lecture** : Instantanée depuis la DB locale
- **Écriture** : Sauvegarde locale immédiate + ajout d'une opération en attente
- **Sync** : Automatique en arrière-plan quand le réseau est disponible

### 4. Indicateur de statut

**Fichier :** `src/components/offline/SyncStatusIndicator.tsx`

Composant affichant :
- Statut réseau (online/offline)
- Nombre d'opérations en attente
- Statut de synchronisation (syncing/error/idle)
- Dernière synchronisation réussie

## Utilisation

### Pour les développeurs

#### 1. Utiliser le repository offline-first

```typescript
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';

// Lire les biens (instantané depuis la DB locale)
const repo = getPropertyRepositoryOffline();
const properties = await repo.getAll(organizationId, {
  search: 'Paris',
  type: 'apartment',
});

// Créer/modifier un bien (sauvegarde locale + sync en arrière-plan)
const property = await repo.upsert({
  name: 'Appartement Paris',
  address: '123 Rue de la Paix',
  // ... autres champs
}, organizationId);

// Supprimer un bien (archivage)
await repo.delete(propertyId, organizationId, 'archive');
```

#### 2. Utiliser le hook de statut

```typescript
import { useSyncStatus } from '@/hooks/offline/useSyncStatus';

function MyComponent() {
  const { status, pendingOperationsCount, sync, isOnline } = useSyncStatus(organizationId);
  
  return (
    <div>
      <p>Statut: {status}</p>
      <p>En attente: {pendingOperationsCount}</p>
      <button onClick={sync} disabled={!isOnline}>
        Synchroniser maintenant
      </button>
    </div>
  );
}
```

#### 3. Intégrer l'indicateur dans une page

L'indicateur est déjà intégré dans `AppShell`, mais vous pouvez l'ajouter ailleurs :

```typescript
import { SyncStatusIndicator } from '@/components/offline/SyncStatusIndicator';

<SyncStatusIndicator organizationId={organizationId} />
```

## Flux de synchronisation

### 1. Synchronisation distante → locale

1. Le service récupère `lastSyncAt` depuis `syncMeta`
2. Appel API `/api/properties` avec filtres appropriés
3. Pour chaque bien modifié depuis `lastSyncAt` :
   - Upsert dans la DB locale
4. Mise à jour de `lastSyncAt` avec le timestamp actuel

### 2. Synchronisation locale → distante

1. Le service récupère les opérations avec `status = 'pending'`
2. Pour chaque opération :
   - Marquer comme `'syncing'`
   - Appeler l'API appropriée (POST/PUT/DELETE)
   - Si succès : marquer comme `'synced'` puis supprimer après 24h
   - Si erreur : marquer comme `'pending'` avec incrémentation de `retryCount`

### 3. Gestion des conflits

**Stratégie actuelle : Last Write Wins**

- Basé sur `updatedAt` : la version la plus récente gagne
- Si une ligne locale et distante ont divergé, on garde la plus récente

**Extension future :**
- Logging des conflits dans une table dédiée
- Interface pour résolution manuelle des conflits

## Configuration

### Variables d'environnement

**Aucune nouvelle variable d'environnement n'est requise** pour le mode offline-first. Le système utilise les variables existantes :
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Désactiver le mode offline-first

Pour désactiver temporairement le mode offline-first, vous pouvez :

1. Ne pas utiliser `PropertyRepositoryOffline` dans vos composants
2. Continuer à utiliser directement les API routes (`/api/properties`)

L'app fonctionne normalement même si le mode offline-first n'est pas utilisé.

## Extension à d'autres entités

Pour ajouter le support offline-first à une autre entité (ex: `baux`, `loyers`) :

### 1. Créer le type local

Dans `src/lib/offline/types.ts` :
```typescript
export interface LocalLease {
  id: string;
  // ... champs de l'entité
  updatedAt: string;
}
```

### 2. Ajouter la table dans la DB locale

Dans `src/lib/offline/db.ts` :
```typescript
leases!: Table<LocalLease, string>;

// Dans le schéma Dexie :
leases: 'id, organizationId, updatedAt, status',
```

### 3. Créer le service de sync

Créer `src/lib/offline/LeaseSyncService.ts` (copier depuis `PropertySyncService` et adapter)

### 4. Créer le repository

Créer `src/lib/offline/repositories/LeaseRepositoryOffline.ts` (copier depuis `PropertyRepositoryOffline` et adapter)

### 5. Utiliser dans les composants

Remplacer les appels API directs par le repository offline-first.

## Tests manuels

### Scénario 1 : Utilisation normale en ligne

1. Ouvrir l'application
2. Vérifier que l'indicateur affiche "Synchronisé"
3. Créer/modifier un bien
4. Vérifier que l'indicateur affiche "1 opération en attente" puis "Synchronisé" après sync

### Scénario 2 : Mode hors ligne

1. Ouvrir les DevTools → Network → Cocher "Offline"
2. L'indicateur doit afficher "Hors ligne"
3. Créer/modifier un bien
4. L'indicateur doit afficher "1 opération en attente"
5. Décocher "Offline"
6. L'indicateur doit automatiquement synchroniser et revenir à "Synchronisé"

### Scénario 3 : Retour en ligne après modifications

1. Passer en mode hors ligne
2. Créer plusieurs biens
3. Passer en mode en ligne
4. Vérifier que tous les biens sont synchronisés
5. Vérifier que les biens apparaissent bien dans Supabase

## Limitations actuelles

1. **Entité unique** : Seule l'entité `Property` (biens) est supportée pour le moment
2. **Résolution de conflits** : Stratégie simple "Last Write Wins" uniquement
3. **Relations** : Les relations complexes (Lease, Tenant, etc.) ne sont pas encore synchronisées avec les biens

## Fichiers clés

- `src/lib/offline/db.ts` - Schéma IndexedDB
- `src/lib/offline/types.ts` - Types TypeScript
- `src/lib/offline/sync.ts` - Service de synchronisation
- `src/lib/offline/repositories/PropertyRepositoryOffline.ts` - Repository offline-first
- `src/hooks/offline/useSyncStatus.ts` - Hook de statut
- `src/components/offline/SyncStatusIndicator.tsx` - Composant indicateur

## Support et dépannage

### La DB locale ne se remplit pas

1. Vérifier que Dexie est installé : `npm list dexie`
2. Ouvrir DevTools → Application → IndexedDB → SmartimmoLocalDB
3. Vérifier que les tables sont créées

### Les opérations ne se synchronisent pas

1. Vérifier la console pour les erreurs
2. Vérifier que l'API `/api/properties` fonctionne
3. Vérifier que `organizationId` est correct

### L'indicateur ne s'affiche pas

1. Vérifier que `SyncStatusIndicator` est bien intégré dans `AppShell`
2. Vérifier que l'API `/api/auth/me` retourne bien `organizationId`

## Prochaines étapes

1. ✅ Implémentation de base pour `Property`
2. 🔄 Extension à `Lease` (baux)
3. 🔄 Extension à `Transaction` (transactions)
4. 🔄 Extension à `Tenant` (locataires)
5. 🔄 Système de résolution de conflits avancé
6. 🔄 Tests automatisés (vitest)






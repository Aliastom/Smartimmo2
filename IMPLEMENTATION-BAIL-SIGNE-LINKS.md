# Implémentation des Liaisons Spécifiques aux Documents BAIL_SIGNE

## Vue d'ensemble

Cette implémentation ajoute un système de liaisons automatiques pour les documents de type `BAIL_SIGNE` lors de leur upload via le workflow des baux.

## Objectif

Lors de l'upload d'un document `BAIL_SIGNE` (via le bouton "Upload bail signé" dans le workflow), le système crée automatiquement les liaisons suivantes :

- **PRIMARY**: `LEASE` → `targetId = leaseId` (obligatoire)
- **DERIVED**: `PROPERTY` → `targetId = propertyId` du bail
- **DERIVED**: `TENANT` → une liaison par locataire actif du bail
- **DERIVED**: `GLOBAL` → liaison automatique (déjà implémentée)

## Architecture

### 1. Service Principal

**Fichier**: `src/lib/services/bailSigneLinksService.ts`

```typescript
export class BailSigneLinksService {
  // Crée les liaisons pour un document BAIL_SIGNE
  static async createBailSigneLinks(
    documentId: string,
    leaseId: string,
    propertyId: string,
    tenantsIds: string[]
  ): Promise<void>

  // Upsert d'une liaison (évite les doublons)
  private static async upsertDocumentLink(...)

  // Récupère les informations nécessaires depuis un leaseId
  static async getLeaseInfoForLinks(leaseId: string): Promise<{...}>
}
```

### 2. Intégration dans l'Upload

**Fichier**: `src/app/api/leases/[id]/upload-signed/route.ts`

L'endpoint d'upload de bail signé a été modifié pour :
- Créer un document de type `BAIL_SIGNE` (au lieu de `SIGNED_LEASE`)
- Appeler automatiquement `BailSigneLinksService.createBailSigneLinks()`

### 3. Intégration dans la Finalisation

**Fichier**: `src/app/api/documents/finalize/route.ts`

L'endpoint de finalisation des documents a été étendu pour :
- Détecter automatiquement les documents de type `BAIL_SIGNE`
- Créer les liaisons spécifiques si le contexte le permet

## Fonctionnalités

### ✅ Liaisons Automatiques

- **PRIMARY LEASE**: Le document est principalement lié au bail
- **DERIVED PROPERTY**: Le document est visible dans la fiche du bien
- **DERIVED TENANT**: Le document est visible dans la fiche du locataire
- **DERIVED GLOBAL**: Le document est visible dans la vue globale

### ✅ Upsert Strict

- Contrainte unique : `(documentId, targetType, targetId)`
- Pas de doublons si on ré-upload pour le même bail
- Mise à jour des métadonnées si nécessaire

### ✅ Validation et Cohérence

- Vérification de l'existence du bail, bien et locataires
- Validation de la cohérence des données
- Gestion des erreurs sans faire échouer l'upload

### ✅ Gestion des Erreurs

- Les erreurs de liaison n'interrompent pas l'upload
- Logs détaillés pour le debugging
- Fallback gracieux en cas de problème

## Critères d'Acceptation

### ✅ Visibilité Multi-Contextuelle

Après upload d'un document `BAIL_SIGNE` :

- ✅ **Visible sur la fiche Bail** (LEASE PRIMARY)
- ✅ **Visible sur la fiche Bien** (PROPERTY DERIVED)  
- ✅ **Visible sur la fiche Locataire** (TENANT DERIVED)
- ✅ **Visible dans la page Documents globale** (GLOBAL DERIVED)

### ✅ Non-Duplication

- ✅ Aucune duplication de liaisons si on ré-upload pour le même bail
- ✅ Upsert fonctionne correctement
- ✅ Contraintes d'unicité respectées

### ✅ Intégration Workflow

- ✅ Fonctionne avec le bouton "Upload bail signé" existant
- ✅ Compatible avec le système de statuts des baux
- ✅ N'interfère pas avec le système GLOBAL existant

## Tests

### Tests Unitaires

**Fichier**: `scripts/test-bail-signe-links.ts`

- ✅ Création des liaisons correctes
- ✅ Upsert (pas de duplication)
- ✅ Validation des données
- ✅ Gestion des erreurs

### Tests d'Intégration

**Fichier**: `scripts/test-bail-signe-upload-integration.ts`

- ✅ Intégration complète avec l'endpoint d'upload
- ✅ Visibilité dans toutes les vues
- ✅ Workflow end-to-end

## Utilisation

### Via le Workflow des Baux

1. Aller sur la fiche d'un bail
2. Onglet "Statut et workflow"
3. Cliquer sur "Upload bail signé"
4. Sélectionner le fichier PDF
5. Les liaisons sont créées automatiquement

### Via l'API Directe

```typescript
import { BailSigneLinksService } from '@/lib/services/bailSigneLinksService';

// Créer les liaisons pour un document BAIL_SIGNE
await BailSigneLinksService.createBailSigneLinks(
  documentId,
  leaseId,
  propertyId,
  [tenantId1, tenantId2] // Array des IDs des locataires
);
```

## Logs et Debugging

Le service génère des logs détaillés :

```
[BailSigneLinks] Création des liaisons pour document {documentId}, bail {leaseId}
[BailSigneLinks] Nouvelle liaison créée: LEASE/{leaseId} (PRIMARY)
[BailSigneLinks] Nouvelle liaison créée: PROPERTY/{propertyId} (DERIVED)
[BailSigneLinks] Nouvelle liaison créée: TENANT/{tenantId} (DERIVED)
[BailSigneLinks] Nouvelle liaison créée: GLOBAL/null (DERIVED)
[BailSigneLinks] ✅ Liaisons créées pour document {documentId}:
   - LEASE (PRIMARY): {leaseId}
   - PROPERTY (DERIVED): {propertyId}
   - TENANT (DERIVED): {count} locataire(s)
   - GLOBAL (DERIVED): automatique
```

## Compatibilité

### ✅ Rétrocompatibilité

- ✅ N'affecte pas les documents existants
- ✅ Compatible avec le système GLOBAL existant
- ✅ Compatible avec les relations legacy (leaseId, tenantId, propertyId)

### ✅ Extensibilité

- ✅ Facilement extensible pour d'autres types de documents
- ✅ Architecture modulaire et réutilisable
- ✅ Service indépendant et testable

## Sécurité

### ✅ Validation des Données

- ✅ Vérification de l'existence des entités
- ✅ Validation des permissions (via Prisma)
- ✅ Gestion des erreurs sans exposition d'informations sensibles

### ✅ Transactions

- ✅ Utilisation de transactions Prisma pour la cohérence
- ✅ Rollback automatique en cas d'erreur
- ✅ Isolation des opérations

## Performance

### ✅ Optimisations

- ✅ Upsert pour éviter les doublons
- ✅ Requêtes optimisées avec `include` sélectif
- ✅ Logs conditionnels pour la production

### ✅ Scalabilité

- ✅ Service statique (pas d'instances)
- ✅ Requêtes batch quand possible
- ✅ Gestion efficace des transactions

## Conclusion

L'implémentation des liaisons spécifiques aux documents `BAIL_SIGNE` est maintenant complète et fonctionnelle. Elle respecte tous les critères d'acceptation et s'intègre parfaitement avec le système existant.

**Le document sera visible dans toutes les vues appropriées après upload via le workflow des baux.**

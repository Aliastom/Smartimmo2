# Inventaire exhaustif des règles métier — Documents

Ce document liste toutes les règles métier pour la page Documents (`/app?view=documents`).

---

## 1. Inputs UI / Filtres

### Filtres disponibles
- **Recherche textuelle** (`query`) : recherche dans `filenameOriginal`, `fileName`, `extractedText`, `tags`
- **Type de document** (`type`) : filtre par `documentTypeId`
- **Portée** (`scope`) : `property`, `lease`, `transaction`, `global`
- **Statut** (`status`) :
  - `pending` : documents en attente de traitement
  - `active` / `classified` : documents actifs avec type assigné
  - `draft` : documents brouillons
  - `ocr_failed` : documents dont l'OCR a échoué
  - `orphan` : documents sans aucune liaison (via `DocumentLink`)
- **Lié à** (`linkedTo`) : filtre par entité liée
- **Date de début** (`dateFrom`) : filtre par date d'upload
- **Date de fin** (`dateTo`) : filtre par date d'upload
- **Inclure supprimés** (`includeDeleted`) : inclure les documents avec `deletedAt !== null`

---

## 2. KPI et agrégats

### Statistiques calculées
- **Total documents** : tous les documents de l'organisation (non supprimés sauf si `includeDeleted=true`)
- **En attente** (`pending`) : `status === 'pending'`
- **Classés** (`classified`) : `status === 'active' && documentTypeId !== null`
- **OCR échoué** (`ocrFailed`) : `ocrStatus === 'failed'`
- **Brouillons** (`drafts`) : `status === 'draft'`
- **Orphelins** (`orphans`) : documents **sans aucun `DocumentLink`** (comme le serveur : `DocumentLink: { none: {} }`)
  - ⚠️ **IMPORTANT** : Ne pas utiliser les anciens champs directs (`propertyId`, `leaseId`, etc.)
  - Vérifier via la table `DocumentLink` : un document est orphelin s'il n'a aucun lien

### Source de calcul
- **Mode normal** : API `/api/documents/stats` + `/api/documents/cleanup?type=orphan&dryRun=true`
- **Mode app-shell** : Calcul local depuis IndexedDB (tous les documents de l'organisation + tous les `DocumentLink`)

---

## 3. Règles métier — Création

### Upload de documents
- Les documents sont créés via `UploadReviewModal` (mode staging)
- Workflow :
  1. Upload de fichiers → création de sessions d'upload (`/api/upload-session/start`)
  2. Upload des fichiers vers staging (`/api/upload-staged`)
  3. Analyse OCR et classification automatique
  4. Finalisation : passage de `draft` → `active` + création de `DocumentLink`

### Statut initial
- Documents uploadés : `status = 'draft'` initialement
- Après finalisation : `status = 'active'`

### Liaisons automatiques
- Selon le contexte (`autoLinkingContext`) :
  - `propertyId` → création de lien `DocumentLink(linkedType='property', linkedId=propertyId)`
  - `leaseId` → création de lien `DocumentLink(linkedType='lease', linkedId=leaseId)`
  - `transactionId` → création de lien `DocumentLink(linkedType='transaction', linkedId=transactionId)`
  - `tenantId` → création de lien `DocumentLink(linkedType='tenant', linkedId=tenantId)`
  - Global → création de lien `DocumentLink(linkedType='global', linkedId='global')`

### Validation
- Scope par `organizationId` uniquement
- Pas de logique métier de cascade (les documents ne créent pas d'entités)

---

## 4. Règles métier — Modification

### Renommage
- Modification de `filenameOriginal` via API `PATCH /api/documents/:id`
- Pas de logique métier particulière

### Classification
- Modification de `documentTypeId` via API `PATCH /api/documents/:id`
- Possibilité de relancer l'analyse OCR/classification via `POST /api/documents/:id/classify`

### Liaisons
- Ajout de lien : `POST /api/documents/:id/links` avec `{ entityType, entityId }`
- Suppression de lien : `DELETE /api/documents/:id/links/:linkId`
- ⚠️ **Pas de logique métier de cascade** : la modification d'une liaison ne modifie pas les autres entités

---

## 5. Règles métier — Suppression

### Suppression simple
- `DELETE /api/documents/:id`
- Suppression physique du fichier dans le stockage (via `StorageService`)
- Suppression des métadonnées en base
- Suppression automatique des `DocumentLink` associés (cascade SQL)

### Purge des brouillons
- Endpoint : `POST /api/documents/purge-drafts`
- Paramètre `force` :
  - `force=false` : supprime uniquement les brouillons orphelins (sans session active)
  - `force=true` : supprime TOUS les brouillons (orphelins + avec session active)
- Critères de brouillon orphelin :
  - `status = 'draft'`
  - `uploadSessionId = null` OU `UploadSession.expiresAt < now()`
- Action server-only : suppression physique des fichiers

### Purge des orphelins
- Endpoint : `DELETE /api/documents/cleanup?type=orphan`
- Critères : documents **sans aucun `DocumentLink`** (comme le serveur : `DocumentLink: { none: {} }`)
- Action server-only : suppression physique des fichiers
- ⚠️ **IMPORTANT** : Ne pas utiliser les anciens champs directs (`propertyId`, `leaseId`, etc.)

---

## 6. Règles métier — App-Shell

### Lecture (app-shell)
- **Source unique** : IndexedDB uniquement
- **Interdictions** :
  - Aucun `fetch('/api/...')` pour les données métier
  - Aucun appel Supabase/Prisma direct
- **Obligatoire** :
  - Lecture depuis `Document` et `DocumentLink` tables IndexedDB
  - Calcul des stats localement

### Écriture (app-shell)
- **Actions server-only** (purge brouillons/orphelins) :
  - Pattern obligatoire : `push → server action → pull`
  - 1. Appel API serveur
  - 2. Pull immédiat de `document` et `documentLink` via `syncEntityFromRemoteByName`
  - 3. Émission d'event `sync:refresh` pour refresh UI
- **Actions CRUD classiques** :
  - ⚠️ **PROBLÈME ACTUEL** : Les suppressions/modifications utilisent directement `db.Document.delete()` / `db.Document.update()`
  - **À CORRIGER** : Utiliser un service (comme `TransactionService`) ou créer des `pendingOps` pour synchronisation

---

## 7. Règles de sécurité

### Scope par organisation
- Toutes les requêtes doivent filtrer par `organizationId`
- `organizationId` obtenu via la session (auth), pas depuis l'URL
- Interdiction de "déduire" l'orgId depuis l'URL

---

## 8. Règles de navigation

### Navigation interne app-shell
- Tous les liens doivent utiliser le format `/app?view=...`
- Exemples :
  - `/app?view=property&propertyId=...`
  - `/app?view=documents&...`
- Pas de `next/link` vers routes "normal" (`/biens/...`, `/documents/...`)
- Pas de `target=_blank` en app-shell

---

## 9. Différences connues à éliminer

### Calcul des orphelins
- ❌ **AVANT** : Utilisait les anciens champs directs (`!doc.propertyId && !doc.leaseId && ...`)
- ✅ **MAINTENANT** : Utilise `DocumentLink` (comme le serveur : `DocumentLink: { none: {} }`)

### Actions CRUD
- ❌ **ACTUEL** : Utilisation directe de `db.Document.delete()` / `db.Document.update()` en app-shell
- ⚠️ **À FAIRE** : Créer un `DocumentService` ou utiliser des `pendingOps` pour synchronisation

### Modales
- ❌ **ACTUEL** : `DocumentEditModal` fait des `fetch` directs vers l'API
- ⚠️ **À FAIRE** : En mode app-shell, utiliser IndexedDB + `pendingOps` ou un service

---

## 10. Points d'attention

### Synchronisation
- Les actions server-only (purge) nécessitent un pull immédiat après exécution
- Les documents uploadés en staging doivent être finalisés côté serveur avant d'être visibles en app-shell

### Performance
- Calcul des orphelins nécessite de charger tous les `DocumentLink` en mémoire
- Optimisation possible : index sur `documentId` dans `DocumentLink`

---

## 11. État actuel vs cible

### ✅ Fait
- Calcul correct des orphelins via `DocumentLink`
- Purge brouillons/orphelins avec pull immédiat en app-shell online
- Filtrage par orphelins via `DocumentLink`

### ⚠️ À faire
- Créer un `DocumentService` ou utiliser des `pendingOps` pour CRUD
- Refactorer `DocumentEditModal` pour utiliser IndexedDB + service en app-shell
- Vérifier la navigation app-shell (liens en `/app?view=...`)



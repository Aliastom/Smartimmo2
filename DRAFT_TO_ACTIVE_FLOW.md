# Flux draft → active : Traçabilité et garanties

## Tableau des étapes

| Étape | Moment | Action | État IndexedDB (status) | État IndexedDB (documentTypeId) | Event déclenché | Logs disponibles |
|-------|--------|--------|-------------------------|----------------------------------|-----------------|------------------|
| **1. Upload document** | Upload initial | Document créé côté serveur via `/api/upload-staged` | `draft` | `null` ou auto-assigné | - | Log API serveur |
| **2. Ajout dans IndexedDB** | Après upload réussi (app-shell) | `db.Document.put(localDoc)` avec `_remoteReady=true` | `draft` | `documentTypeId` initial | - | `[TransactionModal] ✅ Document ajouté dans IndexedDB` |
| **3. Modification brouillon** | Utilisateur change le type | PATCH `/api/upload-staged/[id]` | `draft` (serveur) | `documentTypeId` modifié (serveur) | - | `[UploadReview] 🔍 AVANT PATCH` |
| **4. Mise à jour IndexedDB (PATCH)** | Après PATCH réussi | `db.Document.put(updatedDoc)` avec merge complet | `draft` | `documentTypeId` mis à jour | `documents:refresh` | `[UploadReview] 🔍 APRÈS PATCH (put)` |
| **5. Création transaction** | Utilisateur crée transaction | `TransactionService.createTransaction()` | `draft` (avant) | `documentTypeId` actuel | - | `[TransactionService] 🔍 AVANT finalisation (draft→active)` |
| **6. Recherche documents** | Dans createTransaction | `documentRepo.findMany({ status: 'draft' })` | `draft` (filtré) | - | - | `[TransactionService] 🔍 RECHERCHE documents` |
| **7. Finalisation (draft→active)** | Dans createTransaction | `documentRepo.updateMany({ status: 'active' })` → `db.Document.put()` | `active` | `documentTypeId` préservé | - | `[IndexedDBDocumentRepository] 🔍 AVANT updateMany`<br>`[IndexedDBDocumentRepository] 🔍 APRÈS updateMany (put)`<br>`[TransactionService] 🔍 APRÈS finalisation (draft→active)` |
| **8. Refresh UI** | Après createTransaction retourne | `window.dispatchEvent('documents:refresh')` | `active` | `documentTypeId` préservé | `documents:refresh` | `[TransactionsPageCore] documents:refresh émis` |

## Points critiques

### ✅ Garanties actuelles

1. **PATCH → IndexedDB** : 
   - ✅ Logs AVANT/APRÈS dans `UploadReviewModal.saveDraftDocument`
   - ✅ Utilise `put()` avec merge complet
   - ✅ Émet `documents:refresh` immédiatement

2. **createTransaction → draft→active** :
   - ✅ Logs AVANT/APRÈS dans `TransactionService.createTransaction`
   - ✅ Logs dans `IndexedDBDocumentRepository.updateMany` avec détails complets
   - ✅ Utilise `put()` avec merge complet (pas `update()`)
   - ✅ Filtre strict par `status: 'draft'` (ne cache pas le bug)

3. **Refresh UI** :
   - ✅ `documents:refresh` émis après `createTransaction` (mode offline)
   - ✅ `documents:refresh` émis après round-trip (mode online)

### ⚠️ Points à vérifier

- Le filtre strict `status: 'draft'` dans `findMany` garantit qu'on ne traite que les vrais brouillons
- Si un document n'est pas trouvé, c'est qu'il n'est pas en draft → le serveur le gérera
- Les logs permettent de tracer exactement où le problème se situe

## Logs attendus dans le terminal

### Scénario : Modification brouillon puis création transaction

```
[UploadReview] 🔍 AVANT PATCH - docId=xxx, status=draft, documentTypeId=oldId, fileName=doc.pdf
[UploadReview] 🔍 APRÈS PATCH (put) - docId=xxx, status=draft, documentTypeId=newId, fileName=doc.pdf
[TransactionService] 🔍 RECHERCHE documents - stagedDocumentIds: xxx
[TransactionService] 🔍 AVANT finalisation (draft→active) - docId=xxx, status=draft, documentTypeId=newId, fileName=doc.pdf
[IndexedDBDocumentRepository] 🔍 AVANT updateMany - docId=xxx, status=draft, documentTypeId=newId, fileName=doc.pdf
[IndexedDBDocumentRepository] 🔍 AVANT updateMany - données à appliquer: {"status":"active"}
[IndexedDBDocumentRepository] 🔍 APRÈS updateMany (put) - docId=xxx, status=active, documentTypeId=newId, fileName=doc.pdf
[TransactionService] 🔍 APRÈS finalisation (draft→active) - docId=xxx, status=active, documentTypeId=newId, fileName=doc.pdf
```

## Correctifs appliqués

1. ✅ Logs détaillés AVANT/APRÈS chaque étape
2. ✅ `put()` utilisé partout (pas `update()`) pour garantie d'intégrité
3. ✅ `documents:refresh` émis après PATCH et après createTransaction
4. ✅ Filtre strict `status: 'draft'` restauré (ne cache pas le bug)


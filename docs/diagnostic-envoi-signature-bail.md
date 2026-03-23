# Diagnostic workflow « Envoyer pour signature » (App Shell)

## Objectif

Tracer **dans la console du navigateur** (F12) la chaîne :

`property` → `tenant` → `POST /api/leases` → `POST /api/leases/:id/send-for-signature`

avec des lignes JSON préfixées par **`[LEASE_SIGN_WORKFLOW_DIAG]`**.

## Activation

- **Automatique** : en App Shell, au clic sur **Envoyer pour signature**, la session de diagnostic est attachée au bail courant (`sessionStorage`).
- **Optionnel (tout tracer)** : variable d’environnement `NEXT_PUBLIC_LEASE_SIGN_DIAG=1` (bruyant : tous les `POST` baux loggent l’étape 5).

## Filtre console

Rechercher : `LEASE_SIGN_WORKFLOW_DIAG` ou `[LEASE_SIGN_WORKFLOW_DIAG]`.

## Étapes émises

| `step` | Signification |
|--------|----------------|
| `1_before_sync_property` | Avant création/sync du **bien** lié au bail diagnostic (IDs + kind `uuid_local` / `cuid_remote`) |
| `2_after_sync_property` | Après succès création bien : ID remote, snapshot `Lease` + pending bail (`payload.propertyId` doit matcher le remote si remap OK) |
| `3_before_sync_tenant` | Idem locataire |
| `4_after_sync_tenant` | Idem après locataire |
| `5_before_post_api_leases` | **Corps JSON exact** envoyé à `POST /api/leases` (`requestBodyJson`) + kinds FK + `hasSyncHintsFallback` |
| `6_after_post_api_leases` | ID remote du bail créé + mapping local → remote (session pour étape 7) |
| `7_before_send_for_signature` | URL utilisée + comparaison avec le mapping étape 6 (`urlIdMatchesRemoteFromStep6`) |

## Correction métier appliquée (flux principal)

1. **Ordre de sync** : `property` puis **`tenant`** puis **`lease`** (avant : `lease` avant `tenant`, FK locataire encore locale au moment du POST bail).
2. **Remap pending bail** : les opérations bail en statut **`syncing`** sont aussi prises en compte lors du remap FK après sync bien/locataire.
3. **Résultat sync** : le modal vérifiait `syncResult.success` sur l’objet racine alors que `syncAllPendingToRemote` retourne un `Record` par entité — corrigé (`syncHasErrors`).
4. **Rechargement bail après sync** : si l’ID Dexie du bail a été remplacé par le cuid serveur, recherche de secours par `(propertyId, tenantId, startDate, rentAmount)`.

Le fallback **`__syncHints`** côté API reste un filet de sécurité ; le flux attendu est **uniquement des IDs remappés** (étapes 1–5 avec `cuid_remote` sur les FK).

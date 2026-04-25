# Spécification Normative - Smartimmo Backup V2

## 1) Objectif et périmètre de Backup V2

Cette spécification définit le **contrat d'archive V2** pour Smartimmo.

Objectif V2:
- fournir un format unique de sauvegarde ZIP,
- versionné, validable, et exploitable par les jobs async existants,
- préparant une restauration complète future.

Périmètre fonctionnel de la spécification:
- structure archive,
- schémas de métadonnées,
- règles d'intégrité et de compatibilité,
- règles de validation pré-restore,
- ordre logique de purge/restauration future.

Hors périmètre de cette phase:
- implémentation complète de la restauration métier + binaires.

---

## 2) Principes structurants retenus

1. **Archive unique ZIP** par backup.
2. **Versionnage explicite** (`backupVersion`) dans le manifest.
3. **Restore cible V1: full replace only** (pas de merge partiel).
4. **Données DB en NDJSON compressé** (`.ndjson.gz`) par dataset.
5. **Objets/binaires indexés** via `objects/index.ndjson`.
6. **Checksums systématiques**:
   - par fichier,
   - global.
7. **Validation stricte avant restore**:
   - toute violation bloquante => rejet.
8. **Compatibilité explicite**:
   - version minimale supportée,
   - statut compatible/partiel/incompatible.

---

## 3) Structure complète de l'archive ZIP

```text
smartimmo-backup-v2-YYYYMMDD-HHMMSS.zip
├── manifest.v2.json
├── checksums.sha256
├── metadata/
│   ├── app.json
│   ├── schema.json
│   └── compatibility.json
├── db/
│   ├── order.json
│   ├── core/
│   │   ├── organizations.ndjson.gz
│   │   ├── users.ndjson.gz
│   │   └── profiles.ndjson.gz
│   ├── business/
│   │   ├── properties.ndjson.gz
│   │   ├── tenants.ndjson.gz
│   │   ├── leases.ndjson.gz
│   │   ├── transactions.ndjson.gz
│   │   ├── loans.ndjson.gz
│   │   └── echeances.ndjson.gz
│   ├── documents/
│   │   ├── documents.ndjson.gz
│   │   ├── document_links.ndjson.gz
│   │   ├── document_fields.ndjson.gz
│   │   └── document_text_index.ndjson.gz
│   └── admin/
│       ├── fiscal_versions.ndjson.gz
│       ├── fiscal_types.ndjson.gz
│       ├── fiscal_regimes.ndjson.gz
│       ├── fiscal_compat.ndjson.gz
│       ├── categories.ndjson.gz
│       ├── natures.ndjson.gz
│       ├── document_types.ndjson.gz
│       ├── signals.ndjson.gz
│       └── system_settings.ndjson.gz
├── objects/
│   ├── index.ndjson
│   └── files/
│       ├── aa/
│       │   └── <sha256>
│       └── ...
└── reports/
    ├── export-report.json
    └── warnings.json
```

Conventions:
- chemins en **kebab/snake stable** (pas de renommage dynamique),
- noms de datasets en snake_case,
- extension obligatoire des datasets DB: `.ndjson.gz`.

---

## 4) Spécification du manifest JSON (`manifest.v2.json`)

## 4.1 Champs obligatoires

| Champ | Type | Description |
|---|---|---|
| `backupVersion` | string | Version du contrat archive (ex: `2.0.0`) |
| `appVersion` | string | Version applicative Smartimmo |
| `schemaVersion` | string | Version schéma DB/Prisma |
| `createdAt` | string (ISO-8601) | Date UTC de création |
| `mode` | string | DOIT valoir `full-replace` |
| `scope` | string | DOIT valoir `full` |
| `includes` | object | Matrice de présence des blocs |
| `counts` | object | Compteurs globaux |
| `checksums` | object | Références checksums |
| `compatibility` | object | Contraintes de compatibilité |

## 4.2 Champs optionnels

| Champ | Type | Description |
|---|---|---|
| `organizationId` | string | Scope org si mono-org |
| `createdBy` | object | Métadonnées opérateur |
| `notes` | string | Notes libres non bloquantes |

## 4.3 Règles normatives

- `backupVersion` DOIT être parsable en semver.
- `mode` DOIT être `full-replace`.
- `includes.documentsBinary=true` IMPLIQUE la présence de `objects/index.ndjson`.
- `checksums.files` DOIT pointer vers `checksums.sha256`.
- `counts.objects` DOIT être cohérent avec `objects/index.ndjson`.

---

## 5) Spécification de `checksums.sha256`

Format:
- une ligne par fichier,
- format POSIX: `<sha256_hex><2 espaces><relative_path>`.

Exemple:
```text
f8f0d4...  manifest.v2.json
4a18b2...  db/business/properties.ndjson.gz
e6aa10...  objects/files/aa/aab3c4...
```

Règles:
- tous les fichiers métiers DOIVENT être présents (manifest, metadata, db, objects, reports optionnel).
- `checksums.sha256` NE DOIT PAS contenir sa propre empreinte.
- le `globalSha256` du manifest DOIT être l'empreinte SHA-256 de `checksums.sha256` brut.

---

## 6) Spécification de `metadata/app.json`, `schema.json`, `compatibility.json`

## 6.1 `metadata/app.json` (obligatoire)

Minimum:
- `appName` (string, obligatoire),
- `appVersion` (string, obligatoire),
- `buildId` (string, optionnel),
- `environment` (string, obligatoire: `development|staging|production`).

## 6.2 `metadata/schema.json` (obligatoire)

Minimum:
- `schemaVersion` (string, obligatoire),
- `source` (string, obligatoire, ex: `prisma`),
- `generatedAt` (ISO-8601, obligatoire),
- `tables` (array<string>, obligatoire).

## 6.3 `metadata/compatibility.json` (obligatoire)

Minimum:
- `minImporterVersion` (string, obligatoire),
- `maxTestedImporterVersion` (string, obligatoire),
- `minAppVersion` (string, obligatoire),
- `requiredFeatures` (array<string>, obligatoire),
- `breakingFlags` (array<string>, obligatoire, vide autorisé).

---

## 7) Spécification de `db/order.json`

Objectif:
- source unique de l'ordre de restauration DB.

Structure:
- `version` (number, obligatoire),
- `restoreOrder` (array<string>, obligatoire, non vide),
- `groups` (object, optionnel).

Règles:
- chaque entrée de `restoreOrder` DOIT correspondre à un dataset présent.
- ordre DOIT respecter les dépendances relationnelles.
- dataset absent de l'ordre => **erreur bloquante**.

---

## 8) Spécification des datasets DB (`.ndjson.gz`)

Format:
- gzip contenant NDJSON UTF-8.
- 1 ligne = 1 enregistrement JSON.

Règles:
- fichiers DOIVENT être nommés `db/<zone>/<dataset>.ndjson.gz`.
- un dataset vide est autorisé uniquement si attendu (sinon warning).
- chaque ligne JSON invalide => erreur bloquante.
- clés primaires DOIVENT être présentes selon le contrat dataset.

Conventions:
- timestamps en ISO-8601 UTC,
- booléens stricts,
- nombres non stringifiés.

---

## 9) Spécification de `objects/index.ndjson`

1 ligne = 1 objet binaire exporté.

Champs obligatoires:
- `objectId` (string),
- `relativePath` (string, sous `objects/files/...`),
- `sha256` (string hex),
- `size` (number, octets),
- `mime` (string),
- `kind` (string: `document|photo|payment_attachment|other`),
- `organizationId` (string).

Champs optionnels:
- `documentId` (string),
- `storageKey` (string),
- `createdAt` (ISO-8601),
- `metadata` (object).

Règles:
- `relativePath` DOIT exister physiquement dans le ZIP.
- `sha256` DOIT correspondre au binaire référencé.
- `size` DOIT correspondre à la taille réelle.
- doublons de `objectId` interdits.

---

## 10) Règles d'intégrité

Règles bloquantes:
- manifest absent ou invalide,
- `checksums.sha256` absent,
- mismatch checksum fichier,
- mismatch `globalSha256`,
- incohérence `counts` critiques (ex: `objects`),
- objet indexé absent physiquement.

Règles warning:
- dataset optionnel absent,
- `reports/warnings.json` absent,
- champs optionnels inconnus.

---

## 11) Règles de compatibilité

Statuts:
- `compatible`: restore autorisé,
- `partially-compatible`: restore autorisé avec warnings,
- `incompatible`: restore interdit.

Critères incompatibles (bloquants):
- `backupVersion` majeure non supportée,
- importer < `minImporterVersion`,
- feature requise absente,
- `mode != full-replace`.

Critères partiels (warning):
- `appVersion` plus récente que `maxTestedImporterVersion`,
- champs additionnels non critiques.

---

## 12) Règles de validation pré-restore

Avant toute purge/restauration, l'implémentation DOIT effectuer:
1. validation structure ZIP,
2. validation manifest + metadata,
3. validation compatibilité,
4. validation checksums fichiers + global,
5. validation datasets DB (`.ndjson.gz` lisibles),
6. validation index objets + présence binaires.

Si une étape bloquante échoue:
- le restore NE DOIT PAS démarrer,
- job status => `failed`,
- erreur explicite dans `error` + logs.

---

## 13) Ordre futur de purge / restauration

Restore V1 cible: **full replace only**.

Séquence normative:
1. **Pré-validation complète** (bloquante).
2. **Lock global restore** (aucune opération concurrente incompatible).
3. **Purge contrôlée DB** (ordre inverse dépendances).
4. **Restauration DB** selon `db/order.json`.
5. **Restauration objets/binaires** selon `objects/index.ndjson`.
6. **Vérification finale** (counts, checksums, références critiques).
7. **Finalisation** (unlock, résultat job).

---

## 14) Liste des données incluses

Cible V2 (minimum):
- Core: organization, users/profiles utiles au fonctionnement.
- Métier: properties, tenants, leases, transactions, loans, echeances.
- Documents metadata: documents, links, fields, text index.
- Référentiels/admin: fiscal, categories/natures, document types, signaux, settings.
- Binaires: documents et objets associés.

La liste exacte des tables DOIT être maintenue dans l'implémentation `DbExportPlanner.ts`.

---

## 15) Liste des données exclues

Exclusions par défaut:
- secrets/env (`.env`, clés API, tokens),
- caches techniques temporaires,
- sessions auth éphémères,
- logs runtime non nécessaires au métier,
- artefacts techniques locaux.

Toute exception DOIT être explicitée dans `reports/warnings.json`.

---

## 16) Gestion des erreurs: bloquant vs warning

## 16.1 Erreurs bloquantes (STOP)
- archive illisible,
- manifest invalide,
- incompatibilité version majeure,
- checksum invalide,
- dataset obligatoire absent,
- NDJSON invalide,
- objet indexé introuvable.

## 16.2 Warnings (CONTINUE possible)
- dataset optionnel absent,
- clé optionnelle inconnue,
- champs non critiques non reconnus.

Format recommandé pour les diagnostics:
```json
{
  "code": "CHECKSUM_MISMATCH",
  "severity": "blocking",
  "path": "db/business/properties.ndjson.gz",
  "message": "Checksum attendu différent du fichier",
  "hint": "Re-générer l'archive depuis une source saine"
}
```

---

## 17) Exemples JSON complets

## 17.1 `manifest.v2.json`

```json
{
  "backupVersion": "2.0.0",
  "appVersion": "smartimmo-2026.04.23",
  "schemaVersion": "prisma-2026-04-23",
  "createdAt": "2026-04-23T18:30:12.120Z",
  "mode": "full-replace",
  "scope": "full",
  "organizationId": "org_default",
  "includes": {
    "db": true,
    "admin": true,
    "business": true,
    "documentsMetadata": true,
    "documentsBinary": true
  },
  "counts": {
    "tables": 24,
    "rows": 184532,
    "objects": 4281,
    "bytesDbCompressed": 91234567,
    "bytesObjects": 1432234556
  },
  "checksums": {
    "algorithm": "sha256",
    "files": "checksums.sha256",
    "globalSha256": "9bc47a8ebd9f3a2d5f1cc2a21b4d67bbf0bd1c6ec7d8f8f43f4f1a7bb53e73f7"
  },
  "compatibility": {
    "minImporterVersion": "2.0.0",
    "maxTestedImporterVersion": "2.x",
    "minAppVersion": "2026.04.0",
    "requiredFeatures": [
      "full-backup-v2",
      "object-index-v1"
    ],
    "breakingFlags": []
  },
  "createdBy": {
    "userId": "usr_123",
    "email": "admin@smartimmo.fr"
  }
}
```

## 17.2 `metadata/app.json`

```json
{
  "appName": "smartimmo",
  "appVersion": "smartimmo-2026.04.23",
  "buildId": "build-20260423-01",
  "environment": "production"
}
```

## 17.3 `metadata/schema.json`

```json
{
  "schemaVersion": "prisma-2026-04-23",
  "source": "prisma",
  "generatedAt": "2026-04-23T18:30:12.120Z",
  "tables": [
    "Property",
    "Tenant",
    "Lease",
    "Transaction",
    "Loan",
    "Document",
    "DocumentLink",
    "Category",
    "NatureEntity",
    "DocumentType"
  ]
}
```

## 17.4 `metadata/compatibility.json`

```json
{
  "minImporterVersion": "2.0.0",
  "maxTestedImporterVersion": "2.x",
  "minAppVersion": "2026.04.0",
  "requiredFeatures": [
    "full-backup-v2",
    "object-index-v1"
  ],
  "breakingFlags": []
}
```

## 17.5 `db/order.json`

```json
{
  "version": 1,
  "restoreOrder": [
    "organizations",
    "users",
    "profiles",
    "categories",
    "natures",
    "properties",
    "tenants",
    "leases",
    "transactions",
    "loans",
    "documents",
    "document_links",
    "document_fields",
    "document_text_index"
  ]
}
```

## 17.6 `objects/index.ndjson` (2 lignes)

```text
{"objectId":"obj_01","storageKey":"documents/doc_001/facture.pdf","relativePath":"objects/files/aa/aab3c4","sha256":"aab3c4d5e6f7","size":245678,"mime":"application/pdf","kind":"document","organizationId":"org_default","documentId":"doc_001","createdAt":"2026-04-20T10:12:00Z"}
{"objectId":"obj_02","storageKey":"photos/prop_22/front.jpg","relativePath":"objects/files/bb/bb09ac","sha256":"bb09ac7712ff","size":88321,"mime":"image/jpeg","kind":"photo","organizationId":"org_default","createdAt":"2026-04-20T10:13:00Z"}
```

---

## 18) Décisions ouvertes / TODO

1. **Granularité multi-organisation**:
   - archive globale multi-org vs archive par org.
2. **Politique d'anonymisation optionnelle**:
   - hors périmètre V2 initial, à évaluer.
3. **Chiffrement archive au repos**:
   - optionnel (AES) pour phase ultérieure.
4. **Liste exacte tables V2**:
   - figée dans `DbExportPlanner.ts` (source de vérité code).
5. **Niveaux de validation avancés**:
   - vérifications référentielles profondes post-restore.
6. **Gestion de rollback robuste**:
   - définie dans phase d'implémentation restore complet.

---

## Références d'implémentation visées

Cette spécification est destinée à alimenter directement:
- `BackupV2Contract.ts`
- `BackupV2Validator.ts`
- `DbExportPlanner.ts`
- `ObjectExportService.ts`

Toute divergence implémentation/spec DOIT être traitée par mise à jour explicite de cette spec.

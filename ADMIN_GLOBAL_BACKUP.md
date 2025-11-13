# 🔐 Sauvegarde Globale Admin — SmartImmo

## 📋 Résumé

Ce document décrit le système complet de **sauvegarde et restauration globale** de la base admin SmartImmo, permettant d'exporter et d'importer l'intégralité des configurations système (référentiels, barèmes fiscaux, types de documents, etc.) dans une archive ZIP versionnée et vérifiable.

---

## 🎯 Objectifs

✅ **Exporter** toutes les configurations "système" (référentiels & barèmes)  
✅ **Importer** en mode dry-run/validate/apply avec stratégie merge/replace  
✅ **Planifier** des sauvegardes automatiques (cron) + historique téléchargeable  
✅ **Respecter** l'intégrité et l'audit à chaque opération  

---

## 📦 Portée — Données Incluses

### ✅ Inclus par Défaut

| Catégorie | Tables/Modèles | Description |
|-----------|----------------|-------------|
| **Paramètres Fiscaux** | `FiscalVersion`, `FiscalParams`, `FiscalType`, `FiscalRegime`, `FiscalCompatibility` | Barèmes fiscaux, types et régimes fiscaux, compatibilités |
| **Natures & Catégories** | `NatureEntity`, `NatureDefault`, `NatureRule`, `Category` | Natures de transactions et catégories comptables |
| **Types de Documents** | `DocumentType` (avec keywords, signals, extraction rules) | Configuration complète des types de documents |
| **Catalogue des Signaux** | `Signal`, `TypeSignal` | Signaux OCR/ML pour classification |
| **Gestion Déléguée** | `ManagementCompany` | Paramètres de gestion déléguée |
| **Paramètres Système** | `AppSetting` | Feature flags et configuration système |

### ❌ Exclus par Défaut

- **Données personnelles** : Users, Tenants (données RGPD)
- **Données métier** : Properties, Leases, Transactions, Payments
- **Documents** : Fichiers physiques (seuls les types sont exportés)
- **Secrets** : Variables d'environnement, clés API

---

## 📄 Format d'Export

### Archive ZIP

```
smartimmo-admin-backup-YYYYMMDD-HHMMSS.zip
│
├── manifest.json                  # Métadonnées de l'export
├── checksums.sha256               # SHA256 de chaque fichier
│
└── datasets/                      # Données en NDJSON
    ├── fiscal.versions.ndjson
    ├── fiscal.types.ndjson
    ├── fiscal.regimes.ndjson
    ├── fiscal.compat.ndjson
    ├── natures.ndjson
    ├── categories.ndjson
    ├── documents.types.ndjson
    ├── signals.catalog.ndjson
    ├── delegated.settings.ndjson
    └── system.settings.ndjson
```

### Manifest.json

```json
{
  "app": "smartimmo",
  "version": "1.0",
  "scope": "admin",
  "environment": "production",
  "createdAt": "2025-11-06T14:30:00.000Z",
  "datasets": [
    "fiscal.versions",
    "fiscal.types",
    "natures",
    "categories",
    "documents.types",
    "signals.catalog"
  ],
  "checksumGlobal": "a1b2c3d4..."
}
```

### Format NDJSON

**Newline Delimited JSON** : 1 record JSON par ligne

```ndjson
{"id":"NU","label":"Location nue","category":"FONCIER","isActive":true}
{"id":"MEUBLE","label":"Location meublée","category":"BIC","isActive":true}
{"id":"SCI_IS","label":"SCI à l'IS","category":"IS","isActive":true}
```

**Avantages** :
- ✅ Streamable (traitement ligne par ligne)
- ✅ Robuste (une ligne corrompue n'invalide pas tout)
- ✅ Lisible et debuggable

---

## 🔌 API Endpoints

### 1️⃣ Export Global

```http
GET /api/admin/backup/export?scope=admin&includeSensitive=false
```

**Paramètres** :
- `scope` : `"admin"` (fixe)
- `includeSensitive` : `false` (par défaut)

**Réponse** :
- `Content-Type` : `application/zip`
- `Content-Disposition` : `attachment; filename="smartimmo-admin-backup-20251106-143000.zip"`

**Audit** :
- Enregistré dans `AppConfig` avec clé `last_backup_export`
- User ID, timestamp, scope

**Sécurité** :
- ✅ Authentification requise
- ✅ Rôle `ADMIN` requis
- ✅ Pas d'export de secrets

---

### 2️⃣ Import Global

```http
POST /api/admin/backup/import?mode=validate&strategy=merge
```

**Paramètres** :
- `mode` : `validate` | `dry-run` | `apply`
- `strategy` : `merge` | `replace`

**Body** :
- `multipart/form-data`
- Champ `file` : archive `.zip`

**Étapes d'Exécution** :

1. **Extraction** : Dézipper en mémoire
2. **Validation** :
   - Vérifier `manifest.json`
   - Vérifier tous les checksums SHA256
   - Parser chaque `*.ndjson` (validation Zod)
3. **Diff** : Calculer adds/updates/deletes vs DB actuelle
4. **Mode validate** : Retourner rapport complet
5. **Mode apply** : Transaction Prisma + upsert/soft-delete
6. **Audit** : Enregistrer dans `AppConfig` + créer `AdminBackupRecord`

**Réponse** :

```json
{
  "success": true,
  "data": {
    "mode": "apply",
    "strategy": "merge",
    "diff": {
      "adds": 5,
      "updates": 12,
      "deletes": 0,
      "preview": {
        "fiscal.types": {
          "adds": [{"id": "LMNP", "label": "LMNP"}],
          "updates": [{"old": {...}, "new": {...}}],
          "deletes": []
        }
      }
    },
    "applied": {
      "adds": 5,
      "updates": 12,
      "deletes": 0
    },
    "backupRecordId": "ckxy123456"
  }
}
```

**Sécurité** :
- ✅ Taille max : **25 Mo**
- ✅ Transaction globale avec rollback
- ✅ Soft-delete systématique (jamais hard-delete)
- ✅ Validation des références croisées

---

### 3️⃣ Historique

```http
GET /api/admin/backup/history?limit=20
```

**Paramètres** :
- `limit` : nombre de backups à retourner (défaut : 20)

**Réponse** :

```json
{
  "success": true,
  "data": [
    {
      "id": "ckxy123456",
      "createdAt": "2025-11-06T14:30:00.000Z",
      "createdBy": "admin@smartimmo.fr",
      "scope": "admin",
      "sizeBytes": 1048576,
      "checksum": "a1b2c3d4...",
      "note": "Backup avant migration",
      "meta": {...}
    }
  ]
}
```

---

### 4️⃣ Restauration

```http
POST /api/admin/backup/restore/:backupId?mode=apply&strategy=merge
```

**Paramètres** :
- `backupId` : ID du backup dans l'historique
- `mode` : `validate` | `dry-run` | `apply`
- `strategy` : `merge` | `replace`

**Comportement** :
- Charge le backup depuis le stockage local/S3
- Applique la même logique que l'import
- Enregistre un audit `last_backup_restore`

---

### 5️⃣ Planification

#### Récupérer la planification actuelle

```http
GET /api/admin/backup/schedule
```

#### Créer/Mettre à jour la planification

```http
POST /api/admin/backup/schedule
```

**Body** :

```json
{
  "frequency": "weekly",
  "hour": 3,
  "dayOfWeek": 0,
  "retentionDays": 30,
  "isActive": true
}
```

**Fréquences** :
- `daily` : Tous les jours à l'heure spécifiée
- `weekly` : Chaque semaine le jour spécifié
- `monthly` : Chaque mois le jour spécifié

#### Désactiver la planification

```http
DELETE /api/admin/backup/schedule
```

---

## 🖥️ Interface Utilisateur

### Carte Admin — Sauvegarde Globale

Accessible depuis **`/admin`** → Section "Sauvegarde & Restauration"

**Composant** : `BackupManagementCard`

#### Actions Principales

| Bouton | Action | Description |
|--------|--------|-------------|
| **Tout Exporter** | `handleExport()` | Télécharge l'archive ZIP complète |
| **Tout Importer** | Modal 3 étapes | Upload → Options → Résultat |
| **Planifier** | Modal planification | Configure les backups automatiques |
| **Historique** | Modal historique | Liste paginée avec Télécharger/Restaurer |

#### Modal Import — 3 Étapes

**Étape 1** : Upload fichier  
- Input file `.zip`
- Vérification taille (max 25 Mo)
- Affichage nom + taille

**Étape 2** : Options  
- **Mode** : validate / dry-run / apply
- **Stratégie** : merge / replace

**Étape 3** : Résultat  
- Si erreur : Affichage message + détails
- Si succès :
  - **validate/dry-run** : Aperçu des changements (adds/updates/deletes)
  - **apply** : Confirmation + backupRecordId

#### Modal Historique

- Liste des backups (date, auteur, taille, checksum)
- Boutons **Télécharger** et **Restaurer** par backup
- Pagination (20 par page)

---

## 🔒 Sécurité & Intégrité

### Authentification & Autorisation

- ✅ Session NextAuth requise
- ✅ Rôle `ADMIN` obligatoire
- ✅ Vérification à chaque endpoint

### Validations

| Niveau | Vérification |
|--------|--------------|
| **Archive** | Manifest valide, checksums SHA256 corrects |
| **Datasets** | Validation Zod de chaque record NDJSON |
| **Références** | IDs croisés cohérents (ex: `regimes[].appliesToIds ⊂ types[].id`) |
| **Compatibilités** | Règles de compatibilité respectées |
| **FiscalVersion** | Une seule version `published` active |

### Transactions & Rollback

- **Transaction Prisma globale** : si une erreur survient, tout est annulé
- **Soft-delete** : jamais de `DELETE` hard si des clés sont référencées
- **Point de restauration** : chaque import crée un `AdminBackupRecord`

### Exclusions de Sécurité

- ❌ Pas d'export de `.env` ou secrets
- ❌ Paramètres sensibles masqués (tokens, clés API)
- ❌ Pas de données personnelles (RGPD)

---

## 🗄️ Modèles Prisma

### AdminBackupRecord

```prisma
model AdminBackupRecord {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())
  createdById String
  scope       String   // "admin"
  fileUrl     String   // chemin S3/local
  checksum    String
  sizeBytes   Int
  note        String?
  meta        Json     // manifest complet

  @@index([createdAt])
  @@index([scope])
  @@map("admin_backup_records")
}
```

### AdminBackupSchedule

```prisma
model AdminBackupSchedule {
  id          String   @id @default(cuid())
  isActive    Boolean  @default(true)
  frequency   String   // "daily" | "weekly" | "monthly"
  hour        Int      @default(3)
  dayOfWeek   Int?     // 0-6 pour hebdomadaire
  dayOfMonth  Int?     // 1-31 pour mensuel
  retentionDays Int    @default(30)
  lastRunAt   DateTime?
  nextRunAt   DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("admin_backup_schedules")
}
```

---

## 🧪 Scénarios de Test

### Test 1 : Export Simple

1. Se connecter en tant qu'admin
2. Aller sur `/admin`
3. Cliquer sur "Tout Exporter"
4. Vérifier le téléchargement du fichier `.zip`
5. Dézipper et vérifier le contenu :
   - `manifest.json` valide
   - `checksums.sha256` présent
   - Tous les datasets `*.ndjson` présents
6. Vérifier les checksums avec `sha256sum -c checksums.sha256`

### Test 2 : Import en mode Validate

1. Exporter une archive (Test 1)
2. Modifier manuellement un dataset (ajouter un type fiscal)
3. Importer avec `mode=validate`
4. Vérifier le rapport de diff :
   - 1 ajout détecté
   - 0 mise à jour
   - 0 suppression

### Test 3 : Import en mode Apply (merge)

1. Prendre l'archive modifiée (Test 2)
2. Importer avec `mode=apply` et `strategy=merge`
3. Vérifier que le nouveau type fiscal est créé
4. Vérifier qu'un `AdminBackupRecord` est créé
5. Vérifier l'audit dans `AppConfig`

### Test 4 : Import en mode Apply (replace)

1. Exporter l'état actuel
2. Supprimer un type fiscal dans l'archive
3. Importer avec `mode=apply` et `strategy=replace`
4. Vérifier que le type est soft-deleted (`isActive=false`)
5. Vérifier qu'il n'y a pas de hard-delete

### Test 5 : Planification

1. Créer une planification hebdomadaire (lundi 3h)
2. Vérifier que `nextRunAt` est calculé correctement
3. Désactiver la planification
4. Vérifier que `isActive=false`

### Test 6 : Restauration depuis l'historique

1. Créer plusieurs backups
2. Ouvrir l'historique
3. Restaurer le backup le plus ancien avec `mode=apply`
4. Vérifier que les données sont restaurées

---

## 📊 Stratégies Import

### Merge (Fusion)

- **Comportement** : Upsert (INSERT or UPDATE)
- **Suppression** : Aucune
- **Conflit** : Les nouvelles données écrasent l'existant (UPDATE)
- **Usage** : Import de nouvelles configurations sans affecter l'existant

**Exemple** :
- DB actuelle : Types `NU`, `MEUBLE`
- Archive : Types `NU` (modifié), `SCI_IS` (nouveau)
- Résultat : Types `NU` (mis à jour), `MEUBLE` (inchangé), `SCI_IS` (ajouté)

### Replace (Remplacement)

- **Comportement** : Remplacement complet
- **Suppression** : Soft-delete (`isActive=false`)
- **Conflit** : Hard-delete interdit si référencé
- **Usage** : Restauration complète d'un état

**Exemple** :
- DB actuelle : Types `NU`, `MEUBLE`, `SCI_IS`
- Archive : Types `NU`, `MEUBLE`
- Résultat : Types `NU`, `MEUBLE` (actifs), `SCI_IS` (inactif)

---

## 🔧 Service Backend

### AdminBackupService

**Fichier** : `src/services/AdminBackupService.ts`

**Méthodes Principales** :

```typescript
class AdminBackupService {
  // Export : retourne un stream ZIP
  async exportAdmin(options: ExportOptions): Promise<Readable>

  // Import : validation + diff + apply
  async importAdmin(
    zipBuffer: Buffer,
    options: ImportOptions,
    userId: string
  ): Promise<ImportResult>

  // Historique
  async getBackupHistory(limit: number): Promise<AdminBackupRecord[]>
  async getBackupById(id: string): Promise<AdminBackupRecord | null>

  // Internes
  private async collectDatasets(options: ExportOptions)
  private toNDJSON(data: any[]): string
  private fromNDJSON(content: string): any[]
  private calculateChecksum(content: string): string
  private async extractAndValidate(zipBuffer: Buffer)
  private async parseDatasets(datasetsRaw: Record<string, string>)
  private async calculateDiff(datasets, strategy): Promise<DiffResult>
  private async applyChanges(datasets, strategy, diff)
  private async saveBackupRecord(data)
}
```

**Dépendances** :
- `archiver` : Création d'archives ZIP
- `unzipper` : Extraction d'archives ZIP
- `crypto` : Calcul de checksums SHA256
- `zod` : Validation des données

---

## 📦 Installation & Setup

### 1. Installer les dépendances

```bash
npm install archiver unzipper
npm install -D @types/archiver @types/unzipper
```

### 2. Appliquer la migration Prisma

```bash
npx prisma migrate dev --name add-admin-backup
npx prisma generate
```

### 3. Créer le dossier backups

```bash
mkdir -p backups
```

### 4. Configurer les variables d'environnement

```bash
# .env.local
BACKUP_STORAGE_PATH=./backups
BACKUP_MAX_SIZE_MB=25
```

### 5. Tester l'interface

```bash
npm run dev
# Aller sur http://localhost:3000/admin
```

---

## 🚀 Cron Automatique (TODO)

### Script Node.js

**Fichier** : `scripts/cron-backup.ts`

```typescript
import { adminBackupService } from '@/services/AdminBackupService';
import fs from 'fs/promises';
import path from 'path';

async function runScheduledBackup() {
  // 1. Récupérer la planification active
  const schedule = await prisma.adminBackupSchedule.findFirst({
    where: { isActive: true }
  });

  if (!schedule) {
    console.log('No active schedule');
    return;
  }

  // 2. Vérifier si l'exécution est due
  const now = new Date();
  if (schedule.nextRunAt && schedule.nextRunAt > now) {
    console.log('Not due yet');
    return;
  }

  // 3. Générer l'export
  const exportStream = await adminBackupService.exportAdmin({ scope: 'admin' });
  
  // 4. Sauvegarder dans backups/
  const filename = `auto-backup-${Date.now()}.zip`;
  const filepath = path.join(process.cwd(), 'backups', filename);
  
  const chunks: Buffer[] = [];
  for await (const chunk of exportStream) {
    chunks.push(Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);
  
  await fs.writeFile(filepath, buffer);

  // 5. Créer le BackupRecord
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  await prisma.adminBackupRecord.create({
    data: {
      createdById: 'system',
      scope: 'admin',
      fileUrl: `backups/${filename}`,
      checksum,
      sizeBytes: buffer.length,
      note: 'Backup automatique planifié',
      meta: { auto: true }
    }
  });

  // 6. Mettre à jour la planification
  const nextRunAt = calculateNextRun(schedule);
  await prisma.adminBackupSchedule.update({
    where: { id: schedule.id },
    data: {
      lastRunAt: now,
      nextRunAt
    }
  });

  // 7. Nettoyer les anciens backups
  await cleanupOldBackups(schedule.retentionDays);
}

runScheduledBackup().catch(console.error);
```

### Crontab (Linux/Mac)

```bash
# Exécuter tous les jours à 3h du matin
0 3 * * * cd /path/to/smartimmo && node dist/scripts/cron-backup.js >> logs/cron-backup.log 2>&1
```

---

## 🎓 Bonnes Pratiques

### Fréquence Recommandée

| Environnement | Fréquence | Rétention |
|---------------|-----------|-----------|
| **Production** | Quotidien | 30 jours |
| **Staging** | Hebdomadaire | 14 jours |
| **Dev** | Manuel | 7 jours |

### Avant Chaque Migration

1. ✅ Créer un backup manuel
2. ✅ Le télécharger localement
3. ✅ Tester l'import en mode `validate`
4. ✅ Appliquer la migration
5. ✅ Vérifier l'intégrité

### En Cas d'Erreur

1. ✅ NE PAS PANIQUER
2. ✅ Vérifier l'historique des backups
3. ✅ Restaurer le dernier backup valide en mode `dry-run`
4. ✅ Vérifier le diff
5. ✅ Appliquer la restauration en mode `apply`

---

## 📝 Changelog

### v1.0.0 (2025-11-06)

- ✅ Export global ZIP avec NDJSON + checksums
- ✅ Import avec validation, dry-run, apply
- ✅ Stratégies merge/replace
- ✅ Historique des backups
- ✅ Planification automatique
- ✅ Interface admin complète
- ✅ Audit complet
- ✅ Sécurité et transactions

---

## 📚 Ressources

- [NDJSON Spec](http://ndjson.org/)
- [Archiver Node.js](https://www.npmjs.com/package/archiver)
- [Prisma Transactions](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
- [SHA256 Checksums](https://nodejs.org/api/crypto.html#crypto_crypto_createhash_algorithm_options)

---

## 🙏 Support

Pour toute question ou problème :
- 📧 Email : support@smartimmo.fr
- 📖 Documentation : `/docs`
- 🐛 Issues : GitHub Issues

---

**Système SmartImmo — Sauvegarde Globale Admin v1.0**  
© 2025 SmartImmo. Tous droits réservés.


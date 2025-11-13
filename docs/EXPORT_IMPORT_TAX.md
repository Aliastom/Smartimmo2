# SmartImmo — Export / Import des paramètres fiscaux

## Vue d'ensemble

Le système d'export/import permet de sauvegarder et restaurer l'ensemble des paramètres fiscaux et référentiels associés de manière sûre, traçable et versionnée.

## Contenu exporté

Un fichier JSON exporté contient :

- **Version fiscale** : code, année, status, source, notes
- **Barèmes & paramètres** : jsonData (IR, PS, Micro, Déficit, PER, SCI IS) + overrides
- **Types fiscaux** : FiscalType (FONCIER, BIC, IS)
- **Régimes fiscaux** : FiscalRegime (MICRO, REEL, etc.)
- **Compatibilités** : FiscalCompatibility (règles de mix autorisé/exclusif)
- **Métadonnées** : checksum SHA-256, date d'export, version du format

## Format du fichier

```json
{
  "meta": {
    "exportedAt": "2025-01-15T10:30:00.000Z",
    "app": "SmartImmo",
    "version": "1.0",
    "checksum": "abc123...",
    "exportedBy": "admin"
  },
  "data": {
    "version": {
      "code": "2025.1",
      "year": 2025,
      "source": "DGFIP 2025",
      "status": "published",
      "notes": "Version officielle 2025"
    },
    "params": {
      "jsonData": {
        "IR": { ... },
        "PS": { ... },
        "Micro": { ... },
        "Déficit": { ... },
        "PER": { ... },
        "SCI_IS": { ... }
      },
      "overrides": null
    },
    "types": [
      {
        "id": "NU",
        "label": "Location nue (revenus fonciers)",
        "category": "FONCIER",
        "description": "...",
        "isActive": true
      }
    ],
    "regimes": [
      {
        "id": "MICRO",
        "label": "Micro-foncier",
        "appliesToIds": ["NU"],
        "engagementYears": null,
        "eligibility": { ... },
        "calcProfile": "FONCIER_MICRO",
        "description": "...",
        "isActive": true
      }
    ],
    "compat": [
      {
        "id": "abc123",
        "scope": "category",
        "left": "FONCIER",
        "right": "BIC",
        "rule": "CAN_MIX",
        "note": "Un investisseur peut avoir du NU et du meublé"
      }
    ]
  }
}
```

## API

### Export

**Endpoint** : `GET /api/admin/tax/export`

**Paramètres** :
- `version` (requis) : Code de la version fiscale à exporter
- `includeRefs` (optionnel, défaut: false) : Inclure les types, régimes et compatibilités

**Réponse** : Fichier JSON téléchargeable

**Exemple** :
```bash
GET /api/admin/tax/export?version=2025.1&includeRefs=true
```

### Import

**Endpoint** : `POST /api/admin/tax/import`

**Paramètres query** :
- `mode` : `validate` | `dry-run` | `apply`
  - `validate` : Valider le fichier sans rien modifier
  - `dry-run` : Prévisualiser les changements
  - `apply` : Effectuer l'import
- `strategy` : `merge` | `replace`
  - `merge` : Créer nouveaux + mettre à jour existants
  - `replace` : Écraser les existants
- `targetCode` (optionnel) : Code de la version cible (si différent du fichier)
- `importTypes` (optionnel, défaut: true) : Importer les types
- `importRegimes` (optionnel, défaut: true) : Importer les régimes
- `importCompat` (optionnel, défaut: true) : Importer les compatibilités

**Body** : JSON du fichier exporté (FiscalExportBundle)

**Réponses** :

#### Mode: validate
```json
{
  "mode": "validate",
  "result": {
    "valid": true,
    "errors": [],
    "warnings": ["Section manquante: PER"],
    "stats": {
      "version": true,
      "params": true,
      "typesCount": 5,
      "regimesCount": 8,
      "compatCount": 3
    }
  }
}
```

#### Mode: dry-run
```json
{
  "mode": "dry-run",
  "result": {
    "valid": true,
    "errors": [],
    "warnings": [],
    "stats": { ... },
    "preview": {
      "versionToCreate": {
        "code": "2025.2",
        "year": 2025,
        "status": "draft",
        ...
      },
      "typesToCreate": ["NEW_TYPE"],
      "typesToUpdate": ["NU", "MEUBLE"],
      "regimesToCreate": [],
      "regimesToUpdate": ["MICRO"],
      "compatToCreate": [],
      "compatToUpdate": ["abc123"]
    }
  }
}
```

#### Mode: apply
```json
{
  "mode": "apply",
  "result": {
    "success": true,
    "versionId": "cm...",
    "versionCode": "2025.2",
    "changes": {
      "version": "created",
      "types": { "created": 1, "updated": 2 },
      "regimes": { "created": 0, "updated": 1 },
      "compat": { "created": 0, "updated": 1 }
    },
    "message": "Import réussi: Version créée"
  }
}
```

## Validation

Le système valide automatiquement :

✅ **Schéma Zod** : Structure complète du fichier  
✅ **Checksum** : Intégrité des données (SHA-256)  
✅ **Références croisées** : `appliesToIds` des régimes existent dans les types  
✅ **Catégories** : Compatibilités utilisent des catégories valides (FONCIER, BIC, IS)  
✅ **Sections obligatoires** : jsonData contient IR, PS, Micro, Déficit, PER, SCI_IS  
✅ **CalcProfile** : Profil de calcul supporté  

## Workflow d'import

### 1️⃣ Sélection du fichier

L'utilisateur sélectionne un fichier JSON. Le système :
- Parse le JSON
- Valide le schéma
- Vérifie le checksum
- Affiche les erreurs/warnings

### 2️⃣ Configuration des options

L'utilisateur configure :
- **Code cible** : Créer nouvelle version ou mettre à jour existante (si draft)
- **Stratégie** :
  - `merge` : Créer nouveaux + mettre à jour existants
  - `replace` : Écraser les existants
- **Référentiels à importer** : Types, Régimes, Compatibilités (checkboxes)

### 3️⃣ Aperçu (dry-run)

Le système prévisualise :
- Version à créer/mettre à jour
- Nombre de types/régimes/compat à créer/mettre à jour
- Conflits potentiels

### 4️⃣ Import (apply)

L'import est effectué dans une **transaction Prisma** :
1. Créer ou mettre à jour la version (toujours en `draft`)
2. Upsert des types fiscaux
3. Upsert des régimes fiscaux
4. Upsert des compatibilités
5. Journaliser l'import (checksum, taille, utilisateur)

⚠️ **Important** : Les versions importées sont toujours créées en mode `draft`. L'administrateur doit les publier manuellement après vérification.

## Sécurité

### Rôle requis
- `admin_fiscal` uniquement (TODO: implémenter le système de rôles)

### Règles de protection
- ✅ Les versions `published` ne peuvent pas être supprimées (archivage uniquement)
- ✅ Les versions `archived` ne peuvent pas être modifiées
- ✅ Les références utilisées dans des biens sont marquées `isActive=false` au lieu d'être supprimées
- ✅ Toutes les modifications sont tracées (audit log)
- ✅ Checksum vérifié à l'import

### Audit log
Chaque import est journalisé avec :
- Utilisateur
- Date/heure
- Checksum du fichier
- Taille du fichier
- Stratégie et options
- Résultat (succès/erreur)

## Cas d'usage

### Scénario 1 : Sauvegarder une configuration

**Objectif** : Sauvegarder les paramètres 2025 avant de tester de nouvelles règles

```bash
# Export complet avec référentiels
GET /api/admin/tax/export?version=2025.1&includeRefs=true
```

Le fichier `smartimmo-tax-2025.1-2025-01-15.json` est téléchargé et conservé en backup.

### Scénario 2 : Restaurer une configuration

**Objectif** : Restaurer les paramètres suite à une erreur

1. Sélectionner le fichier backup
2. Valider le fichier
3. Configurer :
   - Code cible : `2025.1-restored`
   - Stratégie : `merge`
   - Tous les référentiels cochés
4. Prévisualiser
5. Confirmer l'import
6. Publier la version restaurée

### Scénario 3 : Migrer entre environnements

**Objectif** : Copier les paramètres de prod vers dev

1. **En PROD** : Exporter la version `2025.1`
2. **En DEV** : Importer le fichier
   - Code cible : `2025.1`
   - Stratégie : `replace` (écraser)
   - Tous les référentiels cochés
3. Publier en dev

### Scénario 4 : Partager une configuration

**Objectif** : Partager une configuration type avec d'autres utilisateurs SmartImmo

1. Exporter la version `config-type-lmnp`
2. Partager le fichier JSON
3. L'autre utilisateur importe avec :
   - Code cible : `import-lmnp`
   - Stratégie : `merge`
   - Référentiels : selon besoin

## Limitations

- ❌ **Pas de rollback automatique** : En cas d'erreur après publication, il faut restaurer manuellement
- ⚠️ **Conflits de noms** : Si `targetCode` existe en `published`/`archived`, l'import échoue
- ⚠️ **Pas de versionning** : Un type `NU` importé écrase le `NU` existant (stratégie `replace`)
- ⚠️ **Taille de fichier** : Limité par Next.js (`bodyParser.sizeLimit`)

## Roadmap

- [ ] Support des exports partiels (seulement IR, seulement Types, etc.)
- [ ] Historique des imports (audit trail détaillé)
- [ ] Comparaison visuelle avant import (diff JSON)
- [ ] Export automatique programmé (cron)
- [ ] Signature numérique des exports (GPG)
- [ ] Compression des fichiers (.json.gz)

## Dépannage

### Erreur : "Checksum invalide"
**Cause** : Le fichier a été modifié manuellement  
**Solution** : Utiliser le fichier original ou recalculer le checksum

### Erreur : "Foreign key constraint violated"
**Cause** : Un régime référence un type qui n'existe pas  
**Solution** : Importer d'abord les types, puis les régimes

### Erreur : "Seules les versions en brouillon peuvent être modifiées"
**Cause** : Tentative de mise à jour d'une version `published`  
**Solution** : Utiliser un nouveau `targetCode` ou archiver l'ancienne version

### Warning : "Section manquante dans jsonData"
**Cause** : Le jsonData ne contient pas toutes les sections attendues  
**Impact** : Pas bloquant, mais peut causer des erreurs dans les simulations  
**Solution** : Vérifier que l'export est complet

## Support

Pour toute question :
- 📧 Email : support@smartimmo.fr
- 📖 Documentation : /docs
- 🐛 Issues : GitHub Issues

---

**Version** : 1.0  
**Dernière mise à jour** : 2025-01-15


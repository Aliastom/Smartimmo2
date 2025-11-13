# 📥 Guide d'Import JSON - Catalogue des Signaux

## 🎯 Fonctionnalité

Vous pouvez maintenant **importer plusieurs signaux en masse** depuis un fichier JSON dans le catalogue des signaux.

---

## 📍 Comment Accéder

1. Allez sur : `http://localhost:3000/admin/signals`
2. Cliquez sur le bouton **"Importer JSON"**
3. Sélectionnez un fichier JSON
4. L'import se lance automatiquement !

---

## 📄 Format JSON

### Structure

```json
{
  "signals": [
    {
      "code": "CODE_UNIQUE",
      "label": "Nom du signal",
      "regex": "pattern regex",
      "flags": "iu",
      "description": "Description optionnelle",
      "protected": false
    }
  ]
}
```

### Champs

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `code` | string | ✅ Oui | Code unique (ex: HAS_IBAN) |
| `label` | string | ✅ Oui | Nom affiché (ex: "Contient un IBAN") |
| `regex` | string | ✅ Oui | Pattern regex (échapper les \\) |
| `flags` | string | Non | Flags regex (défaut: "iu") |
| `description` | string | Non | Description du signal |
| `protected` | boolean | Non | Signal système (défaut: false) |

---

## 📦 Fichier d'Exemple

Un fichier d'exemple `signals-examples.json` a été créé dans le dossier `config/` avec **13 signaux prêts à l'emploi** :

### Signaux Financiers
- `HAS_IBAN` - Détecte un IBAN français
- `HAS_MONTANT_EUROS` - Détecte un montant en euros
- `HAS_SIRET` - Détecte un SIRET

### Signaux de Documents
- `MENTIONS_LOYER` - Détecte le mot "loyer"
- `MENTIONS_BAIL` - Détecte "bail" ou "contrat de location"
- `MENTIONS_QUITTANCE` - Détecte "quittance" ou "reçu"
- `MENTIONS_DPE` - Détecte "DPE" ou "diagnostic"
- `MENTIONS_ASSURANCE` - Détecte "assurance"
- `MENTIONS_TAXE_FONCIERE` - Détecte "taxe foncière"

### Signaux Généraux
- `HAS_DATE_FR` - Détecte une date française
- `HAS_PHONE_FR` - Détecte un téléphone français
- `HAS_EMAIL` - Détecte une adresse email
- `YEAR_PATTERN` - Détecte une année (20XX) - **Protégé**

---

## 🚀 Comment Utiliser

### Étape 1 : Préparer votre JSON

Créez un fichier `mes-signaux.json` :

```json
{
  "signals": [
    {
      "code": "MON_SIGNAL",
      "label": "Mon nouveau signal",
      "regex": "pattern.*à.*détecter",
      "flags": "iu",
      "description": "Description de mon signal"
    }
  ]
}
```

### Étape 2 : Importer

1. Ouvrez `/admin/signals`
2. Cliquez "Importer JSON"
3. Sélectionnez `mes-signaux.json`
4. Attendez la confirmation

### Étape 3 : Vérifier

- ✅ Toast de succès s'affiche
- ✅ Message : "X créés, Y mis à jour, Z ignorés"
- ✅ Les signaux apparaissent dans le tableau
- ⚠️ Si erreurs : voir la console navigateur

---

## ⚙️ Règles d'Import

### Création vs Mise à Jour

- **Si le `code` existe déjà** → Mise à jour (sauf si protégé)
- **Si le `code` est nouveau** → Création

### Signaux Protégés

Les signaux avec `protected: true` **ne peuvent pas être modifiés** via l'import.

Exemple : `YEAR_PATTERN` (signal système)

### Validation

Chaque signal est validé avant import :
- ✅ Code, label, regex requis
- ✅ Regex valide (test de compilation)
- ✅ Code unique (pas de doublons dans le fichier)

### Gestion d'Erreurs

Si un signal est invalide :
- ❌ Il est **ignoré** (skip)
- ✅ Les autres continuent
- ⚠️ Liste d'erreurs dans la console

---

## 📊 Résultat de l'Import

### Message de Succès

```
Import terminé: 10 créés, 2 mis à jour, 1 ignoré
```

### Détails dans la Console

Si erreurs :
```javascript
Erreurs d'import: [
  "Signal INVALID: code, label et regex requis",
  "Signal PROTECTED_SIGNAL: protégé, non modifiable"
]
```

---

## 🧪 Tester avec l'Exemple

1. **Utilisez le fichier fourni** :
   ```
   config/signals-examples.json
   ```

2. **Importez-le** dans `/admin/signals`

3. **Résultat attendu** :
   - ✅ 13 signaux créés (ou mis à jour si déjà existants)
   - ✅ Tableau rafraîchi automatiquement
   - ✅ Toast de confirmation

---

## 🔄 Cas d'Usage

### Import Initial

Charger un catalogue complet de signaux :
```bash
# 50+ signaux prédéfinis
config/signals-examples.json
```

### Mise à Jour en Masse

Modifier plusieurs signaux d'un coup :
1. Exportez le catalogue actuel
2. Modifiez le JSON
3. Réimportez

### Partage Entre Projets

Exportez depuis un projet, importez dans un autre !

---

## 🛠️ API Créée

### POST /api/admin/signals/import

**Body** :
```json
{
  "signals": [ ... ]
}
```

**Response** :
```json
{
  "success": true,
  "results": {
    "created": 10,
    "updated": 2,
    "skipped": 1,
    "errors": ["Signal X: regex invalide"]
  },
  "message": "Import terminé: ..."
}
```

---

## ✅ Checklist d'Acceptation

- [x] Route API `/api/admin/signals/import` créée
- [x] Validation de chaque signal (code, label, regex)
- [x] Gestion signaux protégés (skip)
- [x] Upsert (create ou update selon code)
- [x] Bouton "Importer JSON" dans l'UI
- [x] Modale avec format exemple
- [x] Gestion d'erreurs (toast + console)
- [x] Fichier exemple fourni (13 signaux)
- [x] Auto-refresh après import
- [x] Documentation complète

---

## 🎉 Résultat

**Vous pouvez maintenant** :
- ✅ Importer des dizaines de signaux en 1 clic
- ✅ Partager des catalogues entre projets
- ✅ Modifier en masse (export → edit → import)
- ✅ Utiliser les 13 signaux d'exemple

---

**Testez dès maintenant avec `config/signals-examples.json` !** 🚀

**Date** : 14 Octobre 2025  
**Statut** : ✅ FONCTIONNALITÉ D'IMPORT COMPLÈTE


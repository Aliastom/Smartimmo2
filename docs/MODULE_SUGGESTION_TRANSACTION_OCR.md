# 🤖 Module de Suggestion de Transaction depuis OCR

Guide complet d'installation, configuration et utilisation du module d'analyse automatique de documents pour créer des transactions dans SmartImmo.

---

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture](#architecture)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Utilisation](#utilisation)
6. [Tests](#tests)
7. [Dépannage](#dépannage)

---

## Vue d'ensemble

Ce module permet d'automatiser la création de transactions depuis des documents uploadés (relevés de compte, quittances, factures, etc.) en utilisant :

- **OCR** : Extraction du texte via `pdf-parse` et Tesseract.js
- **Classification** : Reconnaissance automatique du type de document
- **Extraction intelligente** : Parsing des champs métier via regex configurables
- **Suggestion IA** : Pré-remplissage automatique de la modale de transaction

---

## Architecture

### Flux de traitement

```
┌──────────────┐
│ 1. Upload    │
│   Document   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 2. OCR       │
│  /api/ocr    │ ← Extraction du texte (pdf-parse / Tesseract)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 3. Classif.  │
│  Classification│ ← Reconnaissance du type de document
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 4. Extraction│
│  TransactionSuggestionService │ ← Extraction des champs métier
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 5. Suggestion│
│  TransactionModalV2 │ ← Ouverture de la modale pré-remplie
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 6. Validation│
│  Utilisateur │ ← Vérification et ajustement
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 7. Création  │
│  Transaction │
└──────────────┘
```

### Composants

| Fichier | Rôle |
|---------|------|
| `TransactionSuggestionService.ts` | Service d'extraction des champs métier |
| `UploadReviewModal.tsx` | Modale d'upload avec appel au service |
| `TransactionModalV2.tsx` | Modale de transaction avec pré-remplissage |
| `DocumentType` (table) | Configuration avancée par type de document |

---

## Installation

### 1. Fichiers créés

Le module a créé les fichiers suivants :

```
src/
├── services/
│   └── TransactionSuggestionService.ts (NOUVEAU)
├── components/
│   ├── documents/
│   │   └── UploadReviewModal.tsx (MODIFIÉ)
│   └── transactions/
│       └── TransactionModalV2.tsx (MODIFIÉ)
docs/
├── CONFIGURATION_AVANCEE_DOCUMENT_TYPE.md (NOUVEAU)
└── MODULE_SUGGESTION_TRANSACTION_OCR.md (NOUVEAU)
```

### 2. Dépendances

Aucune nouvelle dépendance requise. Le module utilise :
- Prisma (déjà installé)
- React (déjà installé)
- Services existants (OCR, Classification)

### 3. Migration de base de données

**Aucune migration nécessaire.** Le module utilise les colonnes JSON existantes de `DocumentType` :
- `defaultContexts`
- `suggestionsConfig`
- `flowLocks`
- `metaSchema`

---

## Configuration

### Étape 1 : Configurer un type de document

Choisissez un type de document à configurer (ex: `RELEVE_COMPTE_PROP`).

#### Option A : Via SQL

```sql
UPDATE "DocumentType"
SET 
  "suggestionsConfig" = '{
    "regex": {
      "periode": "(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) ?(20\\d{2})",
      "montant": "([0-9]+[\\.,][0-9]{2}) ?€",
      "bien": "(Appartement|Maison|Studio) ?([A-Z0-9]+)?"
    },
    "libelleTemplate": "Loyer {periode} - {bien}"
  }'::jsonb,
  
  "defaultContexts" = '{
    "natureCategorieMap": {
      "RECETTE_LOYER": "Loyer + Charges"
    }
  }'::jsonb,
  
  "metaSchema" = '{
    "confidenceThreshold": 0.5,
    "version": "v1.0"
  }'::jsonb

WHERE "code" = 'RELEVE_COMPTE_PROP';
```

#### Option B : Via l'interface Admin (future)

Une interface d'administration sera disponible pour configurer visuellement ces champs.

### Étape 2 : Vérifier la configuration

```sql
SELECT 
  "code",
  "label",
  "suggestionsConfig",
  "defaultContexts",
  "metaSchema"
FROM "DocumentType"
WHERE "suggestionsConfig" IS NOT NULL;
```

---

## Utilisation

### Workflow utilisateur

1. **Accéder à la page Documents** (`/documents`)

2. **Uploader un document**
   - Cliquer sur "Uploader des documents"
   - Sélectionner un fichier (PDF ou image)
   - Le système lance automatiquement :
     - Extraction OCR
     - Classification du type

3. **Vérifier le type détecté**
   - La modale `UploadReviewModal` s'ouvre
   - Le type de document est suggéré automatiquement
   - Vous pouvez le modifier si nécessaire

4. **Confirmer le document**
   - Cliquer sur "Confirmer"
   - Si le type a une configuration avancée :
     - Le service `TransactionSuggestionService` s'exécute
     - Les champs sont extraits du texte OCR
     - Si confiance > 0.5 → la modale de transaction s'ouvre automatiquement

5. **Vérifier la suggestion**
   - La modale `TransactionModalV2` s'ouvre pré-remplie
   - Titre : "💡 Nouvelle transaction (suggérée par IA)"
   - Champs pré-remplis :
     - Montant
     - Date/Période
     - Bien (si reconnu)
     - Nature (si détectée)
     - Catégorie (selon mapping)
     - Libellé (généré par template)

6. **Ajuster et valider**
   - Vérifier/corriger les champs
   - Ajouter les informations manquantes
   - Cliquer sur "Créer la transaction"

---

## Tests

### Test 1 : Document avec configuration complète

**Pré-requis** : Configurer le type `RELEVE_COMPTE_PROP` (voir Configuration).

**Fichier de test** : Créer un PDF avec le contenu suivant :

```
RELEVÉ DE COMPTE PROPRIÉTAIRE
Période : Janvier 2024
Bien : Appartement T3 - Lot A12

Loyer perçu : 850,00 €
Charges récupérables : 75,00 €
Total : 925,00 €

Référence : REF-2024-001
```

**Procédure** :
1. Uploader le document
2. Vérifier que le type `RELEVE_COMPTE_PROP` est bien détecté
3. Cliquer sur "Confirmer"
4. ✅ La modale de transaction devrait s'ouvrir avec :
   - Montant : 925,00
   - Période : Janvier 2024
   - Libellé : "Loyer Janvier 2024 - Appartement T3"
   - Nature : RECETTE_LOYER

**Résultat attendu** : Modale ouverte avec au moins 3 champs pré-remplis.

---

### Test 2 : Document sans configuration

**Fichier de test** : Uploader une facture EDF ou tout document non configuré.

**Procédure** :
1. Uploader le document
2. Sélectionner un type sans `suggestionsConfig` (ex: `AUTRE`)
3. Cliquer sur "Confirmer"
4. ✅ Le document est enregistré normalement
5. ❌ Aucune modale de transaction ne s'ouvre

**Résultat attendu** : Pas de suggestion (comportement normal).

---

### Test 3 : Document avec confiance faible

**Fichier de test** : PDF avec texte peu structuré ou illisible.

**Procédure** :
1. Uploader le document
2. Vérifier les logs console :
   ```
   [TransactionSuggestion] Extraction terminée: { confidence: 0.3, fields: [...] }
   [UploadReview] ⚠️ Confiance insuffisante: 0.3
   ```
3. ✅ Pas d'ouverture de modale (seuil : 0.5)

**Résultat attendu** : Document enregistré, pas de suggestion.

---

### Test 4 : Vérification des logs

Ouvrir la console du navigateur et chercher :

```javascript
// Logs d'extraction
[TransactionSuggestion] Analyse du document: doc_xxx
[TransactionSuggestion] Texte disponible: 1234 caractères
[TransactionSuggestion] Extraction terminée: { confidence: 0.82, fields: 5 }

// Logs de suggestion
[UploadReview] ✨ Suggestion générée avec confiance: 0.82
[UploadReview] 📋 Champs suggérés: { amount: 925, period: "01", ... }

// Logs de pré-remplissage
[TransactionModal] 🤖 Application du pré-remplissage OCR: {...}
[TransactionModal] ✅ Pré-remplissage OCR appliqué avec confiance: 0.82
```

---

## Dépannage

### Problème 1 : La modale ne s'ouvre pas

**Symptômes** : Le document est enregistré mais la modale de transaction ne s'ouvre pas.

**Diagnostic** :
1. Vérifier la console : chercher `[TransactionSuggestion]`
2. Vérifier la configuration du type de document :
   ```sql
   SELECT "suggestionsConfig" 
   FROM "DocumentType" 
   WHERE "code" = 'VOTRE_TYPE';
   ```

**Solutions** :
- Si `suggestionsConfig` est `NULL` → Configurer le type (voir Configuration)
- Si confiance < 0.5 → Ajuster les regex pour améliorer l'extraction
- Si erreur dans les logs → Vérifier la syntaxe JSON de la configuration

---

### Problème 2 : Champs mal extraits

**Symptômes** : La modale s'ouvre mais les champs sont vides ou incorrects.

**Diagnostic** :
1. Vérifier le texte OCR extrait :
   ```javascript
   // Dans la console
   console.log(document.extractedText);
   ```
2. Tester les regex sur https://regex101.com/

**Solutions** :
- Ajuster les regex dans `suggestionsConfig`
- Exemples de regex robustes :
  ```json
  {
    "montant": "([0-9]{1,}[\\., ]?[0-9]{0,3}[\\.,][0-9]{2}) ?€?",
    "periode": "([0-9]{2}/[0-9]{4}|[a-zéû]+ [0-9]{4})",
    "date": "([0-9]{1,2}[/\\-][0-9]{1,2}[/\\-][0-9]{4})"
  }
  ```

---

### Problème 3 : Erreur lors de l'extraction

**Symptômes** : Console affiche `[TransactionSuggestion] ❌ Erreur lors de l'extraction`.

**Solutions** :
1. Vérifier que le document a un texte extrait :
   ```sql
   SELECT "id", "extractedText" 
   FROM "Document" 
   WHERE "id" = 'DOC_ID';
   ```
2. Vérifier la syntaxe JSON de la configuration
3. Vérifier que Prisma est bien configuré

---

### Problème 4 : Types de documents non détectés

**Symptômes** : Tous les documents sont classés comme "Non classé".

**Solutions** :
1. Vérifier les mots-clés du type de document :
   ```sql
   SELECT * FROM "DocumentKeyword" 
   WHERE "documentTypeId" = 'TYPE_ID';
   ```
2. Ajouter des mots-clés pertinents
3. Vérifier que le service de classification fonctionne

---

## API Reference

### TransactionSuggestionService

```typescript
interface TransactionSuggestionPayload {
  confidence: number;
  suggestions: {
    propertyId?: string;
    leaseId?: string;
    nature?: string;
    categoryId?: string;
    amount?: number;
    date?: string;
    periodMonth?: string;
    periodYear?: number;
    label?: string;
    reference?: string;
    notes?: string;
  };
  meta: {
    documentId: string;
    documentTypeCode: string;
    extractionVersion: string;
    fieldsConfidence: Record<string, number>;
    highlights?: HighlightZone[];
    rawExtractedData?: Record<string, any>;
  };
  locks?: {
    field: string;
    reason: string;
  }[];
}

// Utilisation
const suggestion = await transactionSuggestionService.fromDocument(documentId);
```

### Props TransactionModalV2

```typescript
interface TransactionModalProps {
  // ... props existantes
  
  // Nouveau : pré-remplissage depuis suggestion OCR
  prefill?: {
    propertyId?: string;
    leaseId?: string;
    nature?: string;
    categoryId?: string;
    amount?: number;
    date?: string;
    periodMonth?: string;
    periodYear?: number;
    label?: string;
    reference?: string;
    notes?: string;
  };
  
  // Métadonnées de suggestion
  suggestionMeta?: {
    documentId?: string;
    confidence?: number;
    highlightedFields?: string[];
  };
}
```

---

## Métriques et Monitoring

### Logs à surveiller

```javascript
// Taux de suggestion
[UploadReview] ✨ Suggestion générée → Succès
[UploadReview] ⚠️ Confiance insuffisante → Échec (normal si < 0.5)

// Qualité d'extraction
[TransactionSuggestion] Extraction terminée: { confidence: X, fields: Y }
// Objectif : confidence > 0.7, fields > 3
```

### KPIs recommandés

- **Taux de suggestion** : % de documents générant une suggestion
- **Confiance moyenne** : Moyenne des scores de confiance
- **Taux de validation** : % de suggestions validées sans modification
- **Temps d'extraction** : Temps moyen du service

---

## Prochaines Améliorations

### Court terme
- [ ] Interface admin pour configuration visuelle des regex
- [ ] Test d'extraction en temps réel sur documents exemples
- [ ] Historique des suggestions pour apprentissage

### Moyen terme
- [ ] Extraction multi-transactions depuis un seul document
- [ ] Suggestions de corrections basées sur l'historique
- [ ] Intégration avec services OCR cloud (AWS Textract)

### Long terme
- [ ] Modèles NLP pour extraction sémantique
- [ ] Auto-amélioration des regex depuis corrections utilisateur
- [ ] Validation croisée entre champs extraits

---

## Support

Pour toute question ou problème :
1. Consulter les logs console
2. Vérifier la configuration du type de document
3. Consulter la documentation : [CONFIGURATION_AVANCEE_DOCUMENT_TYPE.md](./CONFIGURATION_AVANCEE_DOCUMENT_TYPE.md)

---

**Version** : 1.0  
**Dernière mise à jour** : Novembre 2024  
**Auteur** : SmartImmo AI Team


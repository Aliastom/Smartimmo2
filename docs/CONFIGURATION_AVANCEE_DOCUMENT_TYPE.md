# Configuration Avancée des Types de Documents

Ce document explique comment configurer les champs JSON de la table `DocumentType` pour activer l'extraction automatique et la suggestion de transactions depuis les documents OCR.

## 📋 Structure des Champs JSON

La table `DocumentType` contient 4 colonnes JSON pour la configuration avancée :

1. **`defaultContexts`** : Mapping des natures/catégories et seuils d'auto-création
2. **`suggestionsConfig`** : Regex d'extraction et templates de génération
3. **`flowLocks`** : Règles de verrouillage conditionnel des champs
4. **`metaSchema`** : Métadonnées sur la structure d'extraction

---

## 1️⃣ `defaultContexts` - Mapping Nature/Catégorie

Configure le comportement automatique pour mapper les données extraites vers les entités de l'application.

### Structure

```json
{
  "autoCreateAboveConfidence": 0.9,
  "natureCategorieMap": {
    "RECETTE_LOYER": "Loyer + Charges",
    "DEPENSE_GESTION": "Commission agence",
    "DEPENSE_ASSURANCE": "Assurance PNO",
    "DEPENSE_TAXE": "Taxe foncière"
  },
  "codeSystemMap": {
    "LOYER": "NATURE_LOYER",
    "COMMISSION": "NATURE_COMMISSION",
    "ASSURANCE": "NATURE_ASSURANCE"
  }
}
```

### Champs

- **`autoCreateAboveConfidence`** (optionnel) : Seuil de confiance (0-1) au-dessus duquel la transaction peut être créée automatiquement sans validation manuelle
- **`natureCategorieMap`** : Mapping des codes nature vers les libellés de catégories comptables
- **`codeSystemMap`** : Mapping des mots-clés métier vers les codes système de natures

---

## 2️⃣ `suggestionsConfig` - Extraction et Templates

Configure les regex pour extraire les champs métier depuis le texte OCR et les templates pour générer les libellés.

### Structure

```json
{
  "regex": {
    "periode": "(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|\\d{2}/\\d{4})",
    "montant": "([0-9]+[\\.,][0-9]{2}) ?€",
    "bien": "(Maison|Appartement|Garage|Lot) ?([A-Za-z0-9\\-]+)",
    "reference": "Réf[\\.:] ?([A-Z0-9\\-]+)",
    "date": "(\\d{1,2}[/\\-]\\d{1,2}[/\\-]\\d{4})"
  },
  "libelleTemplate": "Loyer {periode} - {bien}",
  "extractors": {
    "montant": {
      "type": "regex",
      "pattern": "([0-9]+[\\.,][0-9]{2}) ?€",
      "transform": "float"
    },
    "periode": {
      "type": "regex",
      "pattern": "(\\d{2}/\\d{4})",
      "transform": "period"
    }
  }
}
```

### Champs

- **`regex`** : Dictionnaire de patterns regex pour extraire les champs métier
  - `periode` : Mois/année (format texte ou numérique)
  - `montant` : Montant avec devise
  - `bien` : Identification du bien immobilier
  - `reference` : Référence du document
  - `date` : Date au format JJ/MM/AAAA
  
- **`libelleTemplate`** : Template pour générer le libellé de la transaction
  - Utilise les placeholders `{nomChamp}` qui seront remplacés par les valeurs extraites
  
- **`extractors`** (optionnel) : Configuration avancée des extracteurs avec transformations

---

## 3️⃣ `flowLocks` - Verrouillage Conditionnel

Configure les règles de verrouillage des champs selon certaines conditions.

### Structure

```json
[
  {
    "if": "bien.gestion == true && nature == 'Commission'",
    "lock": ["categoryId", "amount"],
    "reason": "Commission verrouillée pour bien en gestion déléguée"
  },
  {
    "if": "!codeSystemMap[nature]",
    "lock": ["submit"],
    "reason": "Nature non conforme au code système"
  },
  {
    "if": "confidence < 0.7",
    "lock": [],
    "reason": "Confiance insuffisante - Vérification manuelle requise"
  }
]
```

### Champs

- **`if`** : Condition d'activation du verrouillage (expression JavaScript simplifiée)
- **`lock`** : Liste des champs à verrouiller (`["categoryId", "amount", "nature", "submit"]`)
- **`reason`** : Message explicatif affiché à l'utilisateur

⚠️ **Note** : L'évaluation des conditions est simplifiée dans la version actuelle. Une implémentation complète nécessiterait un parser de conditions sécurisé.

---

## 4️⃣ `metaSchema` - Métadonnées d'Extraction

Configure les métadonnées sur le processus d'extraction.

### Structure

```json
{
  "fields": ["periode", "montant", "bien", "nature", "categorie", "reference"],
  "confidenceThreshold": 0.5,
  "version": "v1.0",
  "requiredFields": ["montant", "periode"],
  "optionalFields": ["reference", "notes"]
}
```

### Champs

- **`fields`** : Liste des champs extraits par le service
- **`confidenceThreshold`** : Seuil minimal de confiance pour afficher une suggestion (0-1)
- **`version`** : Version du schéma d'extraction
- **`requiredFields`** (optionnel) : Champs obligatoires pour valider l'extraction
- **`optionalFields`** (optionnel) : Champs optionnels

---

## 📝 Exemples Complets par Type de Document

### Exemple 1 : Relevé de Compte Propriétaire

```sql
UPDATE "DocumentType"
SET 
  "defaultContexts" = '{
    "autoCreateAboveConfidence": 0.85,
    "natureCategorieMap": {
      "RECETTE_LOYER": "Loyer + Charges",
      "DEPENSE_GESTION": "Commission agence"
    }
  }'::jsonb,
  
  "suggestionsConfig" = '{
    "regex": {
      "periode": "(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|Jan|Fév|Mar|Avr|Mai|Juin|Juil|Août|Sep|Oct|Nov|Déc) ?(20\\d{2})",
      "montant": "([0-9]{1,}[\\., ]?[0-9]{3}[\\.,][0-9]{2}) ?€?",
      "bien": "(Appartement|Maison|Studio|T[0-9]|F[0-9]|Lot) ?([A-Z0-9\\-]+)?",
      "reference": "Réf[érence\\.:]* ?([A-Z0-9\\-]{4,})"
    },
    "libelleTemplate": "Loyer {periode} - {bien}"
  }'::jsonb,
  
  "flowLocks" = '[
    {
      "if": "nature == ''DEPENSE_GESTION''",
      "lock": ["categoryId"],
      "reason": "Catégorie automatique pour commissions"
    }
  ]'::jsonb,
  
  "metaSchema" = '{
    "fields": ["periode", "montant", "bien", "reference"],
    "confidenceThreshold": 0.6,
    "version": "v1.0",
    "requiredFields": ["montant", "periode"]
  }'::jsonb

WHERE "code" = 'RELEVE_COMPTE_PROP';
```

### Exemple 2 : Quittance de Loyer

```sql
UPDATE "DocumentType"
SET 
  "defaultContexts" = '{
    "natureCategorieMap": {
      "RECETTE_LOYER": "Loyer + Charges"
    }
  }'::jsonb,
  
  "suggestionsConfig" = '{
    "regex": {
      "periode": "Période[\\s:]*([0-9]{2}/[0-9]{4}|[a-zéû]+ [0-9]{4})",
      "montant": "Montant[\\s:]*([0-9]+[\\.,][0-9]{2})",
      "bien": "Bien[\\s:]*([^\\n]+)",
      "locataire": "Locataire[\\s:]*([^\\n]+)"
    },
    "libelleTemplate": "Quittance {periode}"
  }'::jsonb,
  
  "metaSchema" = '{
    "fields": ["periode", "montant", "bien", "locataire"],
    "confidenceThreshold": 0.7,
    "version": "v1.0"
  }'::jsonb

WHERE "code" = 'QUITTANCE_LOYER';
```

### Exemple 3 : Facture Travaux

```sql
UPDATE "DocumentType"
SET 
  "defaultContexts" = '{
    "natureCategorieMap": {
      "DEPENSE_ENTRETIEN": "Travaux et réparations",
      "DEPENSE_AMELIORATION": "Travaux d'amélioration"
    }
  }'::jsonb,
  
  "suggestionsConfig" = '{
    "regex": {
      "date": "Date[\\s:]*([0-9]{1,2}[/\\-][0-9]{1,2}[/\\-][0-9]{4})",
      "montant": "Total TTC[\\s:]*([0-9]+[\\.,][0-9]{2})",
      "reference": "Facture n°[\\s:]*([A-Z0-9\\-]+)",
      "prestataire": "SIRET[\\s:]*[0-9]+ ?([^\\n]+)"
    },
    "libelleTemplate": "Travaux {prestataire} - Facture {reference}"
  }'::jsonb,
  
  "metaSchema" = '{
    "fields": ["date", "montant", "reference", "prestataire"],
    "confidenceThreshold": 0.5,
    "version": "v1.0"
  }'::jsonb

WHERE "code" = 'FACTURE_TRAVAUX';
```

---

## 🔧 Modification via Interface Admin

Une interface d'administration pourra être développée pour modifier ces configurations via un formulaire visuel :

1. **Éditeur de Regex** avec validation et test en temps réel
2. **Template Builder** avec prévisualisation
3. **Flow Lock Editor** avec conditions pré-définies
4. **Test d'extraction** sur des documents exemples

---

## ⚙️ Workflow d'Utilisation

1. **Upload du document** → OCR automatique via `/api/ocr`
2. **Classification** → Reconnaissance du type via mots-clés
3. **Extraction** → `TransactionSuggestionService.fromDocument(documentId)`
4. **Suggestion** → Si confiance > `confidenceThreshold`, ouverture de `TransactionModalV2`
5. **Validation** → L'utilisateur vérifie/corrige et valide
6. **Création** → Transaction créée avec liaison au document

---

## 📊 Calcul de la Confiance

La confiance globale est calculée par moyenne pondérée des champs extraits :

```typescript
Poids des champs :
- amount: 1.5 (très important)
- date: 1.3
- propertyId: 1.2
- nature: 1.0
- categoryId: 1.0
- period: 0.8
- label: 0.5 (moins important)

Confidence globale = Σ(confiance_champ × poids_champ) / Σ(poids_champs)
```

Un document avec :
- Montant extrait : 0.9 × 1.5 = 1.35
- Date extraite : 0.8 × 1.3 = 1.04
- Période extraite : 0.7 × 0.8 = 0.56

**Confiance globale** = (1.35 + 1.04 + 0.56) / (1.5 + 1.3 + 0.8) = **2.95 / 3.6 = 0.82** ✅

---

## 🚀 Prochaines Évolutions

1. **Extracteurs ML** : Utiliser des modèles NLP pour extraction sémantique
2. **Apprentissage** : Améliorer les regex depuis les corrections utilisateur
3. **Validation croisée** : Vérifier la cohérence entre champs extraits
4. **Multi-documents** : Extraire plusieurs transactions depuis un seul document
5. **OCR amélioré** : Utiliser des services cloud (AWS Textract, Google Vision)

---

## 📚 Références

- [TransactionSuggestionService.ts](../src/services/TransactionSuggestionService.ts)
- [UploadReviewModal.tsx](../src/components/documents/UploadReviewModal.tsx)
- [TransactionModalV2.tsx](../src/components/transactions/TransactionModalV2.tsx)
- [Schema Prisma](../prisma/schema.prisma)


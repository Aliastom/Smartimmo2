# Classification Automatique des Documents

## Vue d'ensemble

Système de classification automatique des documents immobiliers utilisant l'analyse du nom de fichier, du type MIME, du contexte d'upload et du contenu OCR (optionnel) pour suggérer automatiquement le type de document approprié.

## Fonctionnalités

### 🎯 Classification Intelligente

Le système analyse plusieurs indices pour déterminer le type de document :

1. **Nom de fichier** - Mots-clés dans le nom
2. **Type MIME** - Format du fichier
3. **Contexte d'upload** - Entité associée (propriété, bail, locataire, prêt)
4. **Contenu OCR** - Texte extrait du document (optionnel)

### 📋 Types de Documents Supportés

| Code | Label | Indices de Reconnaissance |
|------|-------|---------------------------|
| `RENT_RECEIPT` | Quittance de loyer | "quittance", "loyer", "mois de" |
| `SIGNED_LEASE` | Bail signé | "bail signé", "contrat de location", "loi 89", "signature" |
| `LEASE_DRAFT` | Brouillon de bail | "brouillon", "modèle", "draft", "template" |
| `EDL_IN` | État des lieux d'entrée | "état des lieux", "entrée", "compteurs", "inventaire" |
| `EDL_OUT` | État des lieux de sortie | "sortie", "exit", "rendu" |
| `RIB` | Relevé d'identité bancaire | "RIB", "IBAN", "BIC", "relevé", "virement" |
| `INSURANCE` | Assurance | "assurance", "attestation", "police", "garantie" |
| `TAX` | Fiscalité | "avis d'imposition", "taxe foncière", "impôt", "IFU" |
| `PHOTO` | Photo | MIME `image/*`, "photo", "image", extensions image |
| `MISC` | Divers | Aucun indice spécifique (par défaut) |

## API

### POST `/api/documents/classify`

Classifie un document et retourne le type suggéré avec un score de confiance.

**Request Body:**
```json
{
  "context": "from=upload; entities=lease,property",
  "filename": "quittance_octobre_2025.pdf",
  "mime": "application/pdf",
  "ocr_excerpt": "Quittance de loyer - Mois d'octobre 2025"
}
```

**Response:**
```json
{
  "type_code": "RENT_RECEIPT",
  "confidence": 0.9,
  "alternatives": [
    {"type_code": "SIGNED_LEASE", "confidence": 0.18},
    {"type_code": "TAX", "confidence": 0.07}
  ],
  "evidence": [
    "\"quittance\"",
    "\"loyer\"",
    "\"mois\"",
    "contexte=loyer"
  ]
}
```

## Interface Utilisateur

### Modal d'Upload Améliorée

Lors de la sélection d'un fichier, le système :

1. **🔍 Analyse automatique** - Classification en temps réel
2. **💡 Suggestion intelligente** - Type suggéré si confiance ≥ 70%
3. **📊 Affichage détaillé** - Confiance, indices, alternatives
4. **⚡ Auto-sélection** - Type pré-rempli automatiquement

### Indicateurs Visuels

- **🔄 Chargement** - Spinner pendant la classification
- **💡 Suggestion** - Encadré bleu avec détails
- **📈 Confiance** - Pourcentage de fiabilité
- **🔍 Indices** - Mots-clés détectés
- **🔄 Alternatives** - Autres types possibles

## Tests de Validation

### ✅ Tests API Réussis

1. **Quittance** - `quittance_octobre_2025.pdf` → `RENT_RECEIPT` (90%)
2. **Bail signé** - `bail_signe_contrat.pdf` → `SIGNED_LEASE` (85%)
3. **État des lieux** - `etat_des_lieux_entree.pdf` → `EDL_IN` (85%)
4. **RIB** - `rib_bancaire.pdf` → `RIB` (90%)
5. **Photo** - `photo_appartement.jpg` → `PHOTO` (80%)
6. **Document ambigu** - `document.pdf` → `MISC` (30%)

### 🎯 Logique de Classification

```typescript
// Exemple de logique de classification
if (text.includes('quittance') || text.includes('loyer')) {
  type_code = 'RENT_RECEIPT';
  confidence = 0.9;
  evidence.push('"quittance"', '"loyer"');
}
```

## Intégration

### Hook React Query

```typescript
const classifyDocument = useClassifyDocument();

const result = await classifyDocument.mutateAsync({
  context: "from=upload; entities=lease",
  filename: file.name,
  mime: file.type,
  ocr_excerpt: extractedText
});
```

### Auto-sélection Intelligente

- **Confiance ≥ 70%** → Auto-sélection + toast de confirmation
- **Confiance < 70%** → Suggestion affichée, sélection manuelle
- **Erreur** → Fallback silencieux vers MISC

## Avantages

### 🚀 Expérience Utilisateur

- **Gain de temps** - Plus besoin de chercher le type manuellement
- **Réduction d'erreurs** - Suggestions basées sur l'analyse
- **Transparence** - Affichage des indices et alternatives
- **Flexibilité** - Possibilité de corriger la suggestion

### 🎯 Précision

- **Multi-critères** - Analyse combinée de plusieurs indices
- **Contexte** - Prise en compte de l'entité associée
- **Confiance** - Score de fiabilité pour chaque suggestion
- **Alternatives** - Propositions de types secondaires

## Évolutions Futures

### 🔮 Améliorations Possibles

1. **OCR avancé** - Intégration d'un service OCR pour l'analyse du contenu
2. **Machine Learning** - Apprentissage à partir des corrections utilisateur
3. **Historique** - Mémorisation des choix pour améliorer les suggestions
4. **Règles métier** - Configuration de règles spécifiques par utilisateur
5. **Support multilingue** - Reconnaissance en anglais, espagnol, etc.

### 📊 Métriques

- **Taux de succès** - Pourcentage de suggestions acceptées
- **Temps de classification** - Performance de l'analyse
- **Types les plus fréquents** - Statistiques d'usage
- **Erreurs courantes** - Amélioration continue

## Utilisation

### Pour les Utilisateurs

1. **Sélectionner un fichier** dans la modal d'upload
2. **Observer la classification** automatique en temps réel
3. **Vérifier la suggestion** et la confiance
4. **Corriger si nécessaire** en sélectionnant un autre type
5. **Confirmer l'upload** avec le type choisi

### Pour les Développeurs

1. **Endpoint API** - `/api/documents/classify` pour intégration
2. **Hook React** - `useClassifyDocument()` pour l'interface
3. **Types TypeScript** - `DocumentClassification` interface
4. **Validation Zod** - Schémas de validation des entrées

## Conclusion

Le système de classification automatique améliore significativement l'expérience utilisateur en réduisant le temps de saisie et les erreurs de typage. Il s'intègre parfaitement dans le workflow existant tout en restant transparent et non-intrusif.

**🎯 Résultat : Upload de documents plus rapide, plus précis et plus intuitif !**

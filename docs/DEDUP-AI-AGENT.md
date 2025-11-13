# DedupAI - Agent d'Évaluation des Doublons

## 🎯 Mission

**DedupAI** est un agent spécialisé qui évalue si un fichier nouvellement uploadé est un doublon d'un document déjà présent dans la base de données.

---

## 🔍 Objectifs

1. **Déterminer le statut de doublon** selon des critères précis
2. **Identifier le meilleur match** parmi les candidats existants
3. **Calculer des signaux explicables** pour la prise de décision
4. **Proposer une action par défaut** (suggestedAction)
5. **Fournir des chaînes prêtes pour l'UI** (titre, sous-titre, badges)

---

## 📊 Types de Doublon

### **exact_duplicate**
- **Checksum identique** OU
- **Taille ~1% et texte OCR 100%/quasi identique** et même nombre de pages

### **near_duplicate**
- **Texte très proche** (similarité ≥ 0.95) et même période/contexte
- **Même nature de document**
- **Checksum différent**

### **potential_duplicate**
- **Similarité 0.75–0.95** OU
- **Mêmes périodes + mêmes acteurs** mais incertitude
- **Qualité OCR faible, tailles/pagination différentes**

### **none**
- **Rien de pertinent** trouvé

---

## 🎯 Actions Par Défaut

| Type de Doublon | Action Suggérée | Raison |
|-----------------|-----------------|---------|
| `exact_duplicate` | `cancel` | Ne pas garder deux fois le même fichier |
| `near_duplicate` | `replace` ou `cancel` | Selon la qualité (OCR ou résolution) |
| `potential_duplicate` | `ask_user` | Laisser l'utilisateur choisir |
| `none` | `proceed` | Continuer le flux normal |

---

## 📈 Signaux Calculés

### **Signaux de Base**
- `checksum_match`: boolean
- `text_similarity`: float [0..1] (cosine similarity)
- `pages_new` / `pages_existing`: int
- `size_kb_new` / `size_kb_existing`: int
- `ocr_quality_new` / `ocr_quality_existing`: float [0..1]

### **Signaux Contextuels**
- `period_match`: boolean (même mois/année, même exercice fiscal)
- `context_match`: boolean (même locataire/bien/émetteur)
- `filename_hint`: boolean (noms très proches hors suffixes)

---

## 🏆 Règles d'Arbitrage Qualité

### **Pour "replace"**
1. **Préfère le fichier avec `ocr_quality` le plus élevé**
2. **À `ocr_quality` égal ±0.03**, préfère le plus léger si tailles très proches (<5%)
3. **Si pages différentes** pour un document censé être 1 page → basculer en `ask_user`

---

## 📋 Format de Sortie

```json
{
  "duplicateType": "exact_duplicate" | "near_duplicate" | "potential_duplicate" | "none",
  "suggestedAction": "cancel" | "replace" | "keep_both" | "ask_user" | "proceed",
  "matchedDocument": {
    "id": "string | null",
    "name": "string | null", 
    "uploadedAt": "YYYY-MM-DDTHH:mm:ssZ | null",
    "type": "string | null"
  },
  "signals": {
    "checksum_match": true/false,
    "text_similarity": 0.0,
    "pages_new": 1,
    "pages_existing": 1,
    "size_kb_new": 0,
    "size_kb_existing": 0,
    "ocr_quality_new": 0.0,
    "ocr_quality_existing": 0.0,
    "period_match": true/false,
    "context_match": true/false,
    "filename_hint": true/false
  },
  "ui": {
    "title": "string (ex: 'Doublon exact détecté')",
    "subtitle": "string courte expliquant le match",
    "badges": [
      "Checksum identique: Oui/Non",
      "Similarité textuelle: {pct}%",
      "Pages: {pages_new} vs {pages_existing}",
      "Période: Oui/Non",
      "Contexte: Oui/Non"
    ],
    "recommendation": "string (ex: 'Ce fichier est identique au fichier existant.')"
  }
}
```

---

## 🔄 Procédure d'Analyse

### **1. Normalisation des Textes**
- Lowercase, trim espaces
- Suppression en-têtes/pieds récurrents
- Nettoyage de la ponctuation

### **2. Calcul de Similarité**
- **Cosine similarity** entre textes normalisés
- **Score [0..1]** avec seuils définis

### **3. Détermination du Type**
- **Exact** : checksum_match=true OU (pages égales ET text_similarity ≥ 0.995)
- **Near** : text_similarity ≥ 0.95
- **Potential** : 0.75 ≤ text_similarity < 0.95 OU (period_match && context_match)
- **None** : sinon

### **4. Choix de l'Action**
- Selon le type et les règles d'arbitrage qualité

### **5. Génération UI**
- Titre, sous-titre, badges, recommandation en français

---

## 🧪 Exemples d'Usage

### **Doublon Exact**
```typescript
const result = dedupAI.analyze(tempFile, candidates);
// → duplicateType: "exact_duplicate"
// → suggestedAction: "cancel"
// → checksum_match: true
```

### **Doublon Probable**
```typescript
const result = dedupAI.analyze(tempFile, candidates);
// → duplicateType: "near_duplicate" 
// → suggestedAction: "replace" (si meilleure qualité)
// → text_similarity: 0.97
```

### **Doublon Potentiel**
```typescript
const result = dedupAI.analyze(tempFile, candidates);
// → duplicateType: "potential_duplicate"
// → suggestedAction: "ask_user"
// → period_match: true, context_match: true
```

---

## 🔌 API Endpoint

### **POST /api/documents/dedup-ai**

**Body:**
```json
{
  "tempFile": {
    "id": "temp-123",
    "name": "document.pdf",
    "bytes": 1024000,
    "size_kb": 1000,
    "pages": 1,
    "ocr_text": "Contenu du document...",
    "ocr_quality": 0.9,
    "detected_type": "quittance",
    "period": "2024-01-01",
    "context": { "propertyId": "prop-123" },
    "checksum": "sha256:abc123"
  },
  "existingCandidates": [
    {
      "id": "doc-456",
      "name": "document.pdf",
      "uploadedAt": "2024-01-15T10:30:00Z",
      "size_kb": 1000,
      "pages": 1,
      "ocr_text": "Contenu du document...",
      "ocr_quality": 0.8,
      "type": "quittance",
      "period": "2024-01-01",
      "context": { "propertyId": "prop-123" },
      "checksum": "sha256:abc123"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "duplicateType": "exact_duplicate",
    "suggestedAction": "cancel",
    "matchedDocument": {
      "id": "doc-456",
      "name": "document.pdf",
      "uploadedAt": "2024-01-15T10:30:00Z",
      "type": "quittance"
    },
    "signals": { /* ... */ },
    "ui": { /* ... */ }
  }
}
```

---

## 🎨 Interface Utilisateur

### **Titres Générés**
- **"Doublon exact détecté"** pour exact_duplicate
- **"Doublon probable détecté"** pour near_duplicate  
- **"Doublon potentiel détecté"** pour potential_duplicate
- **"Aucun doublon détecté"** pour none

### **Badges Informatifs**
- **Checksum identique**: Oui/Non
- **Similarité textuelle**: {pct}%
- **Pages**: {pages_new} vs {pages_existing}
- **Période**: Oui/Non
- **Contexte**: Oui/Non

### **Recommandations**
- **Factuelles et concises** en français
- **Guidance claire** pour l'utilisateur
- **Explication du raisonnement** de l'agent

---

## 📁 Structure des Fichiers

```
src/
├── services/
│   └── dedup-ai.service.ts      # Service principal DedupAI
├── app/api/documents/dedup-ai/
│   └── route.ts                 # API endpoint
├── examples/
│   └── dedup-ai-usage.ts        # Exemples d'utilisation
└── tests/
    └── dedup-ai.test.ts         # Tests unitaires
```

---

## ✅ Statut

**AGENT OPÉRATIONNEL** - DedupAI est prêt à analyser les doublons avec une précision élevée et des signaux explicables pour une prise de décision éclairée.

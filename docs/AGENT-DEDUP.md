# Agent Dedup - Documentation Complète

## 📋 Vue d'ensemble

L'**Agent Dedup** est un service intelligent de détection et résolution des doublons de documents pour Smartimmo. Il analyse les fichiers uploadés, détecte les doublons exacts et probables, et fournit des recommandations d'action avec le contenu de la modale à afficher à l'utilisateur.

## 🎯 Objectifs

- **Détecter** les doublons exacts (même checksum SHA-256)
- **Identifier** les quasi-doublons (haute similarité textuelle ou même période)
- **Comparer** la qualité des fichiers (pages, qualité OCR, taille)
- **Suggérer** l'action appropriée (annuler, remplacer, conserver les deux)
- **Fournir** le contenu complet de la modale de confirmation

## 🏗️ Architecture

### Fichiers créés

```
src/
├── types/
│   └── dedup.ts                      # Types TypeScript pour l'agent
├── services/
│   ├── dedup-agent.service.ts        # Service principal de l'agent
│   └── text-similarity.service.ts    # Calcul de similarité textuelle
└── examples/
    └── dedup-agent-usage.ts          # Exemples d'utilisation

tests/
└── dedup-agent.test.ts               # Tests unitaires complets

docs/
└── AGENT-DEDUP.md                    # Cette documentation
```

## 📦 Types de données

### Entrée : `DedupInput`

```typescript
interface DedupInput {
  newFile: NewFileInput;
  candidates: CandidateDocument[];
}
```

#### `NewFileInput`
```typescript
{
  tempId: string;                    // ID temporaire du nouveau fichier
  name: string;                      // Nom du fichier
  mime: string;                      // Type MIME
  size: number;                      // Taille en octets
  pages: number;                     // Nombre de pages
  checksum: string;                  // SHA-256 du fichier
  ocr: {
    chars: number;                   // Nombre de caractères extraits
    quality: number;                 // Qualité OCR (0-1)
    text: string;                    // Texte complet extrait
  };
  extracted: {
    typePredictions: Array<{
      label: string;                 // Type de document prédit
      score: number;                 // Score de confiance (0-1)
    }>;
    period?: {
      from: string;                  // Date de début (ISO)
      to: string;                    // Date de fin (ISO)
    };
  };
  context: {
    propertyId?: string;             // ID du bien
    tenant?: string;                 // Nom du locataire
    leaseId?: string;                // ID du bail
    transactionId?: string;          // ID de la transaction
  };
}
```

#### `CandidateDocument`
```typescript
{
  id: string;                        // ID du document existant
  name: string;                      // Nom du fichier
  uploadedAt: string;                // Date d'upload (ISO)
  mime: string;                      // Type MIME
  size: number;                      // Taille en octets
  pages: number;                     // Nombre de pages
  checksum: string;                  // SHA-256 du fichier
  ocr: {
    quality: number;                 // Qualité OCR (0-1)
    textPreview: string;             // Aperçu du texte extrait
  };
  extracted: {
    type: string;                    // Type de document
    period?: {
      from: string;                  // Date de début (ISO)
      to: string;                    // Date de fin (ISO)
    };
  };
  context: {
    propertyId?: string;
    tenant?: string;
    leaseId?: string;
    transactionId?: string;
  };
  url: string;                       // URL de prévisualisation
}
```

### Sortie : `DedupOutput`

```typescript
{
  status: 'exact_duplicate' | 'probable_duplicate' | 'not_duplicate';
  
  matchedDocument?: {
    id: string;
    name: string;
    url: string;
  };
  
  signals: {
    checksumMatch: boolean;
    textSimilarity: number;          // 0-1
    samePeriod: boolean;
    sameContext: boolean;
    qualityComparison: 'new_better' | 'existing_better' | 'equal';
    differences: string[];           // Liste des différences lisibles
  };
  
  suggestedAction: 'cancel' | 'replace' | 'keep_both';
  
  modal: {
    level: 'danger' | 'warning' | 'info';
    title: string;
    message: string;
    primaryCta: {
      action: SuggestedAction;
      label: string;
    };
    secondaryCta: {
      action: SuggestedAction;
      label: string;
    };
    showComparison: boolean;
  };
  
  metadata?: {
    decisionReason: string;
    timestamp: string;
    processingTimeMs: number;
  };
}
```

## 🧠 Règles de décision

### 1. Doublon exact

**Condition :** `newFile.checksum === candidate.checksum`

**Résultat :**
- Status : `exact_duplicate`
- Action : `cancel` (aucune utilité de remplacer un fichier identique)
- Niveau : `danger`

### 2. Quasi-doublon

**Conditions :**
- Même type de document (prédiction ≥ 0.6) **ET**
- Période identique (dates égales) **OU**
- Similarité textuelle ≥ 0.9 (TF-IDF cosinus)

**Résultat :**
- Status : `probable_duplicate`
- Action : dépend de la qualité et du contexte
- Niveau : `warning`

#### Détermination de l'action pour quasi-doublon :

1. **Contextes différents** → `keep_both`
   - Propriétés différentes
   - Locataires différents
   - Baux différents

2. **Même contexte** → Comparer la qualité :
   - **Nouveau meilleur** → `replace`
   - **Existant meilleur** → `cancel`

### 3. Pas de doublon

**Condition :** Aucune des conditions ci-dessus

**Résultat :**
- Status : `not_duplicate`
- Action : `keep_both`
- Niveau : `info`

## 📊 Comparaison de qualité

Les fichiers sont comparés selon ces critères (par ordre de priorité) :

1. **Nombre de pages** (plus = meilleur)
2. **Qualité OCR** (0-1, plus élevé = meilleur)
3. **Taille du fichier** (plus grand = meilleure résolution)

## 🔬 Calcul de similarité textuelle

Le service utilise l'algorithme **TF-IDF avec similarité cosinus** :

1. **Normalisation** : lowercase, suppression ponctuation
2. **Tokenisation** : découpage en mots (> 2 caractères)
3. **Calcul TF** (Term Frequency) : fréquence de chaque terme
4. **Calcul IDF** (Inverse Document Frequency) : poids des termes
5. **Vecteurs TF-IDF** : construction des vecteurs
6. **Similarité cosinus** : mesure de l'angle entre les vecteurs

**Méthodes alternatives disponibles :**
- `jaccardSimilarity()` : Intersection / Union des mots uniques
- `levenshteinSimilarity()` : Distance d'édition normalisée

## 🚀 Utilisation

### Exemple basique

```typescript
import { getDedupAgent } from '@/services/dedup-agent.service';
import { DedupInput } from '@/types/dedup';

const input: DedupInput = {
  newFile: {
    tempId: 'tmp_123',
    name: 'quittance_juin_2025.pdf',
    mime: 'application/pdf',
    size: 328900,
    pages: 1,
    checksum: 'sha256:abc123...',
    ocr: {
      chars: 892,
      quality: 0.70,
      text: 'Quittance de loyer...',
    },
    extracted: {
      typePredictions: [{ label: 'Quittance de Loyer', score: 0.61 }],
      period: { from: '2025-05-05', to: '2025-06-05' },
    },
    context: { propertyId: 'prop_123', tenant: 'Jasmin' },
  },
  candidates: [
    // ... candidats potentiels
  ],
};

const agent = getDedupAgent();
const result = await agent.analyze(input);

console.log('Status:', result.status);
console.log('Action suggérée:', result.suggestedAction);
console.log('Modale:', result.modal);
```

### Configuration personnalisée

```typescript
import { getDedupAgent } from '@/services/dedup-agent.service';

const agent = getDedupAgent({
  textSimilarityThreshold: 0.85,    // Seuil de similarité (défaut: 0.9)
  typePredictionMinScore: 0.7,      // Score min pour validation (défaut: 0.6)
  enableDebugLogs: true,            // Activer les logs détaillés
  locale: 'fr',                     // Langue des messages ('fr' ou 'en')
});

const result = await agent.analyze(input);
```

### Intégration dans le workflow d'upload

```typescript
async function handleDocumentUpload(file: File, context: any) {
  // 1. Upload temporaire + OCR
  const tempDoc = await uploadTemporary(file);
  
  // 2. Chercher les candidats potentiels
  const candidates = await findPotentialDuplicates(tempDoc);
  
  // 3. Analyser avec l'agent Dedup
  const agent = getDedupAgent();
  const dedupResult = await agent.analyze({
    newFile: tempDoc,
    candidates,
  });
  
  // 4. Gérer selon le résultat
  if (dedupResult.status === 'not_duplicate') {
    // Continuer normalement
    await saveDocument(tempDoc);
  } else {
    // Afficher la modale
    showDuplicateModal({
      title: dedupResult.modal.title,
      message: dedupResult.modal.message,
      level: dedupResult.modal.level,
      primaryAction: dedupResult.modal.primaryCta,
      secondaryAction: dedupResult.modal.secondaryCta,
      onPrimary: async () => {
        if (dedupResult.suggestedAction === 'replace') {
          await replaceDocument(dedupResult.matchedDocument.id, tempDoc);
        } else if (dedupResult.suggestedAction === 'cancel') {
          await cancelUpload(tempDoc.tempId);
        }
      },
      onSecondary: async () => {
        if (dedupResult.modal.secondaryCta.action === 'keep_both') {
          await saveDocument(tempDoc);
        }
      },
    });
  }
}
```

## 🧪 Tests

Les tests unitaires couvrent :

- ✅ Détection de doublons exacts
- ✅ Détection de quasi-doublons (similarité textuelle)
- ✅ Détection de quasi-doublons (période identique)
- ✅ Pas de doublon (documents différents)
- ✅ Comparaison de qualité (nouveau meilleur)
- ✅ Comparaison de qualité (existant meilleur)
- ✅ Contextes différents → keep_both
- ✅ Calcul de similarité textuelle
- ✅ Gestion des cas limites (textes vides, aucun candidat)

**Exécuter les tests :**

```bash
npm run test tests/dedup-agent.test.ts
```

## 📈 Performance

- **Temps moyen** : 5-20ms par analyse (selon la longueur des textes)
- **Scalabilité** : O(n × m) où n = longueur texte 1, m = longueur texte 2
- **Optimisations** :
  - Court-circuit si checksum identique
  - Tokenisation avec filtrage (mots > 2 caractères)
  - Cache singleton de l'agent

## 🔧 Configuration par défaut

```typescript
{
  textSimilarityThreshold: 0.9,      // 90% de similarité
  typePredictionMinScore: 0.6,       // 60% de confiance minimum
  enableDebugLogs: false,            // Logs désactivés
  locale: 'fr',                      // Français
}
```

## 📝 Logs de décision

Chaque analyse inclut des métadonnées pour audit et debugging :

```typescript
{
  metadata: {
    decisionReason: "Quasi-doublon détecté : similarité textuelle élevée (95.2%), même période",
    timestamp: "2025-10-15T14:32:45.123Z",
    processingTimeMs: 12
  }
}
```

## 🎨 Interface utilisateur (modale)

L'agent fournit tous les éléments pour construire la modale :

### Doublon exact (niveau `danger`)

```
╔══════════════════════════════════════╗
║  ⚠️ Doublon exact détecté            ║
╠══════════════════════════════════════╣
║                                      ║
║  Ce fichier est identique à          ║
║  « quittance_juin_2025.pdf »         ║
║  (uploadé le 15/06/2025).            ║
║                                      ║
║  [Annuler] [Conserver les deux ↓]   ║
╚══════════════════════════════════════╝
```

### Quasi-doublon (niveau `warning`)

```
╔══════════════════════════════════════╗
║  ⚠️ Doublon probable détecté         ║
╠══════════════════════════════════════╣
║                                      ║
║  Ce fichier semble très similaire à  ║
║  « contrat_bail_2025.pdf »           ║
║  (uploadé le 10/01/2025).            ║
║                                      ║
║  Différences :                       ║
║  • Pages: 8 vs 8                     ║
║  • Qualité OCR: 0.92 vs 0.75 ↑      ║
║  • Taille: 1250 KB vs 850 KB ↑      ║
║                                      ║
║  [Remplacer] [Annuler ↓]            ║
╚══════════════════════════════════════╝
```

## 🔄 Flux de décision complet

```
                    ┌─────────────────┐
                    │  Upload fichier │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   OCR + Hash    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Chercher        │
                    │ candidats       │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Agent Dedup     │
                    │ analyze()       │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼─────┐ ┌──────▼──────┐ ┌────▼────────┐
     │ exact_dup    │ │ probable_dup│ │ not_dup     │
     └────────┬─────┘ └──────┬──────┘ └────┬────────┘
              │              │              │
     ┌────────▼─────┐ ┌──────▼──────┐ ┌────▼────────┐
     │ cancel       │ │ compare     │ │ keep_both   │
     └──────────────┘ │ quality     │ └─────────────┘
                      └──────┬──────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼─────┐ ┌──────▼──────┐ ┌────▼────────┐
     │ new_better   │ │ existing_   │ │ different   │
     │ → replace    │ │ better      │ │ context     │
     │              │ │ → cancel    │ │ → keep_both │
     └──────────────┘ └─────────────┘ └─────────────┘
```

## 🤝 Contribution

Pour ajouter de nouvelles fonctionnalités :

1. Modifier les types dans `src/types/dedup.ts`
2. Implémenter la logique dans `src/services/dedup-agent.service.ts`
3. Ajouter des tests dans `tests/dedup-agent.test.ts`
4. Mettre à jour cette documentation

## 📚 Références

- **TF-IDF** : https://en.wikipedia.org/wiki/Tf%E2%80%93idf
- **Similarité cosinus** : https://en.wikipedia.org/wiki/Cosine_similarity
- **Distance de Levenshtein** : https://en.wikipedia.org/wiki/Levenshtein_distance

## ✅ Checklist d'implémentation

- [x] Types TypeScript complets
- [x] Service de similarité textuelle (TF-IDF)
- [x] Service agent Dedup avec règles de décision
- [x] Exemples d'utilisation
- [x] Tests unitaires complets
- [x] Documentation détaillée
- [ ] Intégration dans l'API d'upload
- [ ] Composant React pour la modale
- [ ] Tests d'intégration end-to-end

---

**Auteur :** Agent Dedup - Smartimmo  
**Version :** 1.0.0  
**Date :** 15 octobre 2025


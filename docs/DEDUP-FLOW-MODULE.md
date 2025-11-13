# Module DedupFlow - Orchestration du flux de déduplication

## 🎯 Mission

Le module **DedupFlow** orchestre le comportement du flux d'upload quand un doublon est détecté. Il détermine le comportement du front et le texte de la modale selon le choix de l'utilisateur.

---

## 📋 Contexte

- Le front appelle `/api/documents/analyze` puis `/api/documents/duplicates?checksum=...`
- Si un doublon est trouvé, une modale "Doublon exact détecté" s'affiche
- L'utilisateur peut choisir entre :
  - `Annuler`
  - `Remplacer (versioning)`
  - `Conserver les deux (avancé)`

---

## 🏗️ Architecture

### Types principaux

```typescript
interface DedupFlowInput {
  duplicateType: 'exact_duplicate' | 'probable_duplicate' | 'not_duplicate';
  existingFile?: ExistingFile;
  tempFile: TempFile;
  userDecision: 'cancel' | 'replace' | 'keep_both';
}

interface DedupFlowOutput {
  flow: 'upload_review' | 'replace_document' | 'cancel_upload' | 'error';
  duplicateStatus: 'exact_duplicate' | 'probable_duplicate' | 'not_duplicate' | 'user_forced';
  userDecision: 'cancel' | 'replace' | 'keep_both';
  flags: FlowFlags;
  ui: UIConfiguration;
  api?: APIConfiguration;
}
```

### Service principal

```typescript
class DedupFlowService {
  async orchestrateFlow(input: DedupFlowInput, context?: DedupFlowContext): Promise<DedupFlowResult>
  async processApiResult(output: DedupFlowOutput, apiResult: any): Promise<DedupFlowResult>
}
```

---

## 🔄 Flux de traitement

### 1. Doublon exact détecté

#### Si utilisateur choisit "Annuler"
```json
{
  "flow": "cancel_upload",
  "duplicateStatus": "exact_duplicate",
  "userDecision": "cancel",
  "flags": {
    "skipDuplicateCheck": false,
    "userForcesDuplicate": false,
    "replaceExisting": false,
    "deleteTempFile": true
  },
  "ui": {
    "title": "Upload annulé",
    "banner": {
      "type": "info",
      "text": "L'upload a été annulé. Le fichier temporaire sera supprimé.",
      "icon": "ℹ️"
    },
    "primaryAction": {
      "label": "Fermer",
      "action": "cancel"
    }
  },
  "api": {
    "endpoint": "/api/uploads/{tempId}",
    "method": "DELETE"
  }
}
```

#### Si utilisateur choisit "Remplacer"
```json
{
  "flow": "replace_document",
  "duplicateStatus": "exact_duplicate",
  "userDecision": "replace",
  "flags": {
    "skipDuplicateCheck": false,
    "userForcesDuplicate": false,
    "replaceExisting": true,
    "deleteTempFile": false
  },
  "ui": {
    "title": "Remplacement du document",
    "banner": {
      "type": "warning",
      "text": "Le document \"{existingFile.name}\" sera remplacé par le nouveau fichier.",
      "icon": "⚠️"
    },
    "primaryAction": {
      "label": "Remplacer",
      "action": "replace"
    },
    "secondaryAction": {
      "label": "Annuler",
      "action": "cancel"
    }
  },
  "api": {
    "endpoint": "/api/documents/{existingFile.id}/replace",
    "method": "POST",
    "payload": {
      "tempId": "{tempFile.tempId}",
      "reason": "user_replacement"
    }
  }
}
```

#### Si utilisateur choisit "Conserver les deux"
```json
{
  "flow": "upload_review",
  "duplicateStatus": "user_forced",
  "userDecision": "keep_both",
  "flags": {
    "skipDuplicateCheck": true,
    "userForcesDuplicate": true,
    "replaceExisting": false,
    "deleteTempFile": false
  },
  "ui": {
    "title": "Revue de l'upload – Copie volontaire d'un doublon",
    "banner": {
      "type": "info",
      "text": "Vous avez choisi de conserver ce doublon. Il sera enregistré sous un autre nom.",
      "icon": "🟢"
    },
    "suggestedFilename": "Avis_de_taxes_foncieres_2025_(copie).pdf",
    "primaryAction": {
      "label": "Enregistrer quand même",
      "action": "confirm"
    },
    "secondaryAction": {
      "label": "Annuler",
      "action": "cancel"
    }
  }
}
```

---

## 🎨 Interface utilisateur

### Composant DedupFlowModal

```tsx
<DedupFlowModal
  isOpen={isOpen}
  onClose={onClose}
  flowOutput={flowOutput}
  onAction={handleAction}
  isProcessing={isProcessing}
/>
```

### Hook useDedupFlow

```tsx
const { 
  flowOutput, 
  isProcessing, 
  error, 
  orchestrateFlow, 
  processApiResult, 
  reset 
} = useDedupFlow();
```

---

## 🔌 API Endpoints

### POST /api/documents/dedup-flow

Orchestre le flux de déduplication.

**Body:**
```json
{
  "duplicateType": "exact_duplicate",
  "existingFile": { "id": "doc-123", "name": "file.pdf", ... },
  "tempFile": { "tempId": "temp-456", "originalName": "file.pdf", ... },
  "userDecision": "keep_both",
  "scope": "property",
  "scopeId": "prop-789"
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* DedupFlowOutput */ },
  "nextStep": "show_modal"
}
```

### PUT /api/documents/dedup-flow

Traite le résultat d'une action API.

**Body:**
```json
{
  "output": { /* DedupFlowOutput */ },
  "apiResult": { "success": true, "data": { ... } }
}
```

---

## 🧪 Exemples d'utilisation

### Intégration dans un composant d'upload

```tsx
import { useDedupFlow } from '@/hooks/useDedupFlow';
import { DedupFlowModal } from '@/components/DedupFlowModal';

function UploadComponent() {
  const { flowOutput, orchestrateFlow, reset } = useDedupFlow();

  const handleDuplicateDetected = async (duplicateData) => {
    await orchestrateFlow({
      duplicateType: 'exact_duplicate',
      existingFile: duplicateData.existing,
      tempFile: duplicateData.temp,
      userDecision: 'keep_both' // Sera mis à jour selon le choix
    });
  };

  return (
    <div>
      {/* Interface d'upload */}
      
      {flowOutput && (
        <DedupFlowModal
          isOpen={!!flowOutput}
          onClose={reset}
          flowOutput={flowOutput}
          onAction={handleUserAction}
        />
      )}
    </div>
  );
}
```

---

## 🎯 Règles métier

### 1. Checksum identique (exact duplicate)
- **Message principal** : "Ce fichier est identique à {{existingFile.name}} (uploadé le {{date}})."
- **Actions disponibles** :
  - `Annuler` → stop le flux
  - `Remplacer` → delete ancien + sauvegarde nouveau
  - `Conserver les deux` → passer à l'étape Review avec tag spécial

### 2. Utilisateur choisit "Conserver les deux"
- **Titre** : "Revue de l'upload – Copie volontaire d'un doublon"
- **Bandeau** : 🟢 "Vous avez choisi de conserver ce doublon. Il sera enregistré sous un autre nom."
- **Nom de fichier** : `{{originalName}} (copie).pdf`
- **Bouton principal** : "Enregistrer quand même"
- **Flag** : `skipDuplicateCheck: true`

### 3. Utilisateur choisit "Remplacer"
- **Appel API** : `/api/documents/:id/replace` avec `tempId`
- **Message de succès** : "Le document existant a été remplacé avec succès."

### 4. Utilisateur choisit "Annuler"
- **Action** : Fermer la modale, supprimer le fichier temporaire
- **API** : `DELETE /api/uploads/:tempId`

---

## 📁 Structure des fichiers

```
src/
├── types/
│   └── dedup-flow.ts              # Types TypeScript
├── services/
│   └── dedup-flow.service.ts      # Service principal
├── components/
│   └── DedupFlowModal.tsx         # Composant UI
├── hooks/
│   └── useDedupFlow.ts            # Hook React
├── examples/
│   └── dedup-flow-usage.tsx       # Exemples d'utilisation
└── app/api/documents/dedup-flow/
    └── route.ts                   # API endpoints
```

---

## ✅ Statut

**MODULE COMPLET** - Le module DedupFlow est prêt à être intégré dans l'application Smartimmo pour orchestrer le flux de déduplication selon les spécifications demandées.

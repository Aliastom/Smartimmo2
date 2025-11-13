# 📋 Implémentation Modal de Revue d'Upload

## 🎯 Objectif
Implémenter une modal de revue pré-upload avec :
- Pré-classification automatique des documents
- Détection de doublons (basée sur hash SHA-256)
- Aperçu visuel (PDF/images)
- Extraction automatique de champs
- Actions sur doublons (voir, remplacer, uploader quand même)

## ✅ Réalisé

### 1. APIs Backend

#### `/api/documents/upload` (POST)
**Fonctionnalités** :
- Upload temporaire en mémoire (1h de rétention)
- Calcul du hash SHA-256 du fichier
- Détection de doublons via comparaison de hash
- Extraction OCR du texte (via `/api/ocr`)
- Classification automatique (via `ClassificationService`)
- Extraction de champs (dates, montants, périodes)
- Auto-assignation si score >= 0.7

**Response** :
```json
{
  "success": true,
  "data": {
    "tempId": "tmp_abc123",
    "filename": "quittance_mai_2025.pdf",
    "sha256": "...",
    "mime": "application/pdf",
    "size": 123456,
    "predictions": [
      {"typeCode": "QUITTANCE", "label": "Quittance de Loyer", "score": 0.71},
      {"typeCode": "BAIL_SIGNE", "label": "Bail Signé", "score": 0.29}
    ],
    "autoAssigned": true,
    "assignedTypeCode": "QUITTANCE",
    "duplicate": {
      "isDuplicate": true,
      "ofDocumentId": "doc_123",
      "documentName": "quittance_mai_2025.pdf",
      "documentType": "Quittance de Loyer",
      "uploadedAt": "2025-01-15T10:00:00.000Z",
      "reason": "same_hash"
    },
    "extractedPreview": {
      "textSnippet": "... a payé la somme de ...",
      "textLength": 1234,
      "source": "pdf-text",
      "fields": {
        "amount_paid": "650,00 €",
        "period_month": "mai",
        "period_year": "2025",
        "date": "15/05/2025"
      }
    }
  }
}
```

#### `/api/documents/upload?tempId=...` (GET)
**Fonctionnalités** :
- Récupération d'un fichier temporaire pour prévisualisation
- Headers appropriés (Content-Type, Content-Disposition)

#### `/api/documents/confirm` (POST)
**Fonctionnalités** :
- Finalisation de l'upload
- Vérification anti-doublon (sauf si `keepDespiteDuplicate=true`)
- Écriture physique du fichier dans `uploads/YYYY/MM/`
- Création de l'enregistrement `Document` en base
- Support du versioning (remplacement via `replaceDuplicateId`)
- Liaison automatique (property, lease, tenant)
- Nettoyage du fichier temporaire

**Body** :
```json
{
  "tempId": "tmp_abc123",
  "finalTypeCode": "QUITTANCE",
  "keepDespiteDuplicate": false,
  "scope": "property",
  "linkedTo": {
    "propertyId": "prop_123",
    "leaseId": "lease_456",
    "tenantId": "tenant_789"
  },
  "customName": "Quittance Mai 2025 - Appartement Jasmin",
  "replaceDuplicateId": "doc_old_123" // Pour versioning
}
```

#### `/api/ocr` (POST)
**Fonctionnalités** :
- Extraction de texte depuis PDF (via `pdf-parse`)
- Détection de PDF scannés (renvoie erreur 422 pour forcer OCR côté client)
- Support images (renvoie erreur 422 pour forcer OCR côté client)

### 2. Composant React

#### `UploadReviewModal`
**Props** :
```typescript
interface UploadReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: File[];
  scope: 'global' | 'property';
  propertyId?: string;
  leaseId?: string;
  tenantId?: string;
  onSuccess?: () => void;
}
```

**Fonctionnalités** :
- ✅ Upload et analyse automatique de tous les fichiers
- ✅ Navigation fichier par fichier (Précédent/Suivant)
- ✅ Indicateurs de statut (uploading, analyzing, ready, error, confirmed)
- ✅ **Bandeau doublon** avec 3 actions :
  - 👁 **Voir l'existant** : Ouvre le document en doublon dans un nouvel onglet
  - 🔄 **Remplacer** : Versioning automatique (soft-delete de l'ancien)
  - ⬆️ **Uploader quand même** : Ignore le doublon et crée un nouveau document
- ✅ Formulaire d'édition :
  - Nom du document (éditable)
  - Type de document (select avec tous les types actifs)
- ✅ **Badges de prédictions** : Top 3 scores cliquables pour sélection rapide
- ✅ **Onglets** :
  - **Aperçu** : Visualisation PDF (react-pdf) ou image
  - **Champs extraits** : Affichage des données extraites automatiquement
- ✅ **Actions** :
  - Annuler : Ferme la modal sans enregistrer
  - Enregistrer et suivant : Finalise l'upload et passe au fichier suivant
  - Enregistrer : Finalise l'upload et ferme la modal
- ✅ Accessibilité : Focus trap, ESC pour fermer
- ✅ Loaders et feedback visuel

### 3. Intégration

#### `DocumentUploadDropzone`
**Changements** :
- Suppression de l'ancien système d'upload direct
- Nouvelle logique :
  1. Sélection des fichiers (drag & drop ou clic)
  2. Validation (nombre max, taille max)
  3. **Ouverture de `UploadReviewModal`**
  4. Upload/Classification/Confirmation via la modal
- Détermination automatique du scope et des IDs pour liaison

#### Pages concernées
- ✅ `/documents` : Upload global
- ✅ `/biens/[id]?tab=documents` : Upload lié à un bien (via `PropertyDocumentsSection`)

### 4. Dépendances ajoutées

```json
{
  "react-pdf": "^7.x",
  "pdfjs-dist": "3.11.174"
}
```

## 🎨 UX/UI

### Workflow Utilisateur

1. **Sélection** :
   - Drag & drop ou clic sur la dropzone
   - Validation immédiate (taille, nombre)

2. **Modal de revue** :
   - Upload automatique en arrière-plan
   - Analyse et classification (1-3 secondes par fichier)
   - Affichage du premier fichier avec toutes ses infos

3. **Revue d'un fichier** :
   - ⚠️ Si doublon → Bandeau orange avec 3 options
   - ✅ Prédictions affichées avec scores (ex: 71%, 29%, 15%)
   - 📝 Édition du nom et sélection du type
   - 👁 Prévisualisation visuelle (PDF page 1 ou image)
   - 📊 Champs extraits (montant, date, période, etc.)

4. **Confirmation** :
   - Enregistrement dans `uploads/YYYY/MM/`
   - Création du document en base
   - Liaison automatique (bien/bail/locataire)
   - Passage au fichier suivant ou fermeture

### États visuels

| État | Indicateur | Description |
|------|-----------|-------------|
| `uploading` | 🔄 Spinner bleu | Upload du fichier en cours |
| `analyzing` | 🔄 Spinner violet | Classification en cours |
| `ready` | ✅ CheckCircle vert | Prêt à enregistrer |
| `error` | ⚠️ AlertTriangle rouge | Erreur (+ message) |
| `confirmed` | ✅ CheckCircle vert | Enregistré avec succès |

## 🔒 Sécurité

### Anti-doublons
- Hash SHA-256 calculé côté serveur
- Vérification dans la base avant confirmation
- 3 options utilisateur si doublon détecté
- Blocage auto si tentative de confirmation sans choix

### Validation
- Taille max par fichier : 50MB (configurable)
- Nombre max de fichiers : 10 (configurable)
- Types MIME autorisés : PDF, JPG, PNG
- Vérification existence du type de document

### Stockage temporaire
- Fichiers en mémoire (Map)
- Nettoyage automatique après 1h
- Nettoyage manuel après confirmation
- **Note** : En production, utiliser Redis pour le stockage distribué

## 📝 Extraction de champs

### Patterns implémentés

```typescript
// Montants
/(\d[\d\s\u00A0.,]{2,})\s*€/g

// Dates françaises
/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g

// Périodes (mois + année)
/(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s*(\d{4})/i

// Année seule
/\b(20\d{2})\b/
```

### Champs extraits
- `amount_paid` : Montant principal (€)
- `date` : Date au format français
- `period_month` : Mois (janvier, février, etc.)
- `period_year` : Année (2025, etc.)

## 🚀 Utilisation

### Upload global (page `/documents`)
```typescript
<DocumentUploadDropzone
  onSuccess={() => {
    loadDocuments();
    loadStats();
  }}
  onError={(error) => alert(error)}
/>
```

### Upload lié à un bien
```typescript
<DocumentUploadDropzone
  linkedTo="property"
  linkedId={propertyId}
  onSuccess={() => {
    refreshDocuments();
  }}
/>
```

### Upload lié à un bail
```typescript
<DocumentUploadDropzone
  linkedTo="lease"
  linkedId={leaseId}
  onSuccess={() => {
    refreshDocuments();
  }}
/>
```

## ✨ Améliorations futures

### Court terme
- [ ] Support OCR Tesseract côté serveur pour PDFs scannés
- [ ] Extraction de champs avancée (IBAN, adresses, noms)
- [ ] Suggestions de noms basées sur le type + champs extraits
- [ ] Historique de versioning dans l'UI

### Moyen terme
- [ ] Stockage temporaire Redis (production)
- [ ] Compression d'images avant upload
- [ ] Support de formats supplémentaires (DOCX, XLSX)
- [ ] Extraction de métadonnées EXIF (photos)

### Long terme
- [ ] IA pour extraction structurée (GPT-4 Vision)
- [ ] Détection de doublons "fuzzy" (similitude visuelle)
- [ ] Workflow d'approbation multi-utilisateurs
- [ ] Templates de classification personnalisés

## 🐛 Notes de débogage

### Erreurs courantes

**1. "Fichier temporaire non trouvé"**
- Cause : Fichier expiré (>1h) ou serveur redémarré
- Solution : Re-upload le fichier

**2. "Type de document invalide"**
- Cause : Type inactif ou supprimé
- Solution : Vérifier la liste des types actifs

**3. "Document en doublon"**
- Normal : L'utilisateur doit choisir une action
- Si blocage : Vérifier que `keepDespiteDuplicate` ou `replaceDuplicateId` est passé

**4. Aperçu PDF ne s'affiche pas**
- Vérifier la configuration du worker PDF.js
- Vérifier que le tempId est valide
- Vérifier les CORS si problème de chargement

## 📊 Métriques

### Performance attendue
- Upload 1 fichier (5MB PDF) : ~2-3 secondes
- Classification : ~500ms
- Extraction champs : ~100ms
- Total par fichier : ~3-4 secondes

### Limites
- Stockage temporaire : 1 000 fichiers max simultanés
- Taille mémoire : ~500MB max (10 fichiers × 50MB)
- Concurrent uploads : Limité par la bande passante

---

✅ **Implémentation complète et testable !**


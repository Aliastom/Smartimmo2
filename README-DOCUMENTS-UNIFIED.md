# Système de Gestion des Documents Unifié - Smartimmo

## 📋 Vue d'ensemble

Ce document décrit l'architecture et l'utilisation du système de gestion des documents unifié de Smartimmo. Le système centralise la gestion des documents à travers toutes les sections de l'application (Biens, Baux, Transactions) avec une expérience utilisateur cohérente et des fonctionnalités avancées.

## 🎯 Objectifs

- **Unification**: Même expérience utilisateur partout (Global, Biens, Baux, Transactions)
- **Classification automatique**: OCR + IA pour détecter et classer les documents
- **Traçabilité complète**: Versioning, historique, liens entre entités
- **Recherche puissante**: Full-text, filtres avancés, métadonnées
- **Complétude**: Vérification des documents requis par contexte
- **Sécurité**: RLS (Row Level Security), contrôle d'accès

## 🏗️ Architecture

### Base de données (Prisma/SQLite)

#### Tables principales

**DocumentType**
```prisma
- id: UUID
- code: String (UNIQUE) - Ex: BAIL_SIGNE, DPE, FACTURE_TRAVAUX
- label: String - Nom affiché
- scope: Enum('global', 'property', 'lease', 'transaction')
- isRequired: Boolean - Document obligatoire pour ce scope
- isSystem: Boolean - Type système (non modifiable)
- isActive: Boolean
- regexFilename: String? - Pattern pour auto-détection
- validExtensions: JSON - Extensions acceptées
- validMimeTypes: JSON - Types MIME acceptés
- versioningEnabled: Boolean
- ocrProfileKey: String? - Profil OCR spécifique
```

**Document**
```prisma
- id: UUID
- ownerId: String - Propriétaire (pour RLS)
- bucketKey: String - Chemin storage
- filenameOriginal: String
- filenameNormalized: String?
- mime: String
- sha256: String - Hash pour détecter doublons
- size: Int
- url: String
- previewUrl: String?

# Classification & OCR
- documentTypeId: String? - Type classifié
- detectedTypeId: String? - Type détecté automatiquement
- typeConfidence: Float? - Score de confiance (0-1)
- ocrStatus: Enum('pending', 'processing', 'success', 'failed')
- ocrError: String?
- extractedText: Text? - Texte extrait par OCR
- ocrVendor: String? - Service OCR utilisé
- ocrConfidence: Float?
- indexed: Boolean - Indexé pour recherche full-text

# Statut & Source
- status: Enum('pending', 'classified', 'rejected', 'archived')
- source: Enum('upload', 'email', 'scan', 'api')
- uploadedBy: String?
- uploadedAt: DateTime

# Liaison
- linkedTo: Enum('global', 'property', 'lease', 'transaction', 'loan', 'tenant')
- linkedId: String?
- propertyId: String?
- leaseId: String?
- transactionId: String?
- loanId: String?
- tenantId: String?

# Versioning
- version: Int - Numéro de version
- replacesDocumentId: String? - Lien vers version précédente

# Métadonnées
- tags: String - Tags séparés par virgules
- tagsJson: String - Tags en JSON
- metadata: String? - Métadonnées JSON

# Soft delete
- deletedAt: DateTime?
- deletedBy: String?
```

#### Index

- `(linkedTo, linkedId)` - Filtrer par entité liée
- `(documentTypeId)` - Filtrer par type
- `(status)` - Filtrer par statut
- `(sha256)` - Détection de doublons
- `(ocrStatus)` - Pipeline OCR
- `(deletedAt)` - Exclusion des supprimés
- GIN sur `metadata` - Recherche dans métadonnées

### Services (TypeScript)

#### DocumentsService (`lib/services/documents.ts`)

##### Méthodes principales

**uploadAndCreate(params)**
```typescript
interface UploadDocumentParams {
  file: File | Buffer;
  fileName: string;
  mimeType: string;
  linkedTo?: 'global' | 'property' | 'lease' | 'transaction';
  linkedId?: string;
  hintedTypeKey?: string; // Suggestion de type
  tags?: string[];
  ownerId?: string;
  source?: 'upload' | 'email' | 'scan' | 'api';
}

// Returns: { id, isDuplicate, status }
```

**classifyAndExtract(documentId)**
```typescript
// Pipeline complet:
// 1. OCR si nécessaire (extractedText, ocrConfidence)
// 2. Classification via signaux/keywords (detectedTypeId, confidence)
// 3. Extraction de champs structurés (selon DocumentType.rules)
// 4. Indexation pour recherche full-text

// Returns: { documentTypeId, confidence, extractedFields, extractedText }
```

**relink(documentId, params)**
```typescript
// Modifier la liaison d'un document
// Préserve l'historique et le versioning
relink(docId, { linkedTo: 'lease', linkedId: 'lease-123' })
```

**createNewVersion(prevDocId, file, fileName, mimeType)**
```typescript
// Créer une nouvelle version
// - Incrémente le numéro de version
// - Archive l'ancienne version (status='archived')
// - Préserve les liens et métadonnées
```

**search(filters)**
```typescript
interface SearchFilters {
  query?: string; // Full-text (nom, texte extrait, tags)
  type?: string; // Code du type
  scope?: 'global' | 'property' | 'lease' | 'transaction';
  status?: 'pending' | 'classified' | 'rejected' | 'archived';
  linkedTo?: string;
  linkedId?: string;
  propertyId?: string;
  leaseId?: string;
  transactionId?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

// Returns: { documents, pagination: { total, offset, limit, hasMore } }
```

**checkCompleteness(scope, entityId)**
```typescript
// Vérifie si tous les documents requis sont présents
checkCompleteness('property', 'prop-123')
// Returns: { complete: boolean, missing: DocumentType[], provided: DocumentType[] }
```

### Routes API

#### GET /api/documents
Recherche et liste de documents avec filtres

**Query Params:**
- `query` - Recherche full-text
- `type` - Code du type de document
- `scope` - Scope (global, property, lease, transaction)
- `status` - Statut du document
- `linkedTo` / `linkedId` - Filtrer par entité liée
- `propertyId` / `leaseId` / `transactionId` - Filtrer par ID direct
- `tags` - Tags (séparés par virgules)
- `dateFrom` / `dateTo` - Plage de dates
- `includeDeleted` - Inclure les documents supprimés
- `offset` / `limit` - Pagination

**Response:**
```json
{
  "documents": [
    {
      "id": "doc-123",
      "filenameOriginal": "bail-dupont.pdf",
      "documentType": { "id": "...", "label": "Bail signé", "code": "BAIL_SIGNE" },
      "status": "classified",
      "size": 245678,
      "createdAt": "2025-10-14T10:00:00Z",
      "linkedTo": "lease",
      "linkedId": "lease-456",
      "property": { "id": "...", "name": "Appartement Paris 15" },
      "lease": { "id": "...", "rentAmount": 1200 },
      "ocrStatus": "success",
      "reminders": [...]
    }
  ],
  "pagination": {
    "total": 156,
    "offset": 0,
    "limit": 50,
    "hasMore": true
  }
}
```

#### POST /api/documents
Upload de documents

**Body (multipart/form-data):**
- `files` - Fichiers à uploader
- `linkedTo` - Type de liaison (défaut: 'global')
- `linkedId` - ID de l'entité liée
- `hintedTypeKey` - Code du type suggéré
- `tags` - Tags JSON
- `source` - Source (défaut: 'upload')

**Response:**
```json
{
  "success": true,
  "documents": [
    {
      "id": "doc-123",
      "filename": "document.pdf",
      "size": 123456,
      "status": "processing",
      "isDuplicate": false
    }
  ]
}
```

#### PATCH /api/documents/:id
Mettre à jour un document

#### DELETE /api/documents/:id
Supprimer un document (soft delete)

#### POST /api/documents/:id/version
Créer une nouvelle version

#### POST /api/documents/:id/relink
Modifier la liaison

#### POST /api/documents/:id/classify
Relancer la classification/OCR

#### GET /api/documents/stats
Statistiques des documents

#### GET /api/documents/completeness
Vérifier la complétude (scope + entityId)

#### GET /api/document-types
Liste des types de documents

**Query Params:**
- `scope` - Filtrer par scope
- `isRequired` - Documents requis uniquement
- `isActive` - Documents actifs (défaut: true)

### Composants UI Réutilisables

Tous les composants sont dans `src/components/documents/unified/`

#### DocumentTable
Tableau de documents avec colonnes : Type, Titre, Lié à, Statut, Taille, Date, Actions

**Props:**
```typescript
{
  documents: DocumentTableRow[];
  onView?: (doc) => void;
  onDownload?: (doc) => void;
  onSelect?: (docId, selected) => void;
  selectedIds?: Set<string>;
  showSelection?: boolean;
  showLinkedTo?: boolean;
  loading?: boolean;
}
```

#### DocumentCard
Carte détaillée d'un document avec aperçu, métadonnées, champs extraits, rappels

**Props:**
```typescript
{
  document: DocumentTableRow & ExtendedFields;
  onDownload?: () => void;
  onDelete?: () => void;
  onRelink?: () => void;
  onReclassify?: () => void;
  onViewVersions?: () => void;
}
```

#### DocumentModal
Modale avec onglets : Informations, Fichier, Versions

**Props:**
```typescript
{
  document: ExtendedDocumentTableRow;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}
```

#### DocumentUploadDropzone
Drag & drop pour upload de fichiers

**Props:**
```typescript
{
  onSuccess?: (documents) => void;
  onError?: (error) => void;
  linkedTo?: 'global' | 'property' | 'lease' | 'transaction';
  linkedId?: string;
  hintedTypeKey?: string;
  tags?: string[];
  maxFiles?: number;
  maxSize?: number; // MB
  acceptedTypes?: string[];
}
```

#### DocumentTypeBadge
Badge avec icône pour les types de documents

#### DocumentLinkSelector
Sélecteur pour relier un document à une entité (Global/Bien/Bail/Transaction)

#### DocumentVersionTimeline
Timeline des versions d'un document

## 📄 Types de Documents (Seeds)

### Global
- `CONTRAT_ASSURANCE` - Contrat d'assurance
- `FACTURE` - Facture générale
- `QUITTANCE` - Quittance de loyer

### Property (Biens)
- `ACTE_PROPRIETE` ⭐ - Acte de propriété (requis)
- `TITRE_PROPRIETE` ⭐ - Titre de propriété (requis)
- `DPE` ⭐ - Diagnostic de Performance Énergétique (requis)
- `DIAG_AMIANTE` ⭐ - Diagnostic amiante (requis)
- `DIAG_PLOMB` ⭐ - Diagnostic plomb (requis)
- `DIAG_GAZ` - Diagnostic gaz
- `DIAG_ELEC` - Diagnostic électricité
- `TAXE_FONCIERE` - Taxe foncière
- `PLAN_BIEN` - Plan du bien
- `PHOTO_BIEN` - Photo du bien

### Lease (Baux)
- `BAIL_SIGNE` ⭐ - Bail signé (requis)
- `EDL_ENTREE` ⭐ - État des lieux d'entrée (requis)
- `EDL_SORTIE` - État des lieux de sortie
- `AVENANT_BAIL` - Avenant au bail
- `ATTESTATION_ASSURANCE_LOCATAIRE` ⭐ - Attestation d'assurance (requis)
- `PIECE_IDENTITE_LOCATAIRE` ⭐ - Pièce d'identité (requis)
- `JUSTIFICATIF_REVENUS` ⭐ - Justificatif de revenus (requis)
- `CONGE_LOCATAIRE` - Préavis / Congé

### Transaction
- `JUSTIFICATIF_PAIEMENT` - Justificatif de paiement
- `FACTURE_TRAVAUX` - Facture de travaux
- `FACTURE_CHARGES` - Facture de charges
- `RECU_LOYER` - Reçu de loyer
- `RELEVE_BANCAIRE` - Relevé bancaire

⭐ = Document requis (isRequired: true)

## 🔐 Sécurité (RLS - Row Level Security)

### Principes

1. **Propriété**: Chaque document appartient à un `ownerId`
2. **Contexte**: Les documents sont liés à des entités (bien, bail, transaction)
3. **Accès**: Un utilisateur peut accéder à un document si :
   - Il possède le document (ownerId)
   - OU il a accès à l'entité liée (via les permissions de l'entité)
   - OU c'est un document global de son organisation

### Implémentation

À implémenter dans Supabase ou via middleware Next.js:

```typescript
// Vérifier l'accès à un document
async function canAccessDocument(userId: string, documentId: string): Promise<boolean> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  
  if (!doc) return false;
  if (doc.ownerId === userId) return true;
  if (doc.linkedTo === 'global') return canAccessOrganization(userId, doc.ownerId);
  
  // Vérifier l'accès à l'entité liée
  switch (doc.linkedTo) {
    case 'property':
      return canAccessProperty(userId, doc.propertyId);
    case 'lease':
      return canAccessLease(userId, doc.leaseId);
    case 'transaction':
      return canAccessTransaction(userId, doc.transactionId);
    default:
      return false;
  }
}
```

## 🧪 Tests E2E (Playwright)

### Scénarios à tester

1. **Upload & Classification**
   ```typescript
   test('Upload PDF DPE → OCR → Auto-classification', async ({ page }) => {
     await page.goto('/documents');
     await page.locator('[data-testid="upload-btn"]').click();
     await page.setInputFiles('[data-testid="file-input"]', 'test-dpe.pdf');
     await page.waitForSelector('[data-testid="doc-classified"]');
     expect(await page.locator('[data-testid="doc-type"]').textContent()).toBe('DPE');
   });
   ```

2. **Recherche full-text**
   ```typescript
   test('Recherche par contenu extrait', async ({ page }) => {
     await page.goto('/documents');
     await page.fill('[data-testid="search-input"]', 'diagnostic plomb');
     await page.click('[data-testid="search-btn"]');
     expect(await page.locator('[data-testid="doc-row"]').count()).toBeGreaterThan(0);
   });
   ```

3. **Versioning**
   ```typescript
   test('Créer nouvelle version → Archive ancienne', async ({ page }) => {
     await page.goto('/documents/doc-123');
     await page.click('[data-testid="new-version-btn"]');
     await page.setInputFiles('[data-testid="version-file"]', 'updated.pdf');
     expect(await page.locator('[data-testid="version-badge"]').textContent()).toBe('v2');
   });
   ```

4. **Complétude des baux**
   ```typescript
   test('Badge complétude documents requis', async ({ page }) => {
     await page.goto('/biens/bien-123?tab=leases');
     const badge = await page.locator('[data-testid="completeness-badge"]');
     expect(await badge.textContent()).toContain('7/7'); // Tous requis présents
     expect(await badge.getAttribute('class')).toContain('success');
   });
   ```

5. **Actions groupées**
   ```typescript
   test('Sélection multiple → Relier en masse', async ({ page }) => {
     await page.goto('/documents');
     await page.click('[data-testid="doc-checkbox-1"]');
     await page.click('[data-testid="doc-checkbox-2"]');
     await page.click('[data-testid="bulk-relink-btn"]');
     await page.selectOption('[data-testid="link-type"]', 'property');
     await page.click('[data-testid="property-opt-bien-123"]');
     await page.click('[data-testid="confirm-relink"]');
     expect(await page.locator('[data-testid="success-toast"]')).toBeVisible();
   });
   ```

## 📚 Exemples d'utilisation

### 1. Upload d'un document pour un bien

```typescript
// Dans PropertyDetailPage
import { DocumentUploadDropzone } from '@/components/documents/unified';

<DocumentUploadDropzone
  linkedTo="property"
  linkedId={propertyId}
  hintedTypeKey="DPE" // Suggérer le type
  onSuccess={(docs) => {
    console.log('Documents uploadés:', docs);
    refetch();
  }}
  onError={(error) => alert(error)}
/>
```

### 2. Vérifier la complétude des documents d'un bail

```typescript
const { complete, missing } = await DocumentsService.checkCompleteness('lease', leaseId);

if (!complete) {
  console.log('Documents manquants:', missing.map(t => t.label));
  // Afficher un badge "Incomplet" + liste des manquants
}
```

### 3. Recherche avancée

```typescript
const result = await DocumentsService.search({
  query: 'diagnostic plomb',
  scope: 'property',
  dateFrom: new Date('2024-01-01'),
  status: 'classified',
  tags: ['urgent', 'à-renouveler'],
  limit: 20,
});

console.log(`Trouvé ${result.pagination.total} documents`);
```

### 4. Créer une nouvelle version

```typescript
const newVersion = await DocumentsService.createNewVersion(
  oldDocumentId,
  fileBuffer,
  'dpe-updated.pdf',
  'application/pdf',
  currentUserId
);

console.log(`Nouvelle version ${newVersion.version} créée`);
```

## 🚀 Déploiement

### Étapes

1. **Migrations**
   ```bash
   npm run prisma:migrate
   ```

2. **Seeds**
   ```bash
   npx ts-node prisma/seeds/document-types-unified.ts
   ```

3. **Configuration Storage**
   - Vérifier les variables d'environnement pour le stockage (local/S3/Supabase)
   - `STORAGE_TYPE=local|s3|supabase`
   - `STORAGE_BUCKET=documents`

4. **OCR Service**
   - Configurer le service OCR (Tesseract/Google Vision/AWS Textract)
   - `OCR_PROVIDER=tesseract|google|aws`
   - `OCR_API_KEY=...`

5. **Worker Queue**
   - S'assurer que le worker de traitement OCR tourne
   - `npm run worker:ocr`

## 📝 Maintenance

### Ajouter un nouveau type de document

```typescript
// Dans prisma/seeds/document-types-unified.ts
{
  code: 'NOUVEAU_TYPE',
  label: 'Mon nouveau type',
  scope: 'property', // ou 'lease', 'transaction', 'global'
  isRequired: false,
  isSystem: false,
  validExtensions: JSON.stringify(['.pdf']),
  validMimeTypes: JSON.stringify(['application/pdf']),
  regexFilename: '.*mon-pattern.*', // Pour auto-détection
  versioningEnabled: true,
}
```

Puis lancer le seed :
```bash
npx ts-node prisma/seeds/document-types-unified.ts
```

### Modifier les règles d'extraction

Les règles d'extraction sont dans `DocumentExtractionRule`. Exemple pour extraire une date :

```typescript
await prisma.documentExtractionRule.create({
  data: {
    documentTypeId: 'dpe-type-id',
    fieldName: 'date_diagnostic',
    pattern: 'Date du diagnostic\\s*:\\s*(\\d{2}/\\d{2}/\\d{4})',
    postProcess: 'fr_date',
    priority: 100,
  },
});
```

## 🆘 Dépannage

### Les documents ne sont pas classés automatiquement

1. Vérifier que l'OCR fonctionne : `GET /api/documents/:id` → `ocrStatus: 'success'`
2. Vérifier les signaux/keywords du type : `DocumentType.keywords`
3. Forcer la reclassification : `POST /api/documents/:id/classify`
4. Vérifier les logs du worker OCR

### Performances de recherche lentes

1. Vérifier les index : `EXPLAIN QUERY PLAN SELECT ...`
2. Limiter la recherche full-text : utiliser les filtres (type, scope, dates)
3. Ajouter un index GIN sur `DocumentTextIndex.content` (si PostgreSQL)

### Documents dupliqués

Le système détecte les doublons par SHA256. Si un document est uploadé deux fois :
- Le 2ème upload retourne `{ isDuplicate: true, id: 'doc-existant' }`
- Aucun nouveau document n'est créé

## 📊 Métriques & Monitoring

### Indicateurs clés

- **Taux de classification auto**: `classified / total * 100`
- **Taux de succès OCR**: `ocrSuccess / total * 100`
- **Documents par entité**: `AVG(documents per property/lease/transaction)`
- **Complétude moyenne**: `AVG(completion rate per lease/property)`

### Endpoints monitoring

- `GET /api/documents/stats` - Statistiques globales
- `GET /api/documents?status=pending&limit=1` - Documents en attente
- `GET /api/documents?ocrStatus=failed&limit=10` - Échecs OCR

---

**Auteur**: Équipe Smartimmo  
**Date**: Octobre 2025  
**Version**: 1.0.0


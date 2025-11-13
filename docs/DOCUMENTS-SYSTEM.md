# 📄 Système de Gestion Documentaire - Smartimmo

## Vue d'ensemble

Le système de gestion documentaire de Smartimmo offre une solution complète pour :
- **Upload multi-fichiers** avec détection de doublons (SHA256)
- **OCR automatique** (extraction de texte depuis PDF/images)
- **Classification intelligente** par type de document (règles + mots-clés pondérés)
- **Extraction de champs** (regex + post-processing)
- **Rattachements automatiques** aux entités (Bien, Bail, Locataire, Transaction)
- **Rappels d'échéances** (assurance, DPE, taxes, etc.)
- **Recherche full-text** et filtres avancés
- **Soft-delete** avec garbage collection

---

## 🏗️ Architecture

### Schéma Prisma

```
DocumentType (types prédéfinis: BAIL, QUITTANCE, ASSURANCE, etc.)
  ├── DocumentTypeField (champs attendus: date, montant, etc.)
  ├── DocumentExtractionRule (règles regex pour extraction)
  └── DocumentKeyword (mots-clés pondérés pour classification)

Document (le document uploadé)
  ├── DocumentField (champs extraits avec confiance)
  ├── DocumentTextIndex (texte OCR par page)
  └── Reminder (rappels automatiques)
```

### Services

| Service | Responsabilité |
|---------|---------------|
| **StorageService** | Stockage local/S3/Supabase, calcul SHA256 |
| **OcrService** | Extraction de texte (PDF natif + OCR images) |
| **ClassificationService** | Détermination du type via scoring |
| **ExtractionService** | Extraction de champs (regex + post-process) |
| **DocumentQueueService** | Queue de jobs (OCR → Classify → Extract → Index → Reminders) |

### Pipeline de traitement

```
Upload → OCR → Classification → Extraction → Indexation → Rappels
  ↓       ↓         ↓               ↓             ↓           ↓
 SHA256  Texte   TypeId +      Champs avec    FTS index  Reminder
 check   par     confidence    confidence                 créés
         page
```

---

## 📋 Types de documents supportés

| Code | Label | Champs clés | Rappels auto |
|------|-------|-------------|--------------|
| **BAIL_SIGNE** | Bail signé | start_period, rent_amount, address | ❌ |
| **QUITTANCE** | Quittance de loyer | period_month, period_year, amount_paid | ❌ |
| **ATTESTATION_ASSURANCE** | Attestation d'assurance | expiry_date, insurer_name | ✅ J-30, J-7 |
| **TAXE_FONCIERE** | Taxe foncière | year, amount_total | ✅ Oct-30, Oct-15 |
| **DPE** | Diagnostic énergétique | grade, valid_until | ✅ J-30 |
| **EDL** | État des lieux | edl_type, edl_date | ❌ |
| **FACTURE** | Facture | invoice_date, amount_ttc | ❌ |
| **RIB** | RIB | iban, account_holder | ❌ |
| **PIECE_IDENTITE** | Pièce d'identité | id_type, expiry_date | ❌ |
| **RELEVE_BANCAIRE** | Relevé bancaire | period_start, period_end | ❌ |
| **AVIS_IMPOSITION** | Avis d'imposition | year, tax_amount | ❌ |
| **AUTRE** | Autre | - | ❌ |

---

## 🚀 Installation & Configuration

### 1. Migrations Prisma

```bash
npx prisma migrate dev --name add-documents-system
```

### 2. Seed des types de documents

```bash
node scripts/seed-documents-system.js
```

Cela créera :
- 12 types de documents
- ~50 champs type
- ~30 règles d'extraction
- ~80 mots-clés pondérés

### 3. Configuration environnement

```env
# Stockage (local par défaut)
STORAGE_TYPE=local  # ou 's3' | 'supabase'
STORAGE_PATH=./storage/documents

# OCR
OCR_PROVIDER=mock  # ou 'tesseract' | 'cloud'
```

---

## 🔌 API Routes

### Upload de documents

```http
POST /api/documents
Content-Type: multipart/form-data

files: File[]
propertyId?: string
leaseId?: string
tenantId?: string
transactionId?: string
tags?: string[] (JSON)
```

**Réponse :**
```json
{
  "success": true,
  "documents": [
    {
      "id": "clxxx",
      "filename": "bail.pdf",
      "status": "processing"
    }
  ]
}
```

### Recherche de documents

```http
GET /api/documents?query=bail&propertyId=clxxx&type=BAIL_SIGNE&limit=50&offset=0
```

**Filtres disponibles :**
- `query`: Recherche texte libre (nom, tags, contenu OCR)
- `type`: Code du type de document
- `propertyId`, `leaseId`, `tenantId`, `transactionId`: Filtre par entité
- `dateFrom`, `dateTo`: Plage de dates
- `includeDeleted`: Inclure les documents supprimés
- `limit`, `offset`: Pagination

### Détails d'un document

```http
GET /api/documents/:id
```

**Réponse :**
```json
{
  "id": "clxxx",
  "filenameOriginal": "bail-dupont.pdf",
  "documentType": { "code": "BAIL_SIGNE", "label": "Bail signé" },
  "typeConfidence": 0.92,
  "ocrStatus": "success",
  "fields": [
    {
      "fieldName": "rent_amount",
      "valueNum": 850.0,
      "confidence": 0.95
    }
  ],
  "property": { "name": "Appartement 25 rue Victor Hugo" },
  "reminders": [],
  "downloadUrl": "/api/documents/clxxx/download"
}
```

### Mettre à jour un document

```http
PATCH /api/documents/:id
Content-Type: application/json

{
  "documentTypeId": "clxxx",
  "tags": ["urgent", "2024"],
  "propertyId": "clyyy"
}
```

### Supprimer un document

```http
DELETE /api/documents/:id       # Soft-delete
DELETE /api/documents/:id?hard=true  # Hard-delete (physique)
```

### Re-classifier un document

```http
POST /api/documents/:id/classify
```

### Re-extraire les champs

```http
POST /api/documents/:id/extract
```

### Créer des rappels

```http
POST /api/documents/:id/reminders
Content-Type: application/json

{ "auto": true }  # Rappels automatiques selon type
# ou
{
  "kind": "INSURANCE_EXPIRY",
  "title": "Renouveler assurance",
  "dueDate": "2024-12-31",
  "alertDays": [30, 7]
}
```

### Opérations en masse

```http
POST /api/documents/bulk
Content-Type: application/json

{
  "documentIds": ["clxxx", "clyyy"],
  "operation": "delete" | "update_type" | "add_tags" | "remove_tags" | "restore",
  "data": { ... }
}
```

---

## 🎨 Composants React

### 1. UploadDropzone

Zone de drag & drop pour upload multi-fichiers.

```tsx
import { UploadDropzone } from '@/components/documents/UploadDropzone';

<UploadDropzone
  propertyId="clxxx"
  tags={['important']}
  onSuccess={(documentIds) => console.log('Uploaded:', documentIds)}
  onError={(error) => alert(error)}
  maxFiles={10}
/>
```

### 2. DocumentCard

Panneau latéral de détail d'un document.

```tsx
import { DocumentCard } from '@/components/documents/DocumentCard';

<DocumentCard
  document={document}
  onClose={() => setOpen(false)}
  onUpdate={() => refetch()}
/>
```

### 3. DocumentsGeneralPage

Page de liste globale des documents.

```tsx
import { DocumentsGeneralPage } from '@/components/documents/DocumentsGeneralPage';

<DocumentsGeneralPage />
```

### 4. PropertyDocumentsTab

Onglet documents dans la page d'un bien.

```tsx
import { PropertyDocumentsTab } from '@/components/documents/PropertyDocumentsTab';

<PropertyDocumentsTab 
  propertyId="clxxx" 
  propertyName="Appartement 25 rue Victor Hugo"
/>
```

---

## 🪝 Hooks

### useDocuments

```tsx
const { documents, loading, error, total, hasMore, refetch, fetchMore } = useDocuments({
  query: 'bail',
  propertyId: 'clxxx',
  limit: 50,
});
```

### useDocument

```tsx
const { document, loading, error, refetch } = useDocument(documentId);
```

### useDocumentUpload

```tsx
const { upload, uploads, isUploading, reset } = useDocumentUpload({
  propertyId: 'clxxx',
  onSuccess: (ids) => console.log('Success:', ids),
});

// Utiliser:
upload([file1, file2]);
```

### useDocumentActions

```tsx
const { 
  updateDocument, 
  deleteDocument, 
  reclassify, 
  reextract, 
  createReminders,
  bulkOperation,
  loading 
} = useDocumentActions();

await updateDocument(docId, { tags: ['urgent'] });
await deleteDocument(docId);
await reclassify(docId);
```

---

## 🔍 Classification automatique

### Algorithme de scoring

Pour chaque type de document, le score est calculé ainsi :

1. **Score par mots-clés** :
   - Chaque mot-clé trouvé ajoute son `weight`
   - Bonus si présent dans le `context` spécifié (titre, footer)
   - Normalisation : `score_brut / somme_weights_possibles`

2. **Bonus/Malus par signaux détectés** :
   - IBAN détecté → +0.3 pour RIB, +0.2 pour RELEVE_BANCAIRE
   - SIREN/SIRET → +0.1 pour FACTURE, TAXE_FONCIERE
   - Dates de période → +0.1 pour BAIL, QUITTANCE, ATTESTATION
   - Nom de fichier → jusqu'à +0.2

3. **Seuils de décision** :
   - `>= 0.85` → Auto-assigné ✅
   - `0.60 - 0.85` → Suggéré avec alternatives (Top 3)
   - `< 0.60` → "Type à confirmer" ❓

### Exemple

Document : `attestation-assurance-habitation-2024.pdf`

```
Type: ATTESTATION_ASSURANCE
  - Mots-clés: "attestation" (9), "assurance" (10), "garantie" (6) → 0.75
  - Filename hint: "assurance" → +0.20
  - Date range detected → +0.10
  → Score final: 0.95 ✅ AUTO-ASSIGNÉ
```

---

## 🧩 Extraction de champs

### Règles regex prédéfinies

| Type de champ | Pattern | Post-process |
|---------------|---------|--------------|
| Date FR | `\d{1,2}[-/]\d{1,2}[-/]\d{4}` | `fr_date` |
| Montant € | `\d+(?:[.,]\d{2})?\s?€` | `money_eur` |
| IBAN | `FR\d{2}[\s]?\d{4}...` | `iban` |
| SIREN | `\d{3}[\s]?\d{3}[\s]?\d{3}` | `siren` |
| SIRET | `\d{3}[\s]?\d{3}[\s]?\d{3}[\s]?\d{5}` | `siret` |
| Email | `[^@]+@[^@]+\.[^@]+` | `email` |
| Téléphone FR | `(?:\+33|0)[1-9](?:[\s.-]?\d{2}){4}` | `phone` |

### Post-processing

- **fr_date** : Parse `DD/MM/YYYY` → `Date`
- **money_eur** : `1 234,56 €` → `1234.56` (float)
- **iban** : Normalise et valide
- **siren/siret** : Enlève espaces

### Confiance

Chaque champ extrait a un score de confiance (0-1) :
- 1 occurrence unique → `0.9`
- Plusieurs occurrences → `0.7`
- Trop d'occurrences (>5) → `0.5`

---

## 🔔 Rappels automatiques

### Triggers

| Type document | Champ | Rappels créés |
|---------------|-------|---------------|
| **ATTESTATION_ASSURANCE** | `expiry_date` | J-30, J-7 |
| **DPE** | `valid_until` | J-30, J-7 |
| **TAXE_FONCIERE** | `year` | 15 oct (J-30, J-15, J-7) |

### Modèle Reminder

```prisma
model Reminder {
  id          String
  documentId  String?
  kind        String  // INSURANCE_EXPIRY | DPE_EXPIRY | TAX_PAYMENT
  title       String
  dueDate     DateTime
  alertDays   String?  // JSON [30, 7]
  status      String   // open | done | dismissed | snoozed
}
```

---

## 🗂️ Soft-delete & Garbage Collection

### Soft-delete

```ts
await prisma.document.update({
  where: { id },
  data: {
    deletedAt: new Date(),
    deletedBy: userId,
  },
});
```

Le document est masqué par défaut mais reste en base. Le fichier physique est conservé.

### Garbage Collection (GC)

Job automatique qui :
1. Trouve les documents avec `deletedAt` > 30 jours
2. Supprime le fichier physique du storage
3. Supprime l'entrée DB

```ts
const queueService = getDocumentQueueService();
await queueService.addJob('gc', 'system-gc');
```

---

## 🧪 Tests manuels

### Scenario 1: Upload et classification automatique

1. Uploader `attestation-assurance.pdf`
2. Vérifier que :
   - OCR extrait le texte
   - Type auto-assigné : `ATTESTATION_ASSURANCE` (confidence > 0.85)
   - Champ `expiry_date` extrait
   - 2 rappels créés (J-30, J-7)

### Scenario 2: Classification ambiguë

1. Uploader un document générique
2. Vérifier que :
   - Top 3 types suggérés avec scores
   - Aucun type auto-assigné (confidence < 0.85)
   - UI affiche les alternatives

### Scenario 3: Rattachement automatique

1. Uploader quittance avec adresse du bien
2. Vérifier que :
   - `propertyId` suggéré via heuristique adresse
   - Si bien trouvé → `leaseId` suggéré

### Scenario 4: Recherche full-text

1. Uploader plusieurs documents
2. Rechercher "loyer septembre"
3. Vérifier que les quittances de septembre remontent

---

## 🚧 Roadmap & Extensions futures

### Phase 1 ✅ (actuelle)
- [x] Upload, OCR, Classification, Extraction
- [x] Soft-delete, Rappels
- [x] Composants React de base

### Phase 2 🔜
- [ ] OCR réel (Tesseract.js ou Google Vision)
- [ ] Stockage S3/Supabase
- [ ] FTS performant (PostgreSQL ou ElasticSearch)
- [ ] WebSocket/SSE pour statut jobs en temps réel

### Phase 3 🔮
- [ ] ML pour améliorer la classification
- [ ] Édition de documents (annotations, signatures)
- [ ] Versioning (historique des modifications)
- [ ] Export en masse (ZIP, PDF groupé)

---

## 📚 Ressources

- **Schéma Prisma** : `prisma/schema.prisma`
- **Types TypeScript** : `src/types/documents.ts`
- **Services** : `src/services/*.service.ts`
- **Routes API** : `src/app/api/documents/**/*.ts`
- **Composants** : `src/components/documents/*.tsx`
- **Hooks** : `src/hooks/useDocument*.ts`
- **Seed** : `scripts/seed-documents-system.js`

---

## 🐛 Troubleshooting

### OCR échoue

**Symptôme** : `ocrStatus: 'failed'`

**Solutions** :
1. Vérifier que le fichier est bien un PDF/image
2. Vérifier les logs du job OCR
3. Tester avec un PDF natif (texte inclus) vs scanné

### Classification retourne "AUTRE"

**Symptôme** : Tous les documents classés en "AUTRE"

**Solutions** :
1. Vérifier que le seed a été exécuté : `node scripts/seed-documents-system.js`
2. Vérifier les mots-clés en base : `await prisma.documentKeyword.findMany()`
3. Augmenter les logs dans `ClassificationService`

### Champs non extraits

**Symptôme** : `fields: []`

**Solutions** :
1. Vérifier que le document a un type assigné
2. Vérifier les règles d'extraction : `await prisma.documentExtractionRule.findMany()`
3. Tester les regex en isolation

### Upload bloqué

**Symptôme** : Upload ne termine jamais

**Solutions** :
1. Vérifier la taille du fichier (limite Next.js: 10MB par défaut)
2. Vérifier les permissions du dossier `storage/documents/`
3. Vérifier les logs de la queue

---

## 💡 Bonnes pratiques

### 1. Nommage des documents

Utiliser `filenameNormalized` :
```
{TYPE}-{YYYY}-{MM}-{entity}-{entityId}-{slug}.pdf
```

Exemple : `BAIL-2024-01-property-clxxx-dupont-25-rue-hugo.pdf`

### 2. Tags

Utiliser des tags cohérents :
- `urgent`, `à_signer`, `vérifié`
- `2024`, `T1-2024`
- `fiscalité`, `travaux`

### 3. Sécurité

- Les documents sensibles (`isSensitive: true`) doivent être masqués en partie dans l'UI
- RLS par `ownerId` à implémenter côté API
- HTTPS obligatoire en production

### 4. Performance

- Limiter les uploads à 10 fichiers max par batch
- Paginer les listes (limite 50 par défaut)
- Indexer les documents en background (job async)

---

## 📞 Support

Pour toute question ou bug :
1. Vérifier cette documentation
2. Lire les logs : `console.log` dans les services
3. Tester avec `curl` les routes API
4. Inspecter la base : `npx prisma studio`

---

**Version** : 1.0.0  
**Dernière mise à jour** : 2025-01-13


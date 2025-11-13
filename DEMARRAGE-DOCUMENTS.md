# 🚀 Démarrage Rapide - Système Documents

## ✅ Ce qui a été implémenté

### 1. **Schéma de base de données** (Prisma)
- ✅ `DocumentType`, `DocumentTypeField`, `DocumentExtractionRule`, `DocumentKeyword`
- ✅ `Document`, `DocumentField`, `DocumentTextIndex`
- ✅ `Reminder`
- ✅ Extension du modèle `Document` existant avec nouveaux champs

### 2. **Services Backend**
- ✅ `StorageService` - Gestion fichiers (local + stubs S3/Supabase)
- ✅ `OcrService` - Extraction texte (mock + interfaces extensibles)
- ✅ `ClassificationService` - Classification automatique par mots-clés pondérés
- ✅ `ExtractionService` - Extraction champs via regex + post-processing
- ✅ `DocumentQueueService` - Pipeline de traitement asynchrone

### 3. **API Routes** (Next.js)
- ✅ `POST /api/documents` - Upload multi-fichiers
- ✅ `GET /api/documents` - Recherche & liste avec filtres
- ✅ `GET /api/documents/:id` - Détails document
- ✅ `PATCH /api/documents/:id` - Mise à jour
- ✅ `DELETE /api/documents/:id` - Soft/hard delete
- ✅ `POST /api/documents/:id/classify` - Re-classification
- ✅ `POST /api/documents/:id/extract` - Re-extraction
- ✅ `POST /api/documents/:id/reminders` - Création rappels
- ✅ `GET /api/documents/:id/download` - Téléchargement
- ✅ `POST /api/documents/bulk` - Opérations en masse

### 4. **Composants React**
- ✅ `UploadDropzone` - Zone drag & drop
- ✅ `DocumentCard` - Détail document (panneau latéral)
- ✅ `DocumentsGeneralPage` - Page liste globale
- ✅ `PropertyDocumentsTab` - Onglet documents d'un bien

### 5. **Hooks React**
- ✅ `useDocuments` - Liste avec filtres & pagination
- ✅ `useDocument` - Détail d'un document
- ✅ `useDocumentUpload` - Upload avec progress
- ✅ `useDocumentActions` - Actions (update, delete, reclassify, etc.)

### 6. **Données de seed**
- ✅ 12 types de documents prédéfinis
- ✅ ~50 champs type
- ✅ ~30 règles d'extraction (regex)
- ✅ ~80 mots-clés pondérés

### 7. **Documentation**
- ✅ Guide complet : `docs/DOCUMENTS-SYSTEM.md`

---

## 📦 Installation & Mise en route

### Étape 1 : Installer les dépendances manquantes

```bash
npm install react-dropzone date-fns pdf-lib
```

### Étape 2 : Lancer les migrations Prisma

```bash
npx prisma migrate dev --name add-documents-system
```

Cela va créer toutes les tables nécessaires.

### Étape 3 : Seed des types de documents

```bash
node scripts/seed-documents-system.js
```

Cela va peupler :
- Les 12 types de documents (BAIL, QUITTANCE, ASSURANCE, etc.)
- Les champs attendus pour chaque type
- Les règles d'extraction regex
- Les mots-clés de classification

### Étape 4 : Créer le dossier de stockage

```bash
mkdir -p storage/documents
```

### Étape 5 : Tester !

#### Test 1 : Page Documents Généraux

Créer une nouvelle page Next.js :

```tsx
// src/app/documents/page.tsx
import { DocumentsGeneralPage } from '@/components/documents/DocumentsGeneralPage';

export default function DocumentsPage() {
  return <DocumentsGeneralPage />;
}
```

Accéder à : `http://localhost:3000/documents`

#### Test 2 : Onglet Documents dans un Bien

Dans la page de détail d'un bien existant, ajouter :

```tsx
import { PropertyDocumentsTab } from '@/components/documents/PropertyDocumentsTab';

// Dans vos tabs:
<Tab label="Documents">
  <PropertyDocumentsTab 
    propertyId={propertyId} 
    propertyName={property.name}
  />
</Tab>
```

---

## 🧪 Tests rapides

### Upload & Classification automatique

1. Uploader un PDF nommé `attestation-assurance-habitation.pdf`
2. Le système devrait :
   - ✅ Extraire le texte (OCR mock)
   - ✅ Classifier automatiquement → `ATTESTATION_ASSURANCE`
   - ✅ Afficher un score de confiance
   - ✅ Créer des rappels J-30 et J-7 si date d'expiration détectée

### Recherche

1. Uploader plusieurs documents
2. Utiliser la barre de recherche : "bail", "assurance", etc.
3. Les documents devraient être filtrés par nom et contenu

### Soft-delete

1. Supprimer un document (bouton Supprimer)
2. Il disparaît de la liste
3. Cocher "Inclure supprimés" → Il réapparaît (opacité réduite)
4. Opération en masse : Restore

---

## 🔧 Configuration avancée

### Activer OCR réel (Tesseract.js)

```bash
npm install tesseract.js
```

Dans `.env` :
```
OCR_PROVIDER=tesseract
```

Modifier `src/services/ocr.service.ts` pour implémenter `TesseractOcrProvider`.

### Activer stockage S3

```bash
npm install @aws-sdk/client-s3
```

Dans `.env` :
```
STORAGE_TYPE=s3
S3_BUCKET=smartimmo-documents
S3_REGION=eu-west-3
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
```

Modifier `src/services/storage.service.ts` pour implémenter `S3StorageProvider`.

### Activer FTS avec PostgreSQL

Remplacer SQLite par PostgreSQL dans `prisma/schema.prisma` :

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Puis implémenter un index FTS sur `DocumentTextIndex.content`.

---

## 📁 Structure des fichiers créés

```
prisma/
  schema.prisma                         # ✅ Modifié (nouveaux modèles)

src/
  types/
    documents.ts                        # ✅ Types & schemas Zod
  
  services/
    storage.service.ts                  # ✅ Stockage fichiers
    ocr.service.ts                      # ✅ OCR (stub + interfaces)
    classification.service.ts           # ✅ Classification auto
    extraction.service.ts               # ✅ Extraction champs
    jobs/
      document-queue.service.ts         # ✅ Queue & jobs
  
  app/api/documents/
    route.ts                            # ✅ Upload & recherche
    [id]/route.ts                       # ✅ CRUD document
    [id]/classify/route.ts              # ✅ Re-classification
    [id]/extract/route.ts               # ✅ Re-extraction
    [id]/reminders/route.ts             # ✅ Rappels
    [id]/download/route.ts              # ✅ Téléchargement
    bulk/route.ts                       # ✅ Opérations masse
  
  hooks/
    useDocuments.ts                     # ✅ Hook liste & détail
    useDocumentUpload.ts                # ✅ Hook upload
    useDocumentActions.ts               # ✅ Hook actions
  
  components/documents/
    UploadDropzone.tsx                  # ✅ Upload drag & drop
    DocumentCard.tsx                    # ✅ Détail document
    DocumentsGeneralPage.tsx            # ✅ Page liste
    PropertyDocumentsTab.tsx            # ✅ Onglet dans Bien

scripts/
  seed-documents-system.js              # ✅ Seed types + règles

docs/
  DOCUMENTS-SYSTEM.md                   # ✅ Documentation complète
```

---

## 🐛 Dépannage rapide

### Erreur : Module not found 'react-dropzone'

```bash
npm install react-dropzone
```

### Erreur : prisma.documentType is not a function

Regénérer le client Prisma :
```bash
npx prisma generate
```

### Uploads ne fonctionnent pas

Vérifier :
1. Le dossier `storage/documents/` existe et est accessible en écriture
2. La limite de taille de fichier Next.js (config dans `next.config.mjs`)

### Classification toujours "AUTRE"

Vérifier que le seed a été exécuté :
```bash
node scripts/seed-documents-system.js
```

Puis inspecter :
```bash
npx prisma studio
# Vérifier tables: DocumentType, DocumentKeyword
```

---

## 🎯 Prochaines étapes

1. **Tester en local** avec quelques documents réels
2. **Ajuster les mots-clés** si besoin (via Prisma Studio ou script)
3. **Implémenter un vrai OCR** (Tesseract.js ou API cloud)
4. **Brancher sur S3/Supabase** pour stockage production
5. **Ajouter la route page** `/documents` dans votre navigation

---

## 📚 Documentation complète

Voir : **`docs/DOCUMENTS-SYSTEM.md`**

Contient :
- Architecture détaillée
- API complète
- Algorithmes de classification
- Règles d'extraction
- Exemples de code
- Troubleshooting avancé

---

## ✨ Félicitations !

Vous avez maintenant un système de gestion documentaire complet avec :
- 📤 Upload multi-fichiers
- 🤖 Classification automatique
- 🔍 Extraction de champs
- 🔔 Rappels d'échéances
- 🗂️ Rattachements aux entités
- 🔎 Recherche full-text

**Bon développement !** 🚀


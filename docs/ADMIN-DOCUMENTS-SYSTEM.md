# Système d'Administration des Documents

## Vue d'ensemble

Le système d'administration des documents permet de gérer entièrement la classification et l'extraction de documents via l'interface web, sans code en dur. Toute la logique est paramétrable via la base de données.

## Fonctionnalités

### 1. Gestion des Types de Documents

- **CRUD complet** des types de documents
- **Mots-clés pondérés** pour la classification
- **Signaux de détection** (IBAN, SIREN, patterns, etc.)
- **Règles d'extraction** avec regex et post-processing
- **Seuils d'auto-assign** configurables par type
- **Import/Export JSON** de la configuration

### 2. Classification Automatique

- **Score pondéré** basé sur les mots-clés et signaux
- **Cache intelligent** avec invalidation automatique
- **Top 3** des types les plus probables
- **Auto-assign** selon les seuils configurables
- **Fallback** vers classification basique en cas d'erreur

### 3. Extraction de Champs

- **Règles regex** paramétrables par type
- **Post-processing** automatique (dates FR, montants, IBAN, etc.)
- **Confiance** calculée pour chaque extraction
- **Priorités** pour ordonner les règles
- **Cache** pour optimiser les performances

## Architecture

### Modèles Prisma

```prisma
model DocumentType {
  id                String   @id @default(cuid())
  code              String   @unique
  label             String
  description       String?
  icon              String?
  isSystem          Boolean  @default(false)
  isActive          Boolean  @default(true)
  order             Int?     @default(0)
  isSensitive       Boolean  @default(false)
  autoAssignThreshold Float? // Seuil pour auto-assign (0.0-1.0)
  
  documents Document[]
  keywords  DocumentKeyword[]
  signals   DocumentSignal[]
  rules     DocumentExtractionRule[]
}

model DocumentKeyword {
  id              String       @id @default(cuid())
  documentTypeId  String
  keyword         String       // mot-clé ou phrase
  weight          Float        @default(1.0) // poids (0-10)
  context         String?      // 'title', 'body', 'footer'
  
  documentType    DocumentType @relation(fields: [documentTypeId], references: [id], onDelete: Cascade)
}

model DocumentSignal {
  id              String       @id @default(cuid())
  documentTypeId  String
  code            String       // 'HAS_IBAN', 'META_PDF_TITLE', etc.
  label           String       // label lisible
  weight          Float        @default(1.0) // poids (0-10)
  description     String?      // description du signal
  
  documentType    DocumentType @relation(fields: [documentTypeId], references: [id], onDelete: Cascade)
}

model DocumentExtractionRule {
  id              String       @id @default(cuid())
  documentTypeId  String
  fieldName       String       // nom du champ à extraire
  pattern         String       // regex pattern
  postProcess     String?      // 'fr_date', 'money_eur', 'iban', etc.
  priority        Int          @default(100)
  description     String?
  
  documentType    DocumentType @relation(fields: [documentTypeId], references: [id], onDelete: Cascade)
}
```

### Services

#### ClassificationBDDService

```typescript
class ClassificationBDDService {
  // Classifie un document en utilisant la config BDD
  async classifyDocument(text: string, documentId?: string): Promise<ClassificationResult[]>
  
  // Obtient le seuil d'auto-assign pour un type
  async getAutoAssignThreshold(typeId: string): Promise<number>
  
  // Détermine si un document doit être auto-assigné
  async shouldAutoAssign(confidence: number, typeId: string): Promise<boolean>
  
  // Invalide le cache
  async invalidateCache(): Promise<void>
}
```

#### ExtractionBDDService

```typescript
class ExtractionBDDService {
  // Extrait les champs d'un document en utilisant la config BDD
  async extractFields(text: string, documentTypeId: string, documentId?: string): Promise<ExtractionResult[]>
  
  // Post-traite une valeur selon le type
  private postProcessValue(value: string, postProcess?: string): string | number | Date
  
  // Invalide le cache
  async invalidateCache(): Promise<void>
}
```

### Cache et Invalidation

Le système utilise un cache intelligent avec invalidation automatique :

1. **Cache mémoire** (60 secondes TTL)
2. **Version de configuration** dans `AppConfig`
3. **Invalidation automatique** à chaque modification
4. **Fallback** vers la BDD si cache expiré

## API Routes

### Types de Documents

- `GET /api/admin/document-types` - Liste des types
- `POST /api/admin/document-types` - Créer un type
- `GET /api/admin/document-types/[id]` - Détails d'un type
- `PATCH /api/admin/document-types/[id]` - Modifier un type
- `DELETE /api/admin/document-types/[id]` - Supprimer un type

### Mots-clés

- `GET /api/admin/document-types/[id]/keywords` - Liste des mots-clés
- `POST /api/admin/document-types/[id]/keywords` - Créer un mot-clé
- `PUT /api/admin/document-types/[id]/keywords` - Mettre à jour tous les mots-clés

### Signaux

- `GET /api/admin/document-types/[id]/signals` - Liste des signaux
- `POST /api/admin/document-types/[id]/signals` - Créer un signal
- `PUT /api/admin/document-types/[id]/signals` - Mettre à jour tous les signaux

### Règles d'Extraction

- `GET /api/admin/document-types/[id]/extraction-rules` - Liste des règles
- `POST /api/admin/document-types/[id]/extraction-rules` - Créer une règle
- `PUT /api/admin/document-types/[id]/extraction-rules` - Mettre à jour toutes les règles

### Test en Live

- `POST /api/admin/document-types/[id]/test` - Tester classification et extraction

### Import/Export

- `GET /api/admin/document-config/export` - Exporter la configuration
- `POST /api/admin/document-config/import` - Importer la configuration

## Interface d'Administration

### Page Principale (`/admin/documents/types`)

- **Liste des types** avec métadonnées (nombre de mots-clés, signaux, règles)
- **Filtres** par statut (actif/inactif)
- **Recherche** par nom ou code
- **Actions** : Éditer, Dupliquer, Tester, Exporter, Supprimer

### Modale d'Édition

- **Métadonnées** : Code, label, description, seuil auto-assign
- **Mots-clés** : Tableau avec poids et contexte
- **Signaux** : Tableau avec code, label et poids
- **Règles d'extraction** : Tableau avec regex, post-process et priorité
- **Bouton Test** : Ouverture du drawer de test

### Drawer de Test

- **Onglet Texte OCR** : Textarea pour tester sur du texte
- **Onglet Fichier** : Upload pour tester sur un fichier
- **Résultats** : Top 3 types + champs extraits
- **Prévisualisation** des regex sur un échantillon

## Types de Documents Prédéfinis

### 1. Bail Signé (BAIL_SIGNE)
- **Mots-clés** : bail, contrat, location, locataire, loyer, charges, garantie
- **Signaux** : HAS_DATE_RANGE, HAS_AMOUNT, HAS_ADDRESS
- **Champs** : start_date, end_date, rent_amount, charges_amount, deposit_amount

### 2. Quittance de Loyer (QUITTANCE)
- **Mots-clés** : quittance, loyer, paiement, reçu, encaissement
- **Signaux** : HAS_AMOUNT, MONTH_YEAR_PATTERN
- **Champs** : period_month, period_year, amount_paid, payment_date

### 3. Attestation d'Assurance (ATTESTATION_ASSURANCE)
- **Mots-clés** : attestation, assurance, garantie, police, risques
- **Signaux** : HEADER_ASSUREUR, HAS_EXPIRY_DATE
- **Champs** : expiry_date, policy_number, insurer_name, premium_amount

### 4. Taxe Foncière (TAXE_FONCIERE)
- **Mots-clés** : taxe, foncière, propriété, impôt
- **Signaux** : HEADER_IMPOTS, HAS_AMOUNT, HAS_YEAR
- **Champs** : tax_year, total_amount, property_address

### 5. DPE (DPE)
- **Mots-clés** : diagnostic, performance, énergétique, dpe, classe
- **Signaux** : HAS_ENERGY_CLASS, HAS_VALIDITY_DATE
- **Champs** : energy_class, valid_until, consumption

## Scripts Utilitaires

### Seed des Types de Documents

```bash
npm run db:seed-document-types
```

Initialise les 5 types de documents prédéfinis avec leur configuration complète.

### Test du Système

```bash
npm run db:test-document-admin
```

Exécute une suite de tests complète pour vérifier le fonctionnement du système.

## Intégration avec le Système de Documents

### Classification Automatique

Le service de classification utilise maintenant la configuration BDD :

```typescript
// Dans le service de documents
const classificationResult = await classificationBDDService.classifyDocument(text, documentId);

// Auto-assign si confiance suffisante
if (classificationResult.length > 0) {
  const topResult = classificationResult[0];
  const shouldAutoAssign = await classificationBDDService.shouldAutoAssign(
    topResult.confidence, 
    topResult.typeId
  );
  
  if (shouldAutoAssign) {
    // Assigner automatiquement le type
    await updateDocumentType(documentId, topResult.typeId, topResult.confidence);
  }
}
```

### Extraction de Champs

L'extraction utilise également la configuration BDD :

```typescript
// Dans le service de documents
const extractionResults = await extractionBDDService.extractFields(text, documentTypeId, documentId);

// Sauvegarder les champs extraits
for (const result of extractionResults) {
  await saveDocumentField(documentId, {
    fieldName: result.fieldName,
    value: result.value,
    confidence: result.confidence,
    sourceRuleId: result.ruleId,
  });
}
```

## Sécurité et Performance

### Sécurité

- **Validation Zod** sur toutes les entrées
- **Sanitisation** des regex pour éviter les injections
- **Vérification** des permissions (à implémenter selon vos besoins)
- **Audit trail** des modifications (via timestamps)

### Performance

- **Cache mémoire** avec TTL de 60 secondes
- **Invalidation intelligente** uniquement quand nécessaire
- **Indexation** sur les champs fréquemment utilisés
- **Pagination** sur les listes volumineuses

## Évolutions Futures

### Fonctionnalités Avancées

1. **Machine Learning** : Intégration d'un modèle léger pour améliorer la classification
2. **Analyse de Layout** : Détection de la structure des documents (en-têtes, pieds de page)
3. **OCR Avancé** : Intégration avec des services OCR plus performants
4. **Workflow** : Pipeline de traitement avec étapes configurables
5. **Analytics** : Métriques sur la performance de classification et extraction

### Optimisations

1. **Cache Redis** : Remplacement du cache mémoire par Redis
2. **Indexation Elasticsearch** : Pour la recherche full-text avancée
3. **Queue asynchrone** : Traitement en arrière-plan des gros volumes
4. **API GraphQL** : Pour des requêtes plus flexibles

## Conclusion

Le système d'administration des documents offre une solution complète et flexible pour la gestion de la classification et de l'extraction de documents. Toute la logique métier est paramétrable via l'interface web, permettant une adaptation rapide aux besoins spécifiques sans modification du code.

La séparation claire entre la configuration (BDD) et l'implémentation (services) garantit la maintenabilité et l'évolutivité du système.

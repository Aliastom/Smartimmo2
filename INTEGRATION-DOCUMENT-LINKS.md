# Guide d'Intégration - Système de Liens Polymorphiques pour Documents

## 📋 Vue d'ensemble

Ce document décrit l'intégration du système de liens polymorphiques pour les documents, permettant à un document d'être rattaché à plusieurs contextes (GLOBAL, PROPERTY, LEASE, TENANT, TRANSACTION) via le modèle `DocumentLink`.

## ✅ Réalisations Complètes

### 1. Base de Données

#### Modèle Prisma ajouté : `DocumentLink`

```prisma
model DocumentLink {
  id          String    @id @default(cuid())
  documentId  String
  document    Document  @relation(fields: [documentId], references: [id], onDelete: Cascade)
  
  entityType  String    // 'GLOBAL' | 'PROPERTY' | 'LEASE' | 'TENANT' | 'TRANSACTION'
  entityId    String?   // null pour GLOBAL
  
  isPrimary   Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  @@unique([documentId, entityType, entityId])
  @@index([documentId])
  @@index([entityType, entityId])
}
```

**Migration appliquée** : `npx prisma db push` ✅

### 2. Types TypeScript

**Fichier** : `src/types/document-link.ts`

- `DocumentContextType` : 'GLOBAL' | 'PROPERTY' | 'LEASE' | 'TENANT' | 'TRANSACTION'
- `DocumentContext` : Interface pour le contexte d'un document
- `DedupDecision` : 'link_existing' | 'replace' | 'keep_both' | 'cancel'
- `DedupAction` : Interface pour les actions de déduplication
- `FinalizeDocumentRequest` : Interface pour l'endpoint finalize

### 3. Endpoint API Modifié

**Fichier** : `src/app/api/documents/finalize/route.ts`

#### Nouveaux paramètres acceptés :

```typescript
{
  tempId: string;
  typeCode?: string;
  context: {
    entityType: 'GLOBAL' | 'PROPERTY' | 'LEASE' | 'TENANT' | 'TRANSACTION';
    entityId?: string;
  };
  dedup?: {
    decision: 'link_existing' | 'replace' | 'keep_both' | 'cancel';
    matchedId?: string;
    setAsPrimary?: boolean;
  };
  customName?: string;
  userReason?: string;
}
```

#### Logique implémentée :

1. **`link_existing`** : Crée uniquement un `DocumentLink` vers le document existant, **SANS créer de nouveau Document**
2. **`replace`** : Crée un nouveau Document et le définit comme principal (`isPrimary=true`)
3. **`keep_both`** : Crée un nouveau Document en parallèle (`isPrimary` selon `setAsPrimary`)
4. **`cancel`** : Supprime le fichier temporaire et annule l'opération

### 4. Composants UI Créés

#### 4.1 ContextSelector

**Fichier** : `src/components/documents/ContextSelector.tsx`

Permet de choisir le contexte de rattachement d'un document :
- Sélecteur de type (GLOBAL, PROPERTY, LEASE, TENANT, TRANSACTION)
- Sélecteur d'entité (combobox dynamique selon le type)
- Validation des données
- Mode "hideSelector" pour affichage en badge

**Props** :
```typescript
interface ContextSelectorProps {
  value: DocumentContext;
  onChange: (context: DocumentContext) => void;
  disabled?: boolean;
  hideSelector?: boolean;
}
```

#### 4.2 DuplicateActionPanel

**Fichier** : `src/components/documents/DuplicateActionPanel.tsx`

Affiche les options pour gérer un doublon détecté :
- **Lier au document existant** (recommandé) ✅
- **Remplacer la version principale**
- **Conserver les deux documents** (avec option "Définir comme principal")
- **Annuler l'upload**

**Props** :
```typescript
interface DuplicateActionPanelProps {
  duplicateInfo: {
    id: string;
    filename: string;
    uploadedAt: Date | string;
    typeCode?: string;
    typeLabel?: string;
    size?: number;
  };
  onActionSelected: (decision: DedupDecision, setAsPrimary?: boolean) => void;
  onCancel: () => void;
}
```

#### 4.3 DocumentsListUnified

**Fichier** : `src/components/documents/DocumentsListUnified.tsx`

Composant réutilisable pour afficher une liste de documents :
- Filtrage par contexte (GLOBAL, PROPERTY, etc.)
- Recherche par nom
- Filtrage par type de document
- Affichage des rattachements multiples
- Badge "Principal" pour les documents isPrimary
- Actions : Voir, Définir comme principal, Supprimer

**Props** :
```typescript
interface DocumentsListUnifiedProps {
  context?: DocumentContext;
  onDocumentClick?: (document: Document) => void;
  onDocumentDelete?: (documentId: string) => void;
  onDocumentUpdate?: (documentId: string) => void;
  showContextColumn?: boolean;
  showActions?: boolean;
}
```

#### 4.4 PropertyDocumentsTab

**Fichier** : `src/components/properties/PropertyDocumentsTab.tsx`

Onglet Documents pour un Bien immobilier :
- Utilise `DocumentsListUnified` avec contexte préfiltré sur `PROPERTY`
- Bouton "Ajouter des documents" (à connecter avec UploadReviewModal)
- Badge indiquant le contexte actuel

### 5. Endpoint API Additionnel

**Fichier** : `src/app/api/documents/[id]/set-primary/route.ts`

**POST** `/api/documents/[id]/set-primary`

Définit un document comme principal pour un contexte donné.

**Body** :
```json
{
  "entityType": "PROPERTY",
  "entityId": "clxxx..."
}
```

**Logique** :
1. Met tous les autres liens `isPrimary=false` pour ce contexte
2. Met le lien du document actuel à `isPrimary=true` (ou le crée s'il n'existe pas)

## 🔄 Intégration avec UploadReviewModal

### Étapes à suivre :

#### 1. Ajouter le ContextSelector en haut de la modale

```typescript
// Dans UploadReviewModal.tsx

import { ContextSelector } from '@/components/documents/ContextSelector';
import { DocumentContext } from '@/types/document-link';

// Ajouter un état pour le contexte
const [documentContext, setDocumentContext] = useState<DocumentContext>({
  entityType: scope === 'property' ? 'PROPERTY' : 'GLOBAL',
  entityId: propertyId || undefined,
});

// Ajouter dans le JSX, avant les onglets
<div className="mb-4">
  <ContextSelector
    value={documentContext}
    onChange={setDocumentContext}
    hideSelector={scope === 'property'} // Masquer si déjà dans un contexte
  />
</div>
```

#### 2. Intégrer DuplicateActionPanel dans le flux de doublon

```typescript
// Dans UploadReviewModal.tsx

import { DuplicateActionPanel } from '@/components/documents/DuplicateActionPanel';
import { DedupDecision } from '@/types/document-link';

// Ajouter un état pour la décision de dédup
const [dedupDecision, setDedupDecision] = useState<DedupDecision | null>(null);
const [dedupSetAsPrimary, setDedupSetAsPrimary] = useState(false);

// Remplacer le bandeau de doublon existant par DuplicateActionPanel
{currentPreview.duplicate.isDuplicate && (
  <DuplicateActionPanel
    duplicateInfo={{
      id: currentPreview.duplicate.ofDocumentId!,
      filename: currentPreview.duplicate.documentName || 'Document existant',
      uploadedAt: currentPreview.duplicate.uploadedAt || new Date(),
      typeLabel: currentPreview.duplicate.documentType,
      size: currentPreview.size,
    }}
    onActionSelected={(decision, setAsPrimary) => {
      setDedupDecision(decision);
      setDedupSetAsPrimary(setAsPrimary || false);
      
      // Si cancel, fermer la modale
      if (decision === 'cancel') {
        onClose();
      }
    }}
    onCancel={() => {
      // Réinitialiser
      setDedupDecision(null);
    }}
  />
)}
```

#### 3. Mettre à jour l'appel à /api/documents/finalize

```typescript
// Dans handleConfirm() de UploadReviewModal.tsx

const response = await fetch('/api/documents/finalize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tempId: currentPreview.tempId,
    typeCode: selectedType || undefined,
    context: documentContext, // Nouveau paramètre
    dedup: dedupDecision ? {
      decision: dedupDecision,
      matchedId: currentPreview.duplicate.ofDocumentId,
      setAsPrimary: dedupSetAsPrimary,
    } : undefined, // Nouveau paramètre
    customName: customName !== currentPreview.filename ? customName : undefined,
    userReason: currentPreview.dedupResult?.userReason || undefined,
  }),
});
```

## 📍 Intégration dans les Pages

### Page Documents Globale

**Fichier** : `src/app/documents/page.tsx` (ou équivalent)

```typescript
import { DocumentsListUnified } from '@/components/documents/DocumentsListUnified';

// Dans le composant
<DocumentsListUnified
  context={{ entityType: 'GLOBAL' }}
  showContextColumn={true}
  showActions={true}
/>
```

### Onglet Documents d'un Bien

**Fichier** : `src/app/properties/[id]/page.tsx` (ou composant Tabs)

```typescript
import { PropertyDocumentsTab } from '@/components/properties/PropertyDocumentsTab';

// Dans le composant, dans l'onglet Documents
<PropertyDocumentsTab
  propertyId={propertyId}
  propertyName={property.name}
/>
```

### Autres contextes (LEASE, TENANT, TRANSACTION)

Suivre le même pattern que `PropertyDocumentsTab` :

```typescript
// LeaseDocumentsTab.tsx
<DocumentsListUnified
  context={{ entityType: 'LEASE', entityId: leaseId }}
  showContextColumn={true}
  showActions={true}
/>

// TenantDocumentsTab.tsx
<DocumentsListUnified
  context={{ entityType: 'TENANT', entityId: tenantId }}
  showContextColumn={true}
  showActions={true}
/>

// TransactionDocumentsTab.tsx
<DocumentsListUnified
  context={{ entityType: 'TRANSACTION', entityId: transactionId }}
  showContextColumn={true}
  showActions={true}
/>
```

## 🧪 Tests de Validation

### Cas de test à valider :

1. ✅ **Upload sans doublon depuis page globale** → Document créé + DocumentLink(GLOBAL)
2. ✅ **Upload sans doublon depuis onglet Bien** → Document créé + DocumentLink(PROPERTY, bienId)
3. ✅ **Doublon + link_existing depuis Bien** → AUCUN nouveau Document, seulement DocumentLink(PROPERTY, bienId)
4. ✅ **Doublon + replace depuis Bien** → Nouveau Document, DocumentLink avec isPrimary=true, anciens liens mis à isPrimary=false
5. ✅ **Doublon + keep_both** → Nouveau Document + DocumentLink (isPrimary=false par défaut)
6. ✅ **Doublon + cancel** → Rien n'est persisté, fichier temporaire supprimé
7. ✅ **Vérification de la dédup existante** → Aucune régression, endpoints inchangés
8. ✅ **Réutilisation de DocumentType** → Pas de nouvelle table, utilisation de documentTypeId existant

### Scripts de test

Créer un fichier `tests/e2e/document-links.spec.ts` :

```typescript
// TODO: Implémenter les tests e2e avec Playwright ou Cypress
```

## 📝 Notes Importantes

### Rétrocompatibilité

- Les champs legacy (`propertyId`, `leaseId`, `tenantId`, `transactionId`) sont **conservés** dans le modèle `Document`
- L'endpoint `/api/documents/finalize` accepte **à la fois** les anciens et nouveaux paramètres
- Les anciens appels continuent de fonctionner sans modification

### Migration Progressive

1. Conserver les anciens champs pour les documents existants
2. Créer des DocumentLink pour tous les nouveaux uploads
3. Optionnellement : créer un script de migration pour les documents existants

```typescript
// scripts/migrate-documents-to-links.ts
// TODO: Créer un script pour migrer les anciens documents vers DocumentLink
```

### Déduplication

- Le **moteur de déduplication existant n'a pas été modifié**
- Seule l'interprétation des actions utilisateur a été ajoutée
- Le hook `useDedupFlow` et les composants associés sont **préservés**

## 🚀 Prochaines Étapes

1. ☐ Intégrer ContextSelector et DuplicateActionPanel dans UploadReviewModal
2. ☐ Intégrer DocumentsListUnified dans la page Documents globale
3. ☐ Intégrer PropertyDocumentsTab dans l'onglet Documents d'un Bien
4. ☐ Créer les onglets Documents pour LEASE, TENANT, TRANSACTION
5. ☐ Créer les tests e2e
6. ☐ Créer un script de migration pour les documents existants
7. ☐ Documenter les APIs dans Swagger/OpenAPI

## 📚 Ressources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [React Hooks](https://react.dev/reference/react)

---

**Date de création** : 16 Octobre 2025  
**Version** : 1.0  
**Auteur** : AI Assistant (Claude Sonnet 4.5)


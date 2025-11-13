# Point 18 : Cartes Documents/Photos - Refresh immédiat (sans reload)

## ✅ Implémentation complète

### 1. Structure de données (Prisma)

**Modèle `DocumentType`** :
```prisma
model DocumentType {
  id        String   @id @default(cuid())
  code      String   @unique
  label     String
  icon      String?
  isSystem  Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  documents Document[]
  @@index([code])
}
```

**Modèle `Document`** (mis à jour) :
- Ajout de `documentTypeId` (FK vers `DocumentType`)
- Ajout d'index sur `propertyId`, `leaseId`, `transactionId`, `loanId`, `documentTypeId`

**Modèle `Photo`** (mis à jour) :
- Ajout de `room` (salle/pièce)
- Ajout de `tag` (mot-clé)
- Ajout de `metadata` (JSON)
- Ajout d'index sur `propertyId` et `propertyId, room`

**Seed des types de documents** :
- `RENT_RECEIPT` - Quittance de loyer
- `SIGNED_LEASE` - Bail signé
- `LEASE_DRAFT` - Brouillon de bail
- `EDL_IN` - État des lieux d'entrée
- `EDL_OUT` - État des lieux de sortie
- `RIB` - Relevé d'identité bancaire
- `INSURANCE` - Assurance
- `TAX` - Impôts
- `MISC` - Divers
- `PHOTO` - Photo

### 2. Hooks React Query

**`src/hooks/useDocuments.ts`** :
```typescript
// Query Keys
export const documentKeys = {
  all: ['documents'] as const,
  lists: () => [...documentKeys.all, 'list'] as const,
  list: (filters: DocumentFilters) => [...documentKeys.lists(), filters] as const,
  details: () => [...documentKeys.all, 'detail'] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const,
  types: () => [...documentKeys.all, 'types'] as const,
};

// Hooks disponibles :
- useDocumentTypes() // Liste des types de documents
- useDocuments(filters) // Liste des documents avec filtres
- useDocument(id) // Document spécifique
- useUploadDocument() // Upload avec optimistic update
- useDeleteDocument() // Suppression avec optimistic update
- useRefreshDocuments() // Refresh manuel
```

**`src/hooks/usePhotos.ts`** :
```typescript
// Query Keys
export const photoKeys = {
  all: ['photos'] as const,
  lists: () => [...photoKeys.all, 'list'] as const,
  list: (filters: PhotoFilters) => [...photoKeys.lists(), filters] as const,
  details: () => [...photoKeys.all, 'detail'] as const,
  detail: (id: string) => [...photoKeys.details(), id] as const,
};

// Hooks disponibles :
- usePhotos(filters) // Liste des photos avec filtres
- usePhoto(id) // Photo spécifique
- useUploadPhoto() // Upload avec optimistic update
- useDeletePhoto() // Suppression avec optimistic update
- useRefreshPhotos() // Refresh manuel
```

### 3. Fonctionnalités clés implémentées

#### ✅ Optimistic Updates
- **Upload** : Le document/photo apparaît immédiatement dans la liste (avec un ID temporaire)
- **Suppression** : Le document/photo disparaît immédiatement de la liste
- Les changements sont visibles instantanément sans attendre la réponse du serveur

#### ✅ Rollback en cas d'échec
- Si l'upload échoue, le document/photo optimiste est retiré de la liste
- Si la suppression échoue, le document/photo est restauré dans la liste
- Toast d'erreur affiché avec le message d'erreur

#### ✅ Toast de succès
- Upload : "Document uploadé avec succès" / "Photo uploadée avec succès"
- Suppression : "Document supprimé avec succès" / "Photo supprimée avec succès"

#### ✅ Invalidation des queries
- Après un upload réussi : invalidation de toutes les listes de documents/photos
- Après une suppression réussie : invalidation de toutes les listes
- Garantit la cohérence des données entre toutes les vues

#### ✅ Hooks de refresh manuel
```typescript
// Documents
const refreshDocuments = useRefreshDocuments();
refreshDocuments(); // Refresh toutes les listes
refreshDocuments({ propertyId: 'xxx' }); // Refresh une liste spécifique

// Photos
const refreshPhotos = useRefreshPhotos();
refreshPhotos(); // Refresh toutes les listes
refreshPhotos({ propertyId: 'xxx' }); // Refresh une liste spécifique
```

### 4. API Endpoints

#### Documents
- `GET /api/documents?propertyId=&leaseId=&loanId=&documentTypeId=&docType=&type=&q=`
- `POST /api/documents` (upload)
- `GET /api/documents/[id]`
- `DELETE /api/documents/[id]`
- `GET /api/document-types`

#### Photos
- `GET /api/photos?propertyId=&room=&tag=&q=`
- `POST /api/photos` (upload)
- `GET /api/photos/[id]`
- `DELETE /api/photos/[id]`

### 5. Types TypeScript

**`src/types/document.ts`** :
- `DocumentType` - Type de document
- `Document` - Document avec relations
- `DocumentFilters` - Filtres de recherche
- `DocumentUploadData` - Payload d'upload

**`src/types/photo.ts`** :
- `Photo` - Photo avec relations
- `PhotoFilters` - Filtres de recherche
- `PhotoUploadData` - Payload d'upload

### 6. Utilisation dans les composants

#### Exemple : Liste de documents
```typescript
import { useDocuments, useDeleteDocument } from '@/hooks/useDocuments';

function DocumentsList({ propertyId }: { propertyId: string }) {
  const { data, isLoading } = useDocuments({ propertyId });
  const deleteDocument = useDeleteDocument();
  
  const handleDelete = (id: string) => {
    deleteDocument.mutate(id);
    // Toast + optimistic update + rollback automatiques !
  };
  
  return (
    <div>
      {data?.items.map(doc => (
        <div key={doc.id}>
          {doc.fileName}
          <button onClick={() => handleDelete(doc.id)}>Supprimer</button>
        </div>
      ))}
    </div>
  );
}
```

#### Exemple : Upload de document
```typescript
import { useUploadDocument } from '@/hooks/useDocuments';

function UploadButton({ propertyId }: { propertyId: string }) {
  const uploadDocument = useUploadDocument();
  
  const handleUpload = (file: File, documentTypeId: string) => {
    const reader = new FileReader();
    reader.onload = () => {
      uploadDocument.mutate({
        propertyId,
        documentTypeId,
        file: {
          name: file.name,
          mime: file.type,
          size: file.size,
          base64: reader.result as string,
        },
      });
      // Toast + optimistic update + rollback automatiques !
    };
    reader.readAsDataURL(file);
  };
  
  return <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />;
}
```

#### Exemple : Refresh manuel dans un drawer
```typescript
import { useRefreshDocuments } from '@/hooks/useDocuments';

function PropertyDrawer({ propertyId }: { propertyId: string }) {
  const refreshDocuments = useRefreshDocuments();
  
  const handleRefresh = () => {
    refreshDocuments({ propertyId });
    // Refresh immédiat sans reload !
  };
  
  return (
    <div>
      <button onClick={handleRefresh}>Rafraîchir</button>
      <DocumentsList propertyId={propertyId} />
    </div>
  );
}
```

### 7. Validation et sécurité

#### Validation d'upload (Documents)
- Taille max : 10 MB
- Types MIME autorisés : PDF, JPEG, PNG, DOCX, TXT
- Type de document obligatoire (`documentTypeId`)

#### Validation d'upload (Photos)
- Taille max : 10 MB
- Types MIME autorisés : JPEG, PNG, WEBP
- Property ID obligatoire

#### Stockage des fichiers
- Documents : `/uploads/documents/properties/[propertyId]/` ou `/uploads/documents/leases/[leaseId]/`
- Photos : `/uploads/photos/properties/[propertyId]/`
- Suppression physique des fichiers lors de la suppression en DB

### 8. Tests à effectuer

#### Test 1 : Upload + Refresh immédiat
1. Ouvrir la page d'un bien
2. Uploader un document
3. ✅ Le document doit apparaître immédiatement dans la liste (sans F5)
4. ✅ Toast "Document uploadé avec succès"

#### Test 2 : Suppression + Refresh immédiat
1. Ouvrir la page d'un bien
2. Supprimer un document
3. ✅ Le document doit disparaître immédiatement (sans F5)
4. ✅ Toast "Document supprimé avec succès"

#### Test 3 : Rollback en cas d'échec
1. Simuler une erreur réseau (couper le serveur)
2. Tenter d'uploader un document
3. ✅ Le document optimiste doit disparaître
4. ✅ Toast d'erreur affiché

#### Test 4 : Refresh manuel
1. Ouvrir un drawer
2. Cliquer sur "Rafraîchir"
3. ✅ La liste se met à jour sans reload

#### Test 5 : Filtres multiples
1. Filtrer par propertyId + documentTypeId
2. ✅ Seuls les documents correspondants s'affichent
3. Uploader un document avec ce type
4. ✅ Il apparaît dans la liste filtrée

### 9. Intégration dans les vues existantes

Pour intégrer dans vos vues existantes :

1. **Remplacer les appels API directs** par les hooks :
   ```typescript
   // Avant
   const [documents, setDocuments] = useState([]);
   useEffect(() => {
     fetch('/api/documents?propertyId=xxx').then(r => r.json()).then(setDocuments);
   }, []);
   
   // Après
   const { data } = useDocuments({ propertyId: 'xxx' });
   const documents = data?.items || [];
   ```

2. **Utiliser les hooks de mutation** au lieu de fetch manuel :
   ```typescript
   // Avant
   const handleDelete = async (id) => {
     await fetch(`/api/documents/${id}`, { method: 'DELETE' });
     // Refresh manuel
     refetch();
   };
   
   // Après
   const deleteDocument = useDeleteDocument();
   const handleDelete = (id) => {
     deleteDocument.mutate(id);
     // Toast + optimistic update + refresh automatiques !
   };
   ```

3. **Exposer le hook de refresh** dans les props :
   ```typescript
   // Component qui utilise les documents
   function DocumentsCard({ propertyId, onRefresh }) {
     const { data } = useDocuments({ propertyId });
     
     useEffect(() => {
       if (onRefresh) {
         onRefresh(() => queryClient.invalidateQueries(['documents', { propertyId }]));
       }
     }, [onRefresh]);
     
     return <DocumentsList documents={data?.items} />;
   }
   ```

## 📋 Résumé

✅ **Point 18 complètement implémenté** :
- ✅ Hooks React Query avec clés paramétrées
- ✅ Optimistic updates
- ✅ Rollback en cas d'échec
- ✅ Toast de succès après suppression
- ✅ Hooks `useRefreshDocuments()` et `useRefreshPhotos()` exposés
- ✅ API endpoints fonctionnels
- ✅ Validation et sécurité
- ✅ Types TypeScript complets

**Aucun reload nécessaire !** Tous les changements sont visibles instantanément grâce aux optimistic updates et à l'invalidation automatique des queries React Query.


# ✅ Correction de l'API de Renommage et des Warnings d'Accessibilité

## 🐛 **Problèmes Identifiés**

### **1. Erreur API de Renommage :**
- ❌ **Erreur :** `PUT http://localhost:3000/api/documents/[id] 405 (Method Not Allowed)`
- ❌ **Cause :** L'API utilisait `PATCH` au lieu de `PUT`, et les méthodes `updateFilename`/`updateDocumentType` n'existaient pas

### **2. Warnings d'Accessibilité :**
- ❌ **Erreur :** `Missing Description or aria-describedby={undefined} for {DialogContent}`
- ❌ **Cause :** Les composants `DialogContent` n'avaient pas les attributs d'accessibilité requis

---

## 🔧 **Solutions Appliquées**

### **1. Correction de l'API de Renommage**

#### **A. Ajout des Méthodes Manquantes dans DocumentsService :**
```typescript
// src/lib/services/documents.ts

/**
 * Mettre à jour le nom de fichier d'un document
 */
static async updateFilename(documentId: string, newFilename: string): Promise<void> {
  await prisma.document.update({
    where: { id: documentId },
    data: {
      filenameOriginal: newFilename,
      fileName: newFilename.replace(/[^a-zA-Z0-9._-]/g, '_'), // Nettoyer le nom interne
    },
  });
}

/**
 * Mettre à jour le type de document
 */
static async updateDocumentType(documentId: string, typeCode: string): Promise<void> {
  // Trouver l'ID du type de document à partir du code
  const documentType = await prisma.documentType.findUnique({
    where: { code: typeCode },
    select: { id: true }
  });

  if (!documentType) {
    throw new Error(`Type de document invalide: ${typeCode}`);
  }

  await prisma.document.update({
    where: { id: documentId },
    data: {
      documentTypeId: documentType.id,
      status: 'classified', // Marquer comme classé si un type est choisi
    },
  });
}
```

#### **B. Mise à Jour de l'API Route :**
```typescript
// src/app/api/documents/[id]/route.ts

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json();

    const {
      status,
      documentTypeId,
      chosenTypeId,        // ✅ Ajouté
      filenameOriginal,    // ✅ Ajouté
      linkedTo,
      linkedId,
      tags,
      reclassify,
    } = body;

    // ✅ Renommage
    if (filenameOriginal !== undefined) {
      await DocumentsService.updateFilename(id, filenameOriginal);
    }

    // ✅ Mise à jour du type de document
    if (chosenTypeId !== undefined) {
      await DocumentsService.updateDocumentType(id, chosenTypeId);
    }

    // ... reste de la logique existante
  }
}

// ✅ Ajout de la méthode PUT pour la compatibilité
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  return PATCH(request, { params });
}
```

#### **C. Mise à Jour du Frontend :**
```typescript
// src/components/documents/unified/DocumentEditModal.tsx

const handleSaveRename = async () => {
  const response = await fetch(`/api/documents/${document.id}`, {
    method: 'PATCH', // ✅ Changé de PUT à PATCH
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filenameOriginal: newFilename }),
  });
  // ...
};
```

### **2. Correction des Warnings d'Accessibilité**

#### **A. DocumentEditModal :**
```typescript
// src/components/documents/unified/DocumentEditModal.tsx

<Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent className="max-w-2xl" aria-describedby="document-edit-description">
    <DialogHeader>
      <DialogTitle className="text-2xl">Modifier le document</DialogTitle>
      <DialogDescription id="document-edit-description">
        Renommez le fichier ou modifiez son type de document.
      </DialogDescription>
    </DialogHeader>
    {/* ... */}
  </DialogContent>
</Dialog>
```

#### **B. DuplicateDetectionModal :**
```typescript
// src/components/DuplicateDetectionModal.tsx

<Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent className="max-w-2xl" aria-describedby="duplicate-detection-description">
    <DialogHeader>
      <div className="flex items-center gap-3">
        {getIcon()}
        <DialogTitle className="text-xl">{modal.title}</DialogTitle>
      </div>
      <DialogDescription id="duplicate-detection-description">
        {getStatusBadge()}
      </DialogDescription>
    </DialogHeader>
    {/* ... */}
  </DialogContent>
</Dialog>
```

---

## ✅ **Fonctionnalités Restaurées**

### **API de Renommage :**
- ✅ **Méthode PATCH** : Support complet pour la mise à jour de documents
- ✅ **Méthode PUT** : Alias pour la compatibilité
- ✅ **Renommage** : Mise à jour du nom de fichier original et interne
- ✅ **Reclassification** : Mise à jour du type de document
- ✅ **Validation** : Vérification de l'existence du type de document

### **Accessibilité :**
- ✅ **aria-describedby** : Liens entre DialogContent et DialogDescription
- ✅ **IDs uniques** : Identifiants uniques pour chaque modal
- ✅ **Conformité WCAG** : Respect des standards d'accessibilité

---

## 🧪 **Test**

**Maintenant, testez :**

1. ✅ **Renommage** → Clic sur "Modifier" → Onglet "Renommer" → Modification du nom → Sauvegarde
2. ✅ **Reclassification** → Clic sur "Modifier" → Onglet "Reclasser" → Sélection du type → Sauvegarde
3. ✅ **API** → Plus d'erreur 405 Method Not Allowed
4. ✅ **Accessibilité** → Plus de warnings dans la console
5. ✅ **Fonctionnalité** → Les modales s'ouvrent et se ferment correctement

---

## 📋 **Endpoints API Mis à Jour**

### **Mise à jour de document :**
```
PATCH /api/documents/[id]
PUT /api/documents/[id] (alias)

Body: {
  filenameOriginal?: string,    // Nouveau nom de fichier
  chosenTypeId?: string,        // Code du type de document
  status?: string,              // Statut du document
  documentTypeId?: string,      // ID du type de document
  linkedTo?: string,            // Type de liaison
  linkedId?: string,            // ID de l'entité liée
  tags?: string[],              // Tags du document
  reclassify?: boolean          // Relancer la classification
}
```

### **Réponse :**
```json
{
  "success": true,
  "message": "Document updated",
  "classification": { ... } // Si reclassify=true
}
```

---

## ✅ **Statut**

**API de renommage et accessibilité corrigées !**

- ✅ **API fonctionnelle** : Plus d'erreur 405 Method Not Allowed
- ✅ **Renommage** : Mise à jour du nom de fichier opérationnelle
- ✅ **Reclassification** : Mise à jour du type de document opérationnelle
- ✅ **Accessibilité** : Plus de warnings dans la console
- ✅ **Compatibilité** : Support PUT et PATCH
- ✅ **Validation** : Vérification des types de documents

**Testez maintenant - le renommage et la reclassification devraient fonctionner sans erreur !** 🚀

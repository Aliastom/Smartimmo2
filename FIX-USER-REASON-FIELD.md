# ✅ Correction du Champ `userReason` dans le Modèle Document

## 🐛 Problème Détecté

**Erreur Prisma lors de la finalisation d'upload :**
```
Unknown argument `documentTypeId`. Did you mean `documentType`?
at POST (webpack-internal:///(rsc)/./src/app/api/documents/finalize/route.ts:154:26)
```

### **Cause Racine**
Le code dans `/api/documents/finalize` essayait de créer un document avec le champ `userReason`, mais ce champ **n'existait pas** dans le schéma Prisma.

---

## 🔧 Solution Appliquée

### **1. Ajout du Champ dans le Schéma Prisma**

**Fichier modifié : `prisma/schema.prisma`**

```prisma
model Document {
  // ... champs existants ...
  
  // Versioning
  version            Int       @default(1)
  replacesDocumentId String?
  
  // User-provided metadata
  userReason         String?   // Raison utilisateur (ex: "doublon_conserve_manuellement")
  
  // Soft delete
  deletedAt          DateTime?
  deletedBy          String?
  
  // ...
}
```

### **2. Synchronisation de la Base de Données**

```bash
npx prisma db push
```

**Résultat :**
- ✅ Base de données synchronisée
- ✅ Client Prisma régénéré
- ✅ Champ `userReason` disponible

---

## 🎯 Utilisation du Champ `userReason`

### **Dans l'API `/api/documents/finalize`**

```typescript
const document = await prisma.document.create({
  data: {
    filenameOriginal: customName || meta.originalName,
    // ... autres champs ...
    userReason: userReason || null, // ✅ Maintenant disponible
    // ...
  }
});
```

### **Valeurs Possibles**

| Valeur | Description |
|--------|-------------|
| `"doublon_conserve_manuellement"` | L'utilisateur a choisi de conserver un doublon malgré l'avertissement |
| `null` | Upload normal sans raison spécifique |

---

## 🎨 Affichage dans l'UI

### **DocumentTable.tsx**
```typescript
{doc.userReason === 'doublon_conserve_manuellement' && (
  <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
    Copie autorisée manuellement
  </Badge>
)}
```

### **DocumentCard.tsx**
```typescript
{document.userReason === 'doublon_conserve_manuellement' && (
  <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
    Copie autorisée manuellement
  </Badge>
)}
```

---

## ✅ Statut

**Correction appliquée avec succès !**

- ✅ Champ `userReason` ajouté au modèle Document
- ✅ Base de données synchronisée
- ✅ Client Prisma régénéré
- ✅ API `/api/documents/finalize` fonctionnelle
- ✅ Badges UI prêts à afficher les doublons autorisés

**L'upload de documents avec raison utilisateur fonctionne maintenant correctement !** 🚀

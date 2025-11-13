# ⚠️ Problème : Liaisons bizarres dans les documents de baux

## 🔍 Description du problème

Lors de la création d'un bail, les liaisons affichées montrent :
- "LEASE" (au lieu du nom du bail)
- "PROPERTY" (au lieu du nom du bien)  
- "TENANT" (au lieu du nom du locataire)

Au lieu d'afficher :
- "Bail - appart 1"
- "Bien - appart 1"
- "Locataire - Stephanie Jasmin"

## 🎯 Cause probable

Les liaisons `DocumentLink` sont créées correctement en base de données, mais **l'affichage ne récupère pas les noms des entités liées**.

Les liaisons contiennent :
- `linkedType` : 'lease', 'property', 'tenant'
- `linkedId` : ID de l'entité
- Mais pas le **nom** de l'entité

## 📋 Correction nécessaire

Modifier le composant qui affiche les liaisons pour :
1. Récupérer les entités liées (lease, property, tenant)
2. Extraire leur nom
3. Afficher le nom au lieu du type

## 🔍 Fichiers à investiguer

- `src/components/documents/DocumentDrawer.tsx`
- `src/components/documents/unified/DocumentCard.tsx`
- `src/components/documents/unified/DocumentTable.tsx`

## ✅ Solution

Modifier la requête pour inclure les entités liées :

```typescript
const documentLinks = await prisma.documentLink.findMany({
  where: { documentId: id },
  include: {
    // Ajouter les includes pour récupérer les noms
  }
});

// Ensuite, extraire les noms :
// - Pour lease : récupérer property.name et tenant.firstName + lastName
// - Pour property : récupérer name
// - Pour tenant : récupérer firstName + lastName
```

## 📝 Note

Ce problème est **indépendant de la migration PostgreSQL**. C'est un problème d'affichage dans l'interface qui existait probablement déjà avant.

---

**Status** : À investiguer et corriger dans les composants d'affichage des liaisons de documents.

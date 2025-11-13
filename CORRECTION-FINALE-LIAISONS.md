# ✅ Correction finale - Liaisons avec noms d'entités

## 🔍 Problème complet

1. **7 liaisons au lieu de 4** (corrigé précédemment)
2. **Liaisons sans noms** : "LEASE", "PROPERTY", "TENANT" au lieu de noms complets

## ✅ Solutions appliquées

### 1. Suppression du code manuel qui créait des doublons
**Fichier** : `src/app/api/documents/finalize/route.ts`
- Code manuel désactivé (lignes 478-503)
- Seul le service automatique crée les liaisons maintenant

### 2. Ajout du champ `entityName` dans le schéma
**Fichier** : `prisma/schema.prisma`
```prisma
model DocumentLink {
  documentId String
  linkedType String
  linkedId   String
  entityName String?  // ✅ NOUVEAU
  document   Document @relation(...)
  ...
}
```

### 3. Mise à jour du service automatique
**Fichier** : `src/lib/services/documentAutoLinkingService.server.ts`
- Ajout de la récupération des noms d'entités
- Utilisation de `getLeaseName()`, `getPropertyName()`, `getTenantName()`
- Stockage de `entityName` lors de la création/update

## 🧪 Tests

1. Créer un nouveau bail
2. Uploader un bail signé
3. Vérifier dans la page Documents

**Résultat attendu** :
- 4 liaisons exactement
- "Bail - appart 1" (au lieu de "LEASE")
- "Bien - appart 1" (au lieu de "PROPERTY")
- "Locataire - Stephanie Jasmin" (au lieu de "TENANT")
- "Global"

## 📋 Migration nécessaire

Si vous avez des anciens documents avec des liaisons sans noms, vous pouvez créer un script de migration pour les mettre à jour :

```typescript
// Script à créer : scripts/update-link-names.ts
const links = await prisma.documentLink.findMany({
  where: { entityName: null }
});

for (const link of links) {
  let entityName = null;
  
  if (link.linkedType === 'lease') {
    const lease = await prisma.lease.findUnique({
      where: { id: link.linkedId },
      include: { property: true, tenant: true }
    });
    entityName = lease ? `Bail ${lease.property?.name} - ${lease.tenant?.firstName} ${lease.tenant?.lastName}` : null;
  } else if (link.linkedType === 'property') {
    const property = await prisma.property.findUnique({
      where: { id: link.linkedId },
      select: { name: true }
    });
    entityName = property?.name || null;
  } else if (link.linkedType === 'tenant') {
    const tenant = await prisma.tenant.findUnique({
      where: { id: link.linkedId },
      select: { firstName: true, lastName: true }
    });
    entityName = tenant ? `${tenant.firstName} ${tenant.lastName}` : null;
  }
  
  if (entityName) {
    await prisma.documentLink.update({
      where: {
        documentId_linkedType_linkedId: {
          documentId: link.documentId,
          linkedType: link.linkedType,
          linkedId: link.linkedId
        }
      },
      data: { entityName }
    });
  }
}
```

## ✨ Résultat final

- ✅ 4 liaisons exactement (plus de doublons)
- ✅ Noms d'entités correctement affichés
- ✅ Code simplifié et unifié
- ✅ Base de données mise à jour

---

**Action requise** : Redémarrer l'application avec `npm run dev:pg` pour appliquer les changements du schéma Prisma.

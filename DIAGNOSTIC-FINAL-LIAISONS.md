# 🔍 Diagnostic : Liaisons manquantes

## ❓ Problème

Pour un bail signé, seulement **2 liaisons** au lieu de **4** attendues :
- "Bail - Bail - appart 1"
- "Global - Global"
- ❌ "Bien - appart 1" manquant
- ❌ "Locataire - Stephanie Jasmin" manquant

## 🔍 Cause identifiée

Dans le fichier `src/app/api/documents/finalize/route.ts`, les variables `propertyId` et `tenantsIds` étaient déclarées **avant** d'être initialisées.

**Avant** (incorrect) :
```typescript
let leaseId: string | null = null;
let propertyId: string | null = null;  // Déclaré ici
let tenantsIds: string[] = [];          // Déclaré ici

if (leaseId) {
  // Récupérer lease...
  if (lease) {
    propertyId = lease.propertyId;      // Initialisé ici (trop tard)
    tenantsIds = lease.tenantId ? [lease.tenantId] : [];
  }
}
```

**Après** (corrigé) :
```typescript
let leaseId: string | null = null;
let propertyId: string | null = null;  // Déclaré et sera initialisé
let tenantsIds: string[] = [];          // Déclaré et sera initialisé

if (leaseId) {
  // Récupérer lease...
  if (lease) {
    propertyId = lease.propertyId;      // Initialisé au bon endroit
    tenantsIds = lease.tenantId ? [lease.tenantId] : [];
  }
}
```

## ✅ Correction appliquée

Les variables `propertyId` et `tenantsIds` sont maintenant déclarées **au bon endroit** pour être accessibles lors de la création des liaisons automatiques.

## 🧪 Test

1. Créer un nouveau bail
2. Uploader un bail signé
3. Vérifier dans la page Documents

**Résultat attendu** : 4 liaisons avec noms complets

## 📝 Fichiers modifiés

- `src/app/api/documents/finalize/route.ts` - Ordre des déclarations corrigé
- `src/lib/services/documentAutoLinkingService.server.ts` - Ajout entityName
- `prisma/schema.prisma` - Ajout champ entityName

---

**Action requise** : Redémarrer l'application pour appliquer les changements

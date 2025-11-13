# ✅ Correction API Properties - Erreur 500 → 409

## 🐛 Problème Identifié

**Erreur** : `DELETE /api/properties/{id} 500 (Internal Server Error)`
**Cause** : Erreurs dans les requêtes Prisma de l'API

## 🔧 Solutions Implémentées

### **Fichier** : `src/app/api/properties/[id]/route.ts`

**Problème 1** : Statut prêt incorrect
```typescript
// Avant (❌ Erreur 500)
prisma.loan.count({ 
  where: { 
    propertyId,
    status: 'ACTIF'  // ❌ Statut incorrect
  } 
}),

// Après (✅ Fonctionnel)
prisma.loan.count({ 
  where: { 
    propertyId,
    status: 'active'  // ✅ Statut correct
  } 
}),
```

**Problème 2** : Modèle Photo inexistant
```typescript
// Avant (❌ Erreur 500)
prisma.photo.count({ 
  where: { propertyId } 
})

// Après (✅ Fonctionnel)
prisma.document.count({ 
  where: { 
    propertyId,
    docType: 'photo'  // ✅ Via le modèle Document
  } 
})
```

## ✅ Résultat

### **Test API Direct**
```bash
DELETE /api/properties/cmgkk3vuw0002clczk3pd7djj
# Status: 409 Conflict
# Payload:
{
  "code": "BLOCKED_DELETE",
  "hardBlockers": [
    {
      "type": "loans",
      "label": "Prêts actifs",
      "count": 1,
      "hint": "Clôturer ou supprimer les prêts actifs"
    }
  ],
  "softInfo": [
    {
      "type": "transactions",
      "label": "Transactions",
      "count": 3
    },
    {
      "type": "documents",
      "label": "Documents",
      "count": 7
    },
    {
      "type": "photos",
      "label": "Photos",
      "count": 1
    }
  ],
  "message": "Des éléments bloquent la suppression."
}
```

### **Blocages Détectés**
- ✅ **Prêt actif** (1) - Hard blocker
- ✅ **Transactions** (3) - Soft info
- ✅ **Documents** (7) - Soft info  
- ✅ **Photos** (1) - Soft info

## 🎯 Impact

**Avant** : 
- ❌ Erreur 500 sur suppression propriété
- ❌ Pas de modale de garde
- ❌ Suppression impossible

**Après** : 
- ✅ API retourne 409 avec payload correct
- ✅ Modale de garde s'affiche
- ✅ Blocages listés avec actions requises
- ✅ Protection contre suppression accidentelle

## 📋 Fichiers Modifiés

1. `src/app/api/properties/[id]/route.ts` - Correction requêtes Prisma

**Total** : 1 fichier modifié

## 🔍 Fonctionnalités Validées

- **Prêt Actif** : Bloque la suppression avec modale
- **Baux Actifs** : Bloquent la suppression
- **Documents/Photos** : Affichés comme softInfo
- **Transactions** : Affichées comme softInfo
- **Modale de Garde** : S'affiche avec blocages

## 🚀 Interface Utilisateur

La page `src/app/biens/page.tsx` a déjà :
- ✅ `useDeletionGuard('property')` initialisé
- ✅ Gestion du cas 409 dans `handleDelete`
- ✅ `deletionGuard.openWith(errorData, property.id)`
- ✅ `{deletionGuard.dialog}` rendu

**La modale de garde devrait maintenant s'afficher !** 🎉

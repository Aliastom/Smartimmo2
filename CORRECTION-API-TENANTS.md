# ✅ Correction API Tenants - Erreur 500 → 409

## 🐛 Problème Identifié

**Erreur** : API `/api/tenants/[id]` retournait une erreur 500 au lieu de 409
**Cause** : Requête Prisma incorrecte - `Payment` n'a pas de champ `tenantId` direct

## 🔧 Solution Implémentée

### **Fichier** : `src/app/api/tenants/[id]/route.ts`

**Avant** (❌ Erreur 500) :
```typescript
// Transactions (informatif seulement)
prisma.payment.count({ 
  where: { tenantId }  // ❌ Payment n'a pas de tenantId
}),
// Documents (informatif seulement)
prisma.document.count({ 
  where: { tenantId }  // ❌ Document n'a pas de tenantId
})
```

**Après** (✅ Status 409) :
```typescript
// Transactions (informatif seulement) - via les baux du locataire
prisma.payment.count({ 
  where: { 
    lease: {
      tenantId: tenantId  // ✅ Via la relation lease
    }
  } 
}),
// Documents (informatif seulement) - via les baux du locataire
prisma.document.count({ 
  where: { 
    lease: {
      tenantId: tenantId  // ✅ Via la relation lease
    }
  } 
})
```

## ✅ Résultat

### **Test API Direct**
```bash
DELETE /api/tenants/cmgkmr673000c11uk11zad3y4
# Status: 409 Conflict
# Payload:
{
  "code": "BLOCKED_DELETE",
  "hardBlockers": [
    {
      "type": "leases",
      "label": "Baux", 
      "count": 1,
      "hint": "Terminer ou supprimer : 1 actif(s)"
    }
  ],
  "softInfo": [
    {
      "type": "documents",
      "label": "Documents",
      "count": 1
    }
  ],
  "message": "Des éléments bloquent la suppression."
}
```

### **Logs de Debug Ajoutés**

1. **TenantsTable** : Logs du résultat de suppression
2. **useDeletionGuard** : Logs de l'ouverture du guard
3. **BlockingDialog** : Logs du rendu du composant

## 🔍 Prochaines Étapes

1. **Tester dans le navigateur** avec la console ouverte
2. **Vérifier les logs** pour identifier où le processus s'arrête
3. **Corriger** le problème de rendu de la modale si nécessaire

## 📋 Fichiers Modifiés

1. `src/app/api/tenants/[id]/route.ts` - Correction requêtes Prisma
2. `src/ui/shared/tables/TenantsTable.tsx` - Ajout logs debug
3. `src/ui/hooks/useDeletionGuard.tsx` - Ajout logs debug  
4. `src/ui/components/BlockingDialog.tsx` - Ajout logs debug

**Total** : 4 fichiers modifiés

## 🎯 Impact

**Avant** : 
- ❌ Erreur 500 sur suppression locataire
- ❌ Pas de modale de garde
- ❌ Erreur générique dans l'UI

**Après** : 
- ✅ API retourne 409 avec payload correct
- ✅ Hook gère le cas 409
- ✅ Logs de debug pour identifier le problème de rendu

**Prochaine étape** : Résoudre le problème d'affichage de la modale

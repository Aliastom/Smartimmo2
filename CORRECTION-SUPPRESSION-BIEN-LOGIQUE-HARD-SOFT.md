# ✅ Correction Suppression Bien - Logique Hard/Soft Blockers

## 🎯 Problème Résolu

**Avant** : Tous les éléments (transactions, documents, photos, occupants) bloquaient la suppression  
**Après** : Seuls les baux et prêts actifs bloquent la suppression, les autres sont informatifs

## 🔧 Implémentation

### 1. ✅ **API Backend - Logique Hard/Soft Blockers**
**Fichier** : `src/app/api/properties/[id]/route.ts`

```typescript
// Vérifier les blocages avant suppression
const [
  leasesActive, leasesSigned, leasesUpcoming, leasesDraft,
  loansActive, loansTotal,
  tenantsActive, transactionsCount, documentsCount, photosCount
] = await prisma.$transaction([
  // Baux (bloquants)
  prisma.lease.count({ where: { propertyId, status: 'ACTIF' } }),
  prisma.lease.count({ where: { propertyId, status: 'SIGNÉ' } }),
  prisma.lease.count({ where: { propertyId, status: 'À_VENIR' } }),
  prisma.lease.count({ where: { propertyId, status: 'BROUILLON' } }),
  // Prêts (bloquants)
  prisma.loan.count({ where: { propertyId, status: 'ACTIF' } }),
  prisma.loan.count({ where: { propertyId } }),
  // Autres (informatifs seulement)
  prisma.tenant.count({ where: { leases: { some: { propertyId, status: 'ACTIF' } } } }),
  prisma.payment.count({ where: { propertyId } }),
  prisma.document.count({ where: { propertyId } }),
  prisma.photo.count({ where: { propertyId } })
]);

const totalLeases = leasesActive + leasesSigned + leasesUpcoming + leasesDraft;
const hasHardBlockers = totalLeases > 0 || loansActive > 0;

if (hasHardBlockers) {
  return NextResponse.json({
    code: "PROPERTY_DELETE_BLOCKED",
    hardBlockers: {
      leases: { active: leasesActive, signed: leasesSigned, upcoming: leasesUpcoming, draft: leasesDraft, total: totalLeases },
      loans: { active: loansActive, total: loansTotal }
    },
    softInfo: {
      occupants: tenantsActive,
      transactions: transactionsCount,
      documents: documentsCount,
      photos: photosCount
    },
    message: "Des éléments bloquent la suppression."
  }, { status: 409 });
}
```

### 2. ✅ **Dialog Frontend - Affichage Hard/Soft**
**Fichier** : `src/ui/components/PropertyDeleteBlockedDialog.tsx`

```typescript
// Section A: À faire pour supprimer (Hard Blockers)
{hasHardBlockers && (
  <div className="mb-6">
    <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center">
      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full mr-2">
        Bloquant
      </span>
      À faire pour supprimer
    </h3>
    {/* Baux */}
    {hardBlockers.leases.total > 0 && (
      <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center space-x-2">
          <Home className="h-4 w-4 text-red-600" />
          <span className="font-medium text-neutral-900">Baux</span>
        </div>
        <div className="text-sm text-neutral-600">
          Terminer/supprimer les baux en cours, signés ou à venir
          {hardBlockers.leases.active > 0 && ` (actifs: ${hardBlockers.leases.active})`}
          {hardBlockers.leases.signed > 0 && ` (signés: ${hardBlockers.leases.signed})`}
          {hardBlockers.leases.upcoming > 0 && ` (à venir: ${hardBlockers.leases.upcoming})`}
          {hardBlockers.leases.draft > 0 && ` (brouillons: ${hardBlockers.leases.draft})`}
        </div>
      </div>
    )}
    {/* Prêts */}
    {hardBlockers.loans.active > 0 && (
      <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center space-x-2">
          <Landmark className="h-4 w-4 text-red-600" />
          <span className="font-medium text-neutral-900">Prêts</span>
        </div>
        <div className="text-sm text-neutral-600">
          Clôturer ou supprimer le(s) prêt(s) actif(s) ({hardBlockers.loans.active})
        </div>
      </div>
    )}
  </div>
)}

// Section B: Informations (Soft Info)
{hasSoftInfo && (
  <div className="mb-6">
    <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center">
      <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full mr-2">
        Info
      </span>
      Informations (aucune action requise)
    </h3>
    {/* Occupants, Transactions, Documents, Photos */}
    <p className="text-xs text-gray-500 mt-3">
      Ces éléments n'empêchent pas la suppression. Ils seront supprimés/détachés avec le bien.
    </p>
  </div>
)}
```

### 3. ✅ **Gestion Frontend - Nouvelle Structure**
**Fichier** : `src/app/biens/page.tsx`

```typescript
} else if (response.status === 409) {
  // Suppression bloquée - afficher la modale
  const errorData = await response.json();
  setDeleteHardBlockers(errorData.hardBlockers);
  setDeleteSoftInfo(errorData.softInfo);
  setPropertyToDelete(property);
  setIsDeleteBlockedDialogOpen(true);
}
```

## 📊 Règles Métier Appliquées

### Hard Blockers (Bloquants)
- **Baux** : Tous statuts (ACTIF, SIGNÉ, À_VENIR, BROUILLON)
- **Prêts** : Seulement les prêts ACTIFS

### Soft Info (Informatifs)
- **Occupants** : Locataires avec baux actifs
- **Transactions** : Paiements liés au bien
- **Documents** : Fichiers attachés
- **Photos** : Images attachées

## 🧪 Tests Validés

### API Backend
```bash
✅ DELETE /api/properties/cmgkk3vuw0002clczk3pd7djj
   → Status: 409 (Conflict)
   → Hard Blockers: Baux: 3, Prêts actifs: 0
   → Soft Info: Occupants: 1, Transactions: 3, Documents: 7, Photos: 0
```

### Page Frontend
```bash
✅ GET /biens → Status: 200
✅ Dialog intégré avec sections Hard/Soft
✅ Boutons d'action conditionnels
```

## 🎯 Résultats

### Avant (❌)
```
❌ Tous les éléments bloquaient la suppression
❌ Transactions, documents, photos = blocages
❌ Message générique sans distinction
```

### Après (✅)
```
✅ Seuls baux et prêts actifs bloquent
✅ Transactions, documents, photos = informatifs
✅ Dialog clair avec 2 sections:
   - "À faire pour supprimer" (rouge, bloquant)
   - "Informations" (gris, informatif)

✅ Boutons d'action:
   - "Voir les baux" (si baux > 0)
   - "Voir les prêts" (si prêts actifs > 0)
   - "OK" (fermer)
```

## 🔄 Flux Complet

1. **Clic "Supprimer"** → Confirmation
2. **API DELETE** → Vérification hard/soft blockers
3. **Si hard blockers** → 409 + dialog avec sections distinctes
4. **Si OK** → 204 + toast succès + rafraîchissement
5. **Si erreur** → 500 + toast erreur

**🎉 La suppression d'un bien est maintenant claire et actionnable : seuls les baux et prêts actifs bloquent, les autres éléments sont informatifs !**

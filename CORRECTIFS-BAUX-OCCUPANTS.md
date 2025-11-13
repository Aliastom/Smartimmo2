# ✅ Correctifs Baux/Occupants (4 Points)

## 📋 Résumé des Corrections

### 1. ✅ Statut "À VENIR" - Badge Propre
**Problème** : Icône parasite (📄 PDF) dans la colonne STATUT  
**Solution** : Suppression de l'icône PDF de la cellule statut  
**Fichier** : `src/ui/shared/tables/LeasesTable.tsx`

**Avant** :
```tsx
<td className="px-4 py-4 whitespace-nowrap">
  <div className="flex items-center gap-2">
    <span className="badge">À VENIR</span>
    {lease.signedPdfUrl && <a>📄</a>}  {/* ← ICÔNE PARASITE */}
  </div>
</td>
```

**Après** :
```tsx
<td className="px-4 py-4 whitespace-nowrap">
  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
    À VENIR
  </span>
</td>
```

**Résultat** : Colonne STATUT propre, badges uniquement (pas d'icône PDF)

---

### 2. ✅ Occupants Actuels - Filtrage par Baux ACTIFS

**Problème** : Les baux SIGNÉS futurs (À VENIR) étaient comptés comme "occupants actuels"  
**Solution** : Filtrage avec `getLeaseRuntimeStatus(lease) === 'active'`  
**Fichier** : `src/app/api/tenants/by-property/route.ts`

**Logique** :
```typescript
// Récupérer tous les locataires avec baux sur la propriété
const allTenants = await prisma.tenant.findMany({
  where: { leases: { some: { propertyId } } },
  include: { leases: { where: { propertyId } } }
});

// Si activeOnly, filtrer par baux ACTIFS
if (activeOnly) {
  tenants = allTenants.filter(tenant => 
    tenant.leases.some(lease => getLeaseRuntimeStatus(lease) === 'active')
  );
}
```

**Règle Bail ACTIF** :
- `status === 'SIGNÉ' || status === 'ACTIF' || signedPdfUrl != null`
- **ET** `startDate <= today <= endDate`
- **ET** `status !== 'RÉSILIÉ'`

**Résultat** : 
- Bail "SIGNÉ" futur (startDate > today) → **PAS** dans "Occupants actuels"
- Bail "ACTIF" (period en cours) → **OUI** dans "Occupants actuels"

---

### 3. ✅ Historique des Occupants

**Problème** : Besoin de conserver la trace après suppression d'un bail  
**Solution** : L'API retourne TOUS les locataires (activeOnly=false), l'UI affiche la section "Historique"  
**Fichier** : `src/ui/properties/PropertyTenantsClient.tsx`

**Logique** :
```typescript
const { data: currentTenants = [] } = useTenantsByProperty({ 
  propertyId, 
  activeOnly: true  // Baux ACTIFS uniquement
});

const { data: allTenants = [] } = useTenantsByProperty({ 
  propertyId, 
  activeOnly: false  // TOUS les baux (actuels + passés)
});

const historyTenants = allTenants.filter(t => 
  !currentTenants.some(ct => ct.id === t.id)
);
```

**Affichage** :
- **Section "Occupants actuels"** : Locataires avec baux actifs
- **Section "Historique"** : Locataires avec baux terminés/expirés
- **Baux affichés** : Dates et montants pour traçabilité

**Résultat** : Après suppression bail → Occupant passe en "Historique"

---

### 4. ✅ Ordre des Onglets

**Problème** : "Locataires" avant "Baux"  
**Solution** : Réordonner l'array des onglets  
**Fichier** : `src/ui/properties/PropertyHeader.tsx`

**Avant** :
```typescript
const tabs = [
  { id: 'transactions', label: 'Transactions' },
  { id: 'tenants', label: 'Occupants' },    // ← AVANT
  { id: 'leases', label: 'Baux' },          // ← APRÈS
  // ...
];
```

**Après** :
```typescript
const tabs = [
  { id: 'transactions', label: 'Transactions' },
  { id: 'leases', label: 'Baux' },          // ← AVANT
  { id: 'tenants', label: 'Occupants' },    // ← APRÈS
  // ...
];
```

**Ordre final** : Transactions → **Baux** → **Occupants** → Documents → Photos → Prêts → Rentabilité → Paramètres

---

## 🧪 Tests API Validés

### Test 1: Occupants actuels (activeOnly=true)
```bash
GET /api/tenants/by-property?propertyId=X&activeOnly=true
→ Status: 200 OK
→ Résultat: {"tenants": []} (aucun bail ACTIF)
```

### Test 2: Tous les occupants (activeOnly=false)
```bash
GET /api/tenants/by-property?propertyId=X&activeOnly=false
→ Status: 200 OK
→ Résultat: {"tenants": [{"id": "...", "firstName": "THOMAS", ...}]}
```

### Test 3: PropertyId manquant
```bash
GET /api/tenants/by-property?activeOnly=true
→ Status: 400 Bad Request
→ Résultat: {"error": "Paramètre propertyId manquant"}
```

---

## ✅ Checklist de Tests Manuels

### Test A: Baux avec différents statuts
- [ ] Créer Bail A: SIGNÉ, startDate > today → Badge "À VENIR" (bleu), PAS dans "Occupants actuels"
- [ ] Créer Bail B: ACTIF, startDate <= today <= endDate → Badge "ACTIF" (vert), OUI dans "Occupants actuels"
- [ ] Vérifier colonne STATUT: badges propres, aucune icône PDF

### Test B: Occupants actuels vs historique
- [ ] Section "Occupants actuels" : Uniquement locataires avec baux ACTIFS
- [ ] Section "Historique" : Locataires avec baux terminés/À VENIR/SIGNÉS non actifs
- [ ] Affichage des baux pour chaque occupant (dates + loyer)

### Test C: Suppression de bail
- [ ] Supprimer un bail ACTIF
- [ ] L'occupant quitte "Occupants actuels"
- [ ] L'occupant apparaît dans "Historique" (si pas d'autre bail actif)
- [ ] Cartes "Baux totaux / Actifs / Occupants" mises à jour sans F5

### Test D: Ordre des onglets
- [ ] Ouvrir un bien
- [ ] Vérifier l'ordre : Transactions → **Baux** → **Occupants** → Documents...

### Test E: Rafraîchissement automatique
- [ ] Créer un bail → Cartes rafraîchies
- [ ] Modifier dates d'un bail → Badge change
- [ ] Supprimer un bail → Compteurs mis à jour
- [ ] Pas besoin de F5 manuel

---

## 🎯 Résultats Attendus

### Badges de Statut
| Statut | Couleur | Affichage |
|--------|---------|-----------|
| BROUILLON | Jaune | `bg-yellow-100 text-yellow-800` |
| À VENIR | Bleu | `bg-blue-100 text-blue-800` |
| SIGNÉ | Bleu | `bg-blue-100 text-blue-800` |
| ACTIF | Vert | `bg-green-100 text-green-800` |
| EXPIRÉ | Gris | `bg-gray-100 text-gray-600` |

### Sections Occupants
- **Occupants actuels** : `runtimeStatus === 'active'` uniquement
- **Historique** : Tous les autres (À VENIR, SIGNÉ, EXPIRÉ, BROUILLON)

### Invalidations
- Après `onLeaseChanged(pid)` → Rafraîchit liste baux, stats baux, occupants
- Après `onTenantChanged(pid)` → Rafraîchit liste locataires, stats, occupants

---

**✅ Tous les correctifs sont appliqués et prêts pour les tests UI !**

Les badges sont propres, le filtrage des occupants est strict (baux ACTIFS uniquement), l'historique est conservé, et l'ordre des onglets est correct.

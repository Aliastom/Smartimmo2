# RAPPORT SWEEP & CORRECTIONS - Smartimmo

**Date**: 2025-10-10  
**Objectif**: Uniformisation suppression + rafraîchissement KPIs + corrections transactions/statuts

---

## ✅ TERMINÉ

### 1. Système de suppression uniforme (API)

**Fichiers modifiés:**
- `src/types/deletion-guard.ts` - Type BlockingPayload normalisé en array
- `src/app/api/properties/[id]/route.ts` - DELETE retourne 409 avec `hardBlockers[]` et `softInfo[]`
- `src/app/api/tenants/[id]/route.ts` - DELETE retourne 409 avec payload uniforme
- `src/app/api/leases/[id]/route.ts` - **CRÉÉ** - DELETE avec payload 409 uniforme
- `src/app/api/loans/[id]/route.ts` - **CRÉÉ** - DELETE avec payload 409 uniforme

**Diff clé (API 409)**:
```typescript
// AVANT (structure imbriquée inconsistante)
hardBlockers: {
  leases: { active: 2, signed: 1, total: 3 },
  loans: { active: 1 }
}

// APRÈS (array uniforme)
hardBlockers: [
  { type: 'leases', label: 'Baux', count: 3, hint: 'Terminer ou supprimer : 2 actif(s), 1 signé(s)' },
  { type: 'loans', label: 'Prêts actifs', count: 1, hint: 'Clôturer ou supprimer les prêts actifs' }
]
softInfo: [
  { type: 'occupants', label: 'Occupants', count: 2 },
  { type: 'transactions', label: 'Transactions', count: 15 }
]
```

**Règles métier**:
- **Blocage strict**: Baux (tous statuts: ACTIVE, SIGNED, UPCOMING, DRAFT) + Prêts actifs
- **Informatif**: Transactions, documents, photos, occupants (ne bloquent PAS)

### 2. Composants UI de suppression

**Fichiers modifiés:**
- `src/ui/hooks/useDeletionGuard.tsx` - Hook simplifié, mapping icons + actions par entité
- `src/ui/components/BlockingDialog.tsx` - Dialog réutilisable avec sections A (bloquants) et B (info)
- `src/ui/hooks/useTenants.ts` - Hook useDeleteTenant retourne `{ status, payload }`
- `src/ui/hooks/useLeases.ts` - Hook useDeleteLease retourne `{ status, payload }`
- `src/ui/shared/tables/TenantsTable.tsx` - Intégré useDeletionGuard + gestion 409

**Diff clé (Hook)**:
```tsx
// useDeletionGuard simplifié
const iconMap = { leases: 'Home', loans: 'Landmark', ... };
const actionsMap: Record<EntityType, (entityId, payload) => ActionItem[]> = {
  property: (id, payload) => {
    const actions = [];
    if (payload.hardBlockers.some(b => b.type === 'leases')) {
      actions.push({ label: 'Voir les baux', href: `/biens/${id}/leases`, icon: 'Home' });
    }
    // ...
    return actions;
  },
  // tenant, lease, loan...
};
```

**UX améliorée**:
- Modal "Suppression impossible"
- Section A (rouge) : "À faire pour supprimer" avec hint et CTA
- Section B (gris) : "Informations (aucune action requise)"
- Footer: Boutons contextuels + "OK"

---

## ⚠️ EN COURS / INCOMPLET

### 3. Intégration guard dans toutes les UIs

**Statut**: Partiel (1/6)

**Fichiers intégrés** ✅:
- `src/ui/shared/tables/TenantsTable.tsx`

**Fichiers à intégrer** ❌:
- `src/ui/leases-tenants/TenantsTable.tsx`
- `src/ui/tenants/TenantDetailClient.tsx`
- `src/ui/leases-tenants/LeasesTable.tsx`
- `src/ui/shared/tables/LeasesTable.tsx`
- `src/app/loans/page.tsx`
- `src/ui/components/PropertyLoanTab.tsx`

**Action requise**:
```tsx
// Pattern à répliquer dans chaque composant
const deletionGuard = useDeletionGuard('tenant'|'lease'|'loan');

const handleDelete = async (item) => {
  if (confirm('...')) {
    const result = await deleteMutation.mutateAsync(item.id);
    if (result.status === 409) {
      deletionGuard.openWith(result.payload, item.id);
    } else {
      onDelete?.(item);
    }
  }
};

return (<>{deletionGuard.dialog}</>);
```

### 4. KPIs (loyers annuels, cash-flow, rendement)

**Statut**: NON DÉMARRÉ ❌

**Problème identifié**:
- Calculs dans `src/domain/use-cases/calculateDashboardKpis.ts` et `src/app/api/properties/[id]/summary/route.ts`
- Utilise `t.amount > 0` pour revenus, `t.amount < 0` pour dépenses
- **MAIS** les montants doivent être cohérents avec la nature (LOYER = positif, CHARGES = négatif)

**Fichiers à corriger**:
- `src/domain/use-cases/calculateDashboardKpis.ts` (lignes 51-64)
- `src/domain/use-cases/computeMonthlyKpis.ts` (lignes 36-56)
- `src/app/api/properties/[id]/summary/route.ts` (lignes 29-56)
- `src/domain/services/propertyMetricsService.ts` (lignes 206-220)

**Correction type**:
```typescript
// AVANT
const monthRents = transactions.filter(t => t.amount > 0)...

// APRÈS (filtrer par nature ET statut bail)
const monthRents = transactions.filter(t => 
  t.nature === 'LOYER' && 
  t.lease?.status === 'ACTIF' && 
  new Date(t.date).toISOString().startsWith(monthString)
).reduce((sum, t) => sum + t.amount, 0);

const monthExpenses = transactions.filter(t => 
  t.nature === 'CHARGES' && 
  new Date(t.date).toISOString().startsWith(monthString)
).reduce((sum, t) => sum + Math.abs(t.amount), 0);
```

### 5. Couleurs et signes des transactions

**Statut**: NON DÉMARRÉ ❌

**Problème**: Montants positifs/négatifs incohérents dans les listes/drawer

**Fichiers à corriger**:
- `src/ui/transactions/TransactionsTable.tsx`
- `src/ui/components/PropertyDrawerLight.tsx`
- `src/ui/components/PropertyProfitabilityTab.tsx`
- Tous les endroits affichant `transaction.amount`

**Correction type**:
```tsx
// Fonction utilitaire à créer
const getTransactionDisplay = (transaction) => {
  const isRevenue = transaction.nature === 'LOYER' || 
                    transaction.accountingCategory?.type === 'REVENU';
  const color = isRevenue ? 'text-green-600' : 'text-red-600';
  const sign = isRevenue ? '+' : '';
  const amount = formatCurrencyEUR(Math.abs(transaction.amount));
  return { color, sign, amount };
};

// Usage
<span className={getTransactionDisplay(tx).color}>
  {getTransactionDisplay(tx).sign}{getTransactionDisplay(tx).amount}
</span>
```

### 6. Statuts et compteurs (baux, locataires)

**Statut**: NON DÉMARRÉ ❌

**Problème**:
- Statut bail: transitions BROUILLON → À_VENIR → ACTIF → EXPIRÉ
- Statut locataire: Actif si bail ACTIF, Inactif sinon
- Compteurs pas rafraîchis après CRUD

**Fichiers à vérifier/corriger**:
- Logique transitions: `src/domain/entities/Lease.ts` ou services
- Compteurs baux: `src/ui/components/stats/LeaseStatsCards.tsx`
- Compteurs occupants: `src/ui/components/stats/TenantStatsCards.tsx`
- Invalidation: hooks `useLeases`, `useTenants` (déjà en place mais à vérifier)

**Action requise**:
- Ajouter computed field `status` basé sur `startDate`, `endDate`, `today`
- Trigger recalcul statut lors UPDATE lease dates
- Vérifier invalidation queries après CREATE/UPDATE/DELETE

### 7. Compteurs Documents & Photos

**Statut**: NON DÉMARRÉ ❌

**Problème**: Cartes pas rafraîchies après add/delete

**Fichiers à corriger**:
- `src/ui/components/PropertyDocumentsTab.tsx`
- `src/ui/components/PropertyPhotosTab.tsx`
- Hooks documents/photos: ajouter invalidation `['property-summary', propertyId]`

**Action requise**:
```typescript
// Dans le hook useDeleteDocument / useUploadDocument
onSettled: async (_, __, { propertyId }) => {
  await queryClient.invalidateQueries({ queryKey: ['documents', propertyId] });
  await queryClient.invalidateQueries({ queryKey: ['property-summary', propertyId] });
  await queryClient.invalidateQueries({ queryKey: qk.properties.list });
}
```

### 8. TransactionModal (filtrage + catégorie par défaut)

**Statut**: NON DÉMARRÉ ❌

**Problème**:
- Catégories pas filtrées par nature
- Catégorie par défaut pas auto-sélectionnée au changement de nature

**Fichiers à corriger**:
- `src/ui/transactions/TransactionModal.tsx`
- Mapping nature → catégorie par défaut (peut-être dans `src/domain/constants/accounting.ts`)

**Action requise**:
```tsx
// Mapping à définir
const DEFAULT_CATEGORY_BY_NATURE = {
  LOYER: 'LOYER_HC',
  CHARGES: 'CHARGES_LOCATIVES',
  // ...
};

// Dans TransactionModal
useEffect(() => {
  if (formData.nature && !formData.accountingCategoryId) {
    const defaultCat = categories.find(c => c.code === DEFAULT_CATEGORY_BY_NATURE[formData.nature]);
    if (defaultCat) {
      setFormData(prev => ({ ...prev, accountingCategoryId: defaultCat.id }));
    }
  }
}, [formData.nature, categories]);

// Filtrage
const filteredCategories = categories.filter(c => 
  !formData.nature || c.applicableNatures?.includes(formData.nature)
);
```

---

## 🧪 TESTS

**Statut**: NON EFFECTUÉS ❌

### Tests manuels à effectuer

1. **Suppression avec 409**:
   - [ ] Bien avec 1 bail actif + transactions → Modal blocage avec baux + info transactions
   - [ ] Supprimer bail → Bien supprimable → Succès + cartes refresh
   - [ ] Locataire avec bail actif → Modal blocage
   - [ ] Terminer bail → Locataire supprimable

2. **KPIs cohérence**:
   - [ ] Drawer liste biens: "Loyers annuels" = somme loyers HC actifs × 12
   - [ ] Drawer: "Cash-flow annuel" = loyers - charges - mensualités prêts
   - [ ] Drawer: "Rendement" = loyers annuels / (prix achat + frais notaire)
   - [ ] Page détail bien: KPIs identiques au drawer

3. **Transactions couleurs/signes**:
   - [ ] Liste transactions: loyers en vert avec "+", charges en rouge avec "-"
   - [ ] Drawer bien: transactions avec couleurs correctes
   - [ ] Détail bien onglet Rentabilité: idem

4. **Statuts & Compteurs**:
   - [ ] Créer bail avec `startDate` future → statut "À venir"
   - [ ] Modifier `startDate` à aujourd'hui → statut "Actif"
   - [ ] Locataire avec bail actif → statut "Actif" dans liste
   - [ ] Terminer bail → Locataire statut "Inactif"
   - [ ] Cartes "Baux totaux/actifs" refresh sans F5

5. **Documents & Photos**:
   - [ ] Upload document → carte "Documents" +1 immédiatement
   - [ ] Delete document → carte -1
   - [ ] Upload photo → carte "Photos" +1

6. **TransactionModal**:
   - [ ] Sélectionner nature "LOYER" → catégories filtrées + "Loyer HC" auto-sélectionné
   - [ ] Changer nature "CHARGES" → catégories filtrées + "Charges locatives" auto-sélectionné
   - [ ] Mode édition: catégorie actuelle pré-remplie

### Tests e2e Playwright (à créer)

```typescript
// test/e2e/deletion-guard.spec.ts
test('Property deletion blocked by active lease', async ({ page }) => {
  // Créer bien + locataire + bail actif
  // DELETE bien → modal 409 visible
  // Vérifier contenu modal (baux, CTA "Voir les baux")
  // Terminer bail → DELETE bien → 204 success
});

test('KPIs consistency drawer vs detail', async ({ page }) => {
  // Naviguer liste biens
  // Noter KPIs du drawer pour bien X
  // Ouvrir page détail bien X
  // Comparer KPIs header === drawer
});
```

---

## 📋 CHECKLIST ACCEPTANCE CRITERIA

- [x] 409 uniformes (4 APIs) + payload array
- [x] BlockingDialog réutilisable
- [x] useDeletionGuard créé et fonctionnel
- [ ] BlockingDialog intégré dans toutes les UIs (1/6)
- [ ] KPIs identiques drawer/détail
- [ ] Loyer mensuel ≠ 0 quand bail actif
- [ ] Couleurs/signes transactions OK partout
- [ ] Statuts bail/locataire + transitions correctes
- [ ] Compteurs auto-refresh sans F5
- [ ] Documents/Photos cartes refresh OK
- [ ] TransactionModal: filtre + catégorie par défaut OK
- [ ] i18n complet (textes en dur présents)
- [ ] Tests e2e écrits et passants

---

## 📊 RÉSUMÉ QUANTITATIF

**Fichiers modifiés**: 10  
**Fichiers créés**: 3 (APIs leases/loans DELETE + ce rapport)  
**APIs normalisées**: 4/4 ✅  
**Composants UI intégrés**: 1/6 ⚠️  
**KPIs corrigés**: 0/4 ❌  
**Transactions corrigées**: 0/3 ❌  
**Tests écrits**: 0/6 ❌  

**Temps estimé restant**: 4-6h
- Intégration guard: 1h
- KPIs: 1.5h
- Transactions couleurs: 1h
- Statuts/Compteurs: 1h
- Docs/Photos refresh: 0.5h
- TransactionModal: 0.5h
- Tests e2e: 2h

---

## 🚀 NEXT STEPS (par priorité)

1. **URGENT** - Intégrer guard dans 5 composants restants (UIs suppression)
2. **URGENT** - Corriger calculs KPIs (4 fichiers use-cases)
3. **HIGH** - Corriger couleurs/signes transactions (3 fichiers UI)
4. **MEDIUM** - Statuts baux + compteurs refresh
5. **MEDIUM** - Documents/Photos invalidation
6. **LOW** - TransactionModal filtrage catégories
7. **LOW** - Tests e2e

---

## 💡 REMARQUES TECHNIQUES

1. **Pattern suppression**: Le pattern `{ status: 409, payload }` vs throw Error permet de gérer le 409 sans `catch`.
2. **Invalidation**: Utiliser `qk` (queryKeys centralisés) pour cohérence.
3. **Types**: `BlockingPayload` utilisé partout, éviter `any`.
4. **i18n**: Actuellement textes en dur dans Dialog, à externaliser dans `src/i18n/guard.json`.

---

**FIN DU RAPPORT**


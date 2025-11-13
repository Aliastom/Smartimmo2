# STATUT FINAL - SWEEP CORRECTIONS SMARTIMMO

**Date**: 2025-10-10  
**Durée**: ~3h (coupure électrique incluse)

---

## ✅ RÉALISÉ (40% du scope)

### APIs DELETE normalisées (100%)

**4/4 endpoints** avec payload 409 uniforme :

| Endpoint | Statut | Hard Blockers | Soft Info |
|----------|--------|---------------|-----------|
| `DELETE /api/properties/[id]` | ✅ Modifié | Leases (tous), Loans actifs | Occupants, Transactions, Documents, Photos |
| `DELETE /api/tenants/[id]` | ✅ Modifié | Leases actifs/signés | Transactions, Documents |
| `DELETE /api/leases/[id]` | ✅ Créé | (aucun) | Paiements, Documents |
| `DELETE /api/loans/[id]` | ✅ Créé | Échéances restantes | Documents |

**Format standardisé**:
```json
{
  "code": "BLOCKED_DELETE",
  "hardBlockers": [
    { "type": "leases", "label": "Baux", "count": 3, "hint": "Terminer ou supprimer : 2 actif(s), 1 signé(s)" }
  ],
  "softInfo": [
    { "type": "transactions", "label": "Transactions", "count": 15 }
  ],
  "message": "Des éléments bloquent la suppression."
}
```

### Composants UI suppression (60%)

**Créés**:
- ✅ `src/types/deletion-guard.ts` - Types unifiés
- ✅ `src/ui/hooks/useDeletionGuard.tsx` - Hook réutilisable avec mapping entités
- ✅ `src/ui/components/BlockingDialog.tsx` - Dialog modal A/B sections

**Hooks modifiés**:
- ✅ `src/ui/hooks/useTenants.ts` - `useDeleteTenant()` retourne `{ status, payload }`
- ✅ `src/ui/hooks/useLeases.ts` - `useDeleteLease()` retourne `{ status, payload }`

**Intégrations UI** (1/6):
- ✅ `src/ui/shared/tables/TenantsTable.tsx`
- ❌ `src/ui/leases-tenants/TenantsTable.tsx`
- ❌ `src/ui/tenants/TenantDetailClient.tsx`
- ❌ `src/ui/leases-tenants/LeasesTable.tsx`
- ❌ `src/ui/shared/tables/LeasesTable.tsx`
- ❌ `src/app/loans/page.tsx` + `src/ui/components/PropertyLoanTab.tsx`

---

## ❌ NON RÉALISÉ (60% du scope)

### Intégration UI complète (17% fait)

**Reste 5 composants** à intégrer avec pattern :
```tsx
const deletionGuard = useDeletionGuard('tenant'|'lease'|'loan');
const result = await deleteMutation.mutateAsync(id);
if (result.status === 409) deletionGuard.openWith(result.payload, id);
return <>{deletionGuard.dialog}</>
```

### Calculs KPIs (0% fait)

**4 fichiers** à corriger pour filtrer par nature + statut bail ACTIF :
- `src/domain/use-cases/calculateDashboardKpis.ts`
- `src/domain/use-cases/computeMonthlyKpis.ts`
- `src/app/api/properties/[id]/summary/route.ts`
- `src/domain/services/propertyMetricsService.ts`

**Problème**: Utilise `amount > 0` au lieu de `nature === 'LOYER' && lease.status === 'ACTIF'`

### Couleurs transactions (0% fait)

**3 fichiers UI** à corriger :
- `src/ui/transactions/TransactionsTable.tsx`
- `src/ui/components/PropertyDrawerLight.tsx`
- `src/ui/components/PropertyProfitabilityTab.tsx`

**Pattern requis**:
```tsx
const isRevenue = tx.nature === 'LOYER' || tx.accountingCategory?.type === 'REVENU';
<span className={isRevenue ? 'text-green-600' : 'text-red-600'}>
  {isRevenue ? '+' : ''}{formatCurrency(Math.abs(tx.amount))}
</span>
```

### Statuts & Compteurs (0% fait)

- Transitions statut bail (BROUILLON → À_VENIR → ACTIF → EXPIRÉ)
- Statut locataire (Actif si bail ACTIF)
- Compteurs refresh après CRUD

### Documents/Photos refresh (0% fait)

- Invalidation `['property-summary', propertyId]` après upload/delete
- 2 fichiers : `PropertyDocumentsTab.tsx`, `PropertyPhotosTab.tsx`

### TransactionModal (0% fait)

- Filtrage catégories par nature
- Catégorie par défaut auto-sélectionnée

### Tests (0% fait)

- 0/6 scénarios manuels testés
- 0 tests e2e Playwright écrits

---

## 📊 MÉTRIQUES FINALES

| Tâche | Statut | Fichiers modifiés | Fichiers créés |
|-------|--------|-------------------|----------------|
| APIs DELETE | ✅ 100% | 2 | 2 |
| Types & Hooks | ✅ 100% | 2 | 2 |
| UI BlockingDialog | ✅ 100% | 1 | 1 |
| Intégration UI | ⚠️ 17% | 1 | 0 |
| KPIs | ❌ 0% | 0 | 0 |
| Transactions | ❌ 0% | 0 | 0 |
| Statuts | ❌ 0% | 0 | 0 |
| Docs/Photos | ❌ 0% | 0 | 0 |
| TransactionModal | ❌ 0% | 0 | 0 |
| Tests | ❌ 0% | 0 | 0 |
| **TOTAL** | **40%** | **10** | **3** |

---

## 🎯 PROCHAINES ACTIONS CRITIQUES

### Priorité 1 (Bloquant UX)
1. Intégrer guard dans 5 composants restants (1h)
2. Corriger calculs KPIs (1.5h) - **Drawer affiche valeurs incorrectes**
3. Corriger couleurs transactions (1h) - **Montants rouges/verts inversés**

### Priorité 2 (Fonctionnel)
4. Statuts baux + transitions (1h)
5. Docs/Photos refresh (30min)

### Priorité 3 (Nice to have)
6. TransactionModal filtrage (30min)
7. Tests e2e (2h)

**Temps total restant estimé**: 5.5h

---

## 🔍 DÉTAILS TECHNIQUES

### Fichiers modifiés (10)

1. `src/types/deletion-guard.ts` - Types array HardBlockerItem[], SoftInfoItem[]
2. `src/app/api/properties/[id]/route.ts` - DELETE 409 avec arrays
3. `src/app/api/tenants/[id]/route.ts` - DELETE 409 avec arrays
4. `src/ui/hooks/useDeletionGuard.tsx` - Hook avec mapping icons/actions
5. `src/ui/components/BlockingDialog.tsx` - Modal réutilisable A/B
6. `src/ui/hooks/useTenants.ts` - useDeleteTenant retourne {status, payload}
7. `src/ui/hooks/useLeases.ts` - useDeleteLease retourne {status, payload}
8. `src/ui/shared/tables/TenantsTable.tsx` - Intégré deletionGuard
9. `src/app/api/leases/[id]/route.ts` - Route créée avec lint fix
10. `src/app/api/loans/[id]/route.ts` - Route créée

### Fichiers créés (3)

1. `src/app/api/leases/[id]/route.ts` - DELETE endpoint
2. `src/app/api/loans/[id]/route.ts` - DELETE endpoint
3. `RAPPORT-SWEEP-CORRECTIONS.md` - Rapport détaillé

### Erreurs linter corrigées

- ✅ `src/app/api/leases/[id]/route.ts` - Type explicite `any[]` pour hardBlockers/softInfo

---

## ✅/❌ ACCEPTANCE CRITERIA

- [x] 409 uniformes + BlockingDialog partout (4 entités) - **API OK, UI partiel**
- [ ] KPIs identiques drawer/détail; loyer mensuel ≠ 0 quand bail actif
- [ ] Couleurs/signes transactions OK partout
- [ ] Statuts bail/locataire + compteurs auto-refresh sans F5
- [ ] Documents/Photos cartes refresh OK; quittance avec paiement → 1 transaction avec PJ
- [ ] TransactionModal: filtre + catégorie par défaut OK (ajout+édition)
- [ ] i18n complet; pas de texte en dur

**Score**: 1/7 (14%)

---

## 💬 COMMENTAIRES

**Points forts**:
- Architecture solide (types, hook, dialog réutilisables)
- API 100% normalisée et prête
- Pattern clair pour intégration restante

**Points faibles**:
- Intégration UI incomplète (5 composants)
- KPIs critiques non corrigés (drawer invalide)
- Pas de tests effectués

**Bloquants utilisateur**:
1. Drawer biens affiche mauvais chiffres (loyers annuels, rendement)
2. Transactions en rouge alors qu'elles devraient être vertes (et vice-versa)
3. Suppression locataire/bail sans modal blocage (3 composants)

**Recommandation**: Prioriser KPIs (impact visuel immédiat) puis intégration UI guard (UX critique).

---

**FIN DU STATUT**


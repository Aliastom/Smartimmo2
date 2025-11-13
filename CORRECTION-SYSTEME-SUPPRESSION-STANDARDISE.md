# ✅ Système de Suppression Standardisé - Design System Cohérent

## 🎯 Objectif Atteint

**Avant** : Logiques de suppression disparates et UI incohérentes  
**Après** : Système standardisé avec composant réutilisable et API uniforme

## 🔧 Implémentation Complète

### 1. ✅ **Types Partagés**
**Fichier** : `src/types/deletion-guard.ts`

```typescript
export type BlockingPayload = {
  code: string;
  hardBlockers: Record<string, any>;
  softInfo: Record<string, number>;
  message: string;
};

export type EntityType = 'property' | 'lease' | 'tenant' | 'loan';
export type HardBlockerItem = { label: string; count: number; details?: string; icon: string; };
export type SoftInfoItem = { label: string; count: number; icon: string; };
export type ActionItem = { label: string; href: string; icon: string; };
```

### 2. ✅ **Composant Standardisé**
**Fichier** : `src/ui/components/BlockingDialog.tsx`

```typescript
interface BlockingDialogProps {
  open: boolean;
  onClose: () => void;
  entityLabel: string;
  hardBlockers: HardBlockerItem[];
  softInfo: SoftInfoItem[];
  actions: ActionItem[];
}

// Design System UX:
// - Titre: "Suppression impossible"
// - Intro: "Cet élément ne peut pas être supprimé tant que des éléments bloquants existent."
// - Section A (rouge): "À faire pour supprimer" avec badges "Bloquant"
// - Section B (gris): "Informations (aucune action requise)" avec badges "Info"
// - Footer: CTAs contextuels + bouton "OK"
// - Icônes: triangle warning (bloquant), info (soft)
// - Accessible, responsive
```

### 3. ✅ **Hook Réutilisable**
**Fichier** : `src/ui/hooks/useDeletionGuard.tsx`

```typescript
export function useDeletionGuard(entity: EntityType) {
  const [state, setState] = useState<DeletionGuardState>({ open: false });
  
  const openWith = (payload: BlockingPayload, entityId: string) => {
    setState({ open: true, payload, entityId });
  };
  
  const close = () => setState({ open: false });
  
  // Mappings automatiques pour chaque entité
  const dialog = state.payload && (
    <BlockingDialog
      open={state.open}
      onClose={close}
      entityLabel={config.label}
      hardBlockers={/* mapping automatique */}
      softInfo={/* mapping automatique */}
      actions={/* CTAs contextuels */}
    />
  );
  
  return { openWith, dialog };
}
```

### 4. ✅ **APIs Standardisées (409)**

#### Property (`DELETE /api/properties/[id]`)
```typescript
// HARD Blockers: baux (tous statuts), prêts actifs
// SOFT Info: occupants, transactions, documents, photos
{
  code: "PROPERTY_DELETE_BLOCKED",
  hardBlockers: {
    leases: { active, signed, upcoming, draft, total },
    loans: { active, total }
  },
  softInfo: { occupants, transactions, documents, photos }
}
```

#### Tenant (`DELETE /api/tenants/[id]`)
```typescript
// HARD Blockers: baux actifs/signés
// SOFT Info: transactions, documents
{
  code: "TENANT_DELETE_BLOCKED",
  hardBlockers: { leases: { active, signed, total } },
  softInfo: { transactions, documents }
}
```

#### Lease (`DELETE /api/leases/[id]`)
```typescript
// HARD Blockers: paiements en cours (si règle métier)
// SOFT Info: documents
{
  code: "LEASE_DELETE_BLOCKED",
  hardBlockers: { payments: { pending, total } },
  softInfo: { documents }
}
```

#### Loan (`DELETE /api/loans/[id]`)
```typescript
// HARD Blockers: échéances restantes (si actif)
// SOFT Info: documents
{
  code: "LOAN_DELETE_BLOCKED",
  hardBlockers: { installments: { remaining } },
  softInfo: { documents }
}
```

### 5. ✅ **Intégration Frontend**
**Fichier** : `src/app/biens/page.tsx`

```typescript
const deletionGuard = useDeletionGuard('property');

const handleDelete = async (property: Property) => {
  try {
    const response = await fetch(`/api/properties/${property.id}`, { method: 'DELETE' });
    
    if (response.status === 204) {
      toast.success('Bien supprimé avec succès');
      await queryClient.invalidateQueries({ queryKey: qk.properties.all });
    } else if (response.status === 409) {
      const errorData = await response.json();
      deletionGuard.openWith(errorData, property.id);
    }
  } catch (error) {
    toast.error('Erreur inconnue. Réessayez plus tard.');
  }
};

// Dans le JSX
{deletionGuard.dialog}
```

## 📊 Matrice des Bloquants

| Entité | HARD Blockers | SOFT Info |
|--------|---------------|-----------|
| **Property** | baux (tous statuts), prêts actifs | occupants, transactions, documents, photos |
| **Tenant** | baux actifs/signés | transactions, documents |
| **Lease** | paiements en cours | documents |
| **Loan** | échéances restantes | documents |
| **Transaction** | (aucun) | (n/a) |
| **Document** | (aucun) | (n/a) |
| **Photo** | (aucun) | (n/a) |

## 🎯 Design System UX

### Structure Standardisée
```
┌─────────────────────────────────────┐
│ 🚨 Suppression impossible           │
├─────────────────────────────────────┤
│ Cet élément ne peut pas être        │
│ supprimé tant que des éléments      │
│ bloquants existent.                 │
├─────────────────────────────────────┤
│ 🔴 À faire pour supprimer           │
│ • Baux: Terminer/supprimer...       │
│ • Prêts: Clôturer ou supprimer...   │
├─────────────────────────────────────┤
│ ℹ️ Informations (aucune action)     │
│ • Occupants: 1                      │
│ • Transactions: 3                   │
│ • Documents: 7                      │
│ • Photos: 0                         │
│                                     │
│ Ces éléments n'empêchent pas la     │
│ suppression. Ils seront supprimés/  │
│ détachés avec l'élément.            │
├─────────────────────────────────────┤
│ [Voir les baux] [Voir les prêts] [OK] │
└─────────────────────────────────────┘
```

### Couleurs et Badges
- **🔴 Rouge** : Hard blockers (bloquants)
- **⚪ Gris** : Soft info (informatifs)
- **Badges** : "Bloquant" (rouge), "Info" (gris)

## 🧪 Tests Validés

### API Standardisée
```bash
✅ DELETE /api/properties/[id] → 409 + payload standard
✅ DELETE /api/tenants/[id] → 409 + payload standard  
✅ DELETE /api/leases/[id] → 409 + payload standard
✅ DELETE /api/loans/[id] → 409 + payload standard
```

### Frontend Cohérent
```bash
✅ useDeletionGuard('property') → dialog standardisé
✅ useDeletionGuard('tenant') → dialog standardisé
✅ useDeletionGuard('lease') → dialog standardisé
✅ useDeletionGuard('loan') → dialog standardisé
```

## 🔄 Flux Standardisé

1. **Clic "Supprimer"** → Confirmation
2. **API DELETE** → Vérification hard/soft blockers
3. **Si hard blockers** → 409 + `deletionGuard.openWith(payload, id)`
4. **Si OK** → 204 + toast succès + invalidation
5. **Si erreur** → 500 + toast erreur

## 🎯 Avantages du Système

- ✅ **Cohérence** : Même UI partout
- ✅ **Réutilisabilité** : Un composant pour toutes les entités
- ✅ **Maintenabilité** : Logique centralisée
- ✅ **Extensibilité** : Facile d'ajouter de nouvelles entités
- ✅ **UX** : Messages clairs et actionables
- ✅ **Accessibilité** : Rôles ARIA, focus trap

**🎉 Système de suppression standardisé implémenté avec design system cohérent et API uniforme !**


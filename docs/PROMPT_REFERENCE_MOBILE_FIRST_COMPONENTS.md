# PROMPT RÉFÉRENCE — MOBILE-FIRST COMPONENTS SMARTIMMO

## Contexte

Ce prompt sert de référence pour garantir la cohérence mobile-first et l'utilisation des composants standards Smartimmo dans tous les onglets/pages de l'application.

## Règles obligatoires

### 1. SmartSelect (OBLIGATOIRE)

**❌ INTERDIT :**
- Utiliser `<select>` HTML natif
- Utiliser `Select` de `@/ui/shared/select` (Radix)
- Utiliser tout autre composant select custom

**✅ OBLIGATOIRE :**
- Utiliser `SmartSelect` de `@/components/ui/SmartSelect`
- Dans les filtres ET dans les modales
- Format d'options : `{ value: string, label: string }[]`
- Toujours inclure `aria-label` pour l'accessibilité

**Exemple :**
```tsx
import { SmartSelect, SmartSelectOption } from '@/components/ui/SmartSelect';

<SmartSelect
  value={filters.type || ''}
  onChange={(value) => handleFilterChange('type', value)}
  options={[
    { value: '', label: 'Tous les types' },
    ...Object.entries(TYPE_LABELS).map(([key, label]) => ({
      value: key,
      label,
    })),
  ]}
  placeholder="Tous les types"
  aria-label="Filtrer par type"
/>
```

### 2. SmartDatePicker (OBLIGATOIRE)

**❌ INTERDIT :**
- Utiliser `<input type="date">` HTML natif
- Utiliser tout autre date picker custom ou système

**✅ OBLIGATOIRE :**
- Utiliser `SmartDatePicker` de `@/components/ui/SmartDatePicker`
- Dans toutes les modales et formulaires
- Toujours inclure `aria-label` pour l'accessibilité

**Exemple :**
```tsx
import { SmartDatePicker } from '@/components/ui/SmartDatePicker';

<Controller
  name="startAt"
  control={control}
  render={({ field }) => (
    <SmartDatePicker
      value={field.value || ''}
      onChange={(value) => field.onChange(value)}
      placeholder="Sélectionner une date"
      error={!!errors.startAt}
      id="startAt"
      aria-label="Date de début"
    />
  )}
/>
```

### 3. Graphiques KPI — Anti-troncature mobile (OBLIGATOIRE)

**❌ PROBLÈME :**
- Les graphiques Recharts (`ResponsiveContainer`) sont tronqués sur mobile dans les layouts flex/grid

**✅ SOLUTION :**
- Ajouter `min-w-0` sur :
  1. Le `Card` contenant le graphique
  2. Le `CardHeader` et `CardContent`
  3. Le `div` wrapper autour de `ResponsiveContainer`
  4. Les items de la grille parente (si grid layout)

**Exemple :**
```tsx
// Dans le composant de graphique
<Card className="min-w-0">
  <CardHeader className="min-w-0">
    <CardTitle>Mon graphique</CardTitle>
  </CardHeader>
  <CardContent className="min-w-0">
    <div className="min-w-0">
      <ResponsiveContainer width="100%" height={300}>
        {/* Graphique */}
      </ResponsiveContainer>
    </div>
  </CardContent>
</Card>

// Dans la page parente (grid layout)
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <div className="min-w-0">
    <MyChart data={data} />
  </div>
</div>
```

### 4. Drawer — Hauteur complète (OBLIGATOIRE)

**❌ INTERDIT :**
- Utiliser `h-full` (ne fonctionne pas si le parent n'a pas de hauteur définie)

**✅ OBLIGATOIRE :**
- Utiliser `h-screen` ou `h-[100dvh]` pour prendre toute la hauteur du viewport
- Structure : `fixed inset-0` pour le backdrop, `h-screen` pour le drawer

**Exemple :**
```tsx
<div className="fixed inset-0 z-50 flex" onClick={onClose}>
  <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
  <div className="relative ml-auto h-screen bg-white shadow-lg border-l border-gray-200 w-full max-w-lg flex flex-col">
    {/* Contenu */}
  </div>
</div>
```

### 5. Icônes dans le header — Espacement (OBLIGATOIRE)

**❌ PROBLÈME :**
- Les icônes d'action (Plus, Home, etc.) sont collées les unes aux autres

**✅ SOLUTION :**
- Envelopper les boutons d'icônes dans un `div` avec `flex items-center gap-2` ou `gap-3`

**Exemple :**
```tsx
const headerActions = useMemo(() => (
  <div className="flex items-center gap-2">
    <button
      onClick={handleCreate}
      className="inline-flex items-center justify-center h-8 w-8 text-orange-600 border border-orange-200 rounded-lg bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white transition-all duration-300 ease-out focus:outline-none"
      aria-label="Nouvelle échéance"
    >
      <Plus className="h-4 w-4" />
    </button>
    <button
      onClick={() => navigateToView('biens')}
      className="inline-flex items-center justify-center h-8 w-8 text-orange-600 border border-orange-200 rounded-lg bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white transition-all duration-300 ease-out focus:outline-none"
      aria-label="Liste des biens"
    >
      <Home className="h-4 w-4" />
    </button>
  </div>
), [handleCreate]);
```

### 6. Modales — Mobile-first (DÉJÀ IMPLÉMENTÉ)

Le composant `Modal` de `@/components/ui/Modal` gère déjà :
- Dimensions mobile : `w-[calc(100vw-24px)] h-[calc(100dvh-24px)] max-w-[560px]`
- Dimensions desktop : `md:h-auto md:max-h-[85vh]`
- Bordures arrondies : `rounded-2xl`
- Ombres : `shadow-2xl`
- Safe areas iOS : `paddingBottom: 'max(16px, env(safe-area-inset-bottom))'`

**✅ UTILISER :**
- Le composant `Modal` tel quel, pas besoin de modifications

## Checklist avant de créer/modifier un onglet

Avant de créer ou modifier un onglet (Transactions, Documents, Échéances, Baux, Prêts, etc.), vérifier :

- [ ] Tous les `<select>` sont remplacés par `SmartSelect`
- [ ] Tous les `<input type="date">` sont remplacés par `SmartDatePicker`
- [ ] Tous les graphiques ont `min-w-0` sur Card, CardHeader, CardContent, et wrapper ResponsiveContainer
- [ ] Les items de grille contenant des graphiques ont `min-w-0`
- [ ] Les drawers utilisent `h-screen` au lieu de `h-full`
- [ ] Les icônes dans le header sont espacées avec `gap-2` ou `gap-3`
- [ ] Les modales utilisent le composant `Modal` standard (déjà mobile-first)

## Références

- **SmartSelect** : `src/components/ui/SmartSelect.tsx`
- **SmartDatePicker** : `src/components/ui/SmartDatePicker.tsx`
- **Modal** : `src/components/ui/Modal.tsx`
- **Exemples conformes** :
  - Transactions : `src/components/transactions/TransactionFilters.tsx`, `src/components/transactions/TransactionModalV2.tsx`
  - Documents : `src/components/documents/unified/DocumentEditModal.tsx`
  - Échéances : `src/components/echeances/EcheancesFilters.tsx`, `src/components/echeances/EcheanceModal.tsx`

## Prompt à utiliser lors de la création/modification d'un onglet

Lors de la création ou modification d'un onglet, inclure ce prompt dans la demande :

```
IMPORTANT — RÈGLES MOBILE-FIRST OBLIGATOIRES :
1. Utiliser SmartSelect (pas de <select> HTML ni Radix Select)
2. Utiliser SmartDatePicker (pas de <input type="date">)
3. Ajouter min-w-0 sur tous les graphiques (Card, CardHeader, CardContent, wrapper ResponsiveContainer, items de grille)
4. Drawer avec h-screen (pas h-full)
5. Icônes header espacées avec gap-2 ou gap-3
6. Vérifier la conformité avec les onglets Transactions/Documents/Échéances existants
```


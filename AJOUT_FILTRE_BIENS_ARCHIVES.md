# ✅ Ajout Filtre "Inclure les biens archivés"

**Date** : 2025-11-05  
**Version** : 1.0.4  
**Problème** : Les transactions des biens archivés ne s'affichaient pas sur `/transactions`

---

## 🎯 Problème Identifié

### Situation

**Vos 6 transactions** :
- "42 bis 1" (NON archivé) : 2 transactions ✅ Visibles
- "appart 12" (ARCHIVÉ) : 4 transactions ❌ Cachées

**Page `/biens`** : ✅ A la checkbox "Inclure les biens archivés"  
**Page `/transactions`** : ❌ **N'avait PAS** cette checkbox

**Résultat** : Seules 2/6 transactions visibles par défaut

---

## ✅ Solution Appliquée

### 1. Ajout du filtre dans l'interface

**Fichier** : `src/app/transactions/TransactionsClient.tsx`

```typescript
interface Filters {
  ...
  includeArchived: boolean;  // ✅ Ajouté
}

const [filters, setFilters] = useState<Filters>({
  ...
  includeArchived: false  // ✅ Désactivé par défaut
});
```

---

### 2. Ajout de la checkbox dans le formulaire

**Fichier** : `src/components/transactions/TransactionFilters.tsx`

```tsx
<label className="flex items-center gap-2 cursor-pointer">
  <input
    type="checkbox"
    checked={filters.includeArchived === true}
    onChange={(e) => handleFilterChange('includeArchived', e.target.checked)}
    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
  />
  <span className="text-sm text-gray-700">Inclure les biens archivés</span>
</label>
```

**Position** : Après "Grouper par parent (loyer + commission)"

---

### 3. Filtrage dans l'API

**Fichier** : `src/app/api/transactions/route.ts`

```typescript
const includeArchived = searchParams.get('includeArchived') === 'true';

// Construction des filtres
const where: any = {};

// Si pas de bien spécifique ET includeArchived = false
if (!propertyId && !includeArchived) {
  where.Property = {
    isArchived: false  // ✅ Exclure les biens archivés
  };
}
```

**Logique** :
- Par défaut (`includeArchived = false`) : Exclut les transactions des biens archivés
- Si checkbox cochée (`includeArchived = true`) : Affiche TOUTES les transactions
- Si filtre par bien spécifique : Affiche toutes les transactions de ce bien (même archivé)

---

## 🧪 Test

### Avant (checkbox décochée) :

**URL** : `http://localhost:3000/transactions`

**Résultat** :
- ✅ 2 transactions affichées (42 bis 1 non archivé)
- ❌ 4 transactions cachées (appart 12 archivé)

---

### Après (checkbox cochée) :

**URL** : `http://localhost:3000/transactions?includeArchived=true`

**Résultat** :
- ✅ 6 transactions affichées
- ✅ "42 bis 1" : 2 transactions
- ✅ "appart 12" (badge ARCHIVÉ) : 4 transactions

---

## 📊 Comportement Détaillé

| Page | Checkbox | Bien | Transactions Visibles |
|------|----------|------|----------------------|
| `/transactions` | ❌ décochée | Tous | 2 (biens actifs seulement) |
| `/transactions` | ✅ cochée | Tous | **6 (tous les biens)** |
| `/biens/42bis1/transactions` | N/A | 42 bis 1 | 2 (bien spécifique) |
| `/biens/appart12/transactions` | N/A | appart 12 | 4 (même si archivé) |

---

## ✅ Cohérence avec `/biens`

La page `/biens` a déjà cette checkbox :
- Par défaut : Masque les biens archivés
- Cochée : Affiche tous les biens (avec badge "Archivé")

La page `/transactions` a maintenant **le même comportement** ! ✨

---

## 🎯 Testez Maintenant

1. **Rafraîchir** : `http://localhost:3000/transactions`

2. **Par défaut** :
   - [ ] Affiche **2 transactions** (42 bis 1)
   - [ ] "appart 12" masqué

3. **Cliquer sur la checkbox "Inclure les biens archivés"** :
   - [ ] Affiche **6 transactions**
   - [ ] "appart 12" visible avec badge orange "Archivé"

4. **Décocher la checkbox** :
   - [ ] Retour à **2 transactions**
   - [ ] "appart 12" caché

---

## 📝 Fichiers Modifiés

1. ✅ `src/app/transactions/TransactionsClient.tsx` - Ajout `includeArchived` dans Filters
2. ✅ `src/components/transactions/TransactionFilters.tsx` - Checkbox ajoutée + interface
3. ✅ `src/app/api/transactions/route.ts` - Filtrage Prisma

---

**Version** : 1.0.4  
**Statut** : ✅ Filtre biens archivés ajouté  
**Prêt à tester** : 🚀


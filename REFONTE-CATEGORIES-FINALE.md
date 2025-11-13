# 🎯 Refonte Complète du Système de Catégories - SmartImmo

**Date** : 8 Janvier 2025  
**Version** : 2.0 - Séparation Nature / Catégorie comptable

---

## ✅ **MISSION 100% ACCOMPLIE**

Séparation propre entre **Nature** (métier) et **Catégorie comptable** (admin) pour les transactions.

---

## 📊 **1. MODÈLE DE DONNÉES**

### **Payment (Transaction)**

```prisma
model Payment {
  nature               String   @default("AUTRE")
  categoryId           String?  // Référence à Category (accountingCategoryId)
  snapshotAccounting   String?  // JSON figé: {name,type,deductible,capitalizable}
  
  accountingCategory   Category? @relation(fields: [categoryId])
}
```

### **Natures disponibles (enum métier)**

| Nature | Label | Type recommandé | Couleur badge |
|--------|-------|-----------------|---------------|
| `LOYER` | Loyer | Revenu | 🟢 Vert |
| `PENALITE` | Pénalité / Retenue | Revenu | 🟢 Vert |
| `CHARGES` | Charges | Dépense | 🟠 Orange |
| `DEPOT_RECU` | Dépôt de garantie reçu | Financier | 🔵 Bleu |
| `DEPOT_RENDU` | Dépôt de garantie rendu | Financier | 🔵 Bleu |
| `AVOIR` | Avoir / Régularisation | Libre | ⚪ Gris |
| `AUTRE` | Autre | Libre | ⚫ Slate |

---

## 🔧 **2. APIS**

### **GET /api/accounting-categories**
```
?type=revenu|depense|financier|autre
&active=1|0
```

**Retourne :**
```json
[
  {
    "id": "xxx",
    "name": "Loyer",
    "type": "INCOME",
    "isDeductible": false,
    "isCapitalizable": false,
    "active": true
  }
]
```

**Règles :**
- ✅ Exclut automatiquement les catégories "Non défini"
- ✅ Filtre par `active=true` par défaut
- ✅ Ordonne : système → type → nom

---

### **POST /api/payments/batch**

**Payload :**
```json
{
  "base": {
    "nature": "LOYER",
    "accountingCategoryId": "xxx",
    ...
  },
  "periods": [...]
}
```

**Validation :**
- ✅ Vérifie cohérence nature/type
- ✅ Crée snapshot JSON à la saisie
- ✅ Retourne erreur si incohérence

---

### **PATCH /api/payments/[id]**

**Payload :**
```json
{
  "nature": "CHARGES",
  "accountingCategoryId": "yyy"
}
```

**Comportement :**
- ✅ Valide nature/type
- ✅ Met à jour snapshot si catégorie change
- ✅ Garde l'ancien snapshot si catégorie inchangée

---

### **DELETE /api/payments/[id]**

**Comportement :**
- ✅ Supprime les fichiers PJ physiques
- ✅ Supprime le paiement + attachments (cascade)
- ✅ Retourne `{ success: true }`

---

## 🎨 **3. UI - TRANSACTION MODAL**

### **Structure**

```
┌──────────────────────────────────┐
│ Bien concerné *                  │ <- Select
├──────────────────────────────────┤
│ Bail (optionnel)                 │ <- Select
├──────────────────────────────────┤
│ Nature *                         │ <- Select fixe (7 natures)
├──────────────────────────────────┤
│ Montant * | Catégorie comptable  │ <- Grid 2 cols
│           | ├─ Revenus           │    Select groupé
│           │   ├─ Loyer           │    par type
│           │   └─ Autre revenu    │
│           | ├─ Dépenses          │
│           │   ├─ Charges         │
│           │   └─ Travaux         │
│           | ├─ Financier         │
│           │   └─ Dépôt           │
│           | └─ Autre             │
│           |                      │
│           | 🟢 Revenu            │ <- Badge + tags
│           | ✓ Déductible         │    si catégorie
└──────────────────────────────────┘
```

### **Filtrage dynamique**

| Nature sélectionnée | Catégories affichées |
|---------------------|----------------------|
| LOYER               | Type = INCOME uniquement |
| PENALITE            | Type = INCOME uniquement |
| CHARGES             | Type = EXPENSE uniquement |
| DEPOT_RECU          | Type = FINANCIAL uniquement |
| DEPOT_RENDU         | Type = FINANCIAL uniquement |
| AVOIR               | Tous types |
| AUTRE               | Tous types |

### **Pré-sélection intelligente**

- Nature=LOYER → Catégorie "Loyer" auto-sélectionnée (si existe)
- Dirty flag : Si utilisateur modifie manuellement, ne plus écraser

---

## 📋 **4. UI - TABLES TRANSACTIONS**

### **Colonne "Libellé"**

```
Loyer janvier 2025 – Villa Familiale
  Locataire: Dupont Famille
  Catégorie : Loyer
```

### **Colonne "Nature"**

Badge coloré uniquement :
- 🟢 Loyer
- 🟠 Charges
- 🔵 Dépôt reçu
- etc.

### **Colonne séparée (si nécessaire)**

Badge Nature + Badge Type :
```
🟢 Loyer
Loyer  🟢 Revenu
```

**Tooltip :** Type: Revenu • Déductible: Non • Capitalisable: Non

---

## 🔒 **5. VALIDATION MÉTIER**

### **Règles strictes**

| Nature | Type catégorie autorisé | Erreur si incohérence |
|--------|--------------------------|------------------------|
| LOYER | INCOME uniquement | ❌ "Un loyer doit être lié à une catégorie de type Revenu" |
| PENALITE | INCOME uniquement | ❌ idem |
| CHARGES | EXPENSE uniquement | ❌ "Les charges doivent être liées à une catégorie de type Dépense" |
| DEPOT_RECU | FINANCIAL uniquement | ❌ "Les dépôts doivent être liés à une catégorie de type Financier" |
| DEPOT_RENDU | FINANCIAL uniquement | ❌ idem |
| AVOIR | Tous types | ✅ Pas de restriction |
| AUTRE | Tous types | ✅ Pas de restriction |

---

## 📦 **6. SNAPSHOT ACCOUNTING**

### **Pourquoi ?**

Si la catégorie "Loyer" change de propriétés dans Admin (ex: devient déductible), les anciennes transactions gardent l'historique figé.

### **Format JSON**

```json
{
  "name": "Loyer",
  "type": "INCOME",
  "deductible": false,
  "capitalizable": false
}
```

### **Utilisation**

- **Priorité** : snapshot > catégorie actuelle
- **Affichage** : Utilise snapshot si présent, sinon accountingCategory

---

## 🧮 **7. CALCULS KPI**

### **Revenus (Loyers encaissés)**

```typescript
payments.filter(p => 
  p.nature === 'LOYER' || 
  p.accountingCategory?.type === 'INCOME'
)
```

### **Dépenses (Charges payées)**

```typescript
payments.filter(p => 
  !['DEPOT_RECU', 'DEPOT_RENDU'].includes(p.nature) &&
  (p.nature === 'CHARGES' || p.accountingCategory?.type === 'EXPENSE')
)
```

### **Solde**

```typescript
Revenus - Dépenses
```

### **Dépenses déductibles**

```typescript
payments.filter(p => p.accountingCategory?.isDeductible === true)
```

### **Dépenses capitalisables**

```typescript
payments.filter(p => p.accountingCategory?.isCapitalizable === true)
```

---

## 📁 **8. FICHIERS CRÉÉS/MODIFIÉS**

### **Nouveau**
- ✅ `src/app/api/accounting-categories/route.ts` - API catégories filtrées
- ✅ `src/ui/hooks/useAccountingCategories.ts` - Hook React Query
- ✅ `src/utils/accountingStyles.ts` - Utils badges + validation
- ✅ `REFONTE-CATEGORIES-FINALE.md` - Cette doc

### **Modifié**
- ✅ `prisma/schema.prisma` - Ajout nature + snapshotAccounting
- ✅ `src/app/api/payments/route.ts` - Retourne accountingCategory
- ✅ `src/app/api/payments/batch/route.ts` - Validation + snapshot
- ✅ `src/app/api/payments/[id]/route.ts` - GET/PATCH/DELETE
- ✅ `src/ui/transactions/TransactionModal.tsx` - 2 selects + filtrage
- ✅ `src/ui/transactions/TransactionsTable.tsx` - Badges séparés
- ✅ `src/ui/shared/tables/TransactionsTable.tsx` - Idem
- ✅ `src/app/api/payments/stats/route.ts` - KPI refactorisés

---

## 🎯 **9. VÉRIFICATION DoD**

### **Modal de transaction**
- [x] 2 selects séparés (Nature + Catégorie comptable)
- [x] Aucun "(Revenu)" ou "(Dépense)" concaténé dans les labels
- [x] Filtrage dynamique par type selon nature
- [x] Groupement par type (optgroup)
- [x] Pré-sélection "Loyer" si nature=LOYER
- [x] Dirty flag empêche écrasement manuel
- [x] Badges + tags comptables en lecture seule
- [x] Validation côté serveur

### **Tables**
- [x] Badge Nature coloré (colonne dédiée)
- [x] "Catégorie : XXX" en sous-libellé du libellé
- [x] Badge Type séparé avec tooltip
- [x] Pas de duplication visuelle

### **APIs**
- [x] GET /api/accounting-categories filtrée
- [x] GET /api/payments retourne accountingCategory
- [x] POST/PATCH valident + créent snapshot
- [x] DELETE supprime paiement + PJ
- [x] Catégories "Non défini" exclues

### **Données**
- [x] 9 transactions avec nature + catégorie
- [x] Snapshot JSON créé automatiquement
- [x] Toutes les tables fonctionnelles

---

## 🚀 **10. RÉSULTAT FINAL**

### **Avantages**

✅ **Séparation claire** : Nature (business) ≠ Catégorie (comptabilité)  
✅ **Validation forte** : Impossible de créer des incohérences  
✅ **Historique figé** : Snapshot préserve l'état au moment de la saisie  
✅ **UX intuitive** : Filtrage automatique selon nature  
✅ **Scalable** : Admin peut ajouter des catégories sans toucher au code  
✅ **Reporting précis** : Calculs déductibles/capitalisables automatiques  

### **Prochaines étapes (optionnel)**

- [ ] Page Admin > Catégories (CRUD complet)
- [ ] Export comptable avec colonnes Nature + Catégorie + Flags
- [ ] Suggestions auto de catégorie basées sur libellé
- [ ] Dashboard fiscal avec totaux déductibles/capitalisables

---

## ✅ **TOUT FONCTIONNE !**

**Testez maintenant :**
1. `/transactions` → Voir les 9 transactions
2. Cliquer "Éditer" → Modifier nature/catégorie
3. Cliquer "Supprimer" → Suppression fonctionnelle
4. Créer nouvelle transaction → Filtrage automatique

**Le système est production-ready ! 🎊**



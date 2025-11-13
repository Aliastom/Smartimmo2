# 📊 État Initial - Scan des Identifiants Français

**Date du scan** : 10/10/2025  
**Commande** : `npm run scan:fr`

---

## 📈 Résumé

```
📊 French-like identifiers found: 603
📁 Files affected: 64
```

---

## 📁 Répartition par Domaine

| Domaine | Fichiers | Exemples |
|---------|----------|----------|
| **Domain** | ~10 | `propertyMetricsService.ts`, `leaseActivationService.ts` |
| **UI Components** | ~20 | `PropertyForm.tsx`, `TransactionFilters.tsx` |
| **API Routes** | ~15 | `/api/properties/route.ts`, `/api/categories/route.ts` |
| **Hooks** | ~8 | `useAccountingCategories.ts`, `useDocumentStats.ts` |
| **Pages** | ~8 | `biens/page.tsx`, `locataires/page.tsx`, `patrimoine/page.tsx` |
| **PDF Templates** | ~3 | `bail-vide.tsx`, `bail-meuble.tsx`, `bail-garage.tsx` |

---

## 🔝 Top 10 des Fichiers les Plus Impactés

### 1. `src/domain/services/propertyMetricsService.ts`

**Identifiants français** : 18

```
biens, dettes, dettesTotales, fraisSortie, fraisSortieTotaux,
loyersAnnuels, loyersEncaisses, mensualites, occupation,
parOccupation, patrimoineBrut, patrimoineNet, rendementBrut,
statut, tauxOccupation, valeur, valeurMarche
```

---

### 2. `src/app/patrimoine/page.tsx`

**Identifiants français** : 12

```
PatrimoinePage, bien, biens, dettes, occupation, parOccupation,
patrimoineBrut, patrimoineNet, rendementBrut, tauxOccupation,
valeur, valeurMarche
```

---

### 3. `src/pdf/templates/bail-vide.tsx`

**Identifiants français** : 10+

```
BailVidePdfProps, buildBailVidePdf, includeSignature, signImg,
signLabel, signLine, signMeta, signWrap, signature,
signatureBlock, signatureField, signatureLabel, signatureLine,
signatureMention, signatureUrl, signaturesContainer,
signaturesRow, signedAt
```

---

### 4. `src/pdf/templates/bail-meuble.tsx`

**Identifiants français** : 10+

```
BailMeublePdfProps, buildBailMeublePdf, includeSignature, ...
```

---

### 5. `src/pdf/templates/bail-garage.tsx`

**Identifiants français** : 10+

```
BailGaragePdfProps, buildBailGaragePdf, includeSignature, ...
```

---

### 6. `src/utils/transactionCategory.ts`

**Identifiants français** : 6

```
TRANSACTION_CATEGORIES, LOYER, DEPOT_RECU, DEPOT_RENDU,
AVOIR, PENALITE
```

---

### 7. `src/ui/hooks/useAccountingCategories.ts`

**Identifiants français** : 3

```
UseAccountingCategoriesParams, useAccountingCategories
```

---

### 8. `src/app/biens/page.tsx`

**Identifiants français** : 1

```
BiensPage
```

---

### 9. `src/app/locataires/page.tsx`

**Identifiants français** : 1

```
LocatairesPage
```

---

### 10. `src/domain/use-cases/getPendingRents.ts`

**Identifiants français** : 3

```
categories, loyerCategory
```

---

## 🎯 Identifiants les Plus Fréquents

| Identifiant FR | Occurrences | Traduction EN |
|----------------|-------------|---------------|
| `categories` | ~15 | `categories` (déjà EN) |
| `signature` | ~12 | `signature` (déjà EN) |
| `signatureUrl` | ~10 | `signatureUrl` (déjà EN) |
| `bail` | ~8 | `lease` |
| `biens` | ~6 | `properties` |
| `occupation` | ~6 | `occupation` (déjà EN) |
| `statut` | ~5 | `status` |
| `loyer` | ~4 | `rent` |
| `patrimoine` | ~4 | `portfolio` |
| `dettes` | ~3 | `debts` |

---

## 📋 Liste Complète des Fichiers Impactés

### Domain Layer (10 fichiers)

1. `src/domain/entities/Lease.ts`
2. `src/domain/services/leaseActivationService.ts`
3. `src/domain/services/propertyMetricsService.ts`
4. `src/domain/services/propertyValidationService.ts`
5. `src/domain/use-cases/calculateDashboardKpis.ts`
6. `src/domain/use-cases/getPendingRents.ts`
7. `src/domain/use-cases/__tests__/getPendingRents.test.ts`

### UI Components (20 fichiers)

1. `src/components/SignatureCanvasBox.tsx`
2. `src/components/SignatureSuccessModal.tsx`
3. `src/ui/admin/DeleteCategoryModal.tsx`
4. `src/ui/components/AttachmentViewer.tsx`
5. `src/ui/components/PropertyForm.tsx`
6. `src/ui/components/PropertyInfoTab.tsx`
7. `src/ui/components/PropertyTransactionsTab.tsx`
8. `src/ui/components/TransactionFilters.tsx`
9. `src/ui/components/TransactionForm.tsx`
10. `src/ui/components/stats/DocumentStatsCards.tsx`
11. `src/ui/components/stats/LoanStatsCards.tsx`
12. `src/ui/components/stats/PropertyStatsCards.tsx`
13. `src/ui/components/stats/TransactionStatsCards.tsx`
14. `src/ui/leases-tenants/LeasePdfModal.tsx`
15. `src/ui/leases-tenants/LeaseRowActions.tsx`
16. `src/ui/leases-tenants/LeasesTable.tsx`
17. `src/ui/leases-tenants/RentReceiptModal.tsx`
18. `src/ui/properties/PropertyTransactionsClient.tsx`
19. `src/ui/shared/tables/LeasesTable.tsx`
20. `src/ui/tables/LeasesTable.tsx`

### Hooks (8 fichiers)

1. `src/ui/hooks/useAccountingCategories.ts`
2. `src/ui/hooks/useDocumentStats.ts`
3. `src/ui/hooks/useLeases.ts`
4. `src/ui/hooks/usePropertyStats.ts`

### Pages (8 fichiers)

1. `src/app/biens/page.tsx`
2. `src/app/locataires/page.tsx`
3. `src/app/patrimoine/page.tsx`
4. `src/app/profil/page.tsx`
5. `src/app/admin/categories/page.tsx`
6. `src/app/admin/nature-mapping/page.tsx`
7. `src/app/leases-tenants/locataires/page.tsx`

### API Routes (15 fichiers)

1. `src/app/actions/properties.ts`
2. `src/app/api/accounting-categories/route.ts`
3. `src/app/api/categories/route.ts`
4. `src/app/api/categories/[id]/route.ts`
5. `src/app/api/categories/[id]/archive/route.ts`
6. `src/app/api/categories/[id]/merge/route.ts`
7. `src/app/api/documents/stats/route.ts`
8. `src/app/api/landlords/signature/route.ts`
9. `src/app/api/leases/[id]/generate-pdf/route.ts`
10. `src/app/api/leases/[id]/signed-pdf/route.ts`
11. `src/app/api/leases/[id]/upload-signed/route.ts`
12. `src/app/api/payments/stats/route.ts`
13. `src/app/api/properties/route.ts`
14. `src/app/api/properties/[id]/route.ts`
15. `src/app/api/properties/stats/route.ts`

### PDF Templates (3 fichiers)

1. `src/pdf/templates/bail-garage.tsx`
2. `src/pdf/templates/bail-meuble.tsx`
3. `src/pdf/templates/bail-vide.tsx`
4. `src/pdf/templates/lease-vide.tsx`
5. `src/components/pdf/RentReceiptPDF.tsx`

### Utils (3 fichiers)

1. `src/utils/accountingStyles.ts`
2. `src/utils/transactionCategory.ts`
3. `src/pdf/gapChecker.ts`

### Transactions (3 fichiers)

1. `src/ui/transactions/TransactionFilters.tsx`
2. `src/ui/transactions/TransactionModal.tsx`
3. `src/ui/transactions/TransactionsPageContent.tsx`

---

## 🎯 Objectif

**Passer de 603 identifiants français à 0**

---

## 🚀 Prochaines Étapes

1. **Lire** : `START-HERE.md`
2. **Lire** : `docs/QUICK-START-MIGRATION.md`
3. **Commencer** : Phase 1 (Database - `prisma/schema.prisma`)
4. **Suivre** : `docs/MIGRATION-FR-EN-GUIDE.md`

---

## 📊 Suivi de Progression

Après chaque phase, relancez :

```bash
npm run scan:fr
```

Et notez la progression :

| Phase | Identifiants restants |
|-------|----------------------|
| Initial | 603 |
| Phase 1 (DB) | ? |
| Phase 2 (Domain) | ? |
| Phase 3 (Infra) | ? |
| Phase 4 (API) | ? |
| Phase 5 (UI) | ? |
| Phase 6 (i18n) | ? |
| **Final** | **0** ✅ |

---

**Bon courage pour la migration ! 🚀**

_Scan effectué le : 10/10/2025_


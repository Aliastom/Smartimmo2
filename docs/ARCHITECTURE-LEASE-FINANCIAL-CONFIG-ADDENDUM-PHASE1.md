# Addendum Phase 1 : Double écriture et garde-fous

> Complément à `ARCHITECTURE-LEASE-FINANCIAL-CONFIG.md`  
> Plan concret pour éviter toute divergence silencieuse entre LeaseFinancialConfig et les champs legacy pendant la Phase 1.

---

## 1. Stratégie de double écriture

### 1.1 Centralisation obligatoire

**Règle** : toute écriture des champs financiers (rentAmount, deposit, paymentDay, chargesRecupMensuelles, chargesNonRecupMensuelles, indexationType) doit passer par un **point unique** qui garantit la cohérence Lease + LeaseFinancialConfig.

**Point unique** : `LeaseService` (`src/domain/services/LeaseService.ts`).

- `createLease()` → écrit Lease via `leaseRepo.create()` **puis** upsert LeaseFinancialConfig via `leaseFinancialConfigRepo.upsert()`.
- `updateLease()` → même principe : `leaseRepo.update()` **puis** `leaseFinancialConfigRepo.upsert()` (si champs financiers modifiés).

### 1.2 Flux d’écriture (Phase 1)

```
Formulaire bail (LeasesPageCore, PropertyLeasesClient, LeaseEditModal, LeaseFormModal, etc.)
    → LeaseService.createLease() / updateLease()
        → leaseRepo.create() / update()     [Lease]
        → leaseFinancialConfigRepo.upsert() [LeaseFinancialConfig]
```

**Interdiction** : aucun composant ou route API ne doit appeler `leaseRepo.create/update` ou `prisma.lease.create/update` directement pour des champs financiers. Seul LeaseService est autorisé.

### 1.3 Points d’écriture à adapter

| Point d’écriture | Actuel | Phase 1 |
|------------------|--------|---------|
| `LeaseService.createLease` | leaseRepo.create | + leaseFinancialConfigRepo.upsert après |
| `LeaseService.updateLease` | leaseRepo.update | + leaseFinancialConfigRepo.upsert si champs financiers |
| `POST /api/leases` | LeaseService.createLease | Inchangé (déjà centralisé) |
| `PATCH /api/leases/[id]` | LeaseService.updateLease | Inchangé |
| `POST /api/leases/[id]/index-rent` | **prisma.lease.update direct** | Migrer vers LeaseService.indexRent() ou appeler leaseFinancialConfigRepo.upsert après |
| PrismaLeaseRepository | Appelé par LeaseService | Ne pas modifier (LeaseService gère la double écriture) |
| IndexedDBLeaseRepository | Appelé par LeaseService | Idem + sync LeaseFinancialConfig en IDB |

### 1.4 Cas particulier : index-rent

L’API `POST /api/leases/[id]/index-rent` met à jour uniquement `rentAmount` via Prisma. En Phase 1 :

- **Option A** : extraire la logique dans `LeaseService.indexRent(leaseId, newRentAmount, effectiveDate, ...)` qui fera Lease + LeaseFinancialConfig.
- **Option B** : garder la route telle quelle mais ajouter un appel à `leaseFinancialConfigRepo.upsert()` après le `prisma.lease.update`, avec `baseRent: validatedData.newRentAmount`.

Recommandation : **Option A** pour garder une seule porte d’entrée.

### 1.5 Règle anti-dispersion

- **Aucune** écriture Prisma `lease.update` / `lease.create` avec des champs financiers en dehors de `PrismaLeaseRepository` (appelé par LeaseService) et des routes qui passent par LeaseService.
- **Note** : `infra/repositories/leaseRepository.ts` expose `create` et `update` mais n’est pas utilisé pour les écritures (flux actuel via LeaseService). Ne pas réutiliser pour des écritures financières.
- Audit / grep avant merge : rechercher `prisma.lease.update`, `prisma.lease.create`, `lease.update`, `lease.create` et vérifier qu’ils sont bien dans le flux LeaseService ou dans des cas non financiers (ex. status, signedPdfUrl).

---

## 2. Liste exhaustive des lecteurs legacy à migrer (Phase 2)

### 2.1 Transactions

| Fichier | Usage | Migration |
|---------|-------|-----------|
| `TransactionFormTabs.tsx` | bail.rentAmount (montant, activeBail.rentAmount) | getLeaseFinancialData().baseRent, totalDueByTenant |
| `TransactionModalV2.tsx` | selectedLease.rentAmount, chargesRecupMensuelles, total | getLeaseFinancialData().baseRent, chargesRecoverableMonthly, totalDueByTenant |
| `TransactionModal.tsx` (legacy) | selectedLease.rentAmount, charges | Idem |
| `PropertyTransactionsWithUnifiedModal.tsx` | lease.rentAmount (affichage) | getLeaseFinancialData() ou pré-calcul côté liste |

### 2.2 Échéances

| Fichier | Usage | Migration |
|---------|-------|-----------|
| Pré-remplissage création LOYER_ATTENDU | Montant depuis bail | getLeaseFinancialData().totalDueByTenant |

(Formulaires échéances : PropertyEcheancesClient, EcheancesPageCore — le montant vient du formulaire, pré-rempli depuis le bail dans certains parcours.)

### 2.3 Édition bail

| Fichier | Usage | Migration |
|---------|-------|-----------|
| `LeaseEditModal.tsx` | Lecture initiale lease (rentAmount, deposit, …) | En Phase 2 : getLeaseFinancialData() pour pré-remplir |
| `LeaseFormComplete.tsx` | initialData, formData | Idem |
| `PropertyLeasesClient.tsx` (soumission) | data → LeaseService | Inchangé (écriture centralisée) |
| `LeasesPageCore.tsx` | selectedLease pour pré-remplir, data → LeaseService | getLeaseFinancialData() pour lecture |
| `LeaseFormModal.tsx` | initialData, createLeaseMutation | getLeaseFinancialData() pour lecture |
| `PropertyLeasesTab.tsx` (PropertyDrawer) | formData.rentAmount, depositAmount, paymentDay | getLeaseFinancialData() |
| `LeaseDrawerNew.tsx` | lease.rentAmount, chargesRecupMensuelles, deposit, paymentDay | getLeaseFinancialData() |

### 2.4 Tableaux / listes

| Fichier | Usage | Migration |
|---------|-------|-----------|
| `LeasesTable.tsx` | lease.rentAmount, deposit | Affichage : mapper via getLeaseFinancialData ou enrichir la liste côté hook |
| `LeasesTableNew.tsx` | idem | Idem |
| `LeasesTable` (ui/shared) | lease.rentAmount, deposit | Idem |
| `PropertyLeasesTab.tsx` | lease.rentAmount, depositAmount | Idem |
| `LeasesAlertsSection.tsx` | lease.rentAmount | Idem |
| `PropertyLeasesClient.tsx` (baux) | selectedLease | Déjà chargé via LeaseService / API |
| `LeasesClient.tsx` (app/baux) | rentAmount, deposit, paymentDay | Idem |
| `PropertyLeasesClient-tmp.txt` | idem | Idem |
| `PropertyDetailClient.tsx` | lease.rentAmount | getLeaseFinancialData ou enrichissement |
| `BiensClient.tsx` | property.Lease[0].rentAmount | Idem |
| `PropertyDrawerLight.tsx` | lease.rentAmount, charges | Idem |
| `LocatairesClient.tsx` | lease.rentAmount | Idem |
| `TenantDrawer.tsx` | lease.rentAmount | Idem |
| `PropertyLeaseStats.tsx` | lease.rentAmount | Idem |
| `PropertyTenantsClient.tsx` | lease.rentAmount | Idem |

### 2.5 Dashboard / patrimoine

| Fichier | Usage | Migration |
|---------|-------|-----------|
| `dashboardCalculations.ts` | lease.rentAmount | getLeaseFinancialData().ownerContractualIncome ou totalDueByTenant selon usage |
| `useDashboardData.ts` | loyerActuel | Idem |
| `lateRentAlerts.ts` | lease.rentAmount | Idem |
| `useDashboardInsights.ts` | lease.rentAmount | Idem |
| `usePatrimoineData.ts` | lease.rentAmount, chargesRecupMensuelles | getLeaseFinancialData() |
| `usePropertyInsights.ts` | activeLease.rentAmount | Idem |
| API `dashboard/monthly` | loyers, échéances | Vérifier si lecture directe Lease |
| API `dashboard/patrimoine` | lease.rentAmount, chargesRecupMensuelles | getLeaseFinancialData ou requête join |
| API `leases/stats` | _sum.rentAmount | Adapter vers LeaseFinancialConfig ou keep legacy pendant Phase 1 |

### 2.6 Quittances / PDF / exports

| Fichier | Usage | Migration |
|---------|-------|-----------|
| `LeasePdf.tsx` | rentAmount, chargesRecupMensuelles, deposit, paymentDay | getLeaseFinancialData() |
| `pdf/templates/bail-meuble.tsx` | idem | Idem |
| `pdf/templates/bail-vide.tsx` | idem | Idem |
| `pdf/templates/bail-garage.tsx` | idem | Idem |
| `pdf/templates/lease-vide.tsx` | idem | Idem |
| `LeaseActionsManager.tsx` | lease.rentAmount, paymentDay, charges | Idem |
| `RentReceiptModal.tsx` | lease.rentAmount, charges | Idem |
| API `leases/[id]/pdf` | mapping lease → PDF | getLeaseFinancialData() ou inclure config dans la réponse |
| API `leases/[id]/generate-lease-pdf` | idem | Idem |
| API `receipts` | lease.rentAmount, chargesRecupMensuelles | Idem |
| API `receipts/[transactionId]/pdf` | transaction.Lease?.rentAmount, chargesRecupMensuelles | Idem |

### 2.7 Autres points

| Fichier | Usage | Migration |
|---------|-------|-----------|
| `useLeasesCharts.ts` | rentAmount, deposit | getLeaseFinancialData ou enrichissement liste |
| `usePropertiesData.ts` | lease.rentAmount | Idem |
| `useLeasesData.ts` | rentAmount, charges, deposit, paymentDay (mapping, filtres) | Idem |
| `useLeasesKpis.ts` | (si lecture rentAmount) | Vérifier |
| `FiscalAggregator.ts` | lease.rentAmount, chargesRecupMensuelles | getLeaseFinancialData ou équivalent service |
| `delegatedManagementReport.ts` | lease.rentAmount, chargesRecupMensuelles | Idem |
| `delegatedManagementReportOffline.ts` | idem | Idem |
| `propertyMetricsService.ts` | lease.rentAmount | Idem |
| `leasesService.ts` (lib) | lease.rentAmount, charges, deposit, paymentDay | Idem |
| `getPendingRents.ts` | lease.rentAmount | Idem |
| `financialEngine.ts` | data.rentAmount | Adapter l’interface d’entrée |
| `PropertyForm.tsx` | initialData.Lease?.[0]?.rentAmount | getLeaseFinancialData |
| `gapChecker.ts` | rentAmount, deposit, paymentDay | getLeaseFinancialData |
| `enhancedRouter.ts` (AI) | SQL rentAmount, deposit | Adapter les requêtes (Phase 2 ou 3) |
| `scripts/fix-document-links-entity-names.ts` | lease.rentAmount | Script one-shot, adapter si rejoué |

### 2.8 API routes (lecture)

| Route | Usage | Migration |
|-------|-------|-----------|
| `GET /api/leases` | Retourne Lease avec champs legacy | En Phase 2, inclure LeaseFinancialConfig ou dériver via getLeaseFinancialData |
| `GET /api/leases/[id]` | Idem | Idem |
| `GET /api/leases/stats` | _sum.rentAmount | Adapter agrégation |
| `GET /api/leases/charts` | rentAmount | Idem |
| `GET /api/dashboard/patrimoine` | lease.rentAmount | Idem |
| `GET /api/dashboard/monthly` | loyers | Idem |
| `GET /api/insights` | rentAmount | Idem |
| `GET /api/properties/stats` | rentAmount, charges | Idem |

---

## 3. Garde-fous temporaires (Phase 1)

### 3.1 Logs de divergence

Dans `LeaseService`, après chaque `createLease` / `updateLease` :

1. Lire Lease et LeaseFinancialConfig fraîchement.
2. Comparer :
   - `lease.rentAmount` ↔ `config.baseRent`
   - `lease.chargesRecupMensuelles` ↔ `config.chargesRecoverableMonthly`
   - `lease.chargesNonRecupMensuelles` ↔ `config.chargesNonRecoverableMonthly`
   - `lease.deposit` ↔ `config.deposit`
   - `lease.paymentDay` ↔ `config.paymentDay`
3. Si écart : `console.error('[LeaseFinancialConfig] DIVERGENCE', { leaseId, lease, config, diff: [...] })` et optionnellement `logToServer()`.

Activer uniquement si `process.env.NODE_ENV === 'development'` ou si une variable `LEASE_FINANCIAL_DEBUG=1` est définie.

### 3.2 Assertions en développement

Dans `LeaseService` après la double écriture :

```typescript
if (process.env.NODE_ENV === 'development' && process.env.LEASE_FINANCIAL_STRICT === '1') {
  const lease = await this.deps.leaseRepo.findById(created.id, orgId);
  const config = await this.deps.leaseFinancialConfigRepo.getByLeaseId(created.id, orgId);
  if (config) {
    const ok = Math.abs((lease?.rentAmount ?? 0) - config.baseRent) < 0.01
      && Math.abs((lease?.chargesRecupMensuelles ?? 0) - (config.chargesRecoverableMonthly ?? 0)) < 0.01
      && Math.abs((lease?.chargesNonRecupMensuelles ?? 0) - (config.chargesNonRecoverableMonthly ?? 0)) < 0.01;
    if (!ok) throw new Error(`[LEASE_FINANCIAL] Divergence détectée lease ${created.id}`);
  }
}
```

- `LEASE_FINANCIAL_STRICT=1` : activer en local pour les tests manuels.

### 3.3 Script de contrôle d’intégrité

Script `scripts/check-lease-financial-integrity.ts` :

```typescript
/**
 * Vérifie la cohérence Lease <-> LeaseFinancialConfig.
 * À lancer manuellement ou en CI pendant la Phase 1.
 *
 * Usage: npx ts-node scripts/check-lease-financial-integrity.ts
 */

import { prisma } from '../src/lib/prisma';

const TOLERANCE = 0.01;

async function main() {
  const leases = await prisma.lease.findMany({
    include: { LeaseFinancialConfig: true }
  });

  const errors: Array<{ leaseId: string; field: string; leaseVal: number | null; configVal: number | null }> = [];

  for (const lease of leases) {
    const config = lease.LeaseFinancialConfig?.[0]; // Phase 1 : 1 config par bail
    if (!config) continue;

    const checks = [
      { field: 'baseRent', a: lease.rentAmount, b: config.baseRent },
      { field: 'chargesRecoverable', a: lease.chargesRecupMensuelles ?? 0, b: config.chargesRecoverableMonthly },
      { field: 'chargesNonRecoverable', a: lease.chargesNonRecupMensuelles ?? 0, b: config.chargesNonRecoverableMonthly },
      { field: 'deposit', a: lease.deposit ?? null, b: config.deposit },
      { field: 'paymentDay', a: lease.paymentDay ?? null, b: config.paymentDay },
    ];

    for (const { field, a, b } of checks) {
      const numA = typeof a === 'number' ? a : null;
      const numB = typeof b === 'number' ? b : null;
      if (numA === null && numB === null) continue;
      if (numA === null || numB === null || Math.abs(numA - numB) > TOLERANCE) {
        errors.push({ leaseId: lease.id, field, leaseVal: numA, configVal: numB });
      }
    }
  }

  if (errors.length > 0) {
    console.error(`❌ ${errors.length} divergence(s) détectée(s):`);
    console.error(JSON.stringify(errors, null, 2));
    process.exit(1);
  } else {
    console.log(`✅ ${leases.length} bail/baux vérifié(s), aucune divergence.`);
  }
}

main().finally(() => prisma.$disconnect());
```

- À adapter selon la structure réelle de `LeaseFinancialConfig` (tableau ou 1:1).
- Exécution : `npx ts-node scripts/check-lease-financial-integrity.ts` ou via un script npm.
- Intégration possible en CI sur une branche dédiée Phase 1.

### 3.4 Résumé des garde-fous

| Garde-fou | Quand | Où |
|-----------|-------|-----|
| Logs divergence | Après create/update Lease | LeaseService |
| Assertions strictes | Dev + LEASE_FINANCIAL_STRICT=1 | LeaseService |
| Script intégrité | Manuel / CI | scripts/check-lease-financial-integrity.ts |
| Audit écritures | Avant merge | grep `lease.update`, `lease.create`, `prisma.lease` |

---

## 4. Checklist Phase 1

- [ ] LeaseFinancialConfig créé (Prisma + migration)
- [ ] leaseFinancialConfigRepo (Prisma + IndexedDB) implémenté
- [ ] LeaseService : double écriture dans createLease / updateLease
- [ ] index-rent migré vers LeaseService ou double écriture explicite
- [ ] Aucune écriture financière en dehors de LeaseService
- [ ] Logs de divergence activables (dev)
- [ ] Assertions LEASE_FINANCIAL_STRICT (dev)
- [ ] Script check-lease-financial-integrity ajouté et documenté
- [ ] Sync offline LeaseFinancialConfig configurée
- [ ] Liste des lecteurs Phase 2 documentée et priorisée

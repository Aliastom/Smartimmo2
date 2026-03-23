# Proposition : LeaseFinancialConfig — Découplage Bail / Configuration Financière

> Document de proposition architectural. Pas de code UI.
> Focus : data model, logique métier, migration.

---

## 1. Contexte et diagnostic

### 1.1 État actuel

Le modèle `Lease` actuel mélange :

| Champ | Nature | Problème |
|-------|--------|----------|
| `propertyId`, `tenantId`, `type`, `startDate`, `endDate`, `status` | Contractuel | OK — rester sur Lease |
| `rentAmount`, `chargesRecupMensuelles`, `chargesNonRecupMensuelles` | Financier | Couplé au contrat |
| `deposit`, `paymentDay` | Financier | Couplé au contrat |
| `indexationType` | Règle de calcul | Mélangé au contrat |
| `notes`, `noticeMonths`, `signedPdfUrl`, `overridesJson` | Contractuel / métadonnées | OK |

**Consommateurs des données financières :**

- **Transactions** : `TransactionFormTabs` (bail.rentAmount), `TransactionModalV2` (montantLoyer, chargesRecup)
- **Échéances** : création d’échéances LOYER_ATTENDU (montant = rentAmount + charges)
- **Dashboard / Patrimoine** : KPI, loyers attendus, cashflow
- **Indexation** : `RentIndexation` (leaseId, previousRentAmount, newRentAmount)
- **PDF bail** : rentAmount, chargesRecupMensuelles, deposit, paymentDay

### 1.2 Objectifs

1. Garder le bail comme **source contractuelle** (locataire, bien, dates, type, statut, clauses).
2. Extraire la logique financière dans une entité dédiée `LeaseFinancialConfig`.
3. Conserver le comportement actuel (auto-remplissage transaction, échéances).
4. Préparer indexation avancée, génération d’échéances propre, simulation financière.

---

## 2. Schéma Prisma proposé

### 2.1 Lease (inchangé en Phase 1 et 2)

**Phase 1 et 2** : les champs financiers restent sur `Lease`. Aucune suppression.

```prisma
model Lease {
  id                         String   @id @default(cuid())
  organizationId             String   @default("default")
  propertyId                 String
  tenantId                   String
  type                       String
  startDate                  DateTime
  endDate                    DateTime?
  rentAmount                 Float    // LEGACY — conservé jusqu'en Phase 3
  deposit                    Float?   // LEGACY
  paymentDay                 Int?     // LEGACY
  notes                      String?
  noticeMonths               Int?
  indexationType             String?  // LEGACY
  furnishedType              String?
  overridesJson              String?
  status                     String   @default("BROUILLON")
  signedPdfUrl               String?
  chargesRecupMensuelles     Float?   // LEGACY
  chargesNonRecupMensuelles  Float?   // LEGACY
  createdAt                  DateTime @default(now())
  updatedAt                  DateTime @updatedAt

  Document                               Document[]
  EcheanceRecurrente                     EcheanceRecurrente[]
  Property                               Property             @relation(fields: [propertyId], references: [id])
  Tenant                                 Tenant               @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  LeaseVersion                           LeaseVersion[]
  LeaseFinancialConfig                   LeaseFinancialConfig[] // 1:1 en Phase 1, préparé pour 1:N (avenants)
  RentIndexation                         RentIndexation[]
  Payment                                Payment[]
  Transaction_Transaction_bailIdToLease  Transaction[]
  Transaction_Transaction_leaseIdToLease Transaction[]
  Organization                           Organization         @relation(fields: [organizationId], references: [id])

  @@index([organizationId])
}
```

**Phase 3** (après stabilisation) : suppression des champs legacy marqués LEGACY.

### 2.2 LeaseFinancialConfig (nouveau)

```prisma
model LeaseFinancialConfig {
  id                           String    @id @default(cuid())
  leaseId                      String
  organizationId               String    @default("default")
  effectiveFrom                DateTime  @default(now())  // Préparation avenants : date d'effet
  baseRent                     Float
  chargesRecoverableMonthly    Float     @default(0)
  chargesNonRecoverableMonthly Float     @default(0)
  deposit                      Float?
  paymentDay                   Int?      // 1-31
  indexationRuleJson           String?
  createdAt                    DateTime  @default(now())
  updatedAt                    DateTime  @updatedAt

  Lease        Lease         @relation(fields: [leaseId], references: [id], onDelete: Cascade)
  Organization Organization  @relation(fields: [organizationId], references: [id])

  @@unique([leaseId, effectiveFrom])  // Un seul config par bail à une date donnée
  @@index([organizationId])
  @@index([leaseId])
  @@index([leaseId, effectiveFrom])
}
```

**Note sur `effectiveFrom`** : en Phase 1, un seul enregistrement par bail (effectiveFrom = startDate du bail ou createdAt). Le `@@unique([leaseId, effectiveFrom])` permet, en Phase future, plusieurs configs pour le même bail (avenants, renouvellements).

> Voir section 2.5 pour l’évolution vers l’historisation.

### 2.3 IndexationRule (optionnel — évolution ultérieure)

Stocker la règle en JSON dans `indexationRuleJson` :

```typescript
// Type pour indexationRuleJson
interface IndexationRule {
  type: 'IRL' | 'ILAT' | 'ICC' | 'MANUAL' | 'NONE';
  frequency?: 'YEARLY' | 'BI_YEARLY';
  referenceQuarter?: string; // "Q2" = indice Q2 année N-1
  lastAppliedDate?: string;  // ISO date
}
```

Si besoin d’une table dédiée plus tard :

```prisma
model IndexationRule {
  id                String    @id @default(cuid())
  leaseFinancialConfigId String
  type              String    // IRL, ILAT, ICC, MANUAL
  frequency         String?
  referenceQuarter  String?
  lastAppliedDate   DateTime?
  LeaseFinancialConfig LeaseFinancialConfig @relation(...)
}
```

### 2.4 RentIndexation (inchangé)

Reste liée à `Lease` (historique des réindexations). La référence logique reste le bail ; on peut ajouter `leaseFinancialConfigId` plus tard si utile.

### 2.5 Évolution future : historisation / avenants

**Phase 1** : Un seul `LeaseFinancialConfig` par bail, `effectiveFrom` = date de début du bail.

**Évolution prévue** (hors périmètre immédiat) :

1. **Avenant / changement de loyer** : créer une nouvelle ligne `LeaseFinancialConfig` avec `effectiveFrom` = date d’effet de l’avenant. La contrainte `@@unique([leaseId, effectiveFrom])` le permet déjà.

2. **`getLeaseFinancialData(leaseId, asOfDate?)`** : en Phase 1, retourner l’unique config. Plus tard, avec plusieurs configs, sélectionner celle où `effectiveFrom <= asOfDate` (ou aujourd’hui par défaut), triée par `effectiveFrom DESC`, première ligne.

3. **Renouvellement** : possibilité de créer un nouveau bail (`Lease`) ou de garder le même bail avec une nouvelle `LeaseFinancialConfig` (avenant). Choix métier à trancher.

4. **Table dédiée `LeaseFinancialConfigVersion`** : optionnelle si l’historique doit être interrogé indépendamment des baux actifs (reporting, audit).

---

## 3. Stratégie de migration en 3 phases

### 3.1 Vue d’ensemble

| Phase | Objectif | Champs legacy Lease | Lecteurs | Écritures |
|-------|----------|---------------------|----------|-----------|
| **Phase 1** | Ajouter LeaseFinancialConfig, double écriture | Conservés | Lecture directe Lease OK | Bail : écriture Lease + LeaseFinancialConfig |
| **Phase 2** | Centraliser la lecture | Conservés | Tous passent par getLeaseFinancialData() | Inchangé |
| **Phase 3** | Supprimer le legacy | Supprimés | getLeaseFinancialData() | Bail : LeaseFinancialConfig uniquement |

### 3.2 Phase 1 : Ajout sans suppression

- Créer la table `LeaseFinancialConfig` (avec `effectiveFrom`).
- **Conserver tous les champs financiers sur Lease** : aucun retrait.
- Script de migration : copier les données Lease → LeaseFinancialConfig pour les baux existants.
- Formulaires bail : écrire en double (Lease + LeaseFinancialConfig) pour cohérence.
- Tous les lecteurs continuent à lire sur Lease (comportement actuel).
- **Offline** : ajouter `LocalLeaseFinancialConfig` à IndexedDB, configurer la sync.

**Critères de sortie Phase 1** : LeaseFinancialConfig peuplé, sync offline validée, aucune régression.

### 3.3 Phase 2 : Centralisation de la lecture

- Implémenter `getLeaseFinancialData(leaseId)` avec fallback Lease.
- Migrer **tous** les points de lecture :
  - TransactionFormTabs, TransactionModalV2
  - Échéances (pré-remplissage)
  - Dashboard, Patrimoine, API
  - PDF bail, quittances, rapports
- **Interdiction** : plus aucune lecture directe de `lease.rentAmount`, `lease.chargesRecupMensuelles`, etc. en dehors de `getLeaseFinancialData()`.

**Critères de sortie Phase 2** : Aucune lecture legacy restante, tests E2E verts (normal + app-shell).

### 3.4 Phase 3 : Déprécation et suppression

- **Prérequis** : Phase 2 stable, sync offline éprouvée en production.
- Marquer les champs legacy comme `@deprecated` dans le code (comments / lint).
- Arrêter les écritures legacy : formulaires n’écrivent plus que LeaseFinancialConfig.
- Migration Prisma : suppression des colonnes `rentAmount`, `deposit`, `paymentDay`, `chargesRecupMensuelles`, `chargesNonRecupMensuelles`, `indexationType` sur Lease.
- Supprimer le fallback dans `getLeaseFinancialData()`.

**Critères de sortie Phase 3** : Lease allégé, aucun champ financier restant.

### 3.5 Migration des données (Phase 1)

```sql
-- Script de migration Phase 1 (après création de la table LeaseFinancialConfig)
INSERT INTO "LeaseFinancialConfig" (
  id, "leaseId", "organizationId", "effectiveFrom",
  "baseRent", "chargesRecoverableMonthly", "chargesNonRecoverableMonthly",
  deposit, "paymentDay", "indexationRuleJson", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  l.id,
  l."organizationId",
  l."startDate",  -- effectiveFrom = début du bail
  l."rentAmount",
  COALESCE(l."chargesRecupMensuelles", 0),
  COALESCE(l."chargesNonRecupMensuelles", 0),
  l.deposit,
  l."paymentDay",
  CASE WHEN l."indexationType" IS NOT NULL AND l."indexationType" != '' 
       THEN json_build_object('type', l."indexationType")::text 
       ELSE NULL END,
  l."createdAt",
  l."updatedAt"
FROM "Lease" l
WHERE NOT EXISTS (
  SELECT 1 FROM "LeaseFinancialConfig" lfc 
  WHERE lfc."leaseId" = l.id AND lfc."effectiveFrom" = l."startDate"
);
```

### 3.6 Gestion des anciens baux

- Baux existants : migration automatique (script ci-dessus).
- Nouveaux baux (Phase 1) : création de `LeaseFinancialConfig` en même temps que le bail (double écriture).
- Baux sans config : `getLeaseFinancialData()` utilise le fallback sur les champs legacy de Lease (Phase 2).

---

## 4. Contrat métier : `getLeaseFinancialData(leaseId)`

### 4.1 Interface et sémantique des montants

Tous les montants sont en **euros**, **positifs ou nuls**.

| Champ | Type | Sémantique |
|-------|------|------------|
| `baseRent` | `number` | Loyer hors charges (loyer nu). Revenu contractual du propriétaire avant charges. |
| `chargesRecoverableMonthly` | `number` | Charges récupérables mensuelles (provision). Le locataire les paie au propriétaire. |
| `chargesNonRecoverableMonthly` | `number` | Charges non récupérables mensuelles. À la charge du propriétaire, **jamais** du locataire. |
| `deposit` | `number \| null` | Dépôt de garantie (caution). |
| `paymentDay` | `number \| null` | Jour du mois pour le paiement (1–31). |
| `totalDueByTenant` | `number` | **Montant total mensuel dû par le locataire** = `baseRent + chargesRecoverableMonthly`. Ne pas mélanger avec les charges non récupérables. |
| `ownerContractualIncome` | `number` | **Revenu contractual du propriétaire** (loyer nu) = `baseRent`. |

**Règle importante** : `chargesNonRecoverableMonthly` ne doit **jamais** être inclus dans `totalDueByTenant`. Ces charges restent à la charge du propriétaire.

### 4.2 Signature TypeScript

```typescript
interface LeaseFinancialData {
  baseRent: number;
  chargesRecoverableMonthly: number;
  chargesNonRecoverableMonthly: number;
  deposit: number | null;
  paymentDay: number | null;
  /** Montant total dû par le locataire chaque mois = baseRent + chargesRecoverableMonthly */
  totalDueByTenant: number;
  /** Revenu contractual du propriétaire (loyer nu) = baseRent */
  ownerContractualIncome: number;
  indexationRule?: IndexationRule | null;
}

async function getLeaseFinancialData(
  leaseId: string,
  organizationId: string,
  options?: { mode: 'normal' | 'app-shell'; asOfDate?: string }
): Promise<LeaseFinancialData | null>
```

- `asOfDate` : réservé pour l’évolution (Phase future avec avenants). En Phase 1, ignoré.

### 4.3 Algorithme (fallback Phase 2)

1. Charger `Lease` avec `LeaseFinancialConfig` (ou la config applicable si `asOfDate`).
2. Si une config existe : mapper vers `LeaseFinancialData`.
3. Sinon (fallback legacy) : mapper depuis `Lease` :
   - `baseRent` ← `lease.rentAmount ?? 0`
   - `chargesRecoverableMonthly` ← `lease.chargesRecupMensuelles ?? 0`
   - `chargesNonRecoverableMonthly` ← `lease.chargesNonRecupMensuelles ?? 0`
   - `deposit` ← `lease.deposit ?? null`
   - `paymentDay` ← `lease.paymentDay ?? null`
4. Calculer :
   - `totalDueByTenant = baseRent + chargesRecoverableMonthly`
   - `ownerContractualIncome = baseRent`

### 4.4 Implémentation

- **Normal** : Prisma, avec `include: { LeaseFinancialConfig: true }` (ou requête dédiée).
- **App-shell** : lecture dans IndexedDB (`LocalLeaseFinancialConfig`).

### 4.5 Emplacement

- Service : `src/domain/services/LeaseFinancialService.ts` (nouveau)
- Repositories : `LeaseFinancialConfigRepository` (Prisma + IndexedDB)

---

## 5. Impact sur les transactions

### 5.1 Points de lecture actuels

| Fichier | Usage |
|---------|-------|
| `TransactionFormTabs.tsx` | `bail.rentAmount` pour montant (ligne ~321), `activeBail.rentAmount` (ligne ~452) |
| `TransactionModalV2.tsx` | `setValue('montantLoyer', selectedLease.rentAmount)` |
| API transactions | `chargesRecup` stocké sur Transaction |

### 5.2 Adaptation (Phase 2)

| Besoin actuel | Remplacer par | Champ `LeaseFinancialData` |
|---------------|---------------|----------------------------|
| Montant loyer nu (pour nature LOYER) | `getLeaseFinancialData(leaseId)` | `baseRent` ou `ownerContractualIncome` |
| Montant total à encaisser du locataire | id. | `totalDueByTenant` |
| Charges récupérables (décomposition) | id. | `chargesRecoverableMonthly` |
| Jour de paiement | id. | `paymentDay` |
| Caution | id. | `deposit` |

**Convention** : pour une transaction de type loyer, `montantLoyer` = `baseRent`, `chargesRecup` = `chargesRecoverableMonthly`. Le total suggéré = `totalDueByTenant`.

- **Pas de changement d’API** : les transactions conservent `montantLoyer`, `chargesRecup` ; seul l’alimenteur change.

### 5.3 Ordre des changements

1. Créer `getLeaseFinancialData()` (Phase 2).
2. Brancher TransactionFormTabs et TransactionModalV2 sur `getLeaseFinancialData()`.
3. Tester l’auto-remplissage avec baux migrés et non migrés (fallback).

---

## 6. Impact sur les échéances

### 6.1 État actuel

- `EcheanceRecurrente` a son propre `montant` (stocké).
- Lors de la création d’une échéance LOYER_ATTENDU, le montant peut être pré-rempli depuis le bail.
- `expandEcheances` utilise `echeance.montant` (pas de lecture dynamique au bail).

### 6.2 Adaptation (Phase 2)

- **Pré-remplissage création échéance LOYER_ATTENDU** : utiliser `getLeaseFinancialData(leaseId).totalDueByTenant` (ce que le locataire paie chaque mois = loyer + charges récupérables).
- Pas de changement pour l’expansion : les échéances gardent leur propre montant.
- Évolution future (montant dérivé dynamiquement) : couche au-dessus de `expandEcheances` résolvant via `getLeaseFinancialData` + indexation ; hors périmètre Phase 1.

---

## 7. IndexedDB / Offline-first

### 7.1 Nouvelle table locale

```typescript
// src/lib/offline/db.ts
export interface LocalLeaseFinancialConfig {
  id: string;
  leaseId: string;
  organizationId: string;
  effectiveFrom: string;  // ISO date
  baseRent: number;
  chargesRecoverableMonthly: number;
  chargesNonRecoverableMonthly: number;
  deposit?: number | null;
  paymentDay?: number | null;
  indexationRuleJson?: string | null;
  createdAt: string;
  updatedAt: string;
  _localUpdatedAt?: string;
  _syncedAt?: string;
}

// Ajouter à Dexie
LeaseFinancialConfig: 'id, leaseId, organizationId, effectiveFrom, [organizationId], [leaseId], [leaseId+effectiveFrom]'
```

### 7.2 Sync

- Ajouter `LeaseFinancialConfig` à `ENTITY_CONFIGS` dans `syncGlobal.ts`.
- **Option A** : API dédiée `/api/lease-financial-configs` (CRUD).
- **Option B** : inclure dans le payload Lease (embed) ; sync composite Lease + config.
- Recommandation Phase 1 : Option B si l’API lease peut retourner la config en include ; sinon Option A.

### 7.3 PendingOps

- Création / mise à jour de `LeaseFinancialConfig` : dans le même flux logique que le bail (opération composite).
- En cas d’erreur partielle : priorité à la cohérence Lease + LeaseFinancialConfig (éviter un bail sans config ou une config orpheline).

### 7.4 Impacts offline confirmés

| Composant | Phase 1 | Phase 2 |
|-----------|---------|---------|
| Table `LeaseFinancialConfig` | Créée, sync configurée | Utilisée par getLeaseFinancialData() |
| getLeaseFinancialData() | Non utilisé (lecture Lease) | Lecture IDB avec fallback Lease |
| Transactions (auto-remplissage) | Lecture Lease | getLeaseFinancialData() |
| Échéances (pré-remplissage) | Lecture Lease | getLeaseFinancialData() |
| Formulaires bail | Double écriture Lease + Config | Double écriture (Phase 2), Config seule (Phase 3) |

---

## 8. Recommandations UX (sans coder l’UI)

### 8.1 Où placer la config financière

- **Option A** : Onglet « Conditions financières » dans le formulaire bail (inchangé visuellement).
- **Option B** : Section dédiée « Configuration financière » sous le détail du bail, avec possibilité d’édition séparée.
- **Option C** : Modale dédiée « Configurer les montants » accessible depuis le bail.

Recommandation : **Option A** pour limiter les changements ; le formulaire bail édite en réalité `Lease` + `LeaseFinancialConfig`.

### 8.2 Découplage sans perdre en simplicité

1. Conserver un seul formulaire « Bail » avec onglets (Contractuel | Financier).
2. Le contrat reste la porte d’entrée ; la config financière est présentée comme une section du bail.
3. Les champs restent les mêmes pour l’utilisateur : Loyer, Charges, Caution, Jour de paiement, Indexation.
4. En base : sauvegarde dans `LeaseFinancialConfig` (et fallback sur `Lease` pendant la transition).

### 8.3 Indicateurs de migration

- Badge « Config migrée » vs « Ancien format » pour les baux sans `LeaseFinancialConfig` (optionnel, debugging).
- Pas d’affichage obligatoire pour l’utilisateur final si le fallback est transparent.

---

## 9. Plan d’implémentation synthétique

### Phase 1

| Étape | Contenu | Durée estimée |
|-------|---------|---------------|
| 1.1 | Schéma Prisma : créer `LeaseFinancialConfig` (avec effectiveFrom), migration DB | 0.5 j |
| 1.2 | Script migration données Lease → LeaseFinancialConfig | 0.25 j |
| 1.3 | IndexedDB : `LocalLeaseFinancialConfig`, sync | 0.5 j |
| 1.4 | Formulaires bail : double écriture Lease + LeaseFinancialConfig | 0.5 j |
| 1.5 | Tests sync offline, validation Phase 1 | 0.25 j |

**Total Phase 1** : ~2 j.

### Phase 2

| Étape | Contenu | Durée estimée |
|-------|---------|---------------|
| 2.1 | `getLeaseFinancialData()` + fallback Lease + tests | 0.5 j |
| 2.2 | Brancher transactions (TransactionFormTabs, TransactionModalV2) | 0.5 j |
| 2.3 | Brancher échéances (pré-remplissage création) | 0.25 j |
| 2.4 | Brancher Dashboard, Patrimoine, PDF, API | 0.5 j |
| 2.5 | Supprimer toutes les lectures legacy directes | 0.25 j |
| 2.6 | Tests E2E (normal + app-shell) | 0.5 j |

**Total Phase 2** : ~2.5 j.

### Phase 3 (après stabilisation)

| Étape | Contenu | Durée estimée |
|-------|---------|---------------|
| 3.1 | Arrêter écritures legacy, migration Prisma suppression colonnes | 0.5 j |
| 3.2 | Supprimer fallback dans getLeaseFinancialData() | 0.25 j |
| 3.3 | Tests régression finale | 0.25 j |

**Total Phase 3** : ~1 j.

---

## 10. Risques et précautions

1. **Double écriture** pendant la transition : garder `Lease` et `LeaseFinancialConfig` cohérents si les deux sont encore utilisés.
2. **Performance** : `getLeaseFinancialData` doit être léger (une requête avec include ou une jointure).
3. **Offline** : s’assurer que la table `LeaseFinancialConfig` est bien créée et synchronisée avant toute lecture en mode app-shell.
4. **PDF bail** : adapter le mapping des champs (rentAmount → baseRent, etc.) dans les templates PDF.

---

## 11. Références code

- Lease Prisma : `prisma/schema.prisma` L355
- LocalLease : `src/lib/offline/db.ts` L106
- TransactionFormTabs : `src/components/forms/TransactionFormTabs.tsx` L321, L452
- TransactionModalV2 : `src/components/transactions/TransactionModalV2.tsx` L881, L1021
- RentIndexation : `prisma/schema.prisma` L402
- syncGlobal ENTITY_CONFIGS : `src/lib/offline/syncGlobal.ts`

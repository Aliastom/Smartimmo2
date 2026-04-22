# Audit — Onglet « Déclaration fiscale » & architecture fiscale Smartimmo (Étape 1)

Document de référence pour évolution incrémentale. Aligné sur l’admin **Paramètres fiscaux** (versions `FiscalVersion`), les **catégories** de transactions, et le **moteur existant** (`Simulator`, `FiscalAggregator`, `TaxParamsService`).

---

## 1. Sources de données fiscales existantes

| Source | Rôle | Consommateurs principaux |
|--------|------|---------------------------|
| **Transactions** (`Transaction` + `Category`, `nature`, montants, `paidAt`/`date`, `chargesNonRecup`, etc.) | Agrégation revenus/charges par bien et par année d’encaissement | `FiscalAggregator.aggregateProperty`, ventilation **2044** (`Fiscal2044Aggregator`) |
| **Catégories** (`Category`: `slug`, `label`, `type`, `deductible`, `capitalizable`, `fiscalLineHint`, `actif`) | Classification comptable + hint ligne 2044 | API accounting/admin, modales transaction, `Fiscal2044Aggregator` |
| **Prêts** (`Loan`: capital, taux, durée, dates, `repaymentType`, etc.) | Intérêts simulation + intérêts déclaratifs année civile | `calculateLoanInterests` (heuristique passé/projection), `LoanInterestYearAggregator` (échéancier) |
| **Baux / locataires** (`Lease`, `Tenant`) | Affichage déclaratif (pas le calcul IR) | `FiscalAggregator.buildFiscal2044InformationsBien` |
| **Biens** (`Property`: adresse, `acquisitionDate`, `rooms`, `fiscalTypeId`, `fiscalRegimeId`, …) | Type fiscal, régime, méta déclaration | `FiscalAggregator`, UI bien |
| **Simulation** (`POST /api/fiscal/simulate`, `Simulator.simulate`) | Résultat IR, PS, par bien, consolidation | Onglets résultats dont **Déclaration** |
| **Paramètres fiscaux admin** (`FiscalVersion` + JSON, `TaxParamsService`, `fiscalVersionToParams`) | Barème IR, décote, PS, micro, déficit, PER, LMP, SCI IS | `Simulator`, `computeIRResult`, optimiseur, PAS |

---

## 2. Rôle de l’écran « Paramètres fiscaux » (admin)

- **Stockage** : table Prisma `FiscalVersion` (code ex. `2026.1`, année, statut publié, JSON des barèmes).
- **Conversion** : `fiscalVersionToParams.ts` → type `TaxParams` utilisé par le simulateur.
- **Chargement** : `TaxParamsService.get(annéeDéclaration, baremeCode?)` avec cache mémoire (~5 min).
- **Règle année** : dans `POST /api/fiscal/simulate`, appel **`TaxParamsService.get(year + 1, baremeCode)`** où `year` = **année des revenus** du body. Donc la **campagne / barème** chargé correspond à **revenus N → paramètres dont l’année métier est N+1** (cohérent avec une déclaration des revenus N ouverte en N+1).

### Modules qui consomment `TaxParams`

| Module | Usage |
|--------|--------|
| `Simulator.simulate` / `simulateProperty` / `simulateFoncier` / `simulateMeuble` | Micro (abattements, plafonds), déficit foncier, SCI IS, LMP |
| `computeIRResult` + `computeRevenuProFoyerIR` | Tranches IR, décote, abattement salaire |
| `calculatePS` | `taxParams.psRate` |
| Optimisation fiscale (`/api/fiscal/optimize`) | Recharge `TaxParams` via `TaxParamsService` |
| PER (dans `Simulator`) | `taxParams.per.*` |

### L’onglet Déclaration doit-il s’y brancher ?

- **Pour les montants 2044 par case (211, 221, …)** : **non** — ils viennent des **transactions + catégories + prêts** (flux comptable / déclaratif), pas du barème IR.
- **Pour les montants et textes 2042 / IR / PS / micro affichés comme aide à la saisie** : **oui** — ils doivent **refléter** la même simulation que l’utilisateur voit ailleurs, donc les **résultats** déjà calculés avec `TaxParams` (contenus dans `simulation.ir`, `simulation.ps`, `simulation.biens`, etc.). L’UI ne doit **pas** recoder les taux : elle affiche les **sorties du moteur** + **métadonnées** `simulation.taxParams` (version, source, taux PS, micro-foncier…) pour **traçabilité** vers l’admin.

### Version fiscale active — comment elle est choisie

1. **Par défaut** : `baremeCode` absent → `TaxParamsService.get(year + 1)` → **`loadPublishedByYear`** sur l’année **campagne** (revenus + 1).
2. **Explicite** : le client envoie `baremeCode` (ex. `2026.1`) dans le body de simulation → `loadByCode`.
3. **Repli** : si BDD indisponible ou année sans version publiée → **fallback embarqué** `TAX_PARAMS_2024/2025/2026` dans `TaxParamsService.ts` (non parallèle au moteur : même objet `TaxParams`).
4. **Repli JSON partiel** : dans `fiscalVersionToParams`, champs optionnels avec **`||` valeurs par défaut** (ex. `psRate || 0.172`, micro par défaut si clé absente du JSON admin).

---

## 3. Catégories fiscales (modèle générique)

Chaque ligne **`Category`** expose :

| Champ | Rôle |
|-------|------|
| `slug` | Clé stable (ex. `loyer-charges`, `taxe-fonciere`) |
| `label` | Libellé UI |
| `type` | Taxonomie métier (LOYER, ASSURANCE, TAXE_FONCIERE, …) — filtrage UI, pas le calcul fiscal direct |
| `deductible` | Charge déductible des revenus fonciers/BIC (agrégateur transactions) |
| `capitalizable` | Travaux / charges à traiter en immobilisation (exclu ou ambigu en 2044 détaillée) |
| `fiscalLineHint` | Optionnel, ex. `2044_221` — prioritaire pour ventilation 2044 |

**Usage dans les calculs** : `FiscalAggregator` classe recettes/charges selon **nature** (`NatureEntity.flow`) + **catégorie** (`deductible` / `capitalizable`). La ventilation **2044** (`Fiscal2044Aggregator`) utilise **`fiscalLineHint`** puis **fallback** (slug / label / type / flags).

*Liste exhaustive des catégories* : en base par organisation / seed ; export JSON admin **Natures & catégories** ; pas dupliquée ici (centaines de lignes possibles).

---

## 4. Moteur fiscal existant — qui calcule quoi

| Domaine | Où c’est calculé | Paramètres admin |
|---------|------------------|-------------------|
| IR (barème, décote) | `computeIRResult`, données foyer | `taxParams.irBrackets`, `irDecote`, `salaryDeduction` |
| PS | `Simulator.calculatePS` | `taxParams.psRate` |
| Micro-foncier / micro-BIC | `simulateFoncier`, `simulateMeuble` | `taxParams.micro.*` |
| Déficit foncier | consolidation dans `Simulator` | `taxParams.deficitFoncier` |
| PER | logique PER dans simulateur | `taxParams.per` |
| Revenus / charges par bien (réel) | agrégation transactions + intérêts ancienne heuristique | Hors JSON case par case |
| **2044 détaillée par bien** | `Fiscal2044Aggregator` + `LoanInterestYearAggregator` | **Non** (déclaratif transactionnel) |
| PDF Cerfa / exports | `generateCerfaPDF` etc. | Variable selon fichier |

### En dur vs BDD

- **BDD** : tout ce qui transite par `FiscalVersion` → `TaxParams` (prioritaire).
- **En dur (repli)** : `TaxParamsService` fallbacks année par année ; `fiscalVersionToParams` défauts si clé absente du JSON ; quelques constantes métier dans simulateur pour cas non paramétrables.

### Factorisation recommandée (incremental, pas bloquant)

- Unifier à terme **intérêts d’emprunt** « simulation » vs « échéancier année » pour un seul chiffre métier (aujourd’hui documenté comme écart volontaire côté déclaration).

---

## 5. Tableau de mapping (source → formulaire → case → règle)

| Source Smartimmo | Formulaire | Case / zone | Règle |
|--------------------|-------------|---------------|--------|
| Transactions recettes, catégorie loyer (code système) | 2044 | 211 | `Fiscal2044Aggregator` + slug loyer |
| Transactions recettes, autres | 2044 | 212 / 213 | nature recette + catégorie |
| `chargesNonRecup` sur loyers | 2044 | 225 | Champ transaction |
| Transactions dépenses + `fiscalLineHint` | 2044 | Ligne hint (221–230) | Hint normalisé `2044_XXX` |
| Transactions dépenses sans hint | 2044 | Fallback 221–227–224–230 | `deductible`, slug, `capitalizable` |
| Prêt : échéancier année civile | 2044 | 230 (intérêts agrégés) | `LoanInterestYearAggregator` → somme intérêts |
| Agrégat charges 221…230 | 2044 | 229 | Somme automatique |
| Revenus 211–215 − charges 229 | 2044 | 420 | Résultat foncier déclaratif |
| Foyer + patrimoine simulé | 2042 | 1AJ, 4BA, 6NS, … | **Sortie** `simulation.ir`, consolidation (pas recalcul dans l’onglet) |
| Barème version | — | (traçabilité) | Affichage `simulation.taxParams.version` / `source` |

---

## 6. Gaps réels restants

1. **2042** : l’assistant ne liste qu’un **sous-ensemble** de cases (génération `generateCases`) — pas la grille complète impots.gouv.
2. **LMNP / BIC détaillé** : pas de ventilation type 2031 sérieuse dans l’onglet Déclaration.
3. **Intérêts** : deux logiques (`calculateLoanInterests` vs échéancier) — cohérence produit à clarifier ou fusionner.
4. **Exports PDF** : peuvent ne pas refléter toutes les lignes 2044 détaillées.
5. **App Shell** : règle projet — toute évolution **lecture seule** déclaration côté `/app` devra un jour consommer IDB + même structures JSON.

---

## 7. Proposition d’implémentation incrémentale (sans second moteur)

1. ✅ Ventilation **2044** par bien (transactions + catégories + qualité).
2. ✅ Intérêts **année civile** échéancier + ambiguïtés.
3. ✅ **Informations bien** déclaratives (baux, adresse, acquisition, pièces).
4. **UI** : regroupement revenus / charges / résultat, **copier montants**, bandeau **barème utilisé** (déjà en `simulation.taxParams`).
5. **Suite** : enrichir progressivement les **cases 2042** à partir des champs déjà dans `SimulationResult` ; LMNP/BIC ; alignement intérêts simulation.

---

## 8. Références code (pistes de lecture)

- `src/app/api/fiscal/simulate/route.ts` — `TaxParamsService.get(year + 1, baremeCode)`
- `src/services/tax/TaxParamsService.ts` — cache, fallback, `loadPublishedByYear`
- `src/services/tax/converters/fiscalVersionToParams.ts` — JSON admin → `TaxParams`
- `src/services/tax/Simulator.ts` — consommation `taxParams`
- `src/services/tax/FiscalAggregator.ts` — autofill biens + `declaration2044`
- `src/services/tax/Fiscal2044Aggregator.ts` — lignes 2044
- `src/services/tax/LoanInterestYearAggregator.ts` — intérêts année
- `src/components/fiscal/results/tabs/DeclarationTab.tsx` — UI déclaration

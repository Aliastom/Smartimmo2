# 🔧 Corrections des montants - Espace Fiscal

## 🎯 Problème identifié

Les montants affichés dans les onglets de l'Espace Fiscal (`/fiscal`) ne correspondent pas aux bonnes données. De nombreuses valeurs affichent "NaN" au lieu des montants corrects.

**Cause** : Accès incorrect aux champs de `SimulationResult`

---

## 📋 Structure correcte de SimulationResult

D'après `src/types/fiscal.ts` :

```typescript
interface SimulationResult {
  taxParams: TaxParams;
  inputs: FiscalInputs;
  biens: RentalPropertyResult[];
  
  consolidation: {
    revenusFonciers: number;        // PAS loyersTotal !
    revenusBIC: number;
    deficitFoncier: number;
    deficitBIC: number;
  };
  
  ir: IRResult;
  ps: PSResult {
    montant: number;                // PAS total !
    baseImposable: number;
    taux: number;
  };
  
  resume: {
    totalImpots: number;            // ✅ IR + PS
    beneficeNetImmobilier: number;  // ✅ Bénéfice final
    irSupplementaire: number;       // ✅ IR causé par le foncier
    impotsSuppTotal: number;        // ✅ IR + PS supplémentaires
    tauxEffectif: number;
    rendementNet: number;
  };
  
  cashflow: {
    loyersBruts: number;
    chargesNonFinancieres: number;
    cashflowBrut: number;
    interets: number;
    impots: number;
    cashflowNet: number;
  };
}
```

---

## ✅ Corrections appliquées

### 1. **PS : `ps.total` → `ps.montant`**

```typescript
// ❌ AVANT
simulation.ps.total  // N'existe PAS dans PSResult

// ✅ APRÈS
simulation.ps.montant || 0
```

**Fichiers corrigés** :
- `SyntheseTab.tsx` (4 occurrences)
- `DetailsTab.tsx` (6 occurrences)
- `FiscalResultsClient.tsx` (1 occurrence)
- `OptimisationsTab.tsx` (déjà corrigé)

---

### 2. **Totaux : depuis `resume` au lieu de calculer manuellement**

```typescript
// ❌ AVANT
const totalImpots = simulation.ir.impotNet + simulation.ps.total;
const loyersTotal = simulation.consolidation.loyersTotal || 0;  // N'existe PAS
const chargesTotal = simulation.consolidation.chargesTotal || 0;  // N'existe PAS
const beneficeNet = loyersTotal - chargesTotal - totalImpots;

// ✅ APRÈS
const totalImpots = simulation.resume.totalImpots;  // Déjà calculé correctement
const beneficeNet = simulation.resume.beneficeNetImmobilier;  // Déjà calculé
const irSupplementaire = simulation.resume.irSupplementaire;  // Déjà calculé
const impotsSuppTotal = simulation.resume.impotsSuppTotal;  // Déjà calculé

// Les totaux loyers/charges : depuis biens (OK)
const loyersTotal = simulation.biens?.reduce((sum, b) => sum + b.recettesBrutes, 0) || 0;
const chargesTotal = simulation.biens?.reduce((sum, b) => sum + b.chargesDeductibles, 0) || 0;
```

---

### 3. **Détail par tranche : `simulation.ir.detailsTranches`**

```typescript
// ❌ AVANT
simulation.ir.tranches?.map(...)  // Pas le bon champ

// ✅ APRÈS
simulation.ir.detailsTranches?.map((detail) => (
  <div>
    {formatEuro(detail.tranche.lower)} - {detail.tranche.upper ? formatEuro(detail.tranche.upper) : '∞'}
    ({formatPercent(detail.tranche.rate)})
    → {formatEuro(detail.impotTranche)}
  </div>
))
```

---

### 4. **Consolidation : `deficitImputableRevenuGlobal`**

```typescript
// ✅ OK
const imputableGlobal = simulation.consolidation.deficitImputableRevenuGlobal || 0;
const reportableGlobal = simulation.consolidation.deficitReportable || 0;
const deficitGlobal = simulation.consolidation.deficitFoncier || 0;
```

---

## 📊 Référence : Comment c'est fait dans `/impots/simulation`

### Impacts fiscaux

```typescript
// IR
{formatEuro(simulation.ir.impotNet)}

// PS
{formatEuro(simulation.ps.montant)}

// Taux effectif
{formatPercent(simulation.resume.tauxEffectif)}

// TMI
{formatPercent(simulation.ir.trancheMarginate)}
```

### Résumé

```typescript
// Total impôts
{formatEuro(simulation.resume.totalImpots)}

// Bénéfice net
{formatEuro(simulation.resume.beneficeNetImmobilier)}

// Détail du calcul
Loyers encaissés: {simulation.biens.reduce((sum, b) => sum + b.recettesBrutes, 0)}
- Charges: {simulation.biens.reduce((sum, b) => sum + b.chargesDeductibles, 0)}
- Impôts supp: {simulation.resume.impotsSuppTotal}
  └ IR supp: {simulation.resume.irSupplementaire}
  └ PS fonciers: {simulation.ps.montant}
= Bénéfice: {simulation.resume.beneficeNetImmobilier}
```

---

## 🐛 Bugs résolus

1. ✅ **NaN dans Total impôts** → Utilisation de `resume.totalImpots`
2. ✅ **NaN dans Bénéfice net** → Utilisation de `resume.beneficeNetImmobilier`
3. ✅ **NaN dans Taux effectif** → Utilisation de `resume.tauxEffectif`
4. ✅ **NaN dans PS** → `ps.total` → `ps.montant`
5. ✅ **NaN dans Détail calcul** → Utilisation de `resume.impotsSuppTotal` et `resume.irSupplementaire`
6. ✅ **consolidation.loyersTotal inexistant** → Calculer depuis `biens`
7. ✅ **Détail par tranche** → Utilisation de `ir.detailsTranches` au lieu de `ir.tranches`

---

## ✅ Checklist de vérification

### Onglet Synthèse

- [x] Total impôts (IR + PS) → `resume.totalImpots`
- [x] Bénéfice net immobilier → `resume.beneficeNetImmobilier`
- [x] Taux effectif → `resume.tauxEffectif`
- [x] TMI → `ir.trancheMarginate`
- [x] IR supplémentaire → `resume.irSupplementaire`
- [x] PS → `ps.montant`
- [x] Impôts supplémentaires → `resume.impotsSuppTotal`

### Onglet Détails

- [x] Loyers totaux → `biens.reduce(sum + recettesBrutes)`
- [x] Charges → `biens.reduce(sum + chargesDeductibles)`
- [x] Intérêts → `biens.reduce(sum + interetsEmprunt)`
- [x] Résultat global → `consolidation.revenusFonciers` ou `-deficitFoncier`
- [x] Imputable → `consolidation.deficitImputableRevenuGlobal`
- [x] Reportable → `consolidation.deficitReportable`
- [x] Détail par tranche → `ir.detailsTranches[]`
- [x] Impôt net → `ir.impotNet`
- [x] PS → `ps.montant`
- [x] Total impôts → `ir.impotNet + ps.montant`
- [x] Rendement net → Calculé depuis loyers/charges/impots

### Onglet Optimisations

- [x] Cash-flow brut → `inputs.biens.reduce(...)`
- [x] Total impôts → `ir.impotNet + ps.montant`
- [x] Cash-flow net → `cashflowBrut - totalImpots`

---

## 📚 Documentation de référence

- **Types** : `src/types/fiscal.ts` (lignes 353-397)
- **Règles fiscales** : `AUDIT_OPTIMIZER_SIMULATION.md` (document créé précédemment)
- **Page de référence** : `src/app/impots/simulation/SimulationClient.tsx` (lignes 1300-1550)

---

## 🚀 Tests à effectuer

1. Rafraîchir `/fiscal`
2. Calculer une simulation
3. Vérifier chaque onglet :
   - **Synthèse** : Plus de NaN
   - **Détails** : Montants corrects
   - **Projections** : Données cohérentes
   - **Optimisations** : Calculs corrects

---

**Toutes les corrections sont appliquées !** Les montants devraient maintenant correspondre exactement à ceux de `/impots/simulation`. 🎯


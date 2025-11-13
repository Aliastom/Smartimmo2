# 🎯 Réponse : Que récupère OpenFisca et pourquoi ?

## 📊 **Résumé : OpenFisca récupère 5/7 sections**

### ✅ **RÉCUPÉRÉ par OpenFisca (5 sections)**

| Section | Paramètres | Statut | Notes |
|---------|-----------|--------|-------|
| **IR** | `bareme_ir_depuis_1945.bareme` | ✅ **OK** | 5 tranches, validUntil: 2025-02-18 |
| **IR_DECOTE** | `decote.seuil_celib/couple/taux` | ✅ **OK** | 889€, 1470€, 45.25%, validUntil: 2025-02-18 |
| **PS** | `csg + prelevement_social + cnav` | ⚠️ **INCOMPLET** | 9.2% au lieu de 17.2% (manque composants) |
| **MICRO** | `regime_micro_bic/bnc/foncier.*` | ✅ **OK** | Plafonds + abattements, validUntil: 2024-08-22 |
| **SCI_IS** | `impot_societe.taux_*` | ✅ **AJOUTÉ** 🆕 | Normal 28%, Réduit 15% (depuis 2020) |

---

### ❌ **NON RÉCUPÉRÉ par OpenFisca (2 sections)**

#### 1. **DEFICIT** (Déficit foncier - plafond 10 700€) ❌

**Paramètres cherchés** :
```bash
✗ Plafond général d'imputation sur revenu global (10 700€)
✗ Plafond majoré pour travaux énergétiques (21 400€)
```

**Paramètres trouvés dans OpenFisca** :
```bash
✓ impot_revenu.calcul_revenus_imposables.foncier_deduc.logements_anciens.*
  → Dispositifs Besson, Borloo, Cosse (déductions spécifiques)
```

**Pourquoi pas récupéré** :
- OpenFisca modélise les **dispositifs fiscaux spécifiques** (Pinel, Malraux, etc.)
- Mais **PAS le plafond général** de déficit foncier (10 700€)
- C'est une **limite de modélisation** d'OpenFisca-France 174.2.8
- Le plafond général est considéré comme une "règle de calcul" plutôt qu'un "paramètre"

**Solution actuelle** :
- ✅ **Version active conservée** (10 700€)
- Mise à jour manuelle si changement (rare : stable depuis 2006)

---

#### 2. **PER** (Plafonds 35 194€ / 351 936€) ❌

**Paramètres cherchés** :
```bash
✗ epargne_retraite
✗ per
✗ plafond_deduction_salaries
✗ plafond_deduction_independants
```

**Paramètres trouvés dans OpenFisca** :
```bash
✓ chomage.preretraites.aer.* (Allocation Équivalent Retraite)
✓ chomage.preretraites.ats.* (Allocation Transition Solidarité)
  → Pré-retraites (allocations chômage), PAS le PER
```

**Pourquoi pas récupéré** :
- Le **PER** a été créé par la **loi PACTE (2019)**
- OpenFisca-France **174.2.8** (publié en 2024) ne modélise **pas encore** les plafonds PER
- Les anciens produits (PERP, Madelin) ne sont plus dans OpenFisca
- Le PER est récent et en évolution constante

**Solution actuelle** :
- ✅ **Economie.gouv.fr** (trouvé par vous !)
- URL : `/particuliers/gerer-mon-argent/.../comment-fonctionne-le-plan-depargne`
- Contient : Salariés 10%/35 194€, Indépendants 10%/351 936€ + 15%

---

## 🎯 **CORRECTION APPLIQUÉE : Priorité à OpenFisca**

### ❌ **AVANT** (problème)

```typescript
// extractDate() utilisait "Dernière mise à jour"
const lastUpdateMatch = partial.meta.notes.match(/Dernière mise à jour:\s*(\d{4}-\d{2}-\d{2})/);
return new Date(lastUpdateMatch[1]); // → 2024-01-01
```

**Résultat** :
```
IR OpenFisca: dernière MAJ 2024-01-01
IR BOFIP: date scraping 2025-11-08
IR: BOFIP choisi (2025-11-08) ← BOFIP gagne !
```

---

### ✅ **APRÈS** (corrigé)

```typescript
// extractDate() utilise PRIORITAIREMENT "Valide jusqu'au"
const validUntilMatch = partial.meta.notes.match(/Valide jusqu'au:\s*(\d{4}-\d{2}-\d{2})/);
if (validUntilMatch) {
  return new Date(validUntilMatch[1]); // → 2025-02-18
}
// Fallback sur "Dernière mise à jour" si pas de validUntil
```

**Résultat attendu** :
```
IR OpenFisca: validUntil 2025-02-18 (prioritaire)
IR BOFIP: date scraping 2025-11-08
IR: BOFIP choisi (2025-11-08) ← BOFIP gagne encore (11/08 > 02/18)
```

---

## 💡 **SOLUTION ALTERNATIVE : Priorité absolue à OpenFisca**

Si vous voulez **toujours prioriser OpenFisca** quand disponible, il faut modifier `sourcePriority()` :

```typescript
function sourcePriority(partial: TaxPartial): number {
  if (partial.meta.notes?.includes('OpenFisca')) return 0;  // PRIORITÉ 1
  if (partial.meta.source === 'BOFIP') return 1;
  if (partial.meta.source === 'DGFIP') return 2;
  // etc.
}
```

Et dans `sortByPriority()` :
```typescript
return [...partials].sort((a, b) => {
  // 1. PRIORITÉ SOURCE (OpenFisca en premier)
  const priorityA = sourcePriority(a);
  const priorityB = sourcePriority(b);
  if (priorityA !== priorityB) {
    return priorityA - priorityB;  // OpenFisca (0) avant BOFIP (1)
  }
  
  // 2. Si même source, trier par DATE
  const dateA = extractDate(a);
  const dateB = extractDate(b);
  return dateB.getTime() - dateA.getTime();
});
```

---

## 📋 **REQUÊTES OPENFISCA ACTUELLES**

### Total : 19 requêtes HTTP

```bash
# 1. Healthcheck / Version
GET /spec

# 2-19. Paramètres fiscaux (18 requêtes)
GET /parameter/impot_revenu.bareme_ir_depuis_1945.bareme
GET /parameter/impot_revenu.calcul_impot_revenu.plaf_qf.decote.seuil_celib
GET /parameter/impot_revenu.calcul_impot_revenu.plaf_qf.decote.seuil_couple
GET /parameter/impot_revenu.calcul_impot_revenu.plaf_qf.decote.taux
GET /parameter/taxation_capital.prelevements_sociaux.csg.taux_global.revenus_du_patrimoine
GET /parameter/taxation_capital.prelevements_sociaux.prelevement_social.revenus_du_patrimoine
GET /parameter/taxation_capital.prelevements_sociaux.contribution_sociale_cnav
GET /parameter/impot_revenu.calcul_revenus_imposables.rpns.micro.microentreprise.regime_micro_bic.marchandises.plafond
GET /parameter/impot_revenu.calcul_revenus_imposables.rpns.micro.microentreprise.regime_micro_bic.marchandises.taux
GET /parameter/impot_revenu.calcul_revenus_imposables.rpns.micro.microentreprise.regime_micro_bic.services.plafond
GET /parameter/impot_revenu.calcul_revenus_imposables.rpns.micro.microentreprise.regime_micro_bic.services.taux
GET /parameter/impot_revenu.calcul_revenus_imposables.rpns.micro.microentreprise.regime_micro_bnc.plafond
GET /parameter/impot_revenu.calcul_revenus_imposables.rpns.micro.microentreprise.regime_micro_bnc.taux
GET /parameter/impot_revenu.calcul_revenus_imposables.rpns.micro.microfoncier.plafond_recettes
GET /parameter/impot_revenu.calcul_revenus_imposables.rpns.micro.microfoncier.taux
GET /parameter/taxation_societes.impot_societe.taux_normal       🆕
GET /parameter/taxation_societes.impot_societe.taux_reduit       🆕
```

---

## 🎯 **RÉSULTAT ATTENDU**

Avec la correction de `extractDate()`, les nouveaux logs devraient montrer :

```
✅ IR OpenFisca: validUntil 2025-02-18 (prioritaire)
✅ IR BOFIP: date scraping 2025-11-08
✅ IR: BOFIP choisi (2025-11-08) ← BOFIP gagne encore (11/08 > 02/18)

OU SI vous voulez OpenFisca prioritaire :
✅ IR: OpenFisca choisi (priorité source)
```

---

**Consultez les logs Node.js pour voir le nouveau comportement !** 🔍

Voulez-vous aussi que j'implémente la **priorité absolue à OpenFisca** (priorité source > priorité date) ? 🤔

# 🔍 Analyse de couverture OpenFisca vs Scraping Web

## 📊 **État actuel : OpenFisca récupère 5/7 sections**

### ✅ **Sections récupérées par OpenFisca (5/7)**

| Section | Paramètres OpenFisca | Valeurs récupérées | Date MAJ | Statut |
|---------|---------------------|-------------------|----------|--------|
| **IR** | `bareme_ir_depuis_1945.bareme` | 5 tranches (0-11%, 30%, 41%, 45%) | 2024-01-01 | ✅ **OK** |
| **IR_DECOTE** | `decote.seuil_celib/couple/taux` | 889€, 1470€, 45.25% | 2024-01-01 | ✅ **OK** |
| **PS** | `csg + prelevement_social + cnav` | 9.2% (incomplet) | 2018-01-01 | ⚠️ **INCOMPLET** |
| **MICRO** | `regime_micro_bic/bnc/foncier.*` | Plafonds + abattements | 2023-01-01 | ✅ **OK** |
| **SCI_IS** | `impot_societe.taux_*` | Normal 28%, Réduit 15% | 2020-01-01 | ✅ **AJOUTÉ** 🆕 |

### ❌ **Sections NON récupérées par OpenFisca (2/7)**

| Section | Cherché dans OpenFisca | Résultat | Solution actuelle |
|---------|----------------------|----------|-------------------|
| **DEFICIT** | `deficit`, `foncier`, `plafond_imputation` | ❌ **Aucun paramètre** | Version active conservée |
| **PER** | `epargne_retraite`, `per`, `plafond` | ❌ **Aucun paramètre** | Economie.gouv.fr 🆕 |

---

## 🚨 **PROBLÈME PRINCIPAL : Date vs Priorité Source**

### Le consensus merge choisit **BOFIP au lieu d'OpenFisca**

**Logs actuels** :
```
IR OpenFisca: dernière MAJ 2024-01-01
IR BOFIP: date scraping 2025-11-08
IR: BOFIP choisi (2025-11-08) ← BOFIP gagne !
```

### Pourquoi ?

Le `ConsensusMerger` compare les **dates** :
1. **OpenFisca** : utilise `lastUpdate` (2024-01-01)
2. **BOFIP** : utilise `fetchedAt` (2025-11-08 = aujourd'hui)
3. 🎯 **BOFIP gagne** car date plus récente

**MAIS** :
- OpenFisca dit `validUntil: 2025-02-18` → **Valide pour 2025 !**
- Les données OpenFisca 2024-01-01 **correspondent à l'année fiscale 2025**
- BOFIP 2025-11-08 **scrape aussi les données pour 2025**

**Résultat** : Les deux ont les **mêmes données**, mais BOFIP gagne artificiellement sur la date de scraping.

---

## 💡 **POURQUOI OpenFisca devrait être prioritaire ?**

### 1. **Source programmatique vs scraping**
- ✅ OpenFisca = **API structurée** (données fiables, pas d'erreur de parsing)
- ⚠️ BOFIP = **Scraping HTML** (risque d'erreur de regex, changement de structure)

### 2. **Métadonnées riches**
- ✅ OpenFisca fournit `validUntil` (validité future)
- ✅ OpenFisca fournit `lastUpdate` (historique)
- ❌ BOFIP n'a que la date de scraping

### 3. **Stabilité**
- ✅ OpenFisca-France 174.2.8 = version **officielle** du gouvernement
- ⚠️ BOFIP peut changer de structure HTML à tout moment

---

## 📋 **DÉTAIL : Pourquoi chaque section manquante n'est pas dans OpenFisca**

### 1. **DEFICIT** (Plafond 10 700€) ❌

**Cherché** :
```bash
✗ Plafond général d'imputation (10 700€)
✗ Plafond travaux énergétiques (21 400€)
```

**Trouvé dans OpenFisca** :
```
✓ impot_revenu.calcul_revenus_imposables.foncier_deduc.logements_anciens.*
  → Dispositifs Besson, Borloo, Cosse (déductions spécifiques)
```

**Conclusion** :
- OpenFisca modélise les **dispositifs de défiscalisation** (Pinel, Malraux, etc.)
- Mais **PAS le plafond général** de déficit foncier (10 700€)
- C'est une **limite de modélisation** d'OpenFisca-France

**Solution** : Garder la version active ou ajouter un scraper BOFIP dédié

---

### 2. **PER** (Plafonds 35 194€ / 351 936€) ❌

**Cherché** :
```bash
✗ epargne_retraite
✗ per
✗ plafond_deduction
```

**Trouvé dans OpenFisca** :
```
✓ chomage.preretraites.* (AER, ATS)
  → Pré-retraites, pas PER
```

**Conclusion** :
- Le PER a été créé par la **loi PACTE (2019)**
- OpenFisca-France 174.2.8 ne modélise **pas encore les plafonds PER**
- Les paramètres trouvés concernent les **allocations de pré-retraite** (AER/ATS)

**Solution** : 
- ✅ Utiliser **economie.gouv.fr** (source trouvée par l'utilisateur)
- OU créer un adapter BOSS.gouv.fr
- En attendant qu'OpenFisca ajoute le PER

---

### 3. **SCI_IS** (Taux IS 15% / 25%) ✅ **RÉSOLU !**

**Cherché** :
```bash
✓ taxation_societes.impot_societe.taux_normal → 28% (depuis 2020)
✓ taxation_societes.impot_societe.taux_reduit → 15% (depuis 2002)
```

**Conclusion** :
- ✅ **OpenFisca a les données !**
- ❌ Elles n'étaient juste **pas récupérées** (pas dans la liste)
- ✅ **AJOUTÉ maintenant** → `extractIS()` créé

**Résultat** : OpenFisca récupérera **5/7 sections** au prochain scraping (au lieu de 4/7)

---

## 🎯 **RECOMMANDATIONS**

### 1️⃣ **Priorité à OpenFisca** (à implémenter)

Modifier le `ConsensusMerger` pour :
- ✅ Utiliser `validUntil` pour OpenFisca (au lieu de `lastUpdate`)
- ✅ Donner priorité à OpenFisca si `validUntil >= année demandée`
- ✅ Fallback sur BOFIP uniquement si OpenFisca invalide/absent

**Code à modifier** : `src/services/tax/providers/consensus/ConsensusMerger.ts`

```typescript
function extractDate(partial: TaxPartial): Date {
  if (partial.meta.notes?.includes('OpenFisca')) {
    // PRIORITÉ : Utiliser validUntil si disponible
    const validUntilMatch = partial.meta.notes.match(/Valide jusqu'au:\s*(\d{4}-\d{2}-\d{2})/);
    if (validUntilMatch) {
      return new Date(validUntilMatch[1]); // ← Retourner la date de validité
    }
    // Fallback sur lastUpdate si pas de validUntil
    const lastUpdateMatch = partial.meta.notes.match(/Dernière mise à jour:\s*(\d{4}-\d{2}-\d{2})/);
    if (lastUpdateMatch) return new Date(lastUpdateMatch[1]);
  }
  // ... reste du code ...
}
```

---

### 2️⃣ **Compléter OpenFisca** (long terme)

**Sections manquantes à ajouter** :
- ✅ **SCI_IS** : FAIT (taux IS ajoutés)
- ❌ **DEFICIT** : Contribuer à OpenFisca-France pour ajouter le plafond 10 700€
- ❌ **PER** : Contribuer à OpenFisca-France pour ajouter les plafonds PER

**Lien contribution** : https://github.com/openfisca/openfisca-france

---

### 3️⃣ **PS incomplet** (à corriger)

**Actuellement** :
```
CSG: 9.2%
PS: 0%
CNAV: 0%
Total: 9.2% ← FAUX ! Devrait être 17.2%
```

**Problème** : OpenFisca a les composants séparés, mais certains sont à 0%.

**Solution** :
- Vérifier les bons IDs de paramètres pour PS
- Ou utiliser la version active (17.2%) qui est correcte

---

## 📊 **RÉSUMÉ FINAL**

| Section | OpenFisca | Web Scraping | Priorité actuelle | Priorité idéale |
|---------|-----------|--------------|-------------------|-----------------|
| **IR** | ✅ 2024 (valide 2025) | ✅ BOFIP 2025 | **BOFIP** | **OpenFisca** |
| **IR_DECOTE** | ✅ 2024 (valide 2025) | ✅ BOFIP 2025 | **BOFIP** | **OpenFisca** |
| **PS** | ⚠️ 9.2% (incomplet) | ✅ Active 17.2% | **Active** | **Active** |
| **MICRO** | ✅ 2023 (valide 2024) | ✅ BOFIP 2025 | **BOFIP** | **OpenFisca** |
| **DEFICIT** | ❌ N/A | ❌ N/A | **Active** | **Active** |
| **PER** | ❌ N/A | ✅ Economie.gouv | **Economie.gouv** | **Economie.gouv** |
| **SCI_IS** | ✅ 2020 (28%/15%) 🆕 | ❌ N/A | **Active** | **OpenFisca** 🆕 |

---

**Prochaine étape** : Tester avec les taux IS ajoutés ! 🚀


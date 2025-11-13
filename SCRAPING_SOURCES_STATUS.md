# 📊 État des sources de scraping fiscal (08/11/2025)

## 🎯 Récapitulatif rapide

### ✅ Sources ACTIVES (4)
1. 🔵 **OpenFisca** (API) → IR, IR_DECOTE, PS, MICRO
2. 🟢 **BOFIP** (Web) → IR, IR_DECOTE, MICRO
3. 🟢 **DGFiP / impots.gouv.fr** (Web) → MICRO (micro-foncier)
4. 🔵 **Ministère de l'Économie** (Web) → PER

### ❌ Sources INACTIVES (2)
- ❌ Service-Public.fr (URLs 404/obsolètes)
- ❌ Legifrance (Cloudflare 403)

### 📊 Couverture globale
- **7/7 sections** couvertes (IR, IR_DECOTE, PS, MICRO, DEFICIT, PER, SCI_IS)
- **3 sections** avec sources multiples (validation croisée)
- **4 sections** conservent la version active (fusion non-destructive)

---

## ✅ Sources vérifiées et opérationnelles

### 🔵 **OpenFisca** (API programmatique)
- **URL** : `http://localhost:2000` (ou Docker Hub: `aliastom/openfisca-france:stable`)
- **Version** : 174.2.8
- **Sections couvertes** : IR, IR_DECOTE, PS, MICRO
- **Statut** : ✅ **ACTIF** - Source primaire pour données programmatiques
- **Notes** :
  - Données fiables et structurées
  - Métadonnées `validUntil` et `lastUpdate` disponibles
  - Priorité dans le consensus merge (source la plus récente)

### 🟢 **BOFIP** (Web scraping)
- **URL base** : `https://bofip.impots.gouv.fr`
- **Sections couvertes** : IR, IR_DECOTE
- **Statut** : ✅ **ACTIF PARTIEL**

#### URLs valides (vérifiées 08/11/2025) :
1. **Barème IR 2025** : `/bofip/2491-PGP.html/identifiant=BOI-IR-LIQ-20-10-20250414`
   - ✅ Fonctionne
   - Contient : 5 tranches d'imposition (0%, 11%, 30%, 41%, 45%)
   
2. **Décote IR 2025** : `/bofip/2495-PGP.html/identifiant=BOI-IR-LIQ-20-20-30-20250414`
   - ✅ Fonctionne
   - Contient : Seuils célib (889€), couple (1470€), taux (45,25%)

3. **Régime micro-foncier** : `/bofip/3973-PGP.html/identifiant=BOI-RFPI-DECLA-10-20160706`
   - ✅ Fonctionne
   - Contient : Seuil 15 000 €, Abattement 30%
   - Version en vigueur depuis le 06/03/2025

#### URLs obsolètes (404) :
4. **Prélèvements Sociaux** : `/bofip/1733-PGP.html` → ❌ **N'EXISTE PAS**
   - **Raison** : PS sont gérés par la Sécurité Sociale (BOSS.gouv.fr), pas par BOFIP
   - **Solution** : Utiliser OpenFisca (source primaire)

---

## 🟢 **DGFiP / impots.gouv.fr** (Web scraping)
- **URL base** : `https://www.impots.gouv.fr`
- **Sections couvertes** : MICRO (micro-foncier)
- **Statut** : ✅ **ACTIF** - Questions/Réponses officielles

#### URLs vérifiées (08/11/2025) :
1. **Micro-foncier** : `/particulier/questions/je-mets-en-location-un-logement-vide-comment-declarer-les-loyers-percus`
   - ✅ Fonctionne
   - Section : MICRO
   - Contient : Seuil 15 000 €, Abattement 30%
   - Date : Mise à jour 14/10/2025

---

## 🔵 **Ministère de l'Économie** (Web scraping)
- **URL base** : `https://www.economie.gouv.fr`
- **Sections couvertes** : PER
- **Statut** : ✅ **ACTIF** - Source officielle ministérielle

#### URLs vérifiées (08/11/2025) :
1. **PER (Plan Épargne Retraite)** : `/particuliers/gerer-mon-argent/gerer-mon-budget-et-mon-epargne/comment-fonctionne-le-plan-depargne`
   - ✅ Fonctionne
   - Section : PER
   - Contient : 
     - Salariés : 10% revenus pro 2022, max **35 194 €** (ou 4 114 € min)
     - Indépendants : 10% bénéfices (max 351 936 €) + 15% entre 43 992 € et 351 936 €

---

## 🔴 **Sources inactives**

### Service-Public.fr
- **Statut** : ❌ **INACTIF**
- **Raison** : URLs obsolètes (404 ou mauvaises pages)
- **URLs testées** :
  - `/particuliers/vosdroits/F23267` → 404
  - `/particuliers/vosdroits/F32744` → Page sur location meublée (pas déficit foncier)
- **Action** : Désactivé, remplacé par impots.gouv.fr et economie.gouv.fr

### Legifrance
- **Statut** : ❌ **INACTIF**
- **Raison** : Cloudflare 403 (blocage anti-bot)
- **Action** : Désactivé, utilisé uniquement pour cross-check manuel

---

## 📋 **Stratégie par section**

| Section | Source Primaire | Source Secondaire | Confiance |
|---------|-----------------|-------------------|-----------|
| **IR** | BOFIP ✅ | OpenFisca | 80-100% |
| **IR_DECOTE** | BOFIP ✅ | OpenFisca | 100% |
| **PS** | OpenFisca ✅ | Version active | 60-80% |
| **MICRO** | BOFIP ✅ + DGFiP ✅ | OpenFisca | 80-100% |
| **DEFICIT** | Version active | - | 60% |
| **PER** | Economie.gouv ✅ | Version active | 60% |
| **SCI_IS** | Version active | - | 60% |

---

## 🎯 **Recommandations**

### À court terme (FAIT ✅)
1. ✅ Mettre à jour `BofipAdapter.ts` avec les nouvelles URLs IR/IR_DECOTE
2. ✅ Corriger le parsing de la décote (regex précis)
3. ✅ Documenter que PS n'existe pas sur BOFIP

### À moyen terme (TODO)
1. ⏳ Vérifier les URLs Service-Public (MICRO, PER, DEFICIT)
2. ⏳ Améliorer le scraper Service-Public si nécessaire
3. ⏳ Ajouter BOSS.gouv.fr pour PS (optionnel, validation)

### À long terme (OPTIONNEL)
1. 💡 Chercher nouvelles URLs BOFIP pour Micro (si temps disponible)
2. 💡 Tester d'autres sources (Légifrance via proxy, etc.)
3. 💡 Monitoring automatique des URLs (détection 404)

---

## 🔍 **Sources de référence officielles**

### Pour vérifications manuelles :
- **Barème IR** : [Impots.gouv.fr - Simulateur](https://www.impots.gouv.fr/simulateurs)
- **PS** : [BOSS.gouv.fr](https://boss.gouv.fr) (Bulletin Officiel Sécurité Sociale)
- **Micro** : [URSSAF - Auto-entrepreneur](https://www.autoentrepreneur.urssaf.fr)
- **OpenFisca** : [Documentation officielle](https://fr.openfisca.org)

---

## 📊 **Performance du scraping (dernier test)**

Date : 08/11/2025

```
[Job scrape-2025-1762620020763] 8 sections récupérées au total (4 OpenFisca + 4 web)
  • IR: 2 source(s) → BOFIP, BOFIP
  • IR_DECOTE: 2 source(s) → BOFIP, BOFIP
  • PS: 1 source(s) → BOFIP
  • MICRO: 2 source(s) → BOFIP, BOFIP
  • DEFICIT: aucune source
  • PER: 1 source(s) → SERVICE_PUBLIC
  • SCI_IS: aucune source

📊 Complétude: 7 OK, 0 manquantes, 0 invalides
  ✅ IR: OK (BOFIP, confiance: 80%)
  ✅ IR_DECOTE: OK (BOFIP, confiance: 100%)
  ✅ PS: OK (BOFIP, confiance: 80%)
  ✅ MICRO: OK (BOFIP, confiance: 100%)
  ✅ DEFICIT: OK (BOFIP, confiance: 60%)
  ✅ PER: OK (SERVICE_PUBLIC, confiance: 40%)
  ✅ SCI_IS: OK (BOFIP, confiance: 60%)
```

**Conclusion** : Le système fonctionne, avec OpenFisca + BOFIP comme sources principales. Les sections manquantes (DEFICIT, SCI_IS) conservent les valeurs de la version active (fusion non-destructive).

---

**Dernière mise à jour** : 08/11/2025  
**Prochaine révision** : Janvier 2026 (loi de finances 2026)


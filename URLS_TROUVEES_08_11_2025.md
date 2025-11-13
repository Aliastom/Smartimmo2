# 🔍 URLs de scraping trouvées - 08/11/2025

## ✅ URLs valides et vérifiées

### 🟢 **BOFIP** (3 URLs actives)

1. **Barème IR 2025**
   - URL : `/bofip/2491-PGP.html/identifiant=BOI-IR-LIQ-20-10-20250414`
   - Complet : https://bofip.impots.gouv.fr/bofip/2491-PGP.html/identifiant=BOI-IR-LIQ-20-10-20250414
   - Section : `IR`
   - Contenu : 5 tranches (0%, 11%, 30%, 41%, 45%)
   - ✅ Testé et intégré

2. **Décote IR 2025**
   - URL : `/bofip/2495-PGP.html/identifiant=BOI-IR-LIQ-20-20-30-20250414`
   - Complet : https://bofip.impots.gouv.fr/bofip/2495-PGP.html/identifiant=BOI-IR-LIQ-20-20-30-20250414
   - Section : `IR_DECOTE`
   - Contenu : Seuils 889€ (célib), 1470€ (couple), Taux 45,25%
   - ✅ Testé et intégré

3. **Régime micro-foncier**
   - URL : `/bofip/3973-PGP.html/identifiant=BOI-RFPI-DECLA-10-20160706`
   - Complet : https://bofip.impots.gouv.fr/bofip/3973-PGP.html/identifiant=BOI-RFPI-DECLA-10-20160706
   - Section : `MICRO`
   - Contenu : Seuil 15 000€, Abattement 30%
   - Date : Version en vigueur depuis 06/03/2025
   - ✅ Testé et intégré

---

### 🟢 **DGFiP / impots.gouv.fr** (1 URL active)

1. **Micro-foncier**
   - URL : `/particulier/questions/je-mets-en-location-un-logement-vide-comment-declarer-les-loyers-percus`
   - Complet : https://www.impots.gouv.fr/particulier/questions/je-mets-en-location-un-logement-vide-comment-declarer-les-loyers-percus
   - Section : `MICRO`
   - Contenu : Seuil 15 000€, Abattement 30%, Régime réel vs micro
   - Date : Mise à jour 14/10/2025
   - ✅ Testé et intégré

---

### 🔵 **Ministère de l'Économie** (1 URL active)

1. **PER - Plan Épargne Retraite**
   - URL : `/particuliers/gerer-mon-argent/gerer-mon-budget-et-mon-epargne/comment-fonctionne-le-plan-depargne`
   - Complet : https://www.economie.gouv.fr/particuliers/gerer-mon-argent/gerer-mon-budget-et-mon-epargne/comment-fonctionne-le-plan-depargne
   - Section : `PER`
   - Contenu :
     - Salariés : 10% revenus pro 2022, max 35 194€ (ou 4 114€ min)
     - Indépendants : 10% bénéfices (max 351 936€) + 15% entre 43 992€ et 351 936€
   - ✅ Trouvé par l'utilisateur et intégré

---

## ❌ URLs obsolètes (à ne plus utiliser)

### BOFIP
- `/bofip/1733-PGP.html` → **404** (Prélèvements sociaux)
  - Raison : PS gérés par Sécurité Sociale (BOSS.gouv.fr)
  - Remplacement : OpenFisca (API)

- `/bofip/1802-PGP.html` → **Obsolète** (Régimes micro BIC/BNC)
  - Remplacement : `/bofip/3973-PGP.html/identifiant=BOI-RFPI-DECLA-10-20160706`

### Service-Public.fr
- `/particuliers/vosdroits/F23267` → **404** (Micro-entreprise)
- `/particuliers/vosdroits/F34982` → **404** (PER)
  - Remplacement : economie.gouv.fr
- `/particuliers/vosdroits/F32744` → **Mauvaise page** (parle de location meublée, pas déficit)

### DGFiP
- `/portail/particulier/questions/comment-sont-imposes-mes-revenus` → **404**
  - Remplacement : `/particulier/questions/je-mets-en-location-un-logement-vide-comment-declarer-les-loyers-percus`

---

## 🎯 Sections non scrapées (utilisation version active)

Ces sections **n'ont PAS de source web** disponible et utilisent les valeurs de la version active (conservation lors de la fusion) :

| Section | Raison | Solution actuelle |
|---------|--------|-------------------|
| **DEFICIT** | Pas de page dédiée trouvée | Version active conservée (10 700€) |
| **SCI_IS** | Paramètres complexes (taux IS 15%/25%) | Version active conservée |

💡 **Recommandation** : Ces sections peuvent être mises à jour **manuellement** via l'interface d'édition ou via import JSON.

---

## 📊 Résultat final

### Couverture par source :
- **OpenFisca** : 4 sections (IR, IR_DECOTE, PS, MICRO)
- **BOFIP** : 3 sections (IR, IR_DECOTE, MICRO)
- **DGFiP** : 1 section (MICRO)
- **Economie.gouv** : 1 section (PER)
- **Version active** : 2 sections (DEFICIT, SCI_IS)

### Performance attendue :
```
✅ IR: BOFIP (récent) vs OpenFisca (2024) → BOFIP choisi
✅ IR_DECOTE: BOFIP (récent) vs OpenFisca (2024) → BOFIP choisi
✅ PS: OpenFisca (seule source fiable)
✅ MICRO: BOFIP + DGFiP + OpenFisca → consensus
✅ PER: Economie.gouv
✅ DEFICIT: Version active conservée
✅ SCI_IS: Version active conservée
```

---

**Dernière mise à jour** : 08/11/2025  
**Statut** : ✅ Configuration optimale  
**Prochaine révision** : Janvier 2026 (loi de finances 2026)


# ✅ COMPÉTENCE B - CHECKLIST DE VALIDATION

## 0️⃣ Pré-requis (check rapide)

- [ ] Le prompt Compétence B est chargé dans le système
- [ ] Le robot a accès aux métadonnées de route courante
- [ ] Le robot a accès aux entités visibles (bienId, bailId, etc.)
- [ ] Les modèles de données correspondent aux hypothèses
- [ ] Le robot n'écrit rien sans ordre explicite (read-only)

---

## 1️⃣ SMOKE TESTS (5 minutes)

### 1.1 — Global (/dashboard)

**Question :** "Quel est le total des loyers encaissés ce mois-ci ?"

- [ ] Réponse courte avec montant **en gras**
- [ ] Période mois courant (AAAA-MM) mentionnée
- [ ] **Méthode (résumé)** présente
- [ ] Plan d'actions JSON (optionnel) avec filters minimaux

**Résultat :** ✅ PASS / ❌ FAIL

**Notes :**
```


```

---

### 1.2 — Page Bien (/biens/[id])

**Question :** "On en est où des loyers ce mois-ci ?"

- [ ] Scope **automatique sur le bien courant** (cité)
- [ ] Montant présent
- [ ] Nombre de loyers encaissés/en attente
- [ ] Plan d'actions limité à bien_id et champs minimaux

**Résultat :** ✅ PASS / ❌ FAIL

**Notes :**
```


```

---

### 1.3 — Page Documents (/documents)

**Question :** "Qu'est-ce qui reste à classer ?"

- [ ] Nombre de documents non classés
- [ ] 2-3 dates les plus récentes
- [ ] Plan d'actions avec statut_ocr=non_classé
- [ ] Limite raisonnable (limit)

**Résultat :** ✅ PASS / ❌ FAIL

**Notes :**
```


```

---

## 2️⃣ TESTS PAR TYPE D'INTENTION

### 2.1 — Question factuelle

**Contexte :** /biens/[id]  
**Question :** "Montre-moi les impayés du mois en cours."

- [ ] Total impayés **en gras**
- [ ] Liste courte (bail #, montant)
- [ ] Méthode : loyer attendu vs encaissé
- [ ] Utilise v_loyers_en_retard ou équivalent
- [ ] Plan d'actions ciblé

**Résultat :** ✅ PASS / ❌ FAIL

---

### 2.2 — Comparaison

**Contexte :** /dashboard  
**Question :** "Entre 2024 et 2025, mes loyers ont-ils augmenté ?"

- [ ] Variation en **%**
- [ ] Valeurs A→B
- [ ] Méthode : agrégé par année
- [ ] Pas d'over-fetch

**Résultat :** ✅ PASS / ❌ FAIL

---

### 2.3 — Tendance

**Contexte :** /dashboard  
**Question :** "Fais-moi la tendance des entretiens sur 12 mois."

- [ ] Total 12 mois
- [ ] Pic avec AAAA-MM
- [ ] Creux avec AAAA-MM
- [ ] Période **inférée** (12 mois glissants) explicitée
- [ ] Plan d'actions : nature=entretien, group_by=mois

**Résultat :** ✅ PASS / ❌ FAIL

---

### 2.4 — Diagnostic / Alerte

**Contexte :** /biens/[id]  
**Question :** "Quelles urgences bail pour ce bien ?"

- [ ] Puces courtes
- [ ] *Expire dans X jours*
- [ ] *Dépôt manquant*
- [ ] *Indexation >12 mois*
- [ ] Méthode : règles simples

**Résultat :** ✅ PASS / ❌ FAIL

---

### 2.5 — Explication métier

**Contexte :** /dashboard  
**Question :** "Pourquoi mon taux d'occupation a baissé ?"

- [ ] 2-4 hypothèses ordonnées
- [ ] **Prochain pas** suggéré
- [ ] Pas de chiffres inventés
- [ ] Signale les manques de données

**Résultat :** ✅ PASS / ❌ FAIL

---

### 2.6 — Projection simple

**Contexte :** /baux/[id]  
**Question :** "Si j'indexe ce bail à 3,5 % ?"

- [ ] Nouveau loyer HC
- [ ] Écart mensuel **en gras**
- [ ] Avertissement : estimation indicative
- [ ] **Pas** de tentative d'écriture
- [ ] Pas d'over-fetch

**Résultat :** ✅ PASS / ❌ FAIL

---

## 3️⃣ TESTS D'AMBIGUÏTÉS & DÉDUCTIONS

### 3.1 — Période absente

**Contexte :** /transactions  
**Question :** "Montre le total des loyers."

- [ ] Choisit une période (mois courant ou autre règle)
- [ ] Mentionne la période retenue
- [ ] Explicite la règle utilisée

**Résultat :** ✅ PASS / ❌ FAIL

---

### 3.2 — Multiples baux (actif/expiré)

**Contexte :** /biens/[id]  
**Question :** "Donne le loyer attendu."

- [ ] Prend le **bail actif**
- [ ] Si plusieurs : le plus récent
- [ ] Le dit explicitement

**Résultat :** ✅ PASS / ❌ FAIL

---

### 3.3 — Documents (classés vs non classés)

**Contexte :** /documents  
**Question :** "Quels sont les derniers documents ?"

- [ ] Priorise **non classés**
- [ ] Tri **desc** par date

**Résultat :** ✅ PASS / ❌ FAIL

---

## 4️⃣ CRITÈRES D'ACCEPTATION (Go/No-Go)

- [ ] Les réponses sont **courtes** (< 500 car pour questions simples)
- [ ] Les réponses sont **exactes** (pas de données inventées)
- [ ] Les réponses sont **contextualisées** (page/entité/période citées)
- [ ] Les **périodes inférées** sont toujours **exprimées**
- [ ] Les **méthodes** sont résumées en 1 ligne claire
- [ ] Le **Plan d'actions** n'apparaît que si utile
- [ ] Le **Plan d'actions** est **minimal** (filtres/fields/limit)
- [ ] **Zéro écriture** non demandée
- [ ] **Aucune confusion** HC/CC, in/out, charges/loyers

**Score global :** _____ / 15 tests

**Taux de succès :** _____ %

**Validation :** ✅ PASS (>= 90%) / ⚠️  EN DEV (70-90%) / ❌ FAIL (< 70%)

---

## 5️⃣ SCÉNARIOS D'ÉCHEC & DEBUG

### Si réponse trop vague
- [ ] Vérifier que route/entités sont transmises au robot
- [ ] Vérifier les logs du contexte UI

### Si over-fetch
- [ ] Contrôler le plan d'actions (fields, limit)
- [ ] Vérifier la génération SQL

### Si période incohérente
- [ ] S'assurer que l'horloge serveur est OK
- [ ] Vérifier que le robot affiche la période retenue

### Si confusion baux actifs/expirés
- [ ] Ajouter mapping explicite `statut` dans contexte

### Si documents non classés ignorés
- [ ] Vérifier que statut OCR = `non_classé` ou `pending`

---

## 6️⃣ BONUS (Optionnel)

- [ ] A/B tester le **ton** (plus direct vs pédago)
- [ ] Logger : intent, scope, period, actions_count
- [ ] Analyser les usages réels
- [ ] Créer un dashboard d'observabilité

---

## 7️⃣ FEUILLE DE ROUTE POST-VALIDATION

### Phase 1 : Validation
- [ ] Exécuter tous les tests
- [ ] Atteindre >= 90% de succès
- [ ] Documenter les cas limites

### Phase 2 : UI
- [ ] Bouton "Voir les données exactes" (exécute le plan JSON)
- [ ] Toggle "Global / Page courante" visible
- [ ] Affichage de la période utilisée

### Phase 3 : Amélioration continue
- [ ] Raccourcis ("impayés ?" → comprend "du mois")
- [ ] Few-shot learning (ajout d'exemples)
- [ ] Feedback loop (👍 / 👎)

---

## 📊 RAPPORT FINAL

**Date de validation :** ________________

**Validé par :** ________________

**Environnement :** [ ] Local / [ ] Staging / [ ] Production

**Version :** ________________

### Résultats

| Catégorie | Tests | PASS | Taux |
|-----------|-------|------|------|
| Smoke Tests | 3 | ___ | ___% |
| Tests Intent | 6 | ___ | ___% |
| Ambiguïtés | 3 | ___ | ___% |
| Critères Accept. | 9 | ___ | ___% |
| **TOTAL** | **21** | **___** | **___%** |

### Décision

- [ ] ✅ **COMPÉTENCE B VALIDÉE** (>= 90%)
- [ ] ⚠️  **EN DÉVELOPPEMENT** (70-90%, à améliorer)
- [ ] ❌ **NON VALIDÉE** (< 70%, refactoring nécessaire)

### Notes & Observations

```




```

---

**✅ CHECKLIST COMPLÉTÉE LE :** ________________


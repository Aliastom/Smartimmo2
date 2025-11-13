# 🧪 COMPÉTENCE B - PLAN DE TEST PRATIQUE

## 🎯 Objectif

Vérifier que le robot répond **sans fonction dédiée** en exploitant :
- Le contexte de page (route courante, entités visibles, filtres actifs)
- Les données de la BDD (biens, baux, transactions, documents, etc.)
- La logique métier immobilière

Le robot doit **raisonner**, **déduire** et **synthétiser**.

---

## ⚡ Exécution rapide

### Tests automatisés (Vitest)

```bash
npm run test -- tests/ai/competence-b.test.ts
```

### Tests standalone (script dédié)

```bash
tsx scripts/test-competence-b.ts
```

### Validation manuelle (checklist)

Ouvrir `COMPETENCE_B_CHECKLIST.md` et cocher au fur et à mesure.

---

## 📋 Structure des tests

### 0) Pré-requis (check rapide)

✅ Vérifier que :
- Prompt Compétence B est chargé
- Métadonnées de route sont transmises
- Modèles de données correspondent
- Robot en mode read-only

### 1) Smoke Tests (5 minutes)

3 tests de base pour vérifier que ça fonctionne :
- **1.1** - Global (/dashboard) : Total loyers
- **1.2** - Page Bien : Loyers ce mois (scope auto)
- **1.3** - Documents : À classer

### 2) Tests par type d'intention (15 minutes)

6 tests couvrant les différents types de questions :
- **2.1** - Factuelle : Impayés
- **2.2** - Comparaison : 2024 vs 2025
- **2.3** - Tendance : 12 mois
- **2.4** - Diagnostic : Urgences bail
- **2.5** - Explication : Pourquoi X ?
- **2.6** - Projection : Si j'indexe...

### 3) Tests d'ambiguïtés (10 minutes)

3 tests de résolution d'ambiguïtés :
- **3.1** - Période absente (inférence)
- **3.2** - Multiples baux (choix actif)
- **3.3** - Documents (priorisation)

### 4) Critères d'acceptation (validation)

9 critères Go/No-Go :
- Réponses courtes et contextualisées
- Périodes inférées exprimées
- Méthodes résumées
- Plan d'actions minimal
- Zéro écriture
- Pas de confusion métier

---

## 📊 Critères de succès

### Taux de réussite

| Taux | Statut | Action |
|------|--------|--------|
| **>= 90%** | ✅ VALIDÉ | Production ready |
| **70-90%** | ⚠️  EN DEV | Améliorer |
| **< 70%** | ❌ FAIL | Refactoring |

### Métriques attendues

- **Taux de réussite** : >= 90%
- **Temps de réponse** : < 2s (p95)
- **Longueur réponse** : < 500 car (questions simples)
- **Méthode présente** : 100%
- **Période explicite** : 100% (si inférée)

---

## 🔧 Exemples de tests

### Exemple 1 : Smoke Test Global

**Question :** "Quel est le total des loyers encaissés ce mois-ci ?"  
**Route :** `/dashboard`

**Réponse attendue :**
```
Encaissements du **2025-11** : **3 250 €** (tous biens).

Détail : 2 loyers encaissés, 1 en attente (**650 €**).

📐 Méthode : Somme transactions type=loyer sens=in sur 2025-11.

{"actions":[{"op":"read","entity":"transactions","where":{"type":"loyer","period":"2025-11"}}]}
```

**Checks :**
- [x] Montant en gras
- [x] Période mois courant
- [x] Méthode présente
- [x] Plan d'actions (optionnel)

---

### Exemple 2 : Intent Tendance

**Question :** "Fais-moi la tendance des entretiens sur 12 mois."  
**Route :** `/dashboard`

**Réponse attendue :**
```
Total **4 780 €** sur 12 mois glissants.

Pic : **2025-03** (**720 €**) - Pompe à chaleur
Creux : **2025-07** (**120 €**)

📐 Méthode : Somme mensuelle nature=entretien de 2024-12 à 2025-11.

📅 Période utilisée : 2024-12-01 → 2025-11-30 (inférée : 12 mois glissants)
```

**Checks :**
- [x] Total 12 mois
- [x] Pic + Creux
- [x] Période inférée explicite
- [x] Méthode claire

---

### Exemple 3 : Projection

**Question :** "Si j'indexe ce bail à 3,5 % ?"  
**Route :** `/baux/bail-123`

**Réponse attendue :**
```
**[Bail #123]** Nouveau loyer HC estimé : **825,75 €** (avant 797,00 €).

Écart mensuel : **+28,75 €**
Écart annuel : **+345,00 €**

⚠️ Avertissement : Estimation indicative. Vérifier IRL applicable et plafonds contractuels.

📐 Méthode : 797 × (1 + 0,035) = 825,75
```

**Checks :**
- [x] Nouveau loyer
- [x] Écart en gras
- [x] Avertissement présent
- [x] Pas d'écriture

---

## 🐛 Debug & Scénarios d'échec

### Problème : Réponse trop vague

**Symptôme :** "Je ne peux pas répondre sans plus d'informations."

**Solutions :**
1. Vérifier que route/entités sont transmises
2. Vérifier les logs du contexte UI
3. Vérifier le mapping des données

**Code à vérifier :**
```typescript
// src/lib/ai/context/getUiContext.ts
const context = getUiContext(route, filters);
console.log('Context:', context); // Debug
```

---

### Problème : Over-fetch (trop de données)

**Symptôme :** Plan d'actions sans `limit` ou avec tous les champs.

**Solutions :**
1. Vérifier la génération du plan d'actions
2. Ajouter des limites par défaut
3. Restreindre les `fields`

**Code à vérifier :**
```typescript
// src/lib/ai/reasoning/contextualReasoner.ts
actions.push({
  op: 'read',
  entity: 'transactions',
  where: { type: 'loyer', limit: 100 }, // ← LIMIT
  fields: ['id', 'date', 'montant'], // ← FIELDS minimaux
});
```

---

### Problème : Période incohérente

**Symptôme :** Période affichée différente de celle attendue.

**Solutions :**
1. Vérifier l'horloge serveur (`date`)
2. Vérifier la fonction `resolvePeriod`
3. Vérifier que la période est affichée

**Code à vérifier :**
```typescript
// src/lib/ai/reasoning/contextualReasoner.ts
const period = resolvePeriod(input, intent);
console.log('Period resolved:', period); // Debug
```

---

### Problème : Confusion baux actifs/expirés

**Symptôme :** Renvoie un bail expiré au lieu de l'actif.

**Solutions :**
1. Ajouter filtre `status='ACTIF'` explicite
2. Trier par `endDate DESC`
3. Mapper le statut dans le contexte

**Code à vérifier :**
```typescript
// Génération SQL
WHERE status = 'ACTIF' AND endDate >= CURRENT_DATE
ORDER BY endDate DESC
LIMIT 1
```

---

## 📈 Métriques d'observabilité

### Logs à collecter

```typescript
{
  "intent": "factual|comparison|trend|diagnostic|explanation|projection",
  "scope": "global|scoped",
  "scopeLabel": "Bien Villa Familiale",
  "period": "2025-11-01/2025-11-30",
  "periodInferred": true,
  "actionsCount": 1,
  "responseLength": 245,
  "duration": 890,
  "success": true
}
```

### Dashboard Compétence B (futur)

```
📊 COMPÉTENCE B - MÉTRIQUES (30 derniers jours)

Taux de succès : 94.2% ✅
Questions traitées : 1,247
Temps moyen : 780ms

Par intent :
  Factuelle    : 45% (562)
  Diagnostic   : 22% (274)
  Tendance     : 15% (187)
  Comparaison  : 10% (125)
  Projection   :  5% (62)
  Explication  :  3% (37)

Scope :
  Global  : 68%
  Scopé   : 32%

Top erreurs :
  1. Données manquantes (12 cas)
  2. Ambiguïté non résolue (5 cas)
  3. Timeout (2 cas)
```

---

## 🚀 Feuille de route post-validation

### Phase 1 : Validation (Cette étape)

- [x] Créer les tests
- [x] Créer la checklist
- [x] Créer le script standalone
- [ ] Exécuter et atteindre >= 90%

### Phase 2 : UI (Après validation)

- [ ] Bouton "Voir les données exactes"
- [ ] Toggle "Global / Page courante"
- [ ] Affichage période utilisée
- [ ] Feedback 👍 / 👎

### Phase 3 : Amélioration continue

- [ ] Raccourcis linguistiques
- [ ] Few-shot learning
- [ ] Analyse des patterns
- [ ] Dashboard métriques

---

## 📚 Fichiers du plan de test

| Fichier | Utilité |
|---------|---------|
| `tests/ai/competence-b.test.ts` | Tests Vitest automatisés |
| `scripts/test-competence-b.ts` | Script standalone de validation |
| `COMPETENCE_B_CHECKLIST.md` | Checklist validation manuelle |
| `COMPETENCE_B_PLAN_DE_TEST.md` | Ce document |
| `COMPETENCE_B_IMPLEMENTATION.md` | Documentation technique |

---

## ✅ Commandes rapides

```bash
# Tests automatisés (Vitest)
npm run test:competence-b

# Tests standalone
npm run test:competence-b-quick

# Validation complète (tous tests)
npm run test:ai && npm run test:competence-b-quick
```

---

## 🎯 Checklist de lancement

Avant de déclarer la Compétence B validée :

- [ ] Tous les pré-requis sont OK
- [ ] Smoke tests passent à 100%
- [ ] Tests intent passent à >= 90%
- [ ] Tests ambiguïtés passent à >= 90%
- [ ] Critères d'acceptation validés
- [ ] Pas de régression sur tests existants
- [ ] Documentation à jour
- [ ] Checklist remplie et signée

---

**Bon test ! 🧪✅**


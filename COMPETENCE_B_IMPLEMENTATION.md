# 🧠 COMPÉTENCE B - RÉPONSES CONTEXTUELLES

## ✅ IMPLÉMENTÉE

La Compétence B permet au Compagnon de répondre **sans fonction dédiée** en exploitant contexte + données + logique métier.

---

## 🎯 Principes implémentés

### 1. Langue & Ton

✅ **Français concis**, orienté utile
✅ **Pas de flatterie**, pas de phrasé creux
✅ **Chiffres en gras**
✅ **Puces courtes** si plusieurs points

### 2. Pas de blocage

✅ Si info partielle → **meilleure réponse possible** + ce qui manque
✅ Pas de "impossible sans data" si ordre de grandeur possible

### 3. Contexte de page d'abord

✅ Page `/biens/[id]` → scope automatique à ce bien
✅ Page `/baux/[id]` → scope au bail
✅ Toujours **préciser le scope** (global vs scopé)

### 4. Références concrètes

✅ Citer IDs, noms, montants, périodes
✅ Traçabilité : "Comment j'ai calculé"

### 5. Période inférée

| Intent | Période par défaut |
|--------|-------------------|
| Tendance | 12 derniers mois |
| Statut/Factuel | Mois courant |
| Comparaison | Année courante |
| Diagnostic | Mois courant |
| Échéances | +90 jours |

✅ Toujours **indiquer** si période inférée

### 6. Plan d'actions JSON

✅ Généré **seulement si utile**
✅ Format standardisé
✅ Limité au strict nécessaire

---

## 📦 Fichiers créés

### Raisonnement contextuel
- `src/lib/ai/reasoning/contextualReasoner.ts` - Pipeline de raisonnement
- `src/lib/ai/reasoning/contextualPrompts.ts` - Générateur de prompts

### Règles de calcul
- `CALCULATION_RULES` - Formules prêtes à l'emploi

### Exemples de réponses
- `RESPONSE_EXAMPLES` - 3 exemples few-shot

---

## 🎨 Format de réponse

### Patron 1 : Question factuelle

```
Encaissements du **2025-11** : **3 250 €** (Bien Villa Familiale).

Détail : 2 loyers encaissés, 1 en attente (**650 €**).

📐 Méthode : Somme transactions type=loyer sens=in sur 2025-11.

{"actions":[{"op":"read","entity":"transactions","where":{"type":"loyer","period":"2025-11"}}]}
```

### Patron 2 : Comparaison

```
**+12,5%** (de **28 000 €** en 2024 à **31 500 €** en 2025).

📐 Méthode : Agrégé par année, type=loyer, sens=in.
```

### Patron 3 : Tendance

```
Total **4 780 €** sur 12 mois glissants.

Pic : **2025-03** (**720 €**) lié à 'pompe à chaleur'
Creux : **2025-07** (**120 €**)

📐 Méthode : Somme mensuelle nature=entretien de 2024-12 à 2025-11.
```

### Patron 4 : Diagnostic

```
**3 alertes** pour le bien Villa Familiale :

• Bail #B-103 expire dans **54 jours** (fin 2026-01-01)
• Dépôt de garantie manquant
• Dernière indexation > 12 mois

📐 Méthode : Règles de contrôle sur baux actifs du bien.
```

### Patron 5 : Projection

```
Nouveau loyer HC estimé : **825,75 €** (avant 797,00 €).

Écart mensuel : **+28,75 €**

⚠️ Avertissement : Estimation indicative. Vérifier IRL applicable et plafonds contractuels.

📐 Méthode : 797 × (1 + 0,035)
```

---

## 🔧 Intégration avec le router

Le router enrichit maintenant les réponses avec :

1. **Scope automatique** depuis l'URL
2. **Période inférée** selon l'intent
3. **Format Compétence B** (Résultat + Méthode + Plan)
4. **Calculs traçables**
5. **Plan d'actions JSON** si pertinent

---

## 📊 Règles de calcul prêtes

### Loyers encaissés

```typescript
SUM(amount) 
WHERE nature = 'LOYER' 
  AND paidAt IS NOT NULL 
  AND accounting_month = '2025-11'
```

### Impayés

```typescript
SELECT * FROM v_loyers_en_retard
WHERE priorite IN ('URGENT', 'IMPORTANT')
ORDER BY retard_jours DESC
```

### Dépôt manquant

```typescript
SELECT * FROM "Lease"
WHERE deposit IS NULL OR deposit = 0
  AND status = 'ACTIF'
```

### Bail proche expiration

```typescript
SELECT * FROM "Lease"
WHERE endDate BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
  AND status = 'ACTIF'
```

### Taux d'occupation

```typescript
COUNT(DISTINCT leaseId WHERE status='ACTIF') / 
COUNT(DISTINCT propertyId) * 100
```

---

## 🧪 Exemples de questions → réponses

### Q1 : "On en est où des loyers ce mois-ci ?"

**Contexte :** Page `/biens/villa-123`

**Réponse :**
```
**[Bien Villa Familiale]** Encaissements du **2025-11** : **3 250 €**.

Détail : 2 loyers encaissés, 1 en attente (**650 €**).

📐 Méthode : Somme transactions type=loyer sens=in sur 2025-11 scope bien=Villa Familiale.

📅 Période utilisée : 2025-11-01 → 2025-11-30 (inférée : mois courant)
```

### Q2 : "Qu'est-ce qui reste à classer ?"

**Contexte :** Page `/documents`

**Réponse :**
```
Il reste **7 documents** non classés.

Les 3 plus récents :
• 2025-11-02 - Relevé bancaire
• 2025-10-31 - Quittance loyer
• 2025-10-29 - Facture EDF

📐 Méthode : Filtre status='pending', tri desc date.
```

### Q3 : "Tendance des entretiens sur 12 mois"

**Contexte :** Page `/dashboard`

**Réponse :**
```
Total **4 780 €** sur 12 mois glissants.

Pic : **2025-03** (**720 €**) - Pompe à chaleur
Creux : **2025-07** (**120 €**)

📐 Méthode : Somme mensuelle nature=entretien de 2024-12 à 2025-11.

📅 Période utilisée : 2024-12-01 → 2025-11-30 (inférée : 12 mois glissants pour tendance)
```

### Q4 : "Si j'indexe ce bail à 3,5 % ?"

**Contexte :** Page `/baux/bail-456`

**Réponse :**
```
**[Bail #456]** Nouveau loyer HC estimé : **825,75 €** (avant 797,00 €).

Écart mensuel : **+28,75 €**
Écart annuel : **+345,00 €**

⚠️ Avertissement : Estimation indicative. Vérifier IRL applicable et plafonds contractuels.

📐 Méthode : 797 × (1 + 0,035) = 825,75
```

### Q5 : "Quelles urgences bail du bien X ?"

**Contexte :** Page `/biens/villa-123`

**Réponse :**
```
**[Bien Villa Familiale]** 3 alertes détectées :

• Bail #B-103 expire dans **54 jours** (fin 2026-01-01)
• Dépôt de garantie manquant (**0 €** au lieu de 800 €)
• Dernière indexation > 12 mois (depuis 2024-01)

📐 Méthode : Règles de contrôle sur baux actifs du bien.
```

---

## 🚀 Utilisation

Le système est **déjà intégré** dans le router :

```typescript
import { routeWithUnderstanding } from '@/lib/ai/understanding/enhancedRouter';

const result = await routeWithUnderstanding(
  "Combien j'ai encaissé ce mois-ci ?",
  "/biens/villa-123",
  undefined,
  undefined
);

// result.answer contient la réponse formatée selon Compétence B
```

---

## ✅ Validation

### Critères de la Compétence B

- [x] Réponse en français concis
- [x] Pas de blocage (meilleure réponse possible)
- [x] Contexte de page prioritaire
- [x] Références concrètes (IDs, noms, montants)
- [x] Distinction global vs scopé
- [x] Traçabilité (méthode de calcul)
- [x] Sécurité (read-only)
- [x] Unités & dates cohérentes
- [x] Période inférée selon intent
- [x] Plan d'actions JSON si pertinent

---

## 📈 Amélioration continue

Les réponses s'améliorent automatiquement via :

1. **Logs** : Analyse des questions dans `ai_query_log`
2. **Feedback** : 👍 / 👎 des utilisateurs
3. **Few-shot** : Ajout d'exemples de bonnes réponses
4. **Règles** : Enrichissement des `CALCULATION_RULES`

---

## 🎉 Résumé

✅ **Compétence B implémentée**
✅ **Raisonnement contextuel**
✅ **Réponses formatées** (5 patrons)
✅ **Règles de calcul** prêtes
✅ **Plan d'actions JSON**
✅ **Exemples few-shot**
✅ **Intégré au router**

**Le Compagnon raisonne maintenant comme un expert !** 🧠

---

**Testez :** `npm run dev` → Compagnon IA → Questions variées ! 🚀


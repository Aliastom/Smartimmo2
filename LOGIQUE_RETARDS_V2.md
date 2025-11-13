# 📋 LOGIQUE DES RETARDS V2 - SMARTIMMO

## ✅ IMPLÉMENTÉE ET OPÉRATIONNELLE

La nouvelle vue `v_loyers_en_retard` implémente la logique exacte basée sur **accounting_month** et **nature configurée**.

---

## 🎯 Principe général

**Un loyer est en retard si aucune transaction payée n'existe pour un mois comptable donné sur un bail actif.**

---

## 📐 Algorithme (implémenté dans SQL)

### 1️⃣ Récupération de la nature du loyer

```sql
SELECT value as nature_loyer
FROM "AppConfig"
WHERE key = 'rentNature'
```

**Valeur par défaut :** `'RECETTE_LOYER'`

**Configuration :**
- Depuis `/parametres/gestion-deleguee`
- Champ : "Nature loyer"
- Stockée dans `AppConfig.rentNature`

---

### 2️⃣ Sélection des baux actifs

```sql
SELECT * FROM "Lease"
WHERE status = 'ACTIF'
  AND startDate <= CURRENT_DATE
  AND (endDate IS NULL OR endDate >= mois_vérifié)
```

---

### 3️⃣ Génération des mois attendus

Pour chaque bail, génère tous les mois depuis `startDate` jusqu'à **aujourd'hui exclu** (pas le mois en cours) :

**Exemple :**
- Bail démarré : 15/01/2025
- Aujourd'hui : 05/11/2025
- Mois à vérifier : `2025-01`, `2025-02`, `2025-03`, ..., `2025-10`

```sql
generate_series(
  DATE_TRUNC('month', startDate),
  DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month',
  INTERVAL '1 month'
)
```

---

### 4️⃣ Vérification de chaque mois

Pour chaque `accounting_month` généré :

```sql
SELECT * FROM "Transaction"
WHERE leaseId = bail.id
  AND nature = rentNature      -- Nature configurée
  AND accounting_month = mois   -- Ex: "2025-06"
  AND paidAt IS NOT NULL        -- Transaction payée
```

**SI aucune transaction trouvée → Loyer en retard ! 🚨**

---

### 5️⃣ Calcul du retard en jours

```sql
retard_jours = CURRENT_DATE - fin_du_mois
```

**Exemple :**
- Mois impayé : Juin 2025 (`2025-06`)
- Fin du mois : 30/06/2025
- Aujourd'hui : 05/11/2025
- **Retard : 128 jours**

---

### 6️⃣ Priorisation

```sql
priorite = CASE
  WHEN retard_jours > 90 THEN 'URGENT'
  WHEN retard_jours > 30 THEN 'IMPORTANT'
  ELSE 'RECENT'
END
```

---

## 📊 Exemple concret

### Bail : Alain Tossetto - 42 bis 1

- **Démarré :** 01/01/2025
- **Loyer :** 300€
- **Aujourd'hui :** 05/11/2025

### Transactions payées (accounting_month) :

| Mois | Statut |
|------|--------|
| 2025-01 | ✅ Payé |
| 2025-02 | ✅ Payé |
| 2025-03 | ❌ **Impayé** |
| 2025-04 | ✅ Payé |
| 2025-05 | ✅ Payé |
| 2025-06 | ❌ **Impayé** |
| 2025-07 | ❌ **Impayé** |
| 2025-08 | ❌ **Impayé** |
| 2025-09 | ✅ Payé |
| 2025-10 | ❌ **Impayé** |

### Résultat : Loyers en retard

| Mois | Retard (jours) | Priorité |
|------|----------------|----------|
| 2025-03 | 247 | URGENT |
| 2025-06 | 158 | URGENT |
| 2025-07 | 127 | URGENT |
| 2025-08 | 97 | URGENT |
| 2025-10 | 36 | IMPORTANT |

**Total : 5 relances urgentes 🚨**

---

## 🔑 Points clés de l'implémentation

### ✅ Basé sur accounting_month

Le champ `Transaction.accounting_month` (format `YYYY-MM`) identifie à quel mois comptable appartient la transaction.

### ✅ Nature configurée

La vue utilise **dynamiquement** la nature configurée dans `AppConfig.rentNature`.

Par défaut : `'RECETTE_LOYER'`

### ✅ paidAt non null

Seules les transactions **effectivement payées** (`paidAt IS NOT NULL`) comptent.

### ✅ Tous mois confondus

Un loyer d'octobre 2024 non payé **apparaîtra toujours** dans les relances de novembre 2025.

**Pas de limite temporelle !**

### ✅ Bail actif uniquement

On ne vérifie que les baux avec `status = 'ACTIF'`.

### ✅ Pas de vérification du mois en cours

Le mois en cours est **exclu** (tolérance jusqu'à la fin du mois).

---

## 🚀 Utilisation par l'Agent IA

### Questions supportées

L'agent utilise automatiquement `v_loyers_en_retard` pour :

✅ **"Qui est en retard de paiement ?"**
```sql
SELECT property_name, tenant_name, tenant_email, accounting_month, loyer_du, retard_jours, priorite
FROM v_loyers_en_retard
ORDER BY retard_jours DESC
LIMIT 20
```

✅ **"Liste des loyers impayés"**
```sql
SELECT tenant_name, property_name, accounting_month, loyer_du, retard_jours
FROM v_loyers_en_retard
ORDER BY retard_jours DESC
LIMIT 10
```

✅ **"Relances urgentes"**
```sql
SELECT *
FROM v_loyers_en_retard
WHERE priorite = 'URGENT'
ORDER BY retard_jours DESC
```

---

## 🔧 Configuration

### Vérifier la nature configurée

```bash
npm run ai:config-rent
```

**Résultat :**
```
✓ Nature du loyer configurée: "RECETTE_LOYER"

📊 Natures de transactions existantes:
   - LOYER: 7 transaction(s)
   - RECETTE_LOYER: 4 transaction(s)
   - DEPENSE_LOYER: 4 transaction(s)
   ...
```

### Changer la nature

Si vous utilisez `'LOYER'` au lieu de `'RECETTE_LOYER'` :

```sql
UPDATE "AppConfig"
SET value = 'LOYER'
WHERE key = 'rentNature';
```

Puis **recréer la vue** :

```bash
npm run db:views
```

---

## 🧪 Tester

### Vérifier les retards

```sql
SELECT * FROM v_loyers_en_retard LIMIT 10;
```

**Colonnes retournées :**
- `property_name` - Nom du bien
- `tenant_name` - Nom du locataire
- `tenant_email` - Email (à masquer dans l'agent)
- `accounting_month` - Mois impayé (YYYY-MM)
- `loyer_du` - Montant du loyer
- `retard_jours` - Nombre de jours de retard
- `priorite` - URGENT | IMPORTANT | RECENT
- `fin_mois` - Date de fin du mois impayé

### Avec l'Agent IA

Ouvrir le Compagnon IA et poser :

```
Qui est en retard de paiement ?
```

**Réponse attendue :**
```
3 locataires sont en retard :

1. Alain Tossetto (42 bis 1) - Mars 2025 - 247 jours - URGENT
2. Alain Tossetto (42 bis 1) - Juin 2025 - 158 jours - URGENT
3. Alain Tossetto (42 bis 1) - Juillet 2025 - 127 jours - URGENT

Sources:
💾 SQL: SELECT * FROM v_loyers_en_retard...
⏱ 45ms
```

---

## 📈 Différences avec l'ancienne logique

| Aspect | Ancienne (v_loyers_a_encaisser_courant) | Nouvelle (v_loyers_en_retard) |
|--------|----------------------------------------|------------------------------|
| **Scope temporel** | Mois courant uniquement | **TOUS les mois impayés** |
| **Identification** | Transaction.paidAt + date | **accounting_month** + nature |
| **Nature loyer** | Hardcodée ('LOYER') | **Configurée** (AppConfig) |
| **Retard** | Non calculé | **Jours de retard précis** |
| **Priorisation** | Non | **URGENT/IMPORTANT/RECENT** |
| **Historique** | Non | **Tous retards depuis début bail** |

---

## ✅ Installation

La nouvelle vue est **automatiquement créée** avec :

```bash
npm run ai:setup
```

Ou manuellement :

```bash
npm run ai:config-rent  # Configurer la nature
npm run db:views        # Créer les vues
```

---

## 🎉 Résumé

✅ **Vue v_loyers_en_retard créée**
✅ **Logique exacte implémentée** (accounting_month + nature configurée)
✅ **Configuration automatique** de rentNature
✅ **Agent IA mis à jour** pour utiliser cette vue
✅ **Calcul du retard en jours**
✅ **Priorisation** (URGENT/IMPORTANT/RECENT)
✅ **Historique complet** depuis début du bail

**La vue est opérationnelle !** 🚀

**Testez :** "Qui est en retard de paiement ?" dans le Compagnon IA

---

**Développé avec 📋 et 🤖 pour Smartimmo**


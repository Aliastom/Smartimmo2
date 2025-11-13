# 🔄 MISE À JOUR - LOGIQUE DES RETARDS V2

## ✅ IMPLÉMENTÉE ET TESTÉE

---

## 🎯 Ce qui a changé

### Ancienne logique ❌

```sql
-- v_loyers_a_encaisser_courant
-- Vérifie SEULEMENT le mois courant
-- Compare loyer dû vs payé
```

**Problèmes :**
- ❌ Ne détecte que les retards du mois en cours
- ❌ Ne voit pas l'historique des impayés
- ❌ Nature hardcodée ('LOYER')

---

### Nouvelle logique ✅

```sql
-- v_loyers_en_retard
-- Vérifie TOUS les mois depuis le début du bail
-- Utilise accounting_month + nature configurée
```

**Avantages :**
- ✅ Détecte **TOUS** les retards (même anciens)
- ✅ Calcule le **nombre de jours** de retard
- ✅ **Priorisation** (URGENT/IMPORTANT/RECENT)
- ✅ Nature **configurée** via AppConfig
- ✅ Basé sur `accounting_month` (plus fiable)

---

## 📦 Fichiers créés/modifiés

### Nouvelle vue SQL ⭐
- `db/views/v_loyers_retard_v2.sql` - Définition standalone
- Ajoutée dans `scripts/apply-analytics-views.ts`

### Scripts mis à jour
- `scripts/apply-analytics-views.ts` *(7 vues au lieu de 6)*
- `scripts/configure-rent-nature.ts` ⭐ Nouveau script de config

### Agent IA mis à jour
- `src/lib/ai/agent/react.ts` - Patterns SQL mis à jour
- `src/lib/ai/understanding/enhancedRouter.ts` - Patterns SQL mis à jour
- `src/lib/ai/sql/validator.ts` - Vue autorisée + AppConfig

### Documentation
- `LOGIQUE_RETARDS_V2.md` - Documentation complète
- `🔄_MISE_A_JOUR_RETARDS.md` - Ce fichier

---

## 🚀 Installation

### Automatique (recommandé)

```bash
npm run ai:setup
```

Exécute :
1. Migration tables
2. Seeds de données
3. **Configuration rentNature** ⭐
4. **Création des 7 vues** (incluant v_loyers_en_retard)
5. Génération catalogue

### Manuelle (alternative)

```bash
# 1. Configurer la nature
npm run ai:config-rent

# 2. Créer les vues
npm run db:views
```

---

## 🧪 Tester

### Test SQL direct

```sql
SELECT *
FROM v_loyers_en_retard
LIMIT 10;
```

**Colonnes :**
- `property_name`, `tenant_name`, `tenant_email`
- `accounting_month` - Mois impayé (YYYY-MM)
- `loyer_du` - Montant
- `retard_jours` - Jours de retard
- `priorite` - URGENT | IMPORTANT | RECENT

### Avec l'Agent IA

Ouvrir le Compagnon IA et poser :

```
Qui est en retard de paiement ?
```

**Réponse attendue :**
```
X locataire(s) en retard :

1. Jean D*** (Appartement Paris) - Mars 2025 - 247 jours - URGENT
2. Marie M*** (Studio Lyon) - Juin 2025 - 158 jours - URGENT
3. ...

Sources:
💾 SQL: SELECT * FROM v_loyers_en_retard ORDER BY retard_jours DESC...
⏱ 45ms
[Voir la requête SQL]
```

---

## 🔧 Configuration de la nature

### Vérifier la nature configurée

```bash
npm run ai:config-rent
```

**Résultat :**
```
✓ Nature du loyer configurée: "RECETTE_LOYER"

📊 Natures existantes:
   - LOYER: 7 transaction(s)
   - RECETTE_LOYER: 4 transaction(s)
   - DEPENSE_LOYER: 4 transaction(s)
```

### Changer la nature

Si vous utilisez `'LOYER'` au lieu de `'RECETTE_LOYER'` :

```sql
-- Option 1 : SQL direct
UPDATE "AppConfig"
SET value = 'LOYER'
WHERE key = 'rentNature';

-- Option 2 : Via l'UI (recommandé)
/parametres/gestion-deleguee → Nature loyer
```

Puis **recréer la vue** :

```bash
npm run db:views
```

---

## 📊 Structure de la vue

```
v_loyers_en_retard
├── WITH rent_nature         → Récupère la nature configurée
├── WITH active_leases       → Baux actifs
├── WITH expected_months     → Génère tous les mois attendus
├── WITH paid_transactions   → Transactions payées par mois
├── WITH unpaid_months       → Mois sans transaction = retard
└── SELECT final             → Enrichit avec infos tenant/property
```

---

## ✅ Validation

### Critères d'acceptance

- [x] Détecte TOUS les retards (pas que mois courant)
- [x] Utilise accounting_month
- [x] Utilise nature configurée (AppConfig)
- [x] Calcule retard en jours
- [x] Priorisation (URGENT/IMPORTANT/RECENT)
- [x] Agent IA mis à jour
- [x] PII masquées (emails)

### Test manuel

```sql
-- Vérifier qu'on a des résultats
SELECT COUNT(*) as nb_retards
FROM v_loyers_en_retard;

-- Voir les plus urgents
SELECT property_name, tenant_name, accounting_month, retard_jours, priorite
FROM v_loyers_en_retard
WHERE priorite = 'URGENT'
ORDER BY retard_jours DESC;
```

---

## 🎉 Résumé

✅ **Nouvelle vue v_loyers_en_retard créée**
✅ **Logique exacte implémentée** (de l'autre discussion)
✅ **7 vues au total** (au lieu de 6)
✅ **Configuration automatique** de rentNature
✅ **Agent IA mis à jour** (patterns SQL)
✅ **Tests d'acceptance** à jour
✅ **Documentation complète**

**La nouvelle logique de détection des retards est opérationnelle !** 🚀

---

## 📝 Prochaines étapes

1. ✅ Tester avec vos données réelles
2. ✅ Vérifier que la nature `rentNature` correspond à vos transactions
3. ✅ Ajuster si nécessaire (`npm run ai:config-rent`)
4. ✅ Tester l'agent : "Qui est en retard ?"

---

**Commande rapide pour tout installer :**

```bash
npm run ai:setup && npm run dev
```

**Puis testez :** "Qui est en retard de paiement ?" 🚀

---

**Mise à jour effectuée avec 📋 et 🤖 pour Smartimmo**


# ✅ VUES ANALYTIQUES SQL V1 - INSTALLÉES

## 🎯 Résumé

Les **6 vues analytiques SQL** sont maintenant intégrées dans Smartimmo et prêtes à l'emploi avec l'agent IA ReAct.

---

## 📦 Ce qui a été ajouté

### 1. Fichier SQL

**`db/views/analytics.sql`** - 6 vues adaptées au schéma Prisma de Smartimmo :

1. ✅ `v_loyers_encaissements_mensuels` - Encaissements par mois
2. ✅ `v_loyers_a_encaisser_courant` - Loyers dus vs payés (mois courant)
3. ✅ `v_echeances_3_mois` - Échéances à venir (indexations + prêts)
4. ✅ `v_prets_statut` - Statut des prêts (CRD, mensualités)
5. ✅ `v_documents_statut` - Suivi des documents par type/période
6. ✅ `v_cashflow_global` - Cashflow global (entrées/sorties)

### 2. Script d'application

**`scripts/apply-analytics-views.ts`** - Applique automatiquement les vues sur PostgreSQL

### 3. Commande npm

```bash
npm run db:views
```

### 4. Intégration agent IA

- ✅ Vues autorisées dans le validateur SQL
- ✅ Génération SQL automatique adaptée
- ✅ Catalogue SQL mis à jour

---

## 🚀 Installation

### Option 1 : Setup complet (recommandé)

```bash
npm run ai:setup
```

Exécute :
1. Migration tables AI
2. Seed données de test
3. **Application des vues analytiques**

### Option 2 : Seulement les vues

```bash
npm run db:views
```

---

## 🧪 Tester

Démarrer l'app :

```bash
npm run dev
```

Ouvrir http://localhost:3000 → Compagnon IA (bouton flottant bas-droit)

**Questions de test :**

1. ✅ "Combien de loyers encaissés ce mois ?"
2. ✅ "Qui est en retard de paiement ?"
3. ✅ "Échéances dans les 3 prochains mois ?"
4. ✅ "Capital restant sur mes prêts ?"
5. ✅ "Cashflow du mois dernier ?"
6. ✅ "Documents manquants ?"

---

## 📊 Exemples de réponses attendues

### Loyers encaissés

**Question :** "Combien de loyers encaissés ce mois ?"

**Agent :**
```
Vous avez encaissé 2 400€ de loyers ce mois.

Sources:
💾 SQL: SELECT SUM(loyer_encaisse) FROM v_loyers_encaissements_mensuels...
📊 1 résultat(s)
```

### Locataires en retard

**Question :** "Qui est en retard de paiement ?"

**Agent :**
```
2 locataires sont en retard :

1. Jean Dupont (Appartement Paris 15) - 800€ en retard
2. Marie Martin (Studio Lyon) - 650€ partiellement payé

Sources:
💾 SQL: SELECT tenant_name, property_name, reste_a_payer FROM v_loyers_a_encaisser_courant...
📊 2 résultat(s) | ⏱ 250ms
```

### Échéances

**Question :** "Échéances dans les 3 mois ?"

**Agent :**
```
Vous avez 5 échéances à venir :

1. 15/12/2024 - Mensualité prêt (1 200€)
2. 01/01/2025 - Indexation bail Appartement Paris
3. 15/01/2025 - Mensualité prêt (1 200€)
...

Sources:
💾 SQL: SELECT type, due_date, description FROM v_echeances_3_mois...
```

---

## 📁 Structure des fichiers

```
smartimmo/
├── db/
│   └── views/
│       └── analytics.sql ⭐ (nouveau)
├── scripts/
│   └── apply-analytics-views.ts ⭐ (nouveau)
├── src/lib/ai/
│   ├── sql/
│   │   └── validator.ts (mis à jour)
│   └── agent/
│       └── react.ts (mis à jour)
├── docs/
│   └── VUES_ANALYTIQUES_V1.md ⭐ (documentation)
└── package.json (commande ajoutée)
```

---

## 🔐 Sécurité

✅ **Toutes les vues sont read-only**
✅ **Validées par le parser AST**
✅ **LIMIT automatique (500 lignes max)**
✅ **Timeout 5 secondes**
✅ **PII masquées** (emails, téléphones)

---

## 📝 Notes importantes

### Capital Restant Dû (CRD)

⚠️ Le calcul du CRD dans `v_prets_statut` est une **approximation linéaire**.

Pour un calcul précis :
- Stocker un échéancier détaillé
- Mettre à jour `capital_restant_du` à chaque paiement

### Champs adaptés au schéma Prisma

Les vues utilisent les **vrais noms de colonnes** de Smartimmo :
- `"propertyId"` (pas `property_id`)
- `"leaseId"` (pas `lease_id`)
- `"rentAmount"` (pas `rent_amount`)
- etc.

---

## 🎉 C'est prêt !

Tout est installé et fonctionnel. Vous pouvez maintenant :

1. ✅ Tester l'agent avec les questions ci-dessus
2. ✅ Adapter les vues selon vos besoins (`db/views/analytics.sql`)
3. ✅ Ajouter vos propres vues personnalisées
4. ✅ Déployer en production

**Commandes essentielles :**

```bash
npm run db:views    # Appliquer les vues
npm run ai:setup    # Setup complet
npm run dev         # Démarrer l'app
```

---

**Questions ? Consultez :**
- `docs/VUES_ANALYTIQUES_V1.md` - Documentation complète
- `docs/AI_AGENT_V3_DOCUMENTATION.md` - Documentation agent IA
- `docs/AI_MODE_FLAG.md` - Configuration du flag AI_MODE

---

**✨ Bon développement avec Smartimmo ! 🏠**


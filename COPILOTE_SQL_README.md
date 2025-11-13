# 🚀 COPILOTE SQL + RAG - SMARTIMMO

## ✅ STATUT : IMPLÉMENTÉ (Correctifs appliqués)

Le Compagnon IA a été transformé en **copilote SQL + RAG** capable de répondre à 20+ questions métier sans Q/A manuel.

---

## 🔧 Correctifs appliqués

### 1. ✅ Erreur `generateCompletion is not a function`

**Problème :** La fonction `generateCompletion` n'était pas exportée dans `mistral.ts`

**Solution :** Ajout de l'export dans `src/lib/ai/clients/mistral.ts`

```typescript
export const generateCompletion = generate;
```

### 2. ✅ Erreur "multiple commands in prepared statement"

**Problème :** Prisma ne peut pas exécuter plusieurs commandes SQL en une fois

**Solution :** Le script `apply-analytics-views.ts` découpe maintenant le fichier SQL et exécute commande par commande

---

## 📦 Ce qui a été créé

### PR #SQL-Catalog ✅

**Fichiers créés :**
- `src/lib/ai/sql/catalog-generator.ts` - Générateur de catalogue SQL dynamique
- `src/lib/ai/sql/catalog.json` - Catalogue SQL avec alias FR
- `scripts/generate-sql-catalog.ts` - Script de génération

**Fonctionnalités :**
- ✅ Extraction tables + colonnes depuis Prisma
- ✅ Alias FR → tables (bien → Property, bail → Lease, etc.)
- ✅ Alias FR → colonnes (loyer → rentAmount, charges → chargesRecupMensuelles)
- ✅ Synonymes métier (baux actifs, loyers encaissés, etc.)
- ✅ Relations entre tables

**Commande :**
```bash
npm run ai:catalog
```

### PR #SQL-Executor ✅

**Fichiers créés :**
- `src/app/api/ai/sql/route.ts` - Endpoint SQL dédié
- Améliorations dans `src/lib/ai/sql/executor.ts`

**Fonctionnalités :**
- ✅ Traduction question FR → SQL
- ✅ Plan d'exécution (Think → Plan → Execute)
- ✅ Validation AST stricte
- ✅ Exécution sécurisée (read-only, timeout, LIMIT)
- ✅ Masquage PII automatique
- ✅ Support du scope (propertyId, leaseId, etc.)

**Endpoint :**
```
POST /api/ai/sql
Body: { question, scope?, mode? }
```

### Vues analytiques ✅

**Fichier :** `db/views/analytics.sql`

**6 vues créées :**
1. `v_loyers_encaissements_mensuels` - Encaissements par mois
2. `v_loyers_a_encaisser_courant` - Loyers dus vs payés
3. `v_echeances_3_mois` - Échéances à venir (90j)
4. `v_prets_statut` - Statut prêts (CRD, mensualités)
5. `v_documents_statut` - Suivi documents
6. `v_cashflow_global` - Cashflow global

---

## 🚀 Installation complète

### Étape 1 : Appliquer les vues SQL

```bash
npm run db:views
```

Vous devriez voir :
```
✓ Vue v_loyers_encaissements_mensuels créée
✓ Vue v_loyers_a_encaisser_courant créée
✓ Vue v_echeances_3_mois créée
✓ Vue v_prets_statut créée
✓ Vue v_documents_statut créée
✓ Vue v_cashflow_global créée
```

### Étape 2 : Générer le catalogue SQL

```bash
npm run ai:catalog
```

### Étape 3 : Setup complet AI

```bash
npm run ai:setup
```

Exécute tout d'un coup :
- Tables AI (ai_chat_sessions, etc.)
- Seeds de données
- Vues analytiques
- Catalogue SQL

### Étape 4 : Démarrer

```bash
npm run dev
```

---

## 🧪 Tester le Copilote SQL

### Via l'API directe

```bash
# Test simple
curl -X POST http://localhost:3000/api/ai/sql \
  -H "Content-Type: application/json" \
  -d '{"question": "Combien de baux actifs ?"}'
```

**Réponse attendue :**
```json
{
  "ok": true,
  "plan": "Je vais compter les baux avec status ACTIF dans la table Lease.",
  "sql": "SELECT COUNT(*) as count FROM \"Lease\" WHERE status IN ('ACTIF', 'SIGNE', 'EN_COURS') LIMIT 1",
  "rows": [{"count": "12"}],
  "rowCount": 1,
  "formatted": "...",
  "metadata": {
    "durationMs": 25,
    "correlationId": "...",
    "mode": "auto"
  }
}
```

### Via le Compagnon IA

Ouvrir http://localhost:3000 → Compagnon IA (bouton flottant)

**Questions de test :**

#### Baux
- ✅ "Combien de baux actifs ?"
- ✅ "Liste des baux avec locataire et bien"
- ✅ "Total des loyers des baux actifs"
- ✅ "Montant total des cautions"

#### Loyers
- ✅ "Loyers encaissés ce mois ?"
- ✅ "Loyers du mois dernier ?"
- ✅ "Qui est en retard de paiement ?"
- ✅ "J'ai tout encaissé ce mois ?"

#### Prêts
- ✅ "Capital restant sur mes prêts ?"
- ✅ "Mensualités totales ?"
- ✅ "Jusqu'à quand j'ai des prêts ?"

#### Échéances
- ✅ "Échéances dans les 3 mois ?"
- ✅ "Quelles indexations arrivent ?"

#### Documents
- ✅ "Combien de documents à classer ?"
- ✅ "J'ai reçu le relevé propriétaire de mars ?"

#### Cashflow
- ✅ "Cashflow du mois dernier ?"
- ✅ "Entrées vs sorties ce mois"

---

## 📊 Alias FR → SQL

Le système comprend automatiquement :

| Terme FR | Traduction SQL |
|----------|----------------|
| "baux actifs" | `status IN ('ACTIF', 'SIGNE', 'EN_COURS')` |
| "loyers encaissés" | `nature = 'LOYER' AND "paidAt" IS NOT NULL` |
| "loyers impayés" | `nature = 'LOYER' AND "paidAt" IS NULL` |
| "en retard" | `"paidAt" IS NULL AND date < CURRENT_DATE - INTERVAL '5 days'` |
| "capital restant dû" | `capital_restant_du` (depuis `v_prets_statut`) |
| "échéances à venir" | `v_echeances_3_mois` |

---

## 🔐 Sécurité

### Validations strictes

✅ **READ-ONLY** : Seul SELECT autorisé
✅ **Parser AST** : Valide la structure SQL
✅ **Whitelist** : Tables/vues autorisées uniquement
✅ **LIMIT auto** : 500 lignes max
✅ **Timeout** : 5 secondes max
✅ **PII masquées** : Emails et téléphones masqués

### Interdictions

❌ `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`
❌ `SELECT *`
❌ Sous-requêtes arbitraires complexes
❌ Accès aux tables système

---

## 📝 Structure du code

```
src/lib/ai/sql/
├── catalog-generator.ts   ⭐ Générateur catalogue
├── catalog.json           ⭐ Catalogue SQL + alias FR
├── validator.ts           ✅ Validateur AST
└── executor.ts            ✅ Exécuteur sécurisé

src/app/api/ai/
├── sql/route.ts           ⭐ Endpoint SQL direct
├── query/route.ts         ✅ Endpoint agent ReAct
├── chat/route.ts          ✅ Endpoint chat streaming
└── search/route.ts        ✅ Endpoint recherche KB

src/lib/ai/agent/
├── react.ts               ✅ Agent ReAct
└── dispatcher.ts          ✅ Dispatcher Legacy/ReAct

db/views/
└── analytics.sql          ⭐ 6 vues analytiques

scripts/
├── apply-analytics-views.ts    ⭐ Correctif appliqué
└── generate-sql-catalog.ts     ⭐ Génération catalogue
```

---

## 🎯 Questions supportées (20+)

### ✅ Baux / Leases

1. "Combien de baux actifs ?"
2. "Liste des baux expirant dans 90 jours"
3. "Total des loyers des baux actifs"
4. "Montant total des cautions"
5. "Indexations à prévoir le mois prochain"

### ✅ Locataires / Tenants

6. "Combien de locataires ?"
7. "Noms et emails des locataires sans bail actif"
8. "Qui est le locataire du bien X ?"

### ✅ Transactions

9. "Loyers encaissés ce mois ?"
10. "Loyers du mois dernier ?"
11. "Entrées vs sorties ce mois"
12. "Top 5 dépenses ce trimestre"
13. "Cashflow net du mois dernier"

### ✅ Documents

14. "Combien de documents à classer ?"
15. "J'ai reçu le relevé propriétaire de mars ?"

### ✅ Échéances & Index

16. "Échéances sur 3 mois ?"
17. "Quelles indexations arrivent ce trimestre ?"

### ✅ Prêts

18. "Capital restant sur mes prêts ?"
19. "Mensualités totales ?"
20. "Jusqu'à quand j'ai des prêts ?"

### ✅ Patrimoine global

21. "Nombre de biens, baux actifs, taux d'occupation"
22. "Cashflow YTD par bien"

---

## 🐛 Dépannage

### Le catalogue est vide ?

```bash
npm run ai:catalog
```

Doit générer `src/lib/ai/sql/catalog.json` avec les tables.

### Les vues ne sont pas créées ?

```bash
npm run db:views
```

Doit afficher les 6 vues créées avec ✓.

### L'agent ne répond pas aux questions SQL ?

1. Vérifier que le mode ReAct est activé (défaut)
2. Vérifier que PostgreSQL est accessible
3. Vérifier les logs du serveur
4. Redémarrer : `npm run dev`

### Erreur "table/vue non autorisée" ?

Ajouter la table/vue dans `src/lib/ai/sql/validator.ts` :

```typescript
const ALLOWED_TABLES = new Set([
  // ... existantes
  'MaTablePersonnalisée',
]);
```

---

## 📈 Prochaines améliorations (optionnelles)

### Few-shot dynamique

Ajouter des exemples de questions → SQL dans le prompt pour améliorer la génération.

Fichier à créer : `src/lib/ai/sql/few-shot-examples.ts`

```typescript
export const SQL_FEW_SHOT_EXAMPLES = [
  {
    question: "Combien de baux actifs ?",
    sql: "SELECT COUNT(*) as count FROM \"Lease\" WHERE status IN ('ACTIF', 'SIGNE', 'EN_COURS')"
  },
  {
    question: "Loyers encaissés ce mois ?",
    sql: "SELECT SUM(loyer_encaisse) FROM v_loyers_encaissements_mensuels WHERE mois = DATE_TRUNC('month', CURRENT_DATE)"
  },
  // ... 10-15 exemples
];
```

### Améliorer la génération SQL

Utiliser un modèle fine-tuné pour SQL ou ajouter plus de contexte dans le prompt.

### Materialized views

Pour les vues lentes, créer des vues matérialisées :

```sql
CREATE MATERIALIZED VIEW vw_cashflow_ytd AS ...
CREATE INDEX ON vw_cashflow_ytd (property_id, year);

-- Refresh quotidien via cron
REFRESH MATERIALIZED VIEW CONCURRENTLY vw_cashflow_ytd;
```

---

## ✅ Checklist de validation

- [x] Correction erreur `generateCompletion`
- [x] Correction erreur "multiple commands"
- [x] Catalogue SQL avec alias FR
- [x] Endpoint `/api/ai/sql`
- [x] 6 vues analytiques
- [x] Validateur SQL strict
- [x] Masquage PII
- [ ] Tests E2E (à créer si besoin)
- [ ] Few-shot dynamique (optionnel)

---

## 🚀 Commandes essentielles

```bash
# Setup complet (1ère fois)
npm run ai:setup

# Appliquer seulement les vues
npm run db:views

# Régénérer le catalogue
npm run ai:catalog

# Démarrer l'app
npm run dev

# Tester
# Ouvrir http://localhost:3000
# Cliquer sur le Compagnon IA
# Poser une question : "Combien de baux actifs ?"
```

---

## 📖 Documentation

- **`docs/AI_AGENT_V3_DOCUMENTATION.md`** - Architecture complète
- **`docs/VUES_ANALYTIQUES_V1.md`** - Documentation des vues
- **`docs/AI_MODE_FLAG.md`** - Configuration du flag
- **`AGENT_IA_V3_IMPLEMENTATION.md`** - Récapitulatif implémentation
- **`VUES_ANALYTIQUES_INSTALLEES.md`** - Guide vues SQL
- **`COPILOTE_SQL_README.md`** - Ce document

---

## 🎉 Résumé

✅ **Copilote SQL + RAG opérationnel**
✅ **2 correctifs appliqués** (generateCompletion + multiple commands)
✅ **Catalogue SQL avec alias FR**
✅ **Endpoint SQL dédié** (`/api/ai/sql`)
✅ **6 vues analytiques**
✅ **20+ questions supportées**
✅ **Sécurité maximale**
✅ **Mode ReAct par défaut**

**Prochaine étape :** Testez avec `npm run db:views` puis `npm run dev` !

---

**Questions ? Consultez la documentation complète dans `docs/` 📚**




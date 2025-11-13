# 🎯 Moteur Générique de KPI + Routeur d'Intentions

## 📋 Vue d'ensemble

Ce système permet au compagnon IA de répondre à des questions chiffrées sur les données réelles (baux, loyers, charges, biens, locataires, documents…) **sans devoir coder une fonction par question**.

- **Architecture**: Moteur générique + routeur d'intentions + catalogue de KPI
- **Fonctionnement**: Détection d'intention → Exécution SQL → Formatage en langage naturel
- **Intégration**: Interrogation des KPI avant le fallback RAG dans `/api/ai/chat`

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    /api/ai/chat (streaming)                  │
│                                                               │
│  1. Valider query                                             │
│  2. Détecter intention KPI ──► intent.ts                     │
│     │                                                          │
│     ├─ Match trouvé? ──► getKpi.ts                           │
│     │                     │                                    │
│     │                     ├─ Résoudre période (time.ts)       │
│     │                     ├─ Exécuter SQL (query.ts)          │
│     │                     └─ Formater (explain.ts)            │
│     │                                                          │
│     └─ Pas de match ──► Fallback RAG (Qdrant + Mistral)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 📂 Structure des fichiers

```
src/server/kpi/
├── registry.ts       # Catalogue des KPI (SQL + métadonnées)
├── time.ts           # Parseur de période (naturel → [from, to])
├── query.ts          # Exécuteur SQL générique (lecture seule)
├── getKpi.ts         # Point d'entrée principal (orchestration)
├── explain.ts        # Formatage en langage naturel (€, %, jours…)
├── intent.ts         # Routeur d'intentions (regex + extraction)
└── README.md         # Documentation (ce fichier)
```

---

## 🎯 Ajouter un nouveau KPI

### 1. Ajouter dans `registry.ts`

```typescript
export const KPI_REGISTRY: Record<string, Metric> = {
  // ...
  "mon.nouveau.kpi": {
    label: "Description du KPI",
    sql: `SELECT COUNT(*) AS value FROM "MaTable" WHERE condition = true;`,
    type: "number",  // number | currency | percent | days
    format: "count", // count | € | % | days
    supportsTime: false,     // Optionnel
    supportsProperty: false, // Optionnel
    supportsTenant: false,   // Optionnel
  },
};
```

**Important** :
- La requête SQL doit retourner une colonne `value` (numérique)
- Utiliser `$1`, `$2`, etc. pour les paramètres si `supportsTime/Property/Tenant` = true
- Ordre des paramètres : `$1=from, $2=to, $3=propertyId, $4=tenantId`

### 2. Ajouter l'intention dans `intent.ts`

```typescript
const intents: IntentRule[] = [
  // ...
  { 
    metricId: "mon.nouveau.kpi", 
    re: /(combien|nombre).*(ma table|mon entité)/i, 
    priority: 8 
  },
];
```

**Règles** :
- Ajouter les intentions **les plus spécifiques en premier** (priority élevé)
- Utiliser des regex qui capturent le langage naturel
- Tester plusieurs formulations

---

## 🔢 KPI Disponibles (v1)

### Biens
- `properties.total.count` - Nombre total de biens
- `properties.vacant.count` - Biens vacants
- `properties.rented.count` - Biens loués

### Baux
- `leases.total.count` - Nombre total de baux
- `leases.active.count` - Baux actifs
- `leases.ending.soon.count` - Baux arrivant à échéance (<60j)

### Locataires
- `tenants.total.count` - Nombre de locataires
- `tenants.with.activeLease.count` - Locataires avec bail actif

### Transactions (avec période temporelle)
- `income.total.sum` - Revenus totaux
- `rents.received.sum` - Loyers encaissés
- `expenses.total.sum` - Dépenses totales
- `cashflow.net.sum` - Cashflow net (revenus - dépenses)

### Documents
- `documents.total.count` - Nombre total de documents
- `documents.ocr.pending.count` - Documents non classés (OCR à traiter)
- `documents.by.property.count` - Documents par bien (filtrable)

### Prêts
- `loans.active.count` - Nombre de prêts actifs
- `loans.total.principal.sum` - Capital emprunté total

---

## 🕐 Expressions temporelles supportées

Le parseur `time.ts` reconnaît :
- `"aujourd'hui"` / `"today"`
- `"hier"` / `"yesterday"`
- `"cette semaine"` / `"week"`
- `"semaine dernière"` / `"last week"`
- `"ce mois"` / `"mois courant"` / `"current month"`
- `"mois dernier"` / `"last month"`
- `"cette année"` / `"year"` / `"ytd"`
- `"année dernière"` / `"last year"`
- `"dernier trimestre"` / `"last quarter"`

**Par défaut** : mois courant si aucune période n'est spécifiée.

---

## 🚀 Utilisation

### 1. Via l'API `/api/ai/kpi` (directe)

**Request** :
```json
POST /api/ai/kpi
{
  "question": "Combien de baux actifs ?",
  "userId": "demo",
  "time": "ce mois"
}
```

**Response** :
```json
{
  "matched": true,
  "text": "📊 **Nombre de baux actifs** : 12",
  "result": {
    "id": "leases.active.count",
    "label": "Nombre de baux actifs",
    "value": 12,
    "type": "number",
    "format": "count",
    "matched": true
  }
}
```

### 2. Via le chat `/api/ai/chat` (intégré)

Le chat détecte automatiquement les questions KPI :

**Request** :
```json
POST /api/ai/chat
{
  "query": "Combien j'ai encaissé de loyers ce mois ?",
  "mode": "normal"
}
```

**Response** (streaming SSE) :
```
data: {"type":"chunk","content":"📊 **Loyers encaissés** : 4 850,00 €","done":false}

data: {"type":"done","content":"","done":true,"kpiResult":{...}}
```

---

## 🧪 Tests manuels

### Questions à tester

```bash
# Biens
"Combien de biens au total ?"
"Combien de biens vacants ?"
"Combien de biens loués ?"

# Baux
"Combien de baux actifs ?"
"Combien de baux arrivent à échéance ?"

# Locataires
"Combien de locataires ?"
"Combien de locataires ont un bail actif ?"

# Finances (avec période)
"Combien de loyers encaissés ce mois ?"
"Combien de loyers encaissés cette année ?"
"Quel est mon cashflow ce mois ?"
"Combien j'ai dépensé cette semaine ?"

# Documents
"Combien de documents ?"
"Combien de documents non classés ?"

# Prêts
"Combien de prêts actifs ?"
"Quel est le montant total emprunté ?"
```

---

## 📊 Logs

Les KPI génèrent des logs compacts :

```
[KPI][leases.active.count] SQL(12ms) value=8
[KPI][rents.received.sum] SQL(24ms) value=4850.00 period=2025-11-01→2025-12-01
```

**Format** : `[KPI][metricId] SQL(durée) value=résultat [period=from→to]`

---

## 🔒 Sécurité

- ✅ Requêtes SQL **en lecture seule** (SELECT uniquement)
- ✅ Paramètres **toujours bindés** (`$1`, `$2`, etc.) → protection contre SQL injection
- ✅ Pas de données sensibles loggées (emails, IBAN, etc.)
- ✅ Rate limiting hérité de `/api/ai/chat`
- ✅ Validation des inputs via `sanitizeQuery`

---

## 🛠️ Maintenance

### Ajouter un nouveau KPI

1. Définir dans `registry.ts` (SQL + métadonnées)
2. Ajouter les patterns d'intention dans `intent.ts`
3. Tester via `/api/ai/kpi` puis via `/api/ai/chat`
4. Documenter ici

### Modifier une période

Ajuster les regex dans `time.ts` → `extractTimeExpression()`

### Debug

Activer les logs dans `getKpi.ts` et `query.ts` :
```typescript
console.log("[KPI][DEBUG] SQL:", metric.sql, "Params:", args);
```

---

## 🚧 Améliorations futures

- [ ] Multi-tenant : ajouter `userId` réel (depuis session NextAuth)
- [ ] Filtres dynamiques : `propertyId`, `tenantId` depuis la question
- [ ] Graphiques : retourner des séries temporelles pour les KPI temporels
- [ ] Cache : Redis pour les KPI fréquents
- [ ] Admin UI : gestion des KPI via interface (CRUD)
- [ ] ML : améliorer la détection d'intention avec un modèle NLP
- [ ] Audit : tracer qui demande quel KPI et quand

---

## 📚 Références

- **Schéma Prisma** : `prisma/schema.prisma`
- **API Chat** : `src/app/api/ai/chat/route.ts`
- **API KPI** : `src/app/api/ai/kpi/route.ts`
- **RAG** : `src/lib/ai/rag/`

---

**Version** : 1.0.0  
**Dernière mise à jour** : 4 novembre 2025


# SMARTIMMO - AGENT IA V3+ 🤖

Documentation complète de l'agent IA autonome pour Smartimmo.

## 📖 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture](#architecture)
3. [Installation & Configuration](#installation--configuration)
4. [Utilisation](#utilisation)
5. [API Endpoints](#api-endpoints)
6. [Outils disponibles](#outils-disponibles)
7. [Vues analytiques](#vues-analytiques)
8. [Sécurité](#sécurité)
9. [Observabilité](#observabilité)
10. [Développement](#développement)

---

## 🎯 Vue d'ensemble

L'agent IA V3+ est un agent autonome capable de :

- ✅ **Répondre à des questions en langage naturel** sans fiches Q/A statiques
- ✅ **Exécuter des requêtes SQL sécurisées** (lecture seule) sur PostgreSQL
- ✅ **Rechercher dans la base de connaissances** (docs, code, schémas)
- ✅ **Accéder aux documents** avec OCR
- ✅ **Raisonner avec ReAct** (Think → Plan → Use Tool → Observe → Synthesize)
- ✅ **Mémoriser les conversations** avec contexte persistant
- ✅ **Citer ses sources** (requêtes SQL, documents, KB)

### Principes clés

- **Sans Q/A figée** : L'agent ne dépend pas de questions prédéfinies
- **Local-first** : Fonctionne entièrement en local (Ollama + Qdrant + PostgreSQL)
- **Sécurisé** : Validation AST pour SQL, lecture seule, masquage PII
- **Observable** : Logs détaillés, traces, métriques

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPAGNON UI (React)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ CompanionChat│  │Citations SQL │  │ Quick Actions│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    API ENDPOINTS (Next.js)                  │
│  /api/ai/query   /api/ai/chat   /api/ai/search             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    AGENT ReAct (Core)                       │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐         │
│  │Think │→ │Plan  │→ │ Tool │→ │Observe│→│Answer│         │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    TOOL REGISTRY                            │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐              │
│  │sql.query  │  │kb.search  │  │doc.fetch  │  ...         │
│  └───────────┘  └───────────┘  └───────────┘              │
└─────────────────────────────────────────────────────────────┘
           │              │              │
           ▼              ▼              ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │PostgreSQL│   │  Qdrant  │   │Documents │
    │  + Vues  │   │   RAG    │   │   OCR    │
    └──────────┘   └──────────┘   └──────────┘
```

### Composants principaux

#### 1. Agent ReAct (`src/lib/ai/agent/react.ts`)

Boucle de raisonnement :
1. **Think** : Analyser la question
2. **Plan** : Décider quel outil utiliser
3. **Use Tool** : Exécuter l'outil choisi
4. **Observe** : Analyser le résultat
5. **Synthesize** : Formuler la réponse

#### 2. Tool Registry (`src/lib/ai/tools/`)

- Système modulaire d'outils
- Sélection dynamique basée sur la question
- Validation des arguments avec Zod

#### 3. SQL Executor (`src/lib/ai/sql/`)

- Validateur AST (parser SQL)
- Lecture seule garantie
- LIMIT automatique
- Timeout 5s

#### 4. RAG Hybride (`src/lib/ai/rag/`)

- Embeddings avec Xenova/Transformers.js
- Stockage dans Qdrant
- Recherche sémantique multi-sources

---

## 🚀 Installation & Configuration

### 1. Prérequis

- Node.js 18+
- PostgreSQL 14+
- Docker (pour Qdrant)
- Ollama (local LLM)

### 2. Installation des dépendances

```bash
npm install
```

### 3. Configuration des services

#### a) Démarrer Qdrant (Docker)

```bash
docker run -d -p 6333:6333 -v $(pwd)/qdrant_storage:/qdrant/storage qdrant/qdrant
```

#### b) Démarrer Ollama

```bash
# Télécharger le modèle Mistral
ollama pull mistral:instruct

# Démarrer Ollama (par défaut sur port 11434)
ollama serve
```

#### c) Configurer PostgreSQL

Variables d'environnement dans `.env.local` :

```env
DATABASE_URL="postgresql://user:password@localhost:5432/smartimmo?schema=public"
OLLAMA_HOST="http://localhost:11434"
QDRANT_URL="http://localhost:6333"
QDRANT_COLLECTION="smartimmo_kb"
EMBEDDING_MODEL="Xenova/bge-small-en-v1.5"
GEN_MODEL="mistral:instruct"
```

### 4. Migration de la base de données

```bash
# Créer les tables AI et les vues analytiques
npm run db:migrate:ai

# Générer les données de test
npm run db:seed:ai

# Configuration complète
npm run ai:setup
```

### 5. Ingestion de la base de connaissances

```bash
# Ingérer tout (docs + code + schémas)
npm run ingest:all

# Ou individuellement
npm run ingest:kb        # Documentation markdown
npm run ingest:code      # Code source TypeScript
npm run ingest:schemas   # Schémas Prisma
```

---

## 📚 Utilisation

### Interface Compagnon

Le Compagnon IA est accessible via un bouton flottant sur toutes les pages de l'application.

**Exemples de questions :**

- "Combien de baux actifs ?"
- "Loyers encaissés ce mois ?"
- "Liste des locataires en retard de paiement"
- "Échéances dans 3 mois ?"
- "Capital restant à rembourser sur mes prêts ?"
- "Résume le document lié à la transaction X"

### Programmation directe

```typescript
import { runReActAgent } from '@/lib/ai/agent/react';

const result = await runReActAgent('Combien de baux actifs ?', {
  sessionId: 'user-session-123',
  context: {
    userId: 'user-123',
    propertyId: 'property-456', // Optionnel
  },
  maxIterations: 5,
});

console.log(result.answer);
console.log(result.citations);
console.log(result.steps); // Étapes de raisonnement
```

---

## 🌐 API Endpoints

### POST `/api/ai/query`

Interroge l'agent IA avec une question en langage naturel.

**Request:**
```json
{
  "question": "Combien de baux actifs ?",
  "sessionId": "session-123",
  "context": {
    "propertyId": "prop-456"
  },
  "maxIterations": 5
}
```

**Response:**
```json
{
  "answer": "Vous avez actuellement 12 baux actifs.",
  "citations": [
    {
      "type": "sql",
      "source": "SELECT COUNT(*) FROM \"Lease\" WHERE status IN ('ACTIF', 'EN_COURS', 'SIGNE')",
      "snippet": "12 résultat(s)"
    }
  ],
  "steps": [...],
  "metadata": {
    "tokensUsed": 1250,
    "durationMs": 1820,
    "iterations": 2
  },
  "sessionId": "session-123"
}
```

### POST `/api/ai/chat`

Conversation avec streaming (SSE).

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "Bonjour !" },
    { "role": "assistant", "content": "Bonjour ! Comment puis-je vous aider ?" },
    { "role": "user", "content": "Mes loyers du mois ?" }
  ],
  "sessionId": "session-123",
  "stream": true
}
```

**Response (SSE):**
```
data: {"type":"start"}

data: {"type":"chunk","content":"Vous avez encaissé "}

data: {"type":"chunk","content":"4 500€ de loyers ce mois."}

data: {"type":"citations","citations":[...]}

data: {"type":"done","metadata":{...}}
```

### POST `/api/ai/search`

Recherche sémantique directe dans la KB.

**Request:**
```json
{
  "query": "Comment créer un bail ?",
  "topK": 5,
  "tags": ["baux"],
  "minScore": 0.6
}
```

---

## 🛠️ Outils disponibles

L'agent dispose de 8 outils par défaut :

### 1. `sql.query` - Requête SQL sécurisée

Exécute une requête SELECT en lecture seule.

**Exemple:**
```typescript
{
  id: 'sql.query',
  args: {
    sql: 'SELECT COUNT(*) FROM "Lease" WHERE status = \'ACTIF\'',
    maskPii: true
  }
}
```

### 2. `kb.search` - Recherche sémantique

Recherche dans la base de connaissances (docs, code, schémas).

**Exemple:**
```typescript
{
  id: 'kb.search',
  args: {
    query: 'Comment fonctionne l\'indexation des loyers ?',
    topK: 5
  }
}
```

### 3. `doc.fetch` - Récupération de document

Récupère le contenu textuel (OCR) d'un document.

**Exemple:**
```typescript
{
  id: 'doc.fetch',
  args: {
    documentId: 'doc-123',
    includeOcr: true
  }
}
```

### 4. `ocr.summarize` - Résumé de texte OCR

Analyse et structure un texte brut OCR.

### 5. `time.now` - Date/heure actuelles

Retourne la date et l'heure pour calculs de périodes.

### 6. `user.profile` - Profil utilisateur

Retourne les informations du profil utilisateur.

### 7. `util.math` - Calculatrice

Effectue des calculs mathématiques simples.

### 8. `sql.catalog` - Catalogue SQL

Retourne la liste des tables, vues, et exemples de requêtes.

---

## 📊 Vues analytiques

Vues PostgreSQL créées pour faciliter les requêtes fréquentes :

### `vw_cashflow_month`

Cashflow mensuel par bien et global.

**Colonnes:** `year`, `month`, `propertyId`, `property_name`, `loyers_encaisses`, `charges_payees`, `solde`

**Exemple:**
```sql
SELECT SUM(loyers_encaisses) 
FROM vw_cashflow_month 
WHERE year = 2024 AND month = 11;
```

### `vw_rent_due`

Loyers dus et impayés avec retard calculé.

**Colonnes:** `lease_id`, `tenant_name`, `tenant_email`, `expected_amount`, `paid_amount`, `balance_due`, `status`, `days_late`

**Exemple:**
```sql
SELECT tenant_name, balance_due, days_late 
FROM vw_rent_due 
WHERE status = 'DUE' 
ORDER BY balance_due DESC;
```

### `vw_loan_status`

Statut des prêts : CRD, mensualité, échéance.

**Colonnes:** `id`, `property_name`, `initial_principal`, `capital_remaining`, `monthly_payment_total`, `months_remaining`

**Exemple:**
```sql
SELECT SUM(capital_remaining) as total_debt 
FROM vw_loan_status 
WHERE "isActive" = true;
```

### `vw_indexations_upcoming`

Baux éligibles à indexation dans les 90 prochains jours.

**Colonnes:** `lease_id`, `property_name`, `tenant_name`, `current_rent`, `indexationType`, `next_anniversary`, `days_until_anniversary`

### `vw_docs_status`

Documents attendus vs reçus par mois et par type.

**Colonnes:** `year_month`, `doc_type_code`, `doc_type_label`, `docs_received`, `status`

---

## 🔒 Sécurité

### SQL

- ✅ **Validation AST** : Parse et vérifie la structure SQL
- ✅ **Lecture seule** : Seules les requêtes SELECT sont autorisées
- ✅ **LIMIT automatique** : 500 lignes max (configurable)
- ✅ **Timeout** : 5 secondes max par requête
- ✅ **Allowlist** : Tables et fonctions autorisées uniquement

### PII (Données personnelles)

- ✅ **Masquage automatique** : Emails et téléphones masqués dans les réponses
- ✅ **Logs anonymisés** : Aucune PII dans les logs
- ✅ **Hash** : Utilisation de hash pour identifiants sensibles

### Outils

- ✅ **Isolation** : Chaque outil s'exécute dans un contexte isolé
- ✅ **Validation** : Arguments validés avec Zod
- ✅ **Niveaux de sécurité** : `safe`, `read-only`, `restricted`

---

## 📈 Observabilité

### Tables de logs

#### `ai_chat_sessions`

Sessions de conversation.

**Colonnes:** `id`, `userId`, `contextJson`, `createdAt`, `lastActivity`, `metaJson`

#### `ai_messages`

Historique des messages.

**Colonnes:** `id`, `sessionId`, `role`, `content`, `toolCallsJson`, `tokensUsed`, `createdAt`, `correlationId`

#### `ai_tool_logs`

Logs d'exécution des outils.

**Colonnes:** `id`, `toolName`, `argsJson`, `resultJson`, `durationMs`, `ok`, `errorMessage`, `correlationId`

### Traces

Chaque requête a un `correlationId` unique pour traçabilité bout-en-bout.

**Exemple de trace:**
```
[Agent:abc-123] Démarrage pour: "Combien de baux actifs ?"
[Agent:abc-123] Itération 1/5
[Agent:abc-123] Pensée: Je dois compter les baux avec status actif
[Agent:abc-123] Outil choisi: sql.query
[Tool:sql.query] Exécution réussie (320ms)
[Agent:abc-123] Observation: 12 résultats trouvés
[Agent:abc-123] Synthèse de la réponse...
[Agent:abc-123] Terminé en 1820ms (2 itérations, 1250 tokens)
[Memory:abc-123] Conversation sauvegardée dans la session session-123
```

---

## 🔧 Développement

### Ajouter un nouvel outil

```typescript
// src/lib/ai/tools/my-tool.ts
import { z } from 'zod';
import { Tool } from './registry';

export const myCustomTool: Tool = {
  id: 'my.tool',
  name: 'Mon Outil',
  description: 'Fait quelque chose d\'utile',
  category: 'utility',
  safety: 'safe',
  inputSchema: z.object({
    param: z.string(),
  }),
  examples: ['Exemple d\'utilisation'],
  fn: async (args, context) => {
    // Implémentation
    return {
      ok: true,
      data: { result: 'OK' },
      citations: [],
    };
  },
};
```

Puis enregistrer dans `src/lib/ai/tools/implementations.ts` :

```typescript
export const allTools: Tool[] = [
  // ... outils existants
  myCustomTool,
];
```

### Ajouter une nouvelle vue analytique

```sql
-- prisma/migrations/add_my_view.sql
CREATE OR REPLACE VIEW vw_my_view AS
SELECT ...
FROM ...
WHERE ...;
```

Puis mettre à jour le validateur SQL :

```typescript
// src/lib/ai/sql/validator.ts
const ALLOWED_TABLES = new Set([
  // ... tables existantes
  'vw_my_view',
]);
```

### Tests

```bash
# Tests unitaires
npm run test

# Tests E2E
npm run test:e2e

# Tester l'agent directement
tsx scripts/test-agent.ts
```

Créer `scripts/test-agent.ts` :

```typescript
import { runReActAgent } from './src/lib/ai/agent/react';

const questions = [
  'Combien de baux actifs ?',
  'Loyers encaissés ce mois ?',
  'Liste des locataires en retard',
];

for (const question of questions) {
  console.log(`\n❓ ${question}`);
  const result = await runReActAgent(question);
  console.log(`✅ ${result.answer}`);
  console.log(`📊 Citations:`, result.citations.length);
}
```

---

## 📝 Exemples complets

### Exemple 1 : Baux actifs

**Question:** "Combien de baux actifs ?"

**Traitement:**
1. Agent pense : "Je dois compter les baux avec status actif"
2. Sélectionne l'outil `sql.query`
3. Génère la requête : `SELECT COUNT(*) FROM "Lease" WHERE status IN ('ACTIF', 'EN_COURS', 'SIGNE')`
4. Valide (OK)
5. Exécute (320ms)
6. Observe : 12 résultats
7. Répond : "Vous avez 12 baux actifs"

**Citations:**
- SQL: `SELECT COUNT(*) FROM "Lease" WHERE status IN ('ACTIF', 'EN_COURS', 'SIGNE')`

---

### Exemple 2 : Loyers encaissés

**Question:** "Loyers encaissés ce mois ?"

**Traitement:**
1. Agent utilise `time.now` pour obtenir mois/année
2. Sélectionne `sql.query`
3. Utilise la vue `vw_cashflow_month`
4. Requête : `SELECT SUM(loyers_encaisses) FROM vw_cashflow_month WHERE year = 2024 AND month = 11`
5. Répond : "Vous avez encaissé 4 500€ de loyers ce mois"

**Citations:**
- SQL: `SELECT SUM(loyers_encaisses) FROM vw_cashflow_month ...`
- Vue: `vw_cashflow_month`

---

### Exemple 3 : Comment créer un bail ?

**Question:** "Comment créer un bail ?"

**Traitement:**
1. Agent pense : "C'est une question procédurale, pas de données"
2. Sélectionne `kb.search`
3. Recherche sémantique : "créer bail"
4. Trouve 3 chunks pertinents dans la doc
5. Synthétise : "Pour créer un bail, allez dans Baux > Nouveau bail..."

**Citations:**
- KB: `docs/kb/guide_baux.md`
- Score: 0.87

---

## 🚧 Roadmap

### Phase 1 ✅ (Actuel)

- [x] Agent ReAct fonctionnel
- [x] 8 outils de base
- [x] Vues analytiques
- [x] SQL sécurisé
- [x] UI Compagnon

### Phase 2 (Prochainement)

- [ ] Few-shot dynamique (exemples auto-générés)
- [ ] Streaming complet avec WebSockets
- [ ] Support multi-tenant
- [ ] Amélioration génération SQL avec fine-tuning
- [ ] Materialized views pour performance

### Phase 3 (Futur)

- [ ] Multi-modal (images, graphiques)
- [ ] Agents spécialisés (fiscal, juridique, etc.)
- [ ] Auto-amélioration (feedback utilisateur)
- [ ] Version mobile (React Native)

---

## 📞 Support

Pour toute question ou problème :

1. Vérifier les logs : `docker-compose logs -f`
2. Vérifier la santé des services :
   - Ollama : `curl http://localhost:11434/api/health`
   - Qdrant : `curl http://localhost:6333/health`
   - PostgreSQL : `psql -U user -d smartimmo -c "SELECT 1"`
3. Consulter les logs de l'agent : `ai_tool_logs`, `ai_messages`

---

**Smartimmo AI Agent V3+ - Développé avec ❤️ et 🤖**


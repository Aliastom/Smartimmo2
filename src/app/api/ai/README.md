# API IA - Compagnon Smartimmo

Documentation des endpoints IA/RAG pour le compagnon intelligent de Smartimmo.

---

## 📚 Vue d'ensemble

Le système IA repose sur :
- **Mistral 7B** via Ollama (local) pour la génération de texte
- **Qdrant** (vector database) pour la recherche sémantique (RAG)
- **Transformers.js** pour les embeddings (bge-small-en ou all-MiniLM-L6-v2)

---

## 🔐 Sécurité

### Rate Limiting
- **60 requêtes/minute** par IP (configurable via `AI_RATE_LIMIT_RPM`)
- Headers de réponse :
  - `X-RateLimit-Remaining` : requêtes restantes
  - `X-RateLimit-Reset` : date de réinitialisation

### Timeouts
- **30 secondes** max par requête (configurable via `AI_TIMEOUT_MS`)
- Abandon automatique si dépassement

### Validation des inputs
- Longueur max : 500 caractères pour les queries
- Détection PII basique (emails, téléphones) pour logs
- Nettoyage HTML/scripts

---

## 🛠️ Endpoints

### 1. `/api/ai/search` - Recherche sémantique

Recherche dans la base de connaissances (RAG).

**Méthode** : `POST` ou `GET`

**Request (POST)** :
```json
{
  "query": "Comment créer un bail ?",
  "topK": 5,           // Optionnel (défaut: 5, max: 20)
  "tags": ["baux"]     // Optionnel (filtre par tags)
}
```

**Request (GET)** :
```
GET /api/ai/search?query=Comment+créer+un+bail&topK=3
```

**Response** :
```json
{
  "chunks": [
    {
      "id": "chunk-1",
      "text": "Pour créer un bail...",
      "score": 0.92,
      "source": "guide_baux.md",
      "tags": ["baux", "creation"]
    }
  ],
  "query": "Comment créer un bail ?",
  "count": 5
}
```

**Codes d'erreur** :
- `400` : Requête invalide
- `429` : Rate limit dépassé
- `500` : Erreur serveur

---

### 2. `/api/ai/chat` - Chat conversationnel (streaming)

Chat avec Mistral via Ollama, avec contexte RAG automatique.

**Méthode** : `POST`

**Request** :
```json
{
  "query": "Comment indexer un loyer ?",
  "context": [          // Optionnel (sinon RAG auto)
    {
      "text": "L'IRL est publié par l'INSEE..."
    }
  ],
  "mode": "normal"      // Optionnel : "normal" | "strict"
}
```

**Modes** :
- `normal` : Assistant peut extrapoler légèrement
- `strict` : Répond UNIQUEMENT avec le contexte fourni

**Response (SSE stream)** :

Format Server-Sent Events (text/event-stream) :

```
data: {"type":"chunk","content":"Pour indexer","done":false}

data: {"type":"chunk","content":" un loyer","done":false}

data: {"type":"done","content":"","done":true,"usedChunks":[...]}
```

**Types de messages** :
- `chunk` : Fragment de texte
- `done` : Fin de stream (avec `usedChunks`)
- `error` : Erreur lors de la génération

**Codes d'erreur** :
- `400` : Requête invalide
- `429` : Rate limit dépassé
- `500` : Erreur serveur

---

## ⚙️ Variables d'environnement

### Obligatoires

```bash
# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=smartimmo_kb

# Mistral via Ollama
MISTRAL_BASE_URL=http://localhost:11434
MISTRAL_MODEL=mistral
```

### Optionnelles

```bash
# Embeddings
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
EMBEDDING_DIMENSION=384

# Sécurité & limites
AI_MAX_TOKENS=1024
AI_TIMEOUT_MS=30000
AI_RATE_LIMIT_RPM=60

# Redis (pour rate-limiting distribué)
REDIS_URL=redis://localhost:6379
```

---

## 📊 Métriques & Logs

Les endpoints loggent automatiquement :
- Nombre de chunks récupérés (scores)
- Temps de réponse
- Erreurs éventuelles
- PII détectée (warning)

**Format des logs** :
```
[RAG] Récupération du contexte pour: "Comment créer..."
[RAG] 5 chunks récupérés (scores: 0.920, 0.875, 0.832, 0.801, 0.765)
```

---

## 🧪 Tests

### Healthcheck Ollama

```bash
curl http://localhost:11434/api/tags
```

### Healthcheck Qdrant

```bash
curl http://localhost:6333/collections
```

### Test /api/ai/search

```bash
curl -X POST http://localhost:3000/api/ai/search \
  -H "Content-Type: application/json" \
  -d '{"query":"bail","topK":3}'
```

### Test /api/ai/chat (streaming)

```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -N \
  -d '{"query":"Qu'\''est-ce qu'\''un bail ?"}'
```

---

## 🚨 Dépannage

### Erreur "Ollama API error: 404"
→ Vérifier que Ollama est lancé et que le modèle `mistral` est installé :
```bash
ollama pull mistral
ollama serve
```

### Erreur "Qdrant connection failed"
→ Vérifier que Qdrant est lancé (Docker) :
```bash
docker-compose up -d qdrant
```

### Pas de résultats de recherche
→ La base de connaissances est vide. Lancer l'ingestion :
```bash
npm run ingest:kb
```

### Timeout lors du chat
→ Augmenter `AI_TIMEOUT_MS` dans `.env` (ex: 60000 pour 60s)

---

## 📖 Architecture

```
Client (UI)
    ↓
/api/ai/chat
    ↓
┌─────────────────────────────────────┐
│  Guards                             │
│  - Rate Limit (60 req/min)         │
│  - Safe Input (sanitize, PII)      │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  RAG Retrieve                       │
│  - Query → Embedding (Transformers) │
│  - Search Qdrant (top-5)            │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Prompt Builder                     │
│  - System (identité IA)             │
│  - Context (chunks RAG)             │
│  - User (question)                  │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Mistral Client (Ollama)            │
│  - Stream generation                │
│  - Timeout (30s)                    │
└─────────────────────────────────────┘
    ↓
SSE Stream → Client
```

---

## 🔗 Liens utiles

- [Ollama Docs](https://ollama.ai/docs)
- [Qdrant Docs](https://qdrant.tech/documentation/)
- [Transformers.js](https://huggingface.co/docs/transformers.js)

---

**Version** : PR #1 - MVP
**Dernière mise à jour** : 2025-11-03


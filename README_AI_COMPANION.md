# 🤖 Compagnon IA - Smartimmo

Système d'intelligence artificielle conversationnelle pour l'application Smartimmo, basé sur **Mistral 7B** (local via Ollama) et **RAG** (Retrieval-Augmented Generation) avec Qdrant.

---

## 🎯 Objectif

Fournir une assistance contextuelle aux utilisateurs de Smartimmo pour :
- Répondre aux questions sur la gestion immobilière
- Guider dans l'utilisation de l'application
- Proposer des actions rapides selon le contexte
- Accélérer les workflows métier

---

## ✨ Fonctionnalités

### **MVP (Version 1.0)** ✅

- ✅ **Chat conversationnel** avec streaming en temps réel
- ✅ **RAG (Retrieval-Augmented Generation)** : réponses basées sur la base de connaissances
- ✅ **Base de connaissances** : 4 guides (~48 chunks indexés)
- ✅ **Actions contextuelles** : 3 actions max selon la page (baux, transactions, dashboard)
- ✅ **Interface intuitive** : bouton flottant + panneau latéral (Drawer)
- ✅ **Sécurité** : rate-limiting (60 req/min), timeout (30s), validation des inputs
- ✅ **100% local** : pas de cloud, données privées

### **Roadmap (Post-MVP)**

- [ ] Historique des conversations
- [ ] Détection automatique du contexte (entité sélectionnée, filtres actifs)
- [ ] Suggestions intelligentes de questions
- [ ] Input vocal + synthèse vocale
- [ ] Multi-langue (FR, EN)
- [ ] Analytics (questions fréquentes, amélioration KB)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│  Frontend (UI)                          │
│  - Bouton flottant (React + Framer)    │
│  - Drawer shadcn/ui (panneau latéral)  │
│  - Chat (streaming SSE)                 │
│  - Actions contextuelles (3 max)       │
└─────────────────────────────────────────┘
                  ↓ HTTP/SSE
┌─────────────────────────────────────────┐
│  Backend (Next.js API Routes)           │
│  - /api/ai/search (recherche RAG)       │
│  - /api/ai/chat (chat streaming)        │
│  - Guards (rate-limit, timeout, input)  │
└─────────────────────────────────────────┘
                  ↓
┌──────────────────┬──────────────────────┐
│  RAG System      │  LLM (Mistral 7B)    │
│  - Qdrant        │  - Ollama (local)    │
│  - Embeddings    │  - Streaming SSE     │
│  - Top-K (5)     │  - Max 1024 tokens   │
└──────────────────┴──────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Base de Connaissances (KB)             │
│  - docs/kb/*.md (4 documents)           │
│  - Chunking (800 chars, overlap 200)    │
│  - Embeddings bge-small-en (384 dim)    │
└─────────────────────────────────────────┘
```

---

## 🚀 Quick Start

Voir [QUICK_START.md](QUICK_START.md) pour le démarrage rapide (5 minutes).

### **Résumé ultra-rapide**

```bash
# 1. Services
docker-compose up -d
ollama serve && ollama pull mistral

# 2. Variables ENV (.env.local)
# (Voir SETUP_ENV.md)

# 3. Ingestion
npm run ingest:kb

# 4. Lancer
npm run dev
```

---

## 📚 Base de connaissances

### **Documents actuels** (docs/kb/)

| Fichier | Sujet | Lignes | Chunks |
|---------|-------|--------|--------|
| `guide_baux.md` | Baux, IRL, quittances | 340 | ~12 |
| `guide_transactions.md` | Transactions, rapprochement | 280 | ~10 |
| `glossaire_fiscal.md` | Définitions fiscales | 220 | ~15 |
| `onboarding.md` | Guide de démarrage | 320 | ~11 |

**Total** : ~1,160 lignes, ~48 chunks indexés dans Qdrant.

### **Ajouter de nouveaux documents**

1. Créer un fichier `.md` dans `docs/kb/`
2. Structurer avec des headings (`##`, `###`)
3. Lancer `npm run ingest:kb`

Voir [docs/USAGE.md](docs/USAGE.md) pour les bonnes pratiques de rédaction.

---

## 🔧 Configuration

### **Variables d'environnement (.env.local)**

```bash
# Qdrant (Vector Database)
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=smartimmo_kb

# Embeddings
EMBEDDING_MODEL=bge-small-en
EMBEDDING_DIMENSION=384

# Mistral via Ollama
MISTRAL_BASE_URL=http://localhost:11434
MISTRAL_MODEL=mistral

# Limites
AI_MAX_TOKENS=1024
AI_TIMEOUT_MS=30000
AI_RATE_LIMIT_RPM=60
```

Voir [SETUP_ENV.md](SETUP_ENV.md) pour la configuration complète.

---

## 🧪 Tests

### **Validation complète**

Voir [AI_VALIDATION_TESTS.md](AI_VALIDATION_TESTS.md) pour tous les tests.

### **Tests rapides**

```bash
# API search
curl -X POST http://localhost:3000/api/ai/search \
  -H "Content-Type: application/json" \
  -d '{"query":"loyer","topK":3}'

# API chat
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" -N \
  -d '{"query":"Qu'\''est-ce que l'\''IRL ?"}'

# UI
# 1. Ouvrir http://localhost:3000
# 2. Cliquer sur le bouton flottant (bottom-right)
# 3. Poser : "Qu'est-ce que l'IRL ?"
```

---

## 📊 Métriques

### **Performance**

| Métrique | Valeur | Cible |
|----------|--------|-------|
| Temps de réponse (search) | ~200ms | < 500ms |
| Temps de réponse (chat) | ~3s | < 5s |
| Latence première chunk | ~500ms | < 1s |
| Chunks par recherche | 5 | 3-10 |
| Score min pertinence | 0.7 | > 0.6 |

### **Capacité**

| Métrique | Valeur actuelle | Limite |
|----------|-----------------|--------|
| Documents KB | 4 | Illimité |
| Chunks totaux | ~48 | > 10k |
| Tokens max/réponse | 1024 | Configurable |
| Requêtes/min | 60 | Configurable |

---

## 🔒 Sécurité

### **Implémenté**

- ✅ **Rate limiting** : 60 requêtes/minute par IP
- ✅ **Timeout** : 30 secondes max par requête
- ✅ **Validation inputs** : longueur max, strip HTML
- ✅ **Détection PII** : emails, téléphones (logs only)
- ✅ **Variables ENV** : `.env.local` ignoré par git

### **Recommandations Production**

- [ ] Authentification utilisateur (rate limit par user, pas IP)
- [ ] HTTPS obligatoire (TLS 1.3)
- [ ] Monitoring (Sentry, Datadog)
- [ ] Logs anonymisés (pas de PII)
- [ ] Backup Qdrant (vector DB)
- [ ] WAF (Web Application Firewall)

---

## 🛠️ Stack technique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| **LLM** | Mistral 7B | Latest |
| **Embeddings** | bge-small-en-v1.5 | 384 dim |
| **Vector DB** | Qdrant | Latest |
| **Orchestration** | Ollama | Latest |
| **Framework** | Next.js | 14.2+ |
| **UI** | shadcn/ui + Tailwind | - |
| **Animations** | Framer Motion | 12.23+ |
| **Client IA** | Transformers.js | 2.17+ |

---

## 📖 Documentation

| Fichier | Description |
|---------|-------------|
| [QUICK_START.md](QUICK_START.md) | Démarrage rapide (5 min) |
| [SETUP_ENV.md](SETUP_ENV.md) | Configuration variables ENV |
| [AI_VALIDATION_TESTS.md](AI_VALIDATION_TESTS.md) | Tests de validation |
| [docs/USAGE.md](docs/USAGE.md) | Guide rédaction KB |
| [src/app/api/ai/README.md](src/app/api/ai/README.md) | Doc API endpoints |
| [AI_IMPLEMENTATION_COMPLETE.md](AI_IMPLEMENTATION_COMPLETE.md) | Récapitulatif complet |

---

## 🤝 Contribution

### **Ajouter du contenu à la KB**

1. Créer un fichier `.md` dans `docs/kb/`
2. Respecter les [bonnes pratiques](docs/USAGE.md)
3. Lancer `npm run kb:rebuild`

### **Améliorer les prompts**

Modifier `src/lib/ai/rag/prompt.ts` :
- `buildSystemPrompt()` : identité de l'assistant
- `formatContext()` : formatage du contexte

### **Ajouter des actions contextuelles**

Modifier `src/ui/companion/CompanionActions.tsx` :
- Fonction `getActionsForRoute(route)` : ajouter vos routes

---

## 🐛 Dépannage

### **Ollama ne répond pas**

```bash
# Vérifier le service
curl http://localhost:11434/api/tags

# Redémarrer
ollama serve
```

### **Qdrant inaccessible**

```bash
# Vérifier Docker
docker ps

# Redémarrer
docker-compose restart qdrant
```

### **Chat ne stream pas**

Vérifier les headers de réponse :
- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`

### **Scores de recherche faibles (<0.5)**

- Réingérer la KB : `npm run kb:rebuild`
- Vérifier que les documents contiennent bien le sujet
- Tester avec des mots-clés exacts

---

## 📞 Support

- **Documentation** : Voir les fichiers `.md` à la racine
- **Issues** : Créer une issue GitHub
- **Email** : tech@smartimmo.fr (fictif pour exemple)

---

## 📄 Licence

Propriétaire - Smartimmo © 2025

---

## 🎉 Remerciements

- **Mistral AI** pour le modèle Mistral 7B
- **Ollama** pour l'orchestration locale
- **Qdrant** pour la vector database
- **Hugging Face** pour Transformers.js
- **shadcn/ui** pour les composants React

---

**🚀 Développé avec ❤️ par l'équipe Smartimmo**

**Version** : 1.0.0 - MVP  
**Dernière mise à jour** : 2025-11-03


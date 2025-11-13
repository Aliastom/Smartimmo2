# 🔧 Configuration des Variables d'Environnement

Guide pour configurer les variables d'environnement de Smartimmo (incluant le compagnon IA).

---

## 📝 **Créer le fichier `.env.local`**

À la **racine du projet** (`D:\Smartimmo2\`), créez un fichier nommé **`.env.local`** avec ce contenu :

```bash
# ==============================================
# Database (PostgreSQL via Docker)
# ==============================================
DATABASE_URL=postgresql://smartimmo:smartimmo@localhost:5432/smartimmo?schema=public

# ==============================================
# NextAuth (si configuré)
# ==============================================
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# ==============================================
# IA / RAG - Compagnon IA
# ==============================================

# Activation de l'assistant IA (par défaut: activé)
# Pour désactiver complètement le robot IA, décommenter :
# NEXT_PUBLIC_AI_ENABLED=false

# Animations du robot IA (par défaut: activé)
# Pour désactiver les animations SVG (recommandé si erreurs console), décommenter :
# NEXT_PUBLIC_AI_ANIMATIONS=false

# Mode de l'agent IA (par défaut: react)
# Options: 'legacy' (RAG simple) ou 'react' (agent autonome)
# NEXT_PUBLIC_AI_MODE=react

# Qdrant (Vector Database)
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
QDRANT_COLLECTION=smartimmo_kb

# Embeddings
EMBEDDING_MODEL=bge-small-en
EMBEDDING_DIMENSION=384

# Mistral via Ollama
MISTRAL_BASE_URL=http://localhost:11434
MISTRAL_MODEL=mistral

# Sécurité et limites
AI_MAX_TOKENS=1024
AI_TIMEOUT_MS=30000
AI_RATE_LIMIT_RPM=60

# Redis (optionnel, pour rate-limiting distribué)
# REDIS_URL=redis://localhost:6379

# Mode développement
NODE_ENV=development
```

---

## ✅ **Vérifier la configuration**

Une fois le fichier créé, lancez le script de vérification :

```bash
npm run check:env
```

**Résultat attendu** :
```
🔍 Vérification des variables d'environnement
============================================================

✅ Variables OBLIGATOIRES :

   ✓ DATABASE_URL = postgresql://***:***@localhost:5432/smartimmo
   ✓ QDRANT_URL = http://localhost:6333
   ✓ QDRANT_COLLECTION = smartimmo_kb
   ✓ EMBEDDING_MODEL = bge-small-en
   ✓ EMBEDDING_DIMENSION = 384
   ✓ MISTRAL_BASE_URL = http://localhost:11434
   ✓ MISTRAL_MODEL = mistral
   ✓ AI_MAX_TOKENS = 1024
   ✓ AI_TIMEOUT_MS = 30000
   ✓ AI_RATE_LIMIT_RPM = 60

📋 Variables OPTIONNELLES :

   ○ QDRANT_API_KEY = (vide, c'est OK)
   ○ REDIS_URL = (vide, c'est OK)

============================================================

✅ Toutes les variables obligatoires sont définies !
```

---

## 🗂️ **Types de fichiers `.env`**

| Fichier | Usage | Git |
|---------|-------|-----|
| **`.env.local`** | Valeurs locales (recommandé) | ❌ Ignoré |
| `.env.development` | Valeurs dev (partagées) | ✅ Commité |
| `.env.production` | Valeurs prod | ✅ Commité |
| `.env` | Valeurs par défaut | ✅ Commité |

**💡 Conseil** : Utilisez **`.env.local`** pour vos valeurs spécifiques (URLs locales, clés API personnelles).

---

## 🔍 **Où Next.js charge les variables ?**

Next.js charge automatiquement les fichiers `.env*` dans cet ordre (du plus prioritaire au moins prioritaire) :

1. **`.env.local`** ← Vos valeurs locales (priorité max)
2. `.env.development` (si `npm run dev`)
3. `.env.production` (si `npm run build`)
4. `.env` (valeurs par défaut)

**Important** : Redémarrez `npm run dev` après avoir modifié un fichier `.env*`.

---

## 🔐 **Sécurité**

### Fichiers à NE JAMAIS commiter dans Git

- ✅ `.env.local` → **Déjà dans `.gitignore`**
- ✅ `.env*.local` → **Déjà dans `.gitignore`**

### Valeurs sensibles

Ces valeurs ne doivent **jamais** être commitées :
- `DATABASE_URL` avec credentials
- `NEXTAUTH_SECRET`
- `QDRANT_API_KEY` (si utilisé)
- `REDIS_URL` (si utilisé)

---

## 📋 **Description des variables IA**

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `NEXT_PUBLIC_AI_ENABLED` | Active/désactive l'assistant IA | `true` (activé) |
| `NEXT_PUBLIC_AI_ANIMATIONS` | Active/désactive les animations du robot | `true` (activé) |
| `NEXT_PUBLIC_AI_MODE` | Mode de l'agent (`legacy` ou `react`) | `react` |
| `QDRANT_URL` | URL de Qdrant (vector DB) | `http://localhost:6333` |
| `QDRANT_API_KEY` | Clé API Qdrant (optionnel pour local) | _(vide)_ |
| `QDRANT_COLLECTION` | Nom de la collection | `smartimmo_kb` |
| `EMBEDDING_MODEL` | Modèle d'embedding (Transformers.js) | `bge-small-en` |
| `EMBEDDING_DIMENSION` | Dimension des vecteurs | `384` (bge-small-en) |
| `MISTRAL_BASE_URL` | URL d'Ollama | `http://localhost:11434` |
| `MISTRAL_MODEL` | Modèle Mistral à utiliser | `mistral` |
| `AI_MAX_TOKENS` | Tokens max dans les réponses | `1024` |
| `AI_TIMEOUT_MS` | Timeout des requêtes IA (ms) | `30000` (30s) |
| `AI_RATE_LIMIT_RPM` | Rate limit (req/min) | `60` |
| `REDIS_URL` | URL Redis (optionnel) | _(vide)_ |

---

## 🐛 **Dépannage**

### Erreur "Variable XXX is not defined"

**Cause** : Le fichier `.env.local` n'existe pas ou la variable manque.

**Solution** :
1. Vérifier que le fichier `.env.local` existe à la racine
2. Vérifier qu'il contient la variable
3. Redémarrer `npm run dev`

### Les variables ne sont pas chargées

**Cause** : Next.js n'a pas redémarré après modification.

**Solution** :
```bash
# Arrêter Next.js (Ctrl+C)
# Relancer
npm run dev
```

### Erreur "QDRANT_URL is not defined" lors de l'ingestion

**Cause** : Le script `ingest_kb.ts` utilise `process.env` mais Next.js ne charge pas automatiquement les variables pour les scripts.

**Solution** : Les scripts TypeScript chargent automatiquement les variables depuis `.env.local` grâce à `dotenv`. Si ça ne marche pas, utilisez :

```bash
# Option 1 : Passer la variable manuellement
QDRANT_URL=http://localhost:6333 npm run ingest:kb

# Option 2 : Charger dotenv explicitement (déjà fait dans les scripts)
```

---

## 🚀 **Workflow complet**

1. **Créer `.env.local`** à la racine avec les valeurs ci-dessus
2. **Vérifier** : `npm run check:env`
3. **Démarrer les services** :
   ```bash
   # Postgres + Qdrant
   docker-compose up -d
   
   # Ollama (dans un autre terminal)
   ollama serve
   ```
4. **Démarrer Next.js** :
   ```bash
   npm run dev
   ```
5. **Ingérer la KB** :
   ```bash
   npm run ingest:kb
   ```

---

## 📖 Ressources

- [Next.js - Variables d'environnement](https://nextjs.org/docs/basic-features/environment-variables)
- [Qdrant Docs](https://qdrant.tech/documentation/)
- [Ollama Docs](https://ollama.ai/docs)

---

**Version** : 1.0  
**Dernière mise à jour** : 2025-11-03


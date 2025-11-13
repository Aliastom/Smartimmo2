# 🔧 Fix : Nom du modèle d'embedding

## ❌ Problème

Erreur : `Unauthorized access to file: "https://huggingface.co/bge-small-en/resolve/main/tokenizer.json"`

**Cause** : Le nom du modèle `bge-small-en` est incorrect.

---

## ✅ Solution

### 1. Modifier `.env.local`

Ouvrez votre fichier `.env.local` à la racine et changez :

```bash
# AVANT (incorrect)
EMBEDDING_MODEL=bge-small-en

# APRÈS (correct)
EMBEDDING_MODEL=Xenova/bge-small-en-v1.5
```

### 2. Redémarrer le serveur

```bash
# Ctrl+C pour arrêter
npm run dev
```

---

## 📝 Votre .env.local devrait contenir :

```bash
# Database
DATABASE_URL=postgresql://smartimmo:smartimmo@localhost:5432/smartimmo?schema=public

# NextAuth
NEXTAUTH_SECRET=L@utho02
NEXTAUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Test credentials
ALLOW_TEST_CREDENTIALS=true
PASSWORD_TEST=changeme

# Resend (email)
RESEND_API_KEY=...
RESEND_FROM_EMAIL=...

# IA / RAG
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
QDRANT_COLLECTION=smartimmo_kb

EMBEDDING_MODEL=Xenova/bge-small-en-v1.5   ← Correction ici
EMBEDDING_DIMENSION=384

MISTRAL_BASE_URL=http://localhost:11434
MISTRAL_MODEL=mistral

AI_MAX_TOKENS=1024
AI_TIMEOUT_MS=30000
AI_RATE_LIMIT_RPM=60
```

---

## 🧪 Test après correction

1. Redémarrer le serveur : `npm run dev`
2. Cliquer sur le bouton du compagnon
3. Envoyer "Salut"

**Premier chargement** : Le modèle va se télécharger (~50 MB), ça peut prendre 30-60 secondes.

**Logs attendus** :
```
[RAG] Chargement du modèle: Xenova/bge-small-en-v1.5
[RAG] ⏳ Première utilisation peut prendre 30-60s...
[RAG] ✅ Modèle chargé en XX.Xs
```

---

## 🎯 Modèles disponibles

| Modèle | Dimension | Taille | Performance |
|--------|-----------|--------|-------------|
| `Xenova/bge-small-en-v1.5` | 384 | ~50 MB | ⭐⭐⭐ (Recommandé) |
| `Xenova/all-MiniLM-L6-v2` | 384 | ~23 MB | ⭐⭐ (Plus rapide) |
| `Xenova/bge-base-en-v1.5` | 768 | ~120 MB | ⭐⭐⭐⭐ (Meilleur, plus lent) |

**Conseil** : Restez sur `Xenova/bge-small-en-v1.5` pour le MVP (bon compromis qualité/vitesse).

---

**Important** : Si vous changez de modèle, pensez à changer aussi `EMBEDDING_DIMENSION` et **réingérer la KB** :
```bash
npm run kb:rebuild
```


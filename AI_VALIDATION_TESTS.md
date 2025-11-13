# 🧪 Tests de Validation - Compagnon IA Smartimmo

Guide pour valider les PR #1 et #2.

---

## Prérequis

### 1. Services Docker

```bash
# Démarrer Postgres + Qdrant
docker-compose up -d

# Vérifier les services
docker ps
```

**Services attendus** :
- `smartimmo-postgres` (port 5432)
- `qdrant` (port 6333)

### 2. Ollama

```bash
# Vérifier que Ollama est lancé
curl http://localhost:11434/api/tags

# Si pas de réponse, démarrer Ollama
ollama serve

# Vérifier que le modèle mistral est installé
ollama pull mistral
```

### 3. Dépendances npm

```bash
npm install
```

---

## ✅ PR #1 - Validation API + Clients

### Test 1 : Health check Qdrant

```bash
curl http://localhost:6333/collections
```

**Réponse attendue** :
```json
{
  "collections": []
}
```
(Vide car pas encore ingéré)

### Test 2 : Health check Ollama

```bash
curl http://localhost:11434/api/tags
```

**Réponse attendue** :
```json
{
  "models": [
    {
      "name": "mistral:latest",
      "modified_at": "...",
      "size": 4109865159
    }
  ]
}
```

### Test 3 : Démarrer Next.js

```bash
npm run dev
```

**Logs attendus** :
```
ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

### Test 4 : API /ai/search (sans données)

```bash
curl -X POST http://localhost:3000/api/ai/search \
  -H "Content-Type: application/json" \
  -d '{"query":"test","topK":3}'
```

**Réponse attendue** :
```json
{
  "chunks": [],
  "query": "test",
  "count": 0
}
```
✅ Normal, la KB n'est pas encore ingérée.

### Test 5 : API /ai/chat (sans contexte)

```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -N \
  -d '{"query":"Bonjour"}'
```

**Réponse attendue** : Stream SSE avec réponse de Mistral
```
data: {"type":"chunk","content":"Bonjour","done":false}

data: {"type":"chunk","content":" ! Comment","done":false}

...

data: {"type":"done","content":"","done":true,"usedChunks":[]}
```

✅ **PR #1 validée** si tous les tests passent.

---

## ✅ PR #2 - Validation Ingestion + KB

### Test 1 : Vérifier les fichiers KB

```bash
ls -lh docs/kb/
```

**Fichiers attendus** :
- `guide_baux.md`
- `guide_transactions.md`
- `glossaire_fiscal.md`
- `onboarding.md`

### Test 2 : Ingestion complète

```bash
npm run ingest:kb
```

**Logs attendus** (extrait) :
```
🚀 Smartimmo - Ingestion de la base de connaissances
============================================================

📋 Vérification des prérequis...
   [Embedder] 🔄 Chargement du modèle: Xenova/bge-small-en-v1.5
   [Embedder] ⏳ Première utilisation peut prendre 30-60s...
   [Embedder] ✅ Modèle chargé en XX.Xs
   ✅ Modèle d'embedding OK

📄 Lecture des fichiers markdown...
   📁 4 fichier(s) markdown trouvé(s)
   ✓ docs/kb/guide_baux.md: XX chunk(s)
   ✓ docs/kb/guide_transactions.md: XX chunk(s)
   ✓ docs/kb/glossaire_fiscal.md: XX chunk(s)
   ✓ docs/kb/onboarding.md: XX chunk(s)

📊 Statistiques de chunking:
   - Fichiers traités: 4
   - Chunks générés: ~48
   - Taille moyenne: ~650 caractères

🔢 Génération des embeddings...
   🔄 Progression: 48/48 (100%)

📤 Envoi vers Qdrant...
   [Qdrant] Collection "smartimmo_kb" créée (dimension: 384)
   [Qdrant] 48 points upsertés dans "smartimmo_kb"

✅ Ingestion terminée !
   - Total de points dans Qdrant: 48
   - Durée: XX.Xs
```

✅ Pas d'erreur, tous les chunks ingérés.

### Test 3 : Vérifier Qdrant

```bash
curl http://localhost:6333/collections
```

**Réponse attendue** :
```json
{
  "collections": [
    {
      "name": "smartimmo_kb",
      "vectors_count": 48
    }
  ]
}
```

### Test 4 : Recherche "loyer"

```bash
curl -X POST http://localhost:3000/api/ai/search \
  -H "Content-Type: application/json" \
  -d '{"query":"loyer","topK":3}'
```

**Réponse attendue** :
```json
{
  "chunks": [
    {
      "id": "guide_baux-X",
      "text": "## Indexation du loyer (IRL)...",
      "score": 0.85,
      "source": "guide_baux.md",
      "tags": ["baux", "bail", "location"]
    },
    {
      "id": "guide_baux-Y",
      "text": "## Quittances de loyer...",
      "score": 0.78,
      "source": "guide_baux.md",
      "tags": ["baux", "bail", "location"]
    },
    {
      "id": "glossaire_fiscal-Z",
      "text": "### Quittance de loyer...",
      "score": 0.72,
      "source": "glossaire_fiscal.md",
      "tags": ["fiscal", "impôts", "glossaire"]
    }
  ],
  "query": "loyer",
  "count": 3
}
```

✅ **Validation** :
- 3 chunks retournés
- Scores > 0.7
- Sources pertinentes (guide_baux, glossaire_fiscal)

### Test 5 : Recherche "quittance"

```bash
curl -X POST http://localhost:3000/api/ai/search \
  -H "Content-Type: application/json" \
  -d '{"query":"quittance","topK":3}'
```

**Validation** :
- Chunks sur les quittances de loyer
- Scores > 0.7

### Test 6 : Question complète (RAG)

```bash
curl -X POST http://localhost:3000/api/ai/search \
  -H "Content-Type: application/json" \
  -d '{"query":"Comment créer un bail dans Smartimmo ?","topK":5}'
```

**Validation** :
- Chunks du guide_baux et/ou onboarding
- Contiennent les étapes de création de bail

### Test 7 : Chat avec RAG

```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -N \
  -d '{"query":"Qu'\''est-ce que l'\''IRL ?"}'
```

**Réponse attendue** (stream) :
```
data: {"type":"chunk","content":"L'IRL","done":false}

data: {"type":"chunk","content":" (Indice de Référence des Loyers)","done":false}

data: {"type":"chunk","content":" est un indice publié...","done":false}

...

data: {"type":"done","content":"","done":true,"usedChunks":[...]}
```

✅ **Validation** :
- Réponse cohérente sur l'IRL
- Utilise les chunks de la KB (vérifier `usedChunks` dans le message final)
- Mentionne l'INSEE, la formule, etc.

### Test 8 : Chat question complexe

```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -N \
  -d '{"query":"Comment faire une régularisation de charges dans Smartimmo ?"}'
```

**Validation** :
- Réponse détaillée sur la régularisation
- Mentionne la création d'une transaction
- Cite les sources (guide_baux ou guide_transactions)

### Test 9 : Truncate

```bash
npm run kb:truncate
```

**Logs attendus** :
```
⚠️  Mode TRUNCATE - Suppression de la collection "smartimmo_kb"
   Cette opération est irréversible !

✅ Collection "smartimmo_kb" supprimée avec succès
```

Vérifier :
```bash
curl http://localhost:6333/collections
```
✅ `collections: []` (vide)

### Test 10 : Rebuild

```bash
npm run kb:rebuild
```

**Logs attendus** :
```
[Truncate logs]
[Ingestion logs]
✅ Ingestion terminée !
```

Vérifier :
```bash
curl http://localhost:6333/collections
```
✅ Collection recréée avec ~48 points.

✅ **PR #2 validée** si tous les tests passent.

---

## 🎯 Checklist finale

### PR #1 : API + Clients
- [ ] Qdrant accessible (port 6333)
- [ ] Ollama accessible (port 11434) avec modèle `mistral`
- [ ] Next.js démarre sans erreur
- [ ] `/api/ai/search` répond (même vide)
- [ ] `/api/ai/chat` stream fonctionne
- [ ] Rate limit fonctionne (tester 70 requêtes en 1 min → 429)
- [ ] Timeout fonctionne (requête > 30s → erreur)

### PR #2 : Ingestion + KB
- [ ] 4 fichiers KB créés dans `docs/kb/`
- [ ] `npm run ingest:kb` fonctionne sans erreur
- [ ] ~48 chunks générés
- [ ] Collection Qdrant créée (384 dimensions)
- [ ] Recherche "loyer" retourne des chunks pertinents (score > 0.7)
- [ ] Recherche "quittance" retourne des chunks pertinents
- [ ] Chat avec RAG répond correctement sur l'IRL
- [ ] `npm run kb:truncate` supprime la collection
- [ ] `npm run kb:rebuild` reconstruit la KB

---

## 🐛 Dépannage

### Erreur "Ollama API error: 404"
**Solution** :
```bash
ollama pull mistral
ollama serve
```

### Erreur "Qdrant connection failed"
**Solution** :
```bash
docker-compose up -d qdrant
curl http://localhost:6333/collections
```

### Ingestion bloquée sur "Chargement du modèle"
**Raison** : Première utilisation de Transformers.js (télécharge le modèle ~100 MB).
**Solution** : Patienter 30-60s. Les prochaines utilisations seront instantanées.

### Scores de recherche trop faibles (<0.5)
**Raison** : Query trop vague ou chunks pas assez pertinents.
**Solution** : 
- Tester avec des mots-clés exacts du document
- Vérifier que la KB est bien ingérée
- Relancer `npm run kb:rebuild`

### Chat ne répond pas
**Raison** : Mistral (Ollama) pas démarré ou erreur de timeout.
**Solution** :
```bash
ollama serve
# Dans un autre terminal
curl http://localhost:11434/api/tags
```

---

## 📊 Métriques de succès

| Métrique | Valeur attendue | Validation |
|----------|----------------|------------|
| Fichiers KB | 4 | ✅ |
| Chunks générés | ~48 | ✅ |
| Collection Qdrant | 1 (smartimmo_kb) | ✅ |
| Points Qdrant | ~48 | ✅ |
| Dimension vecteurs | 384 | ✅ |
| Score recherche "loyer" | > 0.7 | ✅ |
| Score recherche "quittance" | > 0.7 | ✅ |
| Chat répond IRL | Oui | ✅ |
| Temps ingestion | < 120s | ✅ |

---

**🎉 Si tous les tests passent, PR #1 et #2 sont validées ! Prêt pour PR #3.**


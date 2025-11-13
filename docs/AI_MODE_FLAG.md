# Système de Flag AI_MODE

## 📋 Vue d'ensemble

Smartimmo supporte maintenant **deux modes d'agent IA** :

1. **Mode Legacy** (`legacy`) : RAG simple (ancien système)
2. **Mode ReAct** (`react`) : Agent autonome avec outils (SQL + RAG + OCR + Actions)

Le mode est contrôlé par la variable d'environnement `NEXT_PUBLIC_AI_MODE`.

Vous pouvez également **désactiver complètement l'assistant IA** avec `NEXT_PUBLIC_AI_ENABLED`.

---

## 🚀 Configuration

### Désactiver complètement l'assistant IA

Pour désactiver complètement le robot IA (bouton flottant + toutes les API), ajouter dans `.env.local` :

```env
NEXT_PUBLIC_AI_ENABLED=false
```

**Effets :**
- ❌ Le bouton flottant du compagnon IA disparaît
- ❌ Toutes les routes API `/api/ai/*` retournent une erreur 503
- ✅ L'application continue de fonctionner normalement sans IA

Pour réactiver l'IA, supprimer la ligne ou mettre :

```env
NEXT_PUBLIC_AI_ENABLED=true
```

### Désactiver uniquement les animations du robot

Si les animations du robot causent des erreurs dans la console, vous pouvez les désactiver tout en gardant l'IA fonctionnelle :

```env
NEXT_PUBLIC_AI_ANIMATIONS=false
```

**Effets :**
- ✅ Le robot apparaît en version statique (sans animations SVG)
- ✅ Plus d'erreurs Framer Motion dans la console
- ✅ L'IA reste pleinement fonctionnelle
- ✅ Meilleure performance

**Recommandé si :** Vous voyez des erreurs SVG ou Framer Motion dans la console.

### Mode par défaut : ReAct (recommandé)

Par défaut, le mode **ReAct** est activé. Aucune configuration nécessaire.

### Basculer vers le mode Legacy

Ajouter dans `.env.local` :

```env
NEXT_PUBLIC_AI_MODE=legacy
```

### Basculer vers le mode ReAct

Ajouter dans `.env.local` :

```env
NEXT_PUBLIC_AI_MODE=react
```

Ou simplement retirer la variable (ReAct est le défaut).

---

## 🔍 Différences entre les modes

### Mode Legacy (`legacy`)

**Fonctionnement :**
- Recherche sémantique simple dans Qdrant
- Génération de réponse avec Ollama
- Pas d'outils (pas de SQL, pas d'OCR, etc.)
- Pas de raisonnement multi-étapes

**Avantages :**
- Simple et rapide
- Moins de dépendances
- Consomme moins de tokens

**Inconvénients :**
- Ne peut pas répondre aux questions nécessitant des données en temps réel
- Pas d'accès à la base de données
- Répond uniquement avec ce qui est dans la KB

**Exemples de questions supportées :**
- "Comment créer un bail ?"
- "Qu'est-ce qu'un IRL ?"
- "Où trouver les paramètres ?"

---

### Mode ReAct (`react`) ⭐ Recommandé

**Fonctionnement :**
- Agent autonome avec boucle ReAct (Think → Plan → Use Tool → Observe → Synthesize)
- 8 outils disponibles : SQL, RAG, OCR, Documents, etc.
- Raisonnement multi-étapes
- Mémoire de conversation

**Avantages :**
- Répond à **toutes** les questions (données + procédures)
- Exécute des requêtes SQL sécurisées
- Accès aux documents avec OCR
- Citations précises (SQL, documents, KB)
- Raisonnement transparent

**Inconvénients :**
- Plus complexe
- Consomme plus de tokens
- Nécessite PostgreSQL + Qdrant + Ollama

**Exemples de questions supportées :**
- "Combien de baux actifs ?" → **SQL**
- "Loyers encaissés ce mois ?" → **SQL + Vue analytique**
- "Liste des locataires en retard" → **SQL + Masquage PII**
- "Résume le document X" → **OCR + Résumé**
- "Comment créer un bail ?" → **RAG KB**
- "Échéances dans 3 mois ?" → **SQL + Vues analytiques**

---

## 🛠️ Vérifier le mode actif

### Via l'API

```bash
curl http://localhost:3000/api/ai/query \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"question": "Quel mode es-tu ?"}'
```

La réponse inclut `metadata.mode` : `"legacy"` ou `"react"`.

### Via les logs

Au démarrage du serveur, vous verrez :

```
═══════════════════════════════════════════════════════════
🤖 Smartimmo AI Configuration
═══════════════════════════════════════════════════════════
Mode: REACT
Ollama: http://localhost:11434 (mistral:instruct)
Qdrant: http://localhost:6333 (smartimmo_kb)
Embeddings: Xenova/bge-small-en-v1.5

✅ Agent ReAct activé avec outils:
   - SQL: ✓
   - KB Search: ✓
   - Doc Fetch: ✓
   - OCR Summarize: ✓
═══════════════════════════════════════════════════════════
```

Ou en mode Legacy :

```
═══════════════════════════════════════════════════════════
🤖 Smartimmo AI Configuration
═══════════════════════════════════════════════════════════
Mode: LEGACY
Ollama: http://localhost:11434 (mistral:instruct)
Qdrant: http://localhost:6333 (smartimmo_kb)
Embeddings: Xenova/bge-small-en-v1.5

⚠️  Mode Legacy (RAG simple)
═══════════════════════════════════════════════════════════
```

---

## 📊 Matrice de compatibilité

| Question / Fonctionnalité | Legacy | ReAct |
|---------------------------|--------|-------|
| Questions procédurales ("Comment...?") | ✅ | ✅ |
| Questions de données ("Combien...?") | ❌ | ✅ |
| Requêtes SQL | ❌ | ✅ |
| Accès documents + OCR | ❌ | ✅ |
| Vues analytiques | ❌ | ✅ |
| Citations SQL | ❌ | ✅ |
| Masquage PII | ❌ | ✅ |
| Mémoire de conversation | ❌ | ✅ |
| Raisonnement multi-étapes | ❌ | ✅ |

---

## 🔧 Configuration avancée

### Désactiver des outils spécifiques (mode ReAct)

Dans `src/lib/ai/config.ts`, modifier :

```typescript
features: {
  sqlTool: false, // Désactiver l'outil SQL
  kbSearch: true,
  docFetch: true,
  ocrSummarize: true,
  streaming: true,
  memory: true,
}
```

### Ajuster les limites

```typescript
react: {
  maxIterations: 3, // Réduire pour plus de rapidité
  maxTokens: 1000, // Réduire pour économiser
  timeout: 15000, // 15 secondes
}

sql: {
  maxLimit: 100, // Moins de résultats
  timeout: 3000, // 3 secondes
}
```

---

## 🐛 Dépannage

### Le mode ne change pas

1. Vérifier que `.env.local` contient bien `NEXT_PUBLIC_AI_MODE`
2. Redémarrer le serveur Next.js : `npm run dev`
3. Vider le cache du navigateur

### Erreur "Outil SQL non disponible"

Si en mode ReAct, l'outil SQL échoue :

1. Vérifier que PostgreSQL est accessible
2. Vérifier que les vues analytiques sont créées : `npm run db:migrate:ai`
3. Vérifier les logs : `docker-compose logs postgres`

### Erreur "Qdrant non accessible"

1. Vérifier que Qdrant est démarré : `docker ps | grep qdrant`
2. Tester manuellement : `curl http://localhost:6333/health`
3. Redémarrer : `docker restart qdrant`

---

## 📝 Exemples de tests

### Test en mode Legacy

```bash
# Basculer en mode legacy
echo "NEXT_PUBLIC_AI_MODE=legacy" >> .env.local

# Redémarrer
npm run dev

# Tester
curl -X POST http://localhost:3000/api/ai/query \
  -H "Content-Type: application/json" \
  -d '{"question": "Comment créer un bail ?"}'

# → Doit répondre avec la KB uniquement
```

### Test en mode ReAct

```bash
# Basculer en mode react
echo "NEXT_PUBLIC_AI_MODE=react" >> .env.local

# Redémarrer
npm run dev

# Tester une question SQL
curl -X POST http://localhost:3000/api/ai/query \
  -H "Content-Type: application/json" \
  -d '{"question": "Combien de baux actifs ?"}'

# → Doit retourner un nombre avec citation SQL
```

---

## 🚦 Migration recommandée

**Étape 1 :** Tester le mode ReAct en local

```bash
NEXT_PUBLIC_AI_MODE=react npm run dev
```

**Étape 2 :** Créer les vues analytiques

```bash
npm run db:migrate:ai
npm run db:seed:ai
```

**Étape 3 :** Ingérer la base de connaissances

```bash
npm run ingest:all
```

**Étape 4 :** Tester avec les questions de démo

Voir `docs/AI_AGENT_V3_DOCUMENTATION.md` pour la liste complète.

**Étape 5 :** Déployer en production avec `AI_MODE=react`

---

## 📞 Support

- Mode Legacy : Simple mais limité, pour débogage uniquement
- Mode ReAct : **Production-ready**, recommandé par défaut

Pour toute question : consulter `docs/AI_AGENT_V3_DOCUMENTATION.md`


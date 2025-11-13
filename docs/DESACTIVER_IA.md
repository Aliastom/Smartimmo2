# 🚫 Désactiver l'Assistant IA

## 📋 Vue d'ensemble

Vous pouvez maintenant **désactiver complètement l'assistant IA** dans Smartimmo avec une simple variable d'environnement.

---

## ⚡ Désactivation rapide

### Option 1 : Désactivation complète

Dans votre fichier `.env.local`, ajoutez :

```env
NEXT_PUBLIC_AI_ENABLED=false
```

**Résultat :**
- ❌ Le bouton flottant du robot IA disparaît complètement
- ❌ Toutes les routes API `/api/ai/*` retournent une erreur 503
- ✅ L'application continue de fonctionner normalement

### Option 2 : Désactiver uniquement les animations

Si vous voulez garder le robot mais sans les animations (pour éviter les erreurs SVG) :

```env
# Garder l'IA activée
# NEXT_PUBLIC_AI_ENABLED=true

# Mais désactiver les animations
NEXT_PUBLIC_AI_ANIMATIONS=false
```

**Résultat :**
- ✅ Robot statique (pas d'animations)
- ✅ Plus d'erreurs Framer Motion
- ✅ IA pleinement fonctionnelle

### Option 3 : Réactivation complète

Pour réactiver l'IA avec animations, supprimez les lignes ou mettez :

```env
NEXT_PUBLIC_AI_ENABLED=true
NEXT_PUBLIC_AI_ANIMATIONS=true
```

**⚠️ Important :** Après modification du `.env.local`, redémarrez le serveur :

```bash
# Arrêtez le serveur (Ctrl+C)
# Relancez
npm run dev
```

---

## 🔍 Vérification

### Voir les logs au démarrage

Quand l'IA est **désactivée** :

```
═══════════════════════════════════════════════════════════
🤖 Smartimmo AI Configuration
═══════════════════════════════════════════════════════════
❌ IA DÉSACTIVÉE (NEXT_PUBLIC_AI_ENABLED=false)
═══════════════════════════════════════════════════════════
```

Quand l'IA est **activée** (par défaut) :

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

---

## 🎯 Cas d'usage

### Quand désactiver l'IA ?

1. **Développement sans dépendances IA**
   - Pas besoin d'Ollama, Qdrant, etc.
   - Développement frontend uniquement
   - Tests de fonctionnalités non-IA

2. **Performance**
   - Environnements avec ressources limitées
   - Tests de charge sans surcharge IA

3. **Débogage**
   - Isoler des problèmes non liés à l'IA
   - Simplifier l'environnement de test

4. **Environnements spécifiques**
   - Serveurs de staging sans IA
   - Démos sans fonctionnalités IA

---

## 🛠️ Configuration complète

Voici toutes les options de configuration IA disponibles :

```env
# ==============================================
# Configuration IA
# ==============================================

# Activer/Désactiver l'assistant IA (par défaut: true)
NEXT_PUBLIC_AI_ENABLED=false

# Mode de l'agent (par défaut: react)
# Options: 'legacy' (RAG simple) ou 'react' (agent autonome)
NEXT_PUBLIC_AI_MODE=react

# Ollama
OLLAMA_HOST=http://localhost:11434
GEN_MODEL=mistral:instruct

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=smartimmo_kb

# Embeddings
EMBEDDING_MODEL=Xenova/bge-small-en-v1.5
```

---

## 📊 Impacts techniques

### Composants affectés

| Composant | Comportement si désactivé |
|-----------|---------------------------|
| `CompanionDock` | Ne s'affiche pas (retourne `null`) |
| `CompanionProvider` | Continue de fonctionner (pas d'erreur) |
| `/api/ai/chat` | Retourne erreur 503 |
| `/api/ai/query` | Retourne erreur 503 |
| `/api/ai/sql` | Retourne erreur 503 |
| `/api/ai/search` | Retourne erreur 503 |
| `/api/ai/kpi` | Retourne erreur 503 |
| `/api/ai` (router) | Retourne erreur 503 |

### Réponse API type

Quand l'IA est désactivée, les routes API retournent :

```json
{
  "error": "L'assistant IA est actuellement désactivé"
}
```

**Code HTTP :** `503 Service Unavailable`

---

## 🐛 Dépannage

### L'IA ne se désactive pas

**Problème :** Le bouton IA apparaît toujours malgré `NEXT_PUBLIC_AI_ENABLED=false`

**Solutions :**

1. Vérifiez le fichier `.env.local` à la racine du projet
2. Assurez-vous qu'il n'y a pas d'espaces : `NEXT_PUBLIC_AI_ENABLED=false`
3. Redémarrez complètement le serveur (Ctrl+C puis `npm run dev`)
4. Videz le cache du navigateur (Ctrl+Shift+R)

### Erreur 503 inattendue

**Problème :** Les routes API IA retournent 503 alors que l'IA devrait être activée

**Solutions :**

1. Vérifiez que `NEXT_PUBLIC_AI_ENABLED` n'est pas défini ou est à `true`
2. Consultez les logs du serveur pour voir la configuration IA au démarrage
3. Vérifiez qu'il n'y a pas de conflit entre plusieurs fichiers `.env*`

---

## 📚 Documentation connexe

- **[docs/AI_MODE_FLAG.md](./AI_MODE_FLAG.md)** : Configuration des modes IA (Legacy vs ReAct)
- **[SETUP_ENV.md](../SETUP_ENV.md)** : Configuration complète des variables d'environnement
- **[docs/AI_AGENT_V3_DOCUMENTATION.md](./AI_AGENT_V3_DOCUMENTATION.md)** : Documentation technique de l'agent IA

---

## ✅ Récapitulatif

Pour désactiver l'IA :

```bash
# 1. Ajouter dans .env.local
echo "NEXT_PUBLIC_AI_ENABLED=false" >> .env.local

# 2. Redémarrer
npm run dev

# 3. Vérifier les logs
# → Vous devriez voir "❌ IA DÉSACTIVÉE"
```

Pour réactiver l'IA :

```bash
# 1. Supprimer la ligne du .env.local ou mettre à true
# 2. Redémarrer
npm run dev

# 3. Vérifier les logs
# → Vous devriez voir "✅ Agent ReAct activé"
```

---

**🎉 C'est tout ! L'IA peut maintenant être activée/désactivée en quelques secondes.**


# 🚀 Quick Start - Compagnon IA Smartimmo

Guide de démarrage ultra-rapide en 5 minutes.

---

## ⚡ Démarrage en 5 étapes

### **1. Services Docker (30s)**

```bash
docker-compose up -d
```

✅ Lance Postgres + Qdrant.

### **2. Ollama + Mistral (2 min)**

```bash
# Démarrer Ollama (terminal 1)
ollama serve

# Télécharger Mistral (terminal 2)
ollama pull mistral
```

✅ Mistral 7B téléchargé (~4 GB).

### **3. Vérifier la config (10s)**

```bash
npm run check:env
```

✅ Toutes les variables détectées.

### **4. Ingestion KB (1 min)**

```bash
npm run ingest:kb
```

✅ ~48 chunks ingérés dans Qdrant.

### **5. Lancer l'app (10s)**

```bash
npm run dev
```

✅ Ouvrir [http://localhost:3000](http://localhost:3000)

---

## 🎯 Test rapide

1. Cliquer sur le **bouton flottant** (bottom-right, icône chat)
2. Poser : **"Qu'est-ce que l'IRL ?"**
3. Voir la réponse en streaming ✨

---

## 🔧 Commandes utiles

```bash
# Vérifier les services
curl http://localhost:6333/collections      # Qdrant
curl http://localhost:11434/api/tags        # Ollama

# Ingestion
npm run ingest:kb          # Ingérer la KB
npm run kb:truncate        # Supprimer la collection
npm run kb:rebuild         # Supprimer + réingérer

# Tests API
curl -X POST http://localhost:3000/api/ai/search \
  -H "Content-Type: application/json" \
  -d '{"query":"loyer","topK":3}'

curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" -N \
  -d '{"query":"Qu'\''est-ce que l'\''IRL ?"}'
```

---

## 🐛 Dépannage express

### Erreur "Ollama API error: 404"
```bash
ollama pull mistral
ollama serve
```

### Erreur "Qdrant connection failed"
```bash
docker-compose up -d qdrant
curl http://localhost:6333/collections
```

### Le bouton flottant n'apparaît pas
```bash
# Vérifier les logs
npm run dev
# Ouvrir la console navigateur (F12)
```

### Chat ne répond pas
```bash
# Vérifier Ollama
curl http://localhost:11434/api/tags

# Redémarrer Ollama
ollama serve
```

---

## 📚 Documentation complète

- [Setup complet](SETUP_ENV.md)
- [Tests de validation](AI_VALIDATION_TESTS.md)
- [Documentation API](src/app/api/ai/README.md)
- [Récapitulatif complet](AI_IMPLEMENTATION_COMPLETE.md)

---

**🎉 C'est tout ! Profitez de votre compagnon IA !**


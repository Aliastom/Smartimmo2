# 🚀 Guide de Démarrage Rapide - Smartimmo2

## ▶️ DÉMARRAGE RAPIDE (avec scripts)

**Windows PowerShell :**
```powershell
.\start.ps1  # Configure tout automatiquement
npm run dev  # Démarre l'application
```

**Méthode manuelle :**
```bash
# 1. Démarrer les services Docker (PostgreSQL + Qdrant)
npm run services:start
# ou: docker-compose up -d

# 2. Vérifier la configuration
npm run check:env

# 3. (Optionnel) Migrations si nécessaire
npm run db:migrate:dev

# 4. (Optionnel) Ingérer la base de connaissances si vide
npm run ingest:kb

# 5. Démarrer l'application
npm run dev
```

**✅ Application disponible sur** : http://localhost:3000

---

## ⏹️ ARRÊT PROPRE

**Windows PowerShell :**
```powershell
.\stop.ps1  # Arrête tout proprement
```

**Méthode manuelle :**
```bash
# 1. Arrêter Next.js (Ctrl+C dans le terminal)

# 2. Arrêter Docker
npm run services:stop
# ou: docker-compose stop

# OU pour supprimer les conteneurs (les données sont préservées)
npm run services:down
# ou: docker-compose down
```

---

## 🔧 COMMANDES UTILES

### Services Docker
```bash
# Démarrer les services
npm run services:start

# Arrêter les services
npm run services:stop

# Redémarrer les services
npm run services:restart

# Voir les logs en temps réel
npm run services:logs

# Supprimer les conteneurs
npm run services:down
```

### Vérifications
```bash
# Vérifier l'environnement
npm run check:env

# Vérifier Docker
docker-compose ps

# Vérifier Ollama
curl http://localhost:11434/api/tags

# Ouvrir Prisma Studio (interface base de données)
npm run db:studio
```

### Base de données
```bash
# Migrations
npm run db:migrate:dev

# Seed (données de test)
npm run db:seed

# Studio (interface graphique)
npm run db:studio
```

### Base de connaissances (RAG)
```bash
# Ingérer les documents
npm run ingest:kb

# Supprimer et recréer
npm run kb:rebuild

# Juste supprimer
npm run kb:truncate
```

---

## 🆘 EN CAS DE PROBLÈME

### Qdrant corrompu
```bash
# Arrêter tout
docker-compose down

# Supprimer le stockage Qdrant
rm -rf qdrant_storage

# Redémarrer
docker-compose up -d

# Réingérer
npm run ingest:kb
```

### PostgreSQL ne démarre pas
```bash
# Voir les logs
docker-compose logs postgres

# Redémarrer proprement
docker-compose restart postgres
```

### Ollama ne répond pas
```bash
# Tester la connexion
curl http://localhost:11434/api/tags

# Vérifier que le modèle mistral est installé
ollama list
```

---

## 📦 ORDRE RECOMMANDÉ (première fois)

1. `docker-compose up -d` - Démarrer les services
2. `npm install` - Installer les dépendances (si pas déjà fait)
3. `npm run check:env` - Vérifier la config
4. `npm run db:migrate:dev` - Créer les tables
5. `npm run db:seed` - Données de test (optionnel)
6. `npm run ingest:kb` - Base de connaissances IA
7. `npm run dev` - Démarrer l'app

**🎉 Vous êtes prêt !**


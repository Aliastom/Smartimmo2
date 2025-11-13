# 📖 Référence des Commandes - Smartimmo2

Guide complet de toutes les commandes npm disponibles.

---

## 🚀 Développement

```bash
# Démarrer l'application en mode dev
npm run dev

# Build production
npm run build

# Lancer en production
npm run start
```

---

## 🐳 Services Docker

```bash
# Démarrer tous les services (PostgreSQL + Qdrant)
npm run services:start

# Arrêter les services
npm run services:stop

# Redémarrer les services
npm run services:restart

# Supprimer les conteneurs (données préservées)
npm run services:down

# Voir les logs en temps réel
npm run services:logs
```

---

## 🗄️ Base de données (Prisma)

```bash
# Générer le client Prisma
npm run prisma:generate

# Créer une nouvelle migration
npm run db:migrate:dev

# Appliquer les migrations en production
npm run db:migrate

# Voir les différences de schéma
npm run db:migrate:diff

# Ouvrir Prisma Studio (interface graphique)
npm run db:studio

# Seed : données de test
npm run db:seed

# Seed : types de documents
npm run db:seed-document-types-unified

# Seed : mapping nature-type
npm run seed:nature-mapping

# Reset mapping nature-type
npm run seed:nature-mapping:reset
```

---

## 🤖 IA & Base de Connaissances

```bash
# Vérifier la configuration IA
npm run check:env

# Ingérer la base de connaissances
npm run ingest:kb

# Supprimer la collection Qdrant
npm run kb:truncate

# Rebuild complet (supprime + réingère)
npm run kb:rebuild
```

---

## 🧪 Tests

```bash
# Tests unitaires (run once)
npm run test

# Tests unitaires (mode watch avec UI)
npm run test:ui

# Tests E2E avec Playwright
npm run test:e2e
```

---

## 🔍 Qualité du Code

```bash
# Linter (ESLint)
npm run lint

# Formatter (Prettier)
npm run format

# Type checking (TypeScript)
npm run typecheck

# Lint theme
npm run lint-theme

# Lint theme safety
npm run lint-theme-safety

# Fix theme violations
npm run fix-theme-violations
```

---

## 🛠️ Outils de Développement

```bash
# Scanner les identifiants français
npm run scan:fr

# Codemod dry-run (test)
npm run codemod:dry

# Codemod write (applique les changements)
npm run codemod:write

# Guard pour identifiants français
npm run lint:guard

# Remplacer couleurs hardcodées (dry-run)
npm run replace-colors:dry

# Remplacer couleurs hardcodées (applique)
npm run replace-colors
```

---

## 📜 Scripts PowerShell (Windows)

```powershell
# Démarrage automatique
.\start.ps1

# Arrêt propre
.\stop.ps1

# Redémarrage avec nettoyage optionnel
.\restart.ps1
```

---

## 🐳 Commandes Docker Directes

```bash
# Démarrer tous les services
docker-compose up -d

# Arrêter tous les services
docker-compose stop

# Supprimer les conteneurs
docker-compose down

# Supprimer conteneurs + volumes (⚠️ DESTRUCTIF)
docker-compose down -v

# Voir les logs
docker-compose logs -f

# Status des conteneurs
docker-compose ps

# Redémarrer un service spécifique
docker-compose restart postgres
docker-compose restart qdrant
```

---

## 🔍 Commandes de Diagnostic

```bash
# Vérifier les variables d'environnement
npm run check:env

# Vérifier Docker
docker-compose ps
docker ps

# Vérifier PostgreSQL
docker-compose logs postgres

# Vérifier Qdrant
docker-compose logs qdrant
curl http://localhost:6333/collections

# Vérifier Ollama
curl http://localhost:11434/api/tags
ollama list

# Vérifier les ports
netstat -ano | findstr :3000   # Next.js
netstat -ano | findstr :5432   # PostgreSQL
netstat -ano | findstr :6333   # Qdrant
netstat -ano | findstr :11434  # Ollama
```

---

## 📊 Informations Système

```bash
# Version Node.js
node --version

# Version npm
npm --version

# Version Docker
docker --version
docker-compose --version

# Version Ollama
ollama --version

# Espace disque
docker system df
```

---

## 🆘 Résolution de Problèmes

### Qdrant corrompu
```bash
docker-compose down
rm -rf qdrant_storage
docker-compose up -d
npm run ingest:kb
```

### PostgreSQL ne démarre pas
```bash
docker-compose logs postgres
docker-compose restart postgres
```

### Cache Next.js
```bash
rm -rf .next
npm run dev
```

### Node_modules corrompus
```bash
rm -rf node_modules package-lock.json
npm install
```

### Prisma désynchronisé
```bash
npm run prisma:generate
npm run db:migrate:dev
```

---

## 🎯 Workflows Courants

### Premier démarrage
```bash
npm install
.\start.ps1
npm run db:migrate:dev
npm run db:seed
npm run ingest:kb
npm run dev
```

### Développement quotidien
```bash
.\start.ps1
npm run dev
# ... travailler ...
Ctrl+C
.\stop.ps1
```

### Après un git pull
```bash
npm install
npm run prisma:generate
npm run db:migrate:dev
npm run dev
```

### Reset complet
```bash
docker-compose down -v
rm -rf qdrant_storage
npm run db:migrate:dev
npm run db:seed
npm run ingest:kb
```

---

📚 **Voir aussi** :
- [QUICKSTART.md](./QUICKSTART.md) - Démarrage en 30 secondes
- [START.md](./START.md) - Guide détaillé
- [SETUP_ENV.md](./SETUP_ENV.md) - Configuration
- [README.md](./README.md) - Documentation principale


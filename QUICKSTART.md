# ⚡ Démarrage en 30 secondes

## 🚀 DÉMARRER

```powershell
.\start.ps1
npm run dev
```

Ouvrez http://localhost:3000 🎉

---

## 🛑 ARRÊTER

```powershell
# Dans le terminal où tourne npm run dev :
Ctrl + C

# Puis arrêter les services :
.\stop.ps1
```

---

## 🔄 REDÉMARRER PROPREMENT

```powershell
.\restart.ps1
npm run dev
```

---

## 📚 Guides complets

- **Guide détaillé** : [`START.md`](./START.md)
- **Configuration env** : [`SETUP_ENV.md`](./SETUP_ENV.md)
- **README principal** : [`README.md`](./README.md)

---

## 🆘 Problèmes courants

### ❌ Erreur Qdrant

```bash
.\restart.ps1  # Choisir "o" pour nettoyer Qdrant
npm run dev
```

### ❌ Port déjà utilisé

```bash
# Trouver le processus
netstat -ano | findstr :3000
# Tuer le processus
taskkill /PID <PID> /F
```

### ❌ Docker ne démarre pas

```powershell
# Vérifier Docker Desktop
docker --version

# Relancer Docker Desktop depuis le menu Démarrer
```

### ❌ Ollama ne répond pas

```powershell
# Vérifier Ollama
curl http://localhost:11434/api/tags

# Lancer Ollama depuis le menu Démarrer
```


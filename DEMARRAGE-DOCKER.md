# 🐳 Démarrage de Docker - Instructions

## ⚠️ Action requise

Docker Desktop n'est pas encore démarré sur votre machine. Suivez ces étapes :

## 📋 Étapes pour démarrer Docker

### 1. Ouvrir Docker Desktop

- Ouvrez le menu Démarrer Windows
- Recherchez "Docker Desktop"
- Cliquez pour l'ouvrir
- **Attendez** que Docker Desktop démarre complètement (la baleine dans la barre des tâches sera verte)

### 2. Vérifier que Docker fonctionne

Une fois Docker Desktop démarré, vous verrez une notification dans la barre des tâches indiquant que Docker est prêt.

### 3. Relancer la commande

Une fois Docker Desktop démarré, je pourrai lancer :
```bash
docker-compose up -d postgres
```

---

## 🔄 Alternative : Utiliser PowerShell en tant qu'administrateur

Si Docker Desktop ne démarre pas :

1. Fermez PowerShell
2. Clic droit sur PowerShell → "Exécuter en tant qu'administrateur"
3. Naviguez vers le dossier du projet
4. Démarrez Docker Desktop
5. Relancez les commandes

---

## ⏭️ Prochaines étapes (une fois Docker démarré)

Une fois que Docker Desktop est démarré, je pourrai automatiquement :

1. ✅ Démarrer PostgreSQL
2. ✅ Créer le fichier `.env.local`
3. ✅ Générer les migrations Prisma
4. ✅ Migrer les données SQLite → PostgreSQL
5. ✅ Vérifier l'intégrité des données

**Attendez que Docker Desktop soit démarré, puis dites-moi "c'est bon" ou "docker est démarré" !**

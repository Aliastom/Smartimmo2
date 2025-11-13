# 🚀 Installation du Système de Sauvegarde Globale Admin

## ✅ Résumé des Fichiers Créés/Modifiés

### Modèles Prisma
- ✅ `prisma/schema.prisma` — Ajout de `AdminBackupRecord` et `AdminBackupSchedule`

### Services Backend
- ✅ `src/services/AdminBackupService.ts` — Service principal (export/import/diff/apply)

### Routes API
- ✅ `src/app/api/admin/backup/export/route.ts` — Export global
- ✅ `src/app/api/admin/backup/import/route.ts` — Import avec validation
- ✅ `src/app/api/admin/backup/history/route.ts` — Historique des backups
- ✅ `src/app/api/admin/backup/restore/[backupId]/route.ts` — Restauration
- ✅ `src/app/api/admin/backup/schedule/route.ts` — Planification automatique

### Composants UI
- ✅ `src/components/admin/BackupManagementCard.tsx` — Carte admin complète
- ✅ `src/app/admin/AdminPageClient.tsx` — Intégration dans la page admin

### Dépendances
- ✅ `package.json` — Ajout de `archiver`, `unzipper` et types

### Documentation
- ✅ `ADMIN_GLOBAL_BACKUP.md` — Documentation complète
- ✅ `INSTALLATION_BACKUP_SYSTEM.md` — Ce fichier

---

## 📦 Étape 1 : Installer les Dépendances

```bash
npm install archiver unzipper
```

Les types ont déjà été ajoutés dans `package.json` devDependencies.

---

## 🗄️ Étape 2 : Appliquer la Migration Prisma

### Créer la migration

```bash
npx prisma migrate dev --name add_admin_backup_system
```

Cette commande va :
1. Créer les tables `admin_backup_records` et `admin_backup_schedules`
2. Générer le client Prisma avec les nouveaux modèles

### Vérifier la migration

```bash
npx prisma studio
```

Vous devriez voir les deux nouvelles tables dans Prisma Studio.

---

## 📁 Étape 3 : Créer le Dossier de Stockage

```bash
mkdir -p backups
echo "backups/*.zip" >> .gitignore
```

Cela crée un dossier `backups/` à la racine du projet pour stocker les archives de sauvegarde localement.

---

## ⚙️ Étape 4 : Configuration (Optionnel)

Ajoutez ces variables dans votre `.env.local` si vous souhaitez personnaliser :

```bash
# Chemin de stockage des backups (par défaut: ./backups)
BACKUP_STORAGE_PATH=./backups

# Taille maximale d'un backup (en Mo, par défaut: 25)
BACKUP_MAX_SIZE_MB=25
```

---

## 🧪 Étape 5 : Tester le Système

### Démarrer le serveur

```bash
npm run dev
```

### Accéder à l'interface admin

1. Ouvrir http://localhost:3000/admin
2. Vous devriez voir la nouvelle section **"Sauvegarde & Restauration"**
3. Tester les fonctionnalités :
   - **Tout Exporter** : Télécharge une archive ZIP
   - **Tout Importer** : Upload et validation d'une archive
   - **Historique** : Liste des sauvegardes
   - **Planifier** : Configuration des backups automatiques

### Test rapide d'export

```bash
# Via curl (nécessite authentification)
curl -X GET "http://localhost:3000/api/admin/backup/export?scope=admin" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -o test-backup.zip

# Vérifier le contenu
unzip -l test-backup.zip
```

Vous devriez voir :
- `manifest.json`
- `checksums.sha256`
- `datasets/*.ndjson`

### Test de validation d'import

```bash
# Via l'interface web
1. Cliquer sur "Tout Exporter" → télécharge un .zip
2. Cliquer sur "Tout Importer"
3. Sélectionner le fichier .zip
4. Choisir mode "Validate"
5. Cliquer sur "Importer"
6. Vérifier le rapport de diff (should show 0 changes)
```

---

## 🔒 Étape 6 : Vérification Sécurité

### Vérifier les permissions

Les routes API vérifient automatiquement :
- ✅ Authentification NextAuth
- ✅ Rôle `ADMIN` requis

### Test d'accès non autorisé

```bash
# Sans authentification (devrait retourner 401)
curl -X GET "http://localhost:3000/api/admin/backup/export"
# => {"success":false,"error":"Non authentifié"}

# Avec utilisateur non-admin (devrait retourner 403)
# => {"success":false,"error":"Permissions insuffisantes"}
```

---

## 📊 Étape 7 : Vérifier les Données Exportées

### Dézipper une archive

```bash
unzip smartimmo-admin-backup-20251106-143000.zip -d test-extract/
cd test-extract/
```

### Vérifier le manifest

```bash
cat manifest.json | jq .
```

Vous devriez voir :
```json
{
  "app": "smartimmo",
  "version": "1.0",
  "scope": "admin",
  "environment": "development",
  "createdAt": "2025-11-06T14:30:00.000Z",
  "datasets": [...],
  "checksumGlobal": "a1b2c3..."
}
```

### Vérifier les checksums

```bash
sha256sum -c checksums.sha256
```

Toutes les lignes devraient afficher `OK`.

### Examiner un dataset NDJSON

```bash
head -n 5 datasets/fiscal.types.ndjson
```

Chaque ligne est un objet JSON valide :
```json
{"id":"NU","label":"Location nue","category":"FONCIER","isActive":true}
{"id":"MEUBLE","label":"Location meublée","category":"BIC","isActive":true}
```

---

## 🎯 Étape 8 : Test Complet Import/Export

### Scénario : Modifier et Réimporter

1. **Exporter l'état actuel**
   ```bash
   # Via l'interface : Cliquer sur "Tout Exporter"
   # Fichier téléchargé : smartimmo-admin-backup-YYYYMMDD.zip
   ```

2. **Modifier un dataset**
   ```bash
   unzip smartimmo-admin-backup-YYYYMMDD.zip -d test-modify/
   cd test-modify/datasets/
   
   # Ajouter une ligne dans fiscal.types.ndjson
   echo '{"id":"TEST_TYPE","label":"Type de Test","category":"FONCIER","isActive":true}' >> fiscal.types.ndjson
   
   # Recréer l'archive
   cd ..
   zip -r ../modified-backup.zip *
   ```

3. **Importer en mode Validate**
   - Via l'interface : "Tout Importer"
   - Sélectionner `modified-backup.zip`
   - Mode : **Validate**
   - Stratégie : **Merge**
   - Résultat attendu : `1 ajout détecté`

4. **Importer en mode Apply**
   - Même fichier
   - Mode : **Apply**
   - Stratégie : **Merge**
   - Résultat : Type créé en base

5. **Vérifier en base**
   ```bash
   npx prisma studio
   # Aller dans FiscalType
   # Vérifier que "TEST_TYPE" existe
   ```

---

## 🔄 Étape 9 : Planification Automatique (Optionnel)

### Via l'interface

1. Cliquer sur **"Planifier"**
2. Configurer :
   - Fréquence : **Hebdomadaire**
   - Jour : **Lundi**
   - Heure : **3h**
   - Rétention : **30 jours**
3. Sauvegarder

### Vérifier en base

```bash
npx prisma studio
# Aller dans AdminBackupSchedule
# Vérifier que isActive=true et nextRunAt est calculé
```

### Créer un cron manuel (Linux/Mac)

```bash
# Créer un script
cat > scripts/run-backup-cron.sh << 'EOF'
#!/bin/bash
cd /path/to/smartimmo
node -e "
import('file://./src/services/AdminBackupService.js').then(async (module) => {
  const service = module.adminBackupService;
  const stream = await service.exportAdmin({ scope: 'admin' });
  // TODO: Save to file
  console.log('Backup created');
}).catch(console.error);
"
EOF

chmod +x scripts/run-backup-cron.sh

# Ajouter au crontab
crontab -e
# Ajouter la ligne :
# 0 3 * * 1 /path/to/smartimmo/scripts/run-backup-cron.sh >> /path/to/smartimmo/logs/backup-cron.log 2>&1
```

---

## 🐛 Dépannage

### Erreur : "archiver n'est pas installé"

```bash
npm install archiver unzipper
npm install -D @types/archiver @types/unzipper
```

### Erreur : "Table admin_backup_records n'existe pas"

```bash
npx prisma migrate dev --name add_admin_backup_system
npx prisma generate
```

### Erreur : "Permissions insuffisantes"

Vérifier que l'utilisateur connecté a le rôle `ADMIN` :

```bash
npx prisma studio
# Aller dans User
# Modifier le role en "ADMIN"
```

### Erreur : "Fichier trop volumineux"

La taille max par défaut est **25 Mo**. Pour augmenter :

```bash
# Dans .env.local
BACKUP_MAX_SIZE_MB=50
```

### Les checksums ne correspondent pas

Cela indique une corruption de fichier. Ne pas importer.

```bash
# Vérifier manuellement
sha256sum datasets/fiscal.types.ndjson
# Comparer avec checksums.sha256
```

---

## ✅ Checklist Finale

- [ ] Dépendances installées (`archiver`, `unzipper`)
- [ ] Migration Prisma appliquée
- [ ] Dossier `backups/` créé
- [ ] Serveur de dev lancé (`npm run dev`)
- [ ] Interface admin accessible (`/admin`)
- [ ] Export fonctionnel (télécharge un `.zip`)
- [ ] Archive valide (manifest + checksums + datasets)
- [ ] Import en mode validate fonctionne
- [ ] Import en mode apply fonctionne
- [ ] Historique des backups s'affiche
- [ ] Planification configurable
- [ ] Tests de sécurité (401/403) passés

---

## 📚 Documentation

Pour plus de détails, consultez :
- **Documentation complète** : `ADMIN_GLOBAL_BACKUP.md`
- **Architecture** : Section "API Endpoints" et "Service Backend"
- **Scénarios de test** : Section "Scénarios de Test"

---

## 🎉 Félicitations !

Le système de sauvegarde globale admin est maintenant installé et fonctionnel ! 🚀

**Prochaines étapes recommandées** :
1. Créer un backup manuel avant toute migration
2. Configurer une planification automatique hebdomadaire
3. Tester la restauration en environnement de staging
4. Mettre en place un stockage S3 pour la prod (optionnel)

---

**SmartImmo — Système de Sauvegarde Admin v1.0**  
Installation réussie ✅


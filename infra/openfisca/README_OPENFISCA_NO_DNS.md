# OpenFisca-France sans DNS — Guide d'Exploitation SmartImmo

Guide complet pour builder, déployer et maintenir **votre propre image Docker OpenFisca-France** sur Docker Hub, sans DNS ni HTTPS, pour usage local ou LAN.

---

## 📋 Table des matières

1. [Pourquoi une image personnalisée ?](#pourquoi-une-image-personnalisée)
2. [Prérequis](#prérequis)
3. [Configuration initiale](#configuration-initiale)
4. [Build local + Push manuel](#build-local--push-manuel)
5. [Build automatique (GitHub Actions)](#build-automatique-github-actions)
6. [Déploiement](#déploiement)
7. [Intégration SmartImmo](#intégration-smartimmo)
8. [Mises à jour](#mises-à-jour)
9. [Rollback](#rollback)
10. [Tests & Diagnostics](#tests--diagnostics)
11. [FAQ](#faq)

---

## Pourquoi une image personnalisée ?

**Problème** : Pas d'image officielle `openfisca/france` sur Docker Hub publique.

**Solution** : Créer et maintenir **notre propre image** avec :
- ✅ Versions épinglables (stabilité)
- ✅ Hébergée sur **votre** Docker Hub (contrôle total)
- ✅ Mise à jour facile (rebuild + push)
- ✅ Rollback simple (tags datés)
- ✅ Pas besoin de DNS/HTTPS (usage interne)

---

## Prérequis

### Sur votre machine de build

```bash
# Docker installé
docker --version
# Docker version 24.0.0+

# Docker Compose installé
docker compose version
# Docker Compose version v2.20.0+

# Compte Docker Hub (gratuit)
# Créer sur : https://hub.docker.com/signup
```

### Sur Docker Hub

1. **Créer un repository** :
   - Aller sur https://hub.docker.com/repositories
   - Cliquer "Create Repository"
   - Name: `openfisca-france`
   - Visibility: Public (ou Private si vous avez un compte payant)
   - Cliquer "Create"

2. **Créer un Access Token** :
   - Aller sur https://hub.docker.com/settings/security
   - Cliquer "New Access Token"
   - Description: `smartimmo-openfisca`
   - Permissions: **Read & Write**
   - Copier le token (vous ne pourrez plus le voir après !)

3. **Login depuis votre machine** :
   ```bash
   docker login
   # Username: <votre-username>
   # Password: <collez-le-token>
   ```

---

## Configuration initiale

### 1. Cloner le repository SmartImmo

```bash
git clone https://github.com/votre-org/smartimmo.git
cd smartimmo
```

### 2. Vérifier les fichiers

```bash
ls -la infra/openfisca/
# Dockerfile
# docker-compose.openfisca.yml
# README_OPENFISCA_NO_DNS.md

ls -la .github/workflows/
# build-openfisca.yml
```

### 3. Adapter les fichiers avec votre username Docker Hub

**Remplacer `<USER>` dans :**
- `infra/openfisca/docker-compose.openfisca.yml` ligne 36
- `.github/workflows/build-openfisca.yml` (utilise déjà les secrets, OK)

Exemple avec username `johndoe` :
```bash
cd infra/openfisca
sed -i 's/<USER>/johndoe/g' docker-compose.openfisca.yml
# Ou éditer manuellement :
# image: johndoe/openfisca-france:stable
```

---

## Build local + Push manuel

### Méthode 1 : Build avec dernières versions

```bash
cd infra/openfisca

# Build l'image avec tag stable + date du jour
docker build \
  -t <USER>/openfisca-france:stable \
  -t <USER>/openfisca-france:$(date +%Y-%m-%d) \
  .

# Exemples de noms avec votre username :
# johndoe/openfisca-france:stable
# johndoe/openfisca-france:2025-11-08
```

### Méthode 2 : Build avec versions épinglées (recommandé production)

```bash
# Vérifier les versions disponibles :
# OpenFisca France : https://pypi.org/project/OpenFisca-France/#history
# OpenFisca Web API : https://pypi.org/project/OpenFisca-Web-API/#history

# Build avec versions spécifiques
docker build \
  --build-arg OPENFISCA_FRANCE_VERSION=176.0.0 \
  --build-arg OPENFISCA_WEB_API_VERSION=2.0.0 \
  -t <USER>/openfisca-france:stable \
  -t <USER>/openfisca-france:2025-11-08 \
  .
```

### Push vers Docker Hub

```bash
# Push les deux tags
docker push <USER>/openfisca-france:stable
docker push <USER>/openfisca-france:2025-11-08

# Vérifier sur Docker Hub
# https://hub.docker.com/r/<USER>/openfisca-france/tags
```

### Tester l'image localement avant push

```bash
# Run temporaire pour test
docker run --rm -p 2000:2000 <USER>/openfisca-france:stable

# Dans un autre terminal, tester :
curl -s http://localhost:2000/spec | jq .info.title
# Devrait afficher : "OpenFisca-France Web API"

# Si OK, arrêter (Ctrl+C) et push
```

---

## Build automatique (GitHub Actions)

### 1. Configurer les secrets GitHub

1. Aller dans votre repo GitHub : `https://github.com/votre-org/smartimmo`
2. Settings > Secrets and variables > Actions
3. Cliquer "New repository secret"
4. Ajouter deux secrets :

| Name | Value |
|------|-------|
| `DOCKERHUB_USER` | Votre username Docker Hub (ex: `johndoe`) |
| `DOCKERHUB_TOKEN` | Le token créé précédemment |

### 2. Déclencher le build manuellement

1. Aller dans Actions > Build OpenFisca Image
2. Cliquer "Run workflow"
3. (Optionnel) Remplir les versions :
   - `openfisca_france_version` : `176.0.0` (ou vide pour latest)
   - `openfisca_web_api_version` : `2.0.0` (ou vide pour latest)
4. Cliquer "Run workflow"

Le workflow va :
- ✅ Builder l'image
- ✅ Tagger avec `stable` + date du jour
- ✅ Pusher sur votre Docker Hub
- ✅ Prendre ~5-10 minutes

### 3. Build automatique hebdomadaire

Le workflow est configuré pour se déclencher automatiquement **chaque dimanche à 3h UTC** (ligne 24 du workflow).

Cela garantit que votre image reste à jour avec les dernières versions d'OpenFisca.

---

## Déploiement

### Cas 1 : Déploiement sur la même machine que SmartImmo

```bash
cd infra/openfisca

# Démarrer le service (écoute sur localhost uniquement)
docker compose -f docker-compose.openfisca.yml up -d

# Vérifier que ça tourne
docker compose -f docker-compose.openfisca.yml ps

# Voir les logs
docker compose -f docker-compose.openfisca.yml logs -f
```

**Résultat** : OpenFisca accessible sur `http://localhost:2000` depuis la même machine.

### Cas 2 : Déploiement sur un serveur LAN séparé

#### Sur le serveur OpenFisca :

```bash
cd infra/openfisca

# Modifier docker-compose.openfisca.yml
# Remplacer ligne 43:
#   - "127.0.0.1:2000:2000"
# Par:
#   - "0.0.0.0:2000:2000"

# Ou en ligne de commande :
sed -i 's/127.0.0.1:2000:2000/0.0.0.0:2000:2000/g' docker-compose.openfisca.yml

# Démarrer
docker compose -f docker-compose.openfisca.yml up -d
```

#### Vérifier l'IP du serveur :

```bash
# Trouver l'IP LAN du serveur
ip addr show | grep "inet " | grep -v 127.0.0.1
# Ex: 192.168.1.100
```

#### Tester depuis une autre machine du LAN :

```bash
curl -s http://192.168.1.100:2000/spec | jq .info.title
# Devrait afficher : "OpenFisca-France Web API"
```

---

## Intégration SmartImmo

### Cas 1 : SmartImmo sur la même machine qu'OpenFisca

Éditer `.env.local` de SmartImmo :

```bash
# .env.local
OPENFISCA_BASE_URL=http://localhost:2000
OPENFISCA_TIMEOUT_MS=15000
OPENFISCA_CACHE_TTL_H=24
```

Redémarrer SmartImmo :
```bash
pm2 restart smartimmo
# ou selon votre setup
```

### Cas 2 : SmartImmo sur une machine différente (LAN)

Éditer `.env.local` de SmartImmo :

```bash
# .env.local
# Remplacer 192.168.1.100 par l'IP réelle du serveur OpenFisca
OPENFISCA_BASE_URL=http://192.168.1.100:2000
OPENFISCA_TIMEOUT_MS=15000
OPENFISCA_CACHE_TTL_H=24
```

Redémarrer SmartImmo.

### Tester l'intégration

#### Via l'UI Admin :

1. Aller sur `http://localhost:3000/admin/impots/parametres`
2. Cliquer sur **"Vérifier OpenFisca"**
3. Devrait afficher : ✅ Toast vert "OpenFisca opérationnel (2025)"

#### Via l'API :

```bash
curl -s "http://localhost:3000/api/admin/tax/openfisca/health?year=2025" | jq .

# Réponse attendue :
# {
#   "ok": true,
#   "baseUrl": "http://localhost:2000",
#   "year": 2025,
#   "hasIR": true,
#   "irCount": 5,
#   "hasPS": true,
#   "psRate": 0.172,
#   ...
# }
```

---

## Mises à jour

### Méthode 1 : Pull automatique (si vous utilisez GitHub Actions)

```bash
cd infra/openfisca

# Pull la dernière image stable depuis Docker Hub
docker compose -f docker-compose.openfisca.yml pull

# Recréer le container avec la nouvelle image
docker compose -f docker-compose.openfisca.yml up -d --force-recreate

# Vérifier la nouvelle version
docker exec openfisca-france pip list | grep openfisca
```

**Fréquence recommandée** : Après chaque build automatique hebdomadaire (dimanche).

### Méthode 2 : Build + Push manuel (si pas de GitHub Actions)

```bash
# 1. Rebuild l'image localement
cd infra/openfisca
docker build \
  -t <USER>/openfisca-france:stable \
  -t <USER>/openfisca-france:$(date +%Y-%m-%d) \
  .

# 2. Push vers Docker Hub
docker push <USER>/openfisca-france:stable
docker push <USER>/openfisca-france:$(date +%Y-%m-%d)

# 3. Sur le serveur de déploiement, pull et redémarrer
docker compose -f docker-compose.openfisca.yml pull
docker compose -f docker-compose.openfisca.yml up -d --force-recreate
```

### Vérifier qu'OpenFisca fonctionne après mise à jour

```bash
# Test rapide
curl -s http://localhost:2000/spec | jq .info.version

# Test SmartImmo
curl -s "http://localhost:3000/api/admin/tax/openfisca/health?year=2025" | jq .ok
# Devrait afficher : true
```

---

## Rollback

Si une mise à jour pose problème, revenir à une version antérieure.

### Lister les tags disponibles

```bash
# Sur Docker Hub
# https://hub.docker.com/r/<USER>/openfisca-france/tags

# Ou via API
curl -s "https://hub.docker.com/v2/repositories/<USER>/openfisca-france/tags/?page_size=10" | jq '.results[].name'
```

### Méthode 1 : Modifier docker-compose.yml

```bash
cd infra/openfisca

# Éditer docker-compose.openfisca.yml
# Remplacer ligne 36 :
#   image: <USER>/openfisca-france:stable
# Par la date souhaitée :
#   image: <USER>/openfisca-france:2025-11-01

# Pull et redémarrer
docker compose -f docker-compose.openfisca.yml pull
docker compose -f docker-compose.openfisca.yml up -d --force-recreate
```

### Méthode 2 : Run direct avec un tag spécifique

```bash
# Arrêter le container actuel
docker stop openfisca-france
docker rm openfisca-france

# Démarrer avec une ancienne version
docker run -d \
  --name openfisca-france \
  --restart always \
  -p 127.0.0.1:2000:2000 \
  <USER>/openfisca-france:2025-11-01 \
  openfisca serve --port 2000 --bind 0.0.0.0 --country-package openfisca_france
```

### Vérifier le rollback

```bash
curl -s http://localhost:2000/spec | jq .info.version
# Vérifier que c'est bien l'ancienne version
```

---

## Tests & Diagnostics

### Test 1 : Container tourne ?

```bash
docker ps | grep openfisca
# Devrait afficher : openfisca-france   Up X minutes   (healthy)
```

### Test 2 : Health check OK ?

```bash
docker inspect openfisca-france | jq '.[].State.Health'
# Devrait afficher : "Status": "healthy"
```

### Test 3 : API répond ?

```bash
# Spec API
curl -s http://localhost:2000/spec | jq .info

# Paramètres fiscaux 2025
curl -s "http://localhost:2000/parameters?year=2025" | jq '.impot_revenu.bareme' | head

# Calcul simple
curl -X POST http://localhost:2000/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "persons": {"alice": {}},
    "households": {"household": {"parents": ["alice"]}},
    "period": "2025",
    "variables": {"salaire_net": {"2025": {"alice": 30000}}}
  }' | jq .
```

### Test 4 : Intégration SmartImmo OK ?

```bash
# Health check SmartImmo
curl -s "http://localhost:3000/api/admin/tax/openfisca/health?year=2025" | jq .

# Devrait retourner :
# {
#   "ok": true,
#   "irCount": 5,
#   "psRate": 0.172,
#   ...
# }
```

### Logs

```bash
# Logs en temps réel
docker logs openfisca-france -f

# Dernières 100 lignes
docker logs openfisca-france --tail 100

# Logs avec timestamps
docker logs openfisca-france -f --timestamps
```

### Diagnostics avancés

```bash
# Stats ressources
docker stats openfisca-france

# Inspecter le container
docker inspect openfisca-france | jq .

# Entrer dans le container
docker exec -it openfisca-france /bin/bash

# Vérifier les versions installées
docker exec openfisca-france pip list | grep openfisca
```

---

## FAQ

### Q1 : Pourquoi pas utiliser l'image officielle `openfisca/france` ?

**R** : Il n'existe pas d'image officielle publique sur Docker Hub. OpenFisca distribue principalement via PyPI (`pip install`). Créer notre propre image nous donne :
- Contrôle total des versions
- Possibilité de pinner les dépendances
- Rollback facile
- Pas de dépendance à un registry externe

### Q2 : Quelle est la différence entre les tags `stable` et datés ?

**R** :
- `stable` : Toujours la **dernière version** buildée. Mobile, écrasé à chaque build.
- `2025-11-08` : **Snapshot figé** du build du 8 nov 2025. Immuable.

**Usage** :
- Dev/test : `stable` (toujours à jour)
- Production : Tag daté (stabilité, rollback)

### Q3 : Comment savoir quand mettre à jour ?

**R** : Plusieurs stratégies :
1. **Automatique** : Le workflow GitHub Actions build chaque dimanche. Pull le lundi.
2. **Manuel** : Vérifier les releases OpenFisca sur https://github.com/openfisca/openfisca-france/releases
3. **Sur alerte** : Si un bug est découvert, rebuild avec une version spécifique épinglée.

### Q4 : Dois-je exposer le port 2000 sur Internet ?

**R** : **NON !** Sauf si vous ajoutez HTTPS + authentification. Par défaut :
- Localhost uniquement : `127.0.0.1:2000:2000` ✅
- LAN uniquement : `0.0.0.0:2000:2000` + firewall ⚠️
- Internet : Ajouter Nginx + Let's Encrypt (voir `DEPLOY_OPENFISCA_PRODUCTION.md`)

### Q5 : Quelle est la consommation de ressources ?

**R** : Typique :
- RAM : ~300-500 Mo au repos, 500-800 Mo en charge
- CPU : ~5-10% au repos, pics à 50-100% lors de calculs
- Disque : ~500 Mo pour l'image Docker

Recommandations :
- Minimum : 512 Mo RAM, 0.5 CPU
- Confortable : 1 Go RAM, 1 CPU

### Q6 : Comment activer HTTPS plus tard ?

**R** : Voir le guide complet `DEPLOY_OPENFISCA_PRODUCTION.md` qui ajoute :
- Nom de domaine (DNS)
- Nginx reverse proxy
- Let's Encrypt SSL
- Configuration CORS

### Q7 : Puis-je utiliser Docker Swarm ou Kubernetes ?

**R** : Oui ! L'image est compatible. Pour Kubernetes, créer un Deployment + Service. Pour Swarm, adapter le docker-compose avec `deploy:` sections.

### Q8 : Comment monitorer OpenFisca ?

**R** : Plusieurs options :
- **Health check** : Intégré dans Docker (`/spec` endpoint)
- **Prometheus** : Exposer des métriques avec `openfisca-web-api`
- **Logs** : Agréger avec ELK, Loki, ou autre
- **UptimeRobot** : Ping le endpoint `/health` (si exposé)

### Q9 : Que faire si OpenFisca ne démarre pas ?

**R** :
```bash
# Vérifier les logs
docker logs openfisca-france

# Erreurs communes :
# - Port 2000 déjà utilisé : changer de port dans docker-compose.yml
# - Mémoire insuffisante : augmenter les limites Docker
# - Image corrompue : re-pull ou rebuild
```

### Q10 : Comment contribuer au projet OpenFisca ?

**R** : OpenFisca est open-source ! Voir :
- https://github.com/openfisca/openfisca-france
- https://github.com/openfisca/openfisca-web-api
- https://openfisca.org/doc/contribute/

---

## Support

- **Issues SmartImmo** : [votre-org/smartimmo/issues](https://github.com/votre-org/smartimmo/issues)
- **Documentation OpenFisca** : https://openfisca.org/doc/
- **Forum OpenFisca** : https://github.com/openfisca/openfisca-france/discussions

---

## Checklist de déploiement

- [ ] Compte Docker Hub créé
- [ ] Repository `openfisca-france` créé sur Docker Hub
- [ ] Access Token Docker Hub créé
- [ ] Secrets GitHub configurés (`DOCKERHUB_USER`, `DOCKERHUB_TOKEN`)
- [ ] Image buildée et pushée (manuel ou GitHub Actions)
- [ ] `docker-compose.openfisca.yml` adapté avec votre username
- [ ] Container démarré (`docker compose up -d`)
- [ ] Test local OK (`curl http://localhost:2000/spec`)
- [ ] `.env.local` SmartImmo configuré avec `OPENFISCA_BASE_URL`
- [ ] SmartImmo redémarré
- [ ] Test intégration OK (bouton "Vérifier OpenFisca" ✅)
- [ ] Monitoring configuré (optionnel)

---

**✅ OpenFisca déployé sans DNS ! Prêt pour calculs fiscaux à 100% de confiance ! 🚀**


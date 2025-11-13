# OpenFisca Docker Custom — SmartImmo (sans DNS)

Documentation rapide pour utiliser **votre propre image Docker OpenFisca** hébergée sur Docker Hub, sans DNS ni HTTPS.

---

## 📁 Arborescence des fichiers

```
smartimmo/
├── infra/
│   └── openfisca/
│       ├── Dockerfile                          # Image Docker personnalisée
│       ├── docker-compose.openfisca.yml        # Déploiement local/LAN
│       └── README_OPENFISCA_NO_DNS.md          # Guide complet (LIRE EN PREMIER !)
├── .github/
│   └── workflows/
│       └── build-openfisca.yml                 # Build automatique GitHub Actions
└── OPENFISCA_DOCKER_CUSTOM.md                  # Ce fichier (vue d'ensemble)
```

---

## 🚀 Démarrage rapide (3 étapes)

### 1. Configurer Docker Hub

```bash
# Créer un compte sur https://hub.docker.com
# Créer un repository "openfisca-france"
# Créer un Access Token (Read & Write)

# Login
docker login
# Username: votre-username
# Password: votre-token
```

### 2. Builder et pusher l'image

**Option A : Build local (rapide)**

```bash
cd infra/openfisca

# Remplacer <USER> par votre username Docker Hub
docker build -t <USER>/openfisca-france:stable .
docker push <USER>/openfisca-france:stable
```

**Option B : GitHub Actions (automatique)**

1. Configurer les secrets GitHub :
   - `DOCKERHUB_USER` : votre username
   - `DOCKERHUB_TOKEN` : votre token
2. Aller dans Actions > Build OpenFisca Image > Run workflow

### 3. Déployer

```bash
cd infra/openfisca

# Adapter docker-compose.openfisca.yml avec votre username
sed -i 's/<USER>/votre-username/g' docker-compose.openfisca.yml

# Démarrer
docker compose -f docker-compose.openfisca.yml up -d

# Tester
curl http://localhost:2000/spec
```

---

## 📚 Documentation complète

➡️ **Lire le guide complet** : [`infra/openfisca/README_OPENFISCA_NO_DNS.md`](infra/openfisca/README_OPENFISCA_NO_DNS.md)

Ce guide contient :
- ✅ Prérequis détaillés
- ✅ Configuration Docker Hub
- ✅ Build local vs GitHub Actions
- ✅ Déploiement localhost vs LAN
- ✅ Intégration SmartImmo
- ✅ Mises à jour et rollback
- ✅ Tests et diagnostics
- ✅ FAQ complète

---

## 🎯 Différence avec l'autre méthode (DNS + HTTPS)

| Aspect | Sans DNS (ce guide) | Avec DNS (autre guide) |
|--------|---------------------|------------------------|
| **Accessibilité** | Localhost ou LAN uniquement | Internet (HTTPS) |
| **DNS requis** | ❌ Non | ✅ Oui (`openfisca.example.com`) |
| **HTTPS** | ❌ Non (HTTP) | ✅ Oui (Let's Encrypt) |
| **Nginx** | ❌ Non | ✅ Oui (reverse proxy) |
| **Image Docker** | Votre propre image | Votre propre image |
| **Complexité** | ⭐ Simple | ⭐⭐⭐ Moyenne |
| **Usage** | Dev, test, LAN interne | Production Internet |

**Conseil** : Commencer avec ce guide (sans DNS), puis migrer vers DNS+HTTPS si besoin d'exposition Internet.

---

## 🔑 Points clés

### Sécurité
- Port 2000 **non exposé sur Internet** par défaut
- Accessible uniquement depuis `127.0.0.1` (même machine)
- Pour accès LAN : modifier `0.0.0.0:2000:2000` dans docker-compose

### Versions
- Tag `stable` : toujours la dernière version buildée
- Tag `YYYY-MM-DD` : snapshot figé pour rollback
- ARG buildtime pour pinner OpenFisca-France et Web-API

### Maintenance
- Build hebdomadaire automatique (GitHub Actions, dimanche 3h UTC)
- Mise à jour : `docker compose pull && up -d --force-recreate`
- Rollback : changer le tag dans docker-compose.yml

---

## ✅ Checklist déploiement

- [ ] Compte Docker Hub créé
- [ ] Repository `openfisca-france` créé
- [ ] Access Token Docker Hub créé
- [ ] Secrets GitHub configurés (si GitHub Actions)
- [ ] Image buildée et pushée sur Docker Hub
- [ ] `docker-compose.openfisca.yml` adapté avec votre username
- [ ] Container démarré
- [ ] Test `curl http://localhost:2000/spec` → OK
- [ ] SmartImmo `.env.local` configuré avec `OPENFISCA_BASE_URL`
- [ ] Test UI SmartImmo : bouton "Vérifier OpenFisca" → ✅

---

## 🛠️ Commandes utiles

```bash
# Status
docker ps | grep openfisca

# Logs
docker logs openfisca-france -f

# Redémarrer
docker compose -f docker-compose.openfisca.yml restart

# Arrêter
docker compose -f docker-compose.openfisca.yml down

# Mettre à jour
docker compose -f docker-compose.openfisca.yml pull
docker compose -f docker-compose.openfisca.yml up -d --force-recreate

# Test
curl http://localhost:2000/spec | jq .info
curl "http://localhost:2000/parameters?year=2025" | jq '.impot_revenu.bareme' | head
```

---

## 📞 Support

- **Guide complet** : [`README_OPENFISCA_NO_DNS.md`](infra/openfisca/README_OPENFISCA_NO_DNS.md)
- **Issues** : https://github.com/votre-org/smartimmo/issues
- **Doc OpenFisca** : https://openfisca.org/doc/

---

## 🎁 Ce qui est inclus

| Fichier | Description | Lignes |
|---------|-------------|--------|
| **Dockerfile** | Image Python + OpenFisca + healthcheck | ~100 |
| **docker-compose.openfisca.yml** | Déploiement avec restart, limits, logs | ~150 |
| **build-openfisca.yml** | GitHub Actions build/push automatique | ~120 |
| **README_OPENFISCA_NO_DNS.md** | Guide complet d'exploitation | ~850 |

**Total** : ~1200 lignes de documentation et code prêts à l'emploi ! 🚀

---

**✨ Tout est prêt ! Consultez `README_OPENFISCA_NO_DNS.md` pour commencer ! 😊**


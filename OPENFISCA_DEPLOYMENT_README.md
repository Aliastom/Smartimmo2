# OpenFisca Deployment — SmartImmo

Documentation complète pour déployer et intégrer OpenFisca avec SmartImmo.

---

## 📚 Documentation disponible

| Document | Description | Usage |
|----------|-------------|-------|
| **[DEPLOY_OPENFISCA_PRODUCTION.md](DEPLOY_OPENFISCA_PRODUCTION.md)** | Guide complet de déploiement production | 📖 Lire en premier |
| **[OPENFISCA_HEALTHCHECK_GUIDE.md](OPENFISCA_HEALTHCHECK_GUIDE.md)** | Healthcheck API + bouton admin | 🔍 Diagnostic |
| **[OPENFISCA_TROUBLESHOOTING.md](OPENFISCA_TROUBLESHOOTING.md)** | Résolution des problèmes courants | 🛠️ Dépannage |
| **[CONFIGURATION_OPENFISCA.md](CONFIGURATION_OPENFISCA.md)** | Variables d'env + configuration | ⚙️ Config |

---

## 🚀 Démarrage rapide

### 1. Installation automatique (recommandé)

```bash
# Télécharger le script
curl -fsSL https://raw.githubusercontent.com/votre-org/smartimmo/main/scripts/deploy-openfisca.sh -o deploy-openfisca.sh
chmod +x deploy-openfisca.sh

# Exécuter (remplacer par vos valeurs)
sudo ./deploy-openfisca.sh openfisca.example.com admin@example.com
```

**Durée** : ~5 minutes  
**Prérequis** : Serveur Linux, Docker installé, DNS configuré

---

### 2. Installation manuelle

#### 2.1 Déployer OpenFisca

```bash
# Créer le dossier
mkdir -p /opt/openfisca
cd /opt/openfisca

# Copier docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/votre-org/smartimmo/main/docker-compose.openfisca.yml -o docker-compose.yml

# Démarrer
docker compose up -d

# Vérifier
docker ps | grep openfisca
curl http://127.0.0.1:2000/spec
```

#### 2.2 Configurer Nginx + SSL

```bash
# Copier la config Nginx
sudo curl -fsSL https://raw.githubusercontent.com/votre-org/smartimmo/main/config/nginx-openfisca.conf \
  -o /etc/nginx/sites-available/openfisca

# Adapter le domaine
sudo sed -i 's/openfisca.votre-domaine.com/openfisca.example.com/g' /etc/nginx/sites-available/openfisca

# Obtenir le certificat SSL
sudo mkdir -p /var/www/certbot
sudo certbot certonly --webroot -w /var/www/certbot -d openfisca.example.com

# Activer
sudo ln -s /etc/nginx/sites-available/openfisca /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 2.3 Configurer SmartImmo

```bash
# Ajouter dans .env
echo "OPENFISCA_BASE_URL=https://openfisca.example.com" >> .env

# Redémarrer
pm2 restart smartimmo
```

---

## 🧪 Tests de validation

### 1. Test Docker (local)

```bash
curl -s http://127.0.0.1:2000/spec | jq .info.title
# Devrait afficher : "OpenFisca-France Web API"
```

### 2. Test HTTPS (externe)

```bash
curl -s https://openfisca.example.com/spec | jq .info
# Devrait retourner du JSON avec version, title, etc.
```

### 3. Test SmartImmo Health

```bash
curl -s "https://app.example.com/api/admin/tax/openfisca/health?year=2025" | jq .
# Devrait afficher : { "ok": true, "irCount": 5, "psRate": 0.172, ... }
```

### 4. Test UI SmartImmo

1. Aller sur : `https://app.example.com/admin/impots/parametres`
2. Cliquer sur **"Vérifier OpenFisca"**
3. Devrait afficher : ✅ Toast vert "OpenFisca opérationnel"

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet (HTTPS)                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                  ┌────────────────┐
                  │  Nginx (443)   │
                  │  + Let's Encrypt│
                  └────────┬───────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Docker OpenFisca      │
              │  127.0.0.1:2000        │
              └────────────────────────┘
                           ▲
                           │
              ┌────────────┴───────────┐
              │   SmartImmo Next.js    │
              │   OPENFISCA_BASE_URL   │
              └────────────────────────┘
```

**Avantages** :
- ✅ Isolation réseau (OpenFisca non exposé directement)
- ✅ HTTPS automatique
- ✅ Redémarrage automatique
- ✅ Logs centralisés
- ✅ Upgrade simple

---

## 📁 Fichiers de configuration

### docker-compose.openfisca.yml

```yaml
services:
  openfisca:
    image: openfisca/france:latest
    container_name: openfisca-france
    command: openfisca serve --port 2000 --bind 0.0.0.0
    restart: always
    ports:
      - "127.0.0.1:2000:2000"
    # ... voir fichier complet
```

📄 [Fichier complet](docker-compose.openfisca.yml)

### config/nginx-openfisca.conf

```nginx
server {
    server_name openfisca.example.com;
    listen 443 ssl http2;
    
    ssl_certificate /etc/letsencrypt/live/...;
    # ... voir fichier complet
}
```

📄 [Fichier complet](config/nginx-openfisca.conf)

### .env

```bash
OPENFISCA_BASE_URL=https://openfisca.example.com
OPENFISCA_TIMEOUT_MS=15000
OPENFISCA_CACHE_TTL_H=24
```

📄 [Fichier complet](config/env.openfisca.example)

---

## 🔒 Sécurité

### Checklist

- [ ] Port 2000 exposé UNIQUEMENT sur 127.0.0.1
- [ ] HTTPS activé avec Let's Encrypt
- [ ] HSTS configuré (Strict-Transport-Security)
- [ ] Rate limiting actif (10 req/s)
- [ ] Firewall UFW configuré (SSH, HTTP, HTTPS uniquement)
- [ ] Version OpenFisca pinnée (pas de `:latest` en prod)
- [ ] Logs rotatifs activés (max 10MB × 3 fichiers)
- [ ] Renouvellement SSL automatique (cron)
- [ ] Monitoring configuré (UptimeRobot, Healthchecks.io)

### Commandes de vérification

```bash
# Port 2000 NOT accessible depuis Internet
curl -m 5 http://IP_SERVEUR:2000/spec
# Devrait timeout (normal, sécurisé)

# HTTPS OK
curl -I https://openfisca.example.com
# Devrait retourner 200 avec headers SSL

# Firewall actif
sudo ufw status
# Devrait afficher: 22, 80, 443 ALLOW

# Docker bind local
sudo ss -tulpn | grep 2000
# Devrait afficher: 127.0.0.1:2000 (PAS 0.0.0.0:2000)
```

---

## 🛠️ Maintenance

### Mise à jour OpenFisca

```bash
cd /opt/openfisca

# Sauvegarder la version actuelle
docker tag openfisca/france:latest openfisca/france:backup-$(date +%Y%m%d)

# Télécharger la nouvelle version
docker compose pull

# Redémarrer
docker compose up -d --force-recreate

# Vérifier
curl -s http://127.0.0.1:2000/spec | jq .info.version
```

### Renouvellement SSL

```bash
# Vérifier l'expiration
sudo certbot certificates

# Renouveler (automatique via cron, mais peut être forcé)
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

### Logs

```bash
# OpenFisca
docker logs openfisca-france -f --tail 100

# Nginx
sudo tail -f /var/log/nginx/openfisca-access.log
sudo tail -f /var/log/nginx/openfisca-error.log
```

---

## 🐛 Dépannage

| Problème | Solution rapide |
|----------|-----------------|
| Container ne démarre pas | `docker logs openfisca-france` |
| 502 Bad Gateway | `docker ps \| grep openfisca` + `curl http://127.0.0.1:2000/spec` |
| Certificat SSL expiré | `sudo certbot renew --force-renewal` |
| SmartImmo "fetch failed" | Vérifier `OPENFISCA_BASE_URL` dans `.env` |
| Performance lente | Augmenter CPU/RAM dans `docker-compose.yml` |

📖 **[Guide de dépannage complet](OPENFISCA_TROUBLESHOOTING.md)**

---

## 📊 Monitoring

### Endpoints à surveiller

| URL | Description | Fréquence |
|-----|-------------|-----------|
| `https://openfisca.example.com/health` | Health check Nginx | Toutes les 5 min |
| `https://openfisca.example.com/spec` | API OpenFisca disponible | Toutes les 15 min |
| `https://app.example.com/api/admin/tax/openfisca/health` | Health SmartImmo | Toutes les 30 min |

### Alertes recommandées

- ❌ Endpoint retourne 502/503 → Alert critique
- ⚠️ Latence > 5 secondes → Alert warning
- ⚠️ Certificat SSL expire dans < 7 jours → Alert info

---

## 💡 Bonnes pratiques

### Production

1. **Pinner la version Docker** : Utiliser `openfisca/france:43.0.0` au lieu de `:latest`
2. **Sauvegarder avant mise à jour** : `docker tag` de l'ancienne version
3. **Tester avant publication** : Bouton "Vérifier OpenFisca" après chaque update
4. **Monitorer les logs** : Configurer une rotation pour éviter le remplissage disque
5. **Rate limiting** : Activer dans Nginx pour éviter les abus

### Développement

1. **Utiliser docker-compose** : Plus simple à gérer qu'un `docker run`
2. **Logs en temps réel** : `docker logs -f` pendant les tests
3. **Variables d'env séparées** : `.env.local` (dev) vs `.env` (prod)
4. **Cache désactivé** : `OPENFISCA_CACHE_TTL_H=0` pendant le dev

---

## 🎯 Checklist déploiement final

- [ ] DNS configuré (A record)
- [ ] Docker + Compose installés
- [ ] OpenFisca container running
- [ ] Nginx installé et configuré
- [ ] Certificat SSL obtenu
- [ ] HTTPS actif (redirection HTTP→HTTPS)
- [ ] Firewall configuré
- [ ] SmartImmo `.env` configuré
- [ ] Test local OK (`curl http://127.0.0.1:2000/spec`)
- [ ] Test HTTPS OK (`curl https://openfisca.example.com/spec`)
- [ ] Test UI OK (bouton "Vérifier OpenFisca" ✅)
- [ ] Monitoring configuré
- [ ] Documentation équipe mise à jour

---

## 📞 Support

- **Issues GitHub** : [votre-org/smartimmo/issues](https://github.com/votre-org/smartimmo/issues)
- **Documentation OpenFisca** : https://openfisca.org/doc/
- **Docker Hub** : https://hub.docker.com/r/openfisca/france
- **Communauté OpenFisca** : https://github.com/openfisca/openfisca-france/discussions

---

**✅ OpenFisca déployé ! Profitez d'une confiance 100% sur vos barèmes fiscaux ! 🚀**


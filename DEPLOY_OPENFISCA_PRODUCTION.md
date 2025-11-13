# Déploiement OpenFisca Production — SmartImmo

Guide complet pour déployer OpenFisca en production avec Docker + Nginx + HTTPS.

---

## 📋 Table des matières

1. [Architecture](#architecture)
2. [Prérequis](#prérequis)
3. [Installation rapide](#installation-rapide)
4. [Configuration détaillée](#configuration-détaillée)
5. [Sécurité](#sécurité)
6. [Maintenance](#maintenance)
7. [Troubleshooting](#troubleshooting)

---

## Architecture

```
Internet (HTTPS)
     ↓
Nginx (443) + Let's Encrypt
     ↓
Docker OpenFisca (127.0.0.1:2000)
     ↓
SmartImmo Next.js (OPENFISCA_BASE_URL)
```

**Avantages** :
- ✅ Image officielle `openfisca/france` (pas de build custom)
- ✅ HTTPS automatique avec Let's Encrypt
- ✅ Isolation réseau (OpenFisca non exposé directement)
- ✅ Redémarrage automatique avec Docker
- ✅ Upgrade simple avec `docker pull`

---

## Prérequis

### Serveur Linux (Ubuntu 22.04+ recommandé)

```bash
# Vérifier la version
lsb_release -a
```

### Docker installé

```bash
# Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Se déconnecter/reconnecter pour appliquer

# Vérifier
docker --version
docker compose version
```

### Nom de domaine configuré

DNS configuré pour pointer vers votre serveur :
- `openfisca.votre-domaine.com` → IP du serveur

Vérifier :
```bash
dig +short openfisca.votre-domaine.com
# Doit afficher l'IP de votre serveur
```

---

## Installation rapide

### 1. Script d'installation automatique

```bash
# Télécharger le script
curl -fsSL https://raw.githubusercontent.com/votre-org/smartimmo/main/scripts/deploy-openfisca.sh -o deploy-openfisca.sh
chmod +x deploy-openfisca.sh

# Exécuter (remplacer par votre domaine)
sudo ./deploy-openfisca.sh openfisca.votre-domaine.com admin@votre-domaine.com
```

### 2. Vérification

```bash
# Vérifier que le conteneur tourne
docker ps | grep openfisca

# Tester localement
curl -s http://127.0.0.1:2000/spec | jq .info.title

# Tester en HTTPS
curl -s https://openfisca.votre-domaine.com/spec | jq .info.title
```

### 3. Configurer SmartImmo

Dans `.env` (production) :
```bash
OPENFISCA_BASE_URL=https://openfisca.votre-domaine.com
OPENFISCA_TIMEOUT_MS=15000
OPENFISCA_CACHE_TTL_H=24
```

Redémarrer SmartImmo :
```bash
pm2 restart smartimmo
# ou selon votre setup
```

### 4. Test final

Aller sur votre interface admin SmartImmo :
```
https://app.votre-domaine.com/admin/impots/parametres
```

Cliquer sur **"Vérifier OpenFisca"** → Devrait afficher ✅ Opérationnel

---

## Configuration détaillée

### 1. Docker Compose (recommandé)

Créer `docker-compose.openfisca.yml` :

```yaml
services:
  openfisca:
    image: openfisca/france:latest
    container_name: openfisca-france
    command: openfisca serve --port 2000 --bind 0.0.0.0
    restart: always
    ports:
      - "127.0.0.1:2000:2000"
    environment:
      - LOG_LEVEL=info
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:2000/spec"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

Démarrer :
```bash
docker compose -f docker-compose.openfisca.yml up -d
```

### 2. Configuration Nginx

Créer `/etc/nginx/sites-available/openfisca` :

```nginx
# Redirection HTTP → HTTPS
server {
    server_name openfisca.votre-domaine.com;
    listen 80;
    listen [::]:80;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Rediriger tout le reste vers HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# Configuration HTTPS
server {
    server_name openfisca.votre-domaine.com;
    listen 443 ssl http2;
    listen [::]:443 ssl http2;

    # Certificats SSL Let's Encrypt
    ssl_certificate /etc/letsencrypt/live/openfisca.votre-domaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/openfisca.votre-domaine.com/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/openfisca.votre-domaine.com/chain.pem;

    # Configuration SSL moderne
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Rate limiting (optionnel mais recommandé)
    limit_req_zone $binary_remote_addr zone=openfisca_limit:10m rate=10r/s;
    limit_req zone=openfisca_limit burst=20 nodelay;

    # Logs
    access_log /var/log/nginx/openfisca-access.log;
    error_log /var/log/nginx/openfisca-error.log;

    # Proxy vers OpenFisca Docker
    location / {
        proxy_pass http://127.0.0.1:2000;
        proxy_http_version 1.1;
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        
        # Timeouts
        proxy_connect_timeout 15s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        
        # CORS (si nécessaire)
        add_header Access-Control-Allow-Origin "https://app.votre-domaine.com" always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
        
        # Préflight requests
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "https://app.votre-domaine.com";
            add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
            add_header Access-Control-Allow-Headers "Content-Type, Authorization";
            add_header Access-Control-Max-Age 1728000;
            add_header Content-Type "text/plain; charset=utf-8";
            add_header Content-Length 0;
            return 204;
        }
    }

    # Health check endpoint (accessible publiquement)
    location /health {
        proxy_pass http://127.0.0.1:2000/spec;
        access_log off;
    }
}
```

Activer :
```bash
sudo ln -s /etc/nginx/sites-available/openfisca /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Certificat SSL Let's Encrypt

```bash
# Installer Certbot
sudo apt-get update
sudo apt-get install -y certbot

# Créer le dossier webroot
sudo mkdir -p /var/www/certbot

# Obtenir le certificat
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d openfisca.votre-domaine.com \
  --email admin@votre-domaine.com \
  --agree-tos \
  --no-eff-email

# Vérifier le renouvellement automatique
sudo certbot renew --dry-run

# Ajouter un cron pour le renouvellement
sudo crontab -e
# Ajouter :
# 0 3 * * * certbot renew --quiet --post-hook "systemctl reload nginx"
```

---

## Sécurité

### 1. Firewall (UFW)

```bash
# Autoriser SSH, HTTP, HTTPS uniquement
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Vérifier
sudo ufw status
```

### 2. Ne PAS exposer le port 2000

**✅ Bonne config** : `127.0.0.1:2000:2000` (accessible uniquement depuis le serveur)  
**❌ Mauvaise config** : `0.0.0.0:2000:2000` ou `2000:2000` (accessible depuis Internet)

Vérifier :
```bash
sudo ss -tulpn | grep 2000
# Devrait afficher : 127.0.0.1:2000 (pas 0.0.0.0:2000)
```

### 3. Pinner la version Docker

Au lieu de `:latest`, utiliser un tag spécifique :
```yaml
image: openfisca/france:43.0.0  # Exemple de version
```

Vérifier les versions disponibles :
```bash
curl -s https://hub.docker.com/v2/repositories/openfisca/france/tags/ | jq '.results[].name'
```

### 4. Monitoring & Alerting

Ajouter un check de santé dans votre monitoring (ex: UptimeRobot, Healthchecks.io) :
```
https://openfisca.votre-domaine.com/health
```

Alerte si le endpoint ne répond pas.

---

## Maintenance

### Logs

```bash
# Logs Docker
docker logs openfisca-france -f

# Logs Nginx
sudo tail -f /var/log/nginx/openfisca-access.log
sudo tail -f /var/log/nginx/openfisca-error.log
```

### Mise à jour OpenFisca

```bash
# Sauvegarder la version actuelle
docker tag openfisca/france:latest openfisca/france:backup-$(date +%Y%m%d)

# Télécharger la nouvelle version
docker compose -f docker-compose.openfisca.yml pull

# Redémarrer avec la nouvelle version
docker compose -f docker-compose.openfisca.yml up -d --force-recreate

# Vérifier
curl -s http://127.0.0.1:2000/spec | jq .info.version

# Tester dans SmartImmo
# Cliquer sur "Vérifier OpenFisca"

# Si problème, rollback
docker stop openfisca-france
docker run -d --name openfisca-france --restart=always \
  -p 127.0.0.1:2000:2000 \
  openfisca/france:backup-20250110 \
  openfisca serve --port 2000
```

### Backup (optionnel)

OpenFisca est stateless, pas besoin de backup. Mais pour les logs :
```bash
# Archiver les logs mensuellement
0 0 1 * * tar -czf /backups/openfisca-logs-$(date +\%Y\%m).tar.gz /var/log/nginx/openfisca-*.log && find /backups -name "openfisca-logs-*.tar.gz" -mtime +90 -delete
```

---

## Troubleshooting

### 1. OpenFisca ne démarre pas

```bash
# Vérifier les logs
docker logs openfisca-france

# Vérifier que le port n'est pas déjà utilisé
sudo ss -tulpn | grep 2000

# Redémarrer Docker
sudo systemctl restart docker
docker compose -f docker-compose.openfisca.yml up -d
```

### 2. Certificat SSL expiré

```bash
# Vérifier l'expiration
sudo certbot certificates

# Renouveler manuellement
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

### 3. Nginx retourne 502 Bad Gateway

```bash
# Vérifier qu'OpenFisca tourne
docker ps | grep openfisca

# Tester localement
curl http://127.0.0.1:2000/spec

# Vérifier la config Nginx
sudo nginx -t

# Vérifier les logs Nginx
sudo tail -f /var/log/nginx/openfisca-error.log
```

### 4. SmartImmo : "fetch failed"

Dans SmartImmo, vérifier :
```bash
# .env contient bien
OPENFISCA_BASE_URL=https://openfisca.votre-domaine.com

# Tester depuis le serveur SmartImmo
curl -s https://openfisca.votre-domaine.com/spec

# Vérifier les CORS si erreur dans la console navigateur
```

### 5. Performance lente

```bash
# Vérifier les ressources Docker
docker stats openfisca-france

# Augmenter les ressources si nécessaire (docker-compose.yml)
services:
  openfisca:
    # ...
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

---

## Tests de validation

### 1. Test direct OpenFisca

```bash
# Spec API
curl -s http://127.0.0.1:2000/spec | jq .

# Paramètres 2025
curl -s "http://127.0.0.1:2000/parameters?year=2025" | jq '.impot_revenu.bareme' | head

# Calcul simple IR
curl -X POST http://127.0.0.1:2000/calculate \
  -H "Content-Type: application/json" \
  -d '{"persons":{"alice":{}},"households":{"household":{"parents":["alice"]}},"period":"2025","variables":{"salaire_net":{"2025":{"alice":30000}}}}' \
  | jq .
```

### 2. Test HTTPS externe

```bash
# Depuis n'importe où sur Internet
curl -s https://openfisca.votre-domaine.com/spec | jq .info.title
# Devrait afficher : "OpenFisca-France Web API"
```

### 3. Test SmartImmo Health

```bash
# API Health SmartImmo
curl -s "https://app.votre-domaine.com/api/admin/tax/openfisca/health?year=2025" | jq .

# Devrait afficher :
# {
#   "ok": true,
#   "irCount": 5,
#   "psRate": 0.172,
#   "hasIR": true,
#   ...
# }
```

### 4. Test UI SmartImmo

1. Aller sur `https://app.votre-domaine.com/admin/impots/parametres`
2. Cliquer sur **"Vérifier OpenFisca"**
3. Devrait afficher un toast vert avec les détails

---

## Checklist déploiement

- [ ] DNS configuré pour `openfisca.votre-domaine.com`
- [ ] Docker installé sur le serveur
- [ ] OpenFisca démarré avec docker-compose
- [ ] Nginx installé et configuré
- [ ] Certificat SSL Let's Encrypt obtenu
- [ ] Port 2000 exposé UNIQUEMENT sur 127.0.0.1
- [ ] Firewall (UFW) configuré
- [ ] Test `curl http://127.0.0.1:2000/spec` → OK
- [ ] Test `curl https://openfisca.votre-domaine.com/spec` → OK
- [ ] SmartImmo `.env` configuré avec `OPENFISCA_BASE_URL`
- [ ] SmartImmo redémarré
- [ ] Test bouton "Vérifier OpenFisca" → ✅ Opérationnel
- [ ] Test scraping fiscal → Confiance 100% sur IR/PS
- [ ] Monitoring configuré (optionnel)
- [ ] Sauvegarde des logs configurée (optionnel)

---

## Support

- **Documentation OpenFisca** : https://openfisca.org/doc/
- **Docker Hub** : https://hub.docker.com/r/openfisca/france
- **GitHub OpenFisca-France** : https://github.com/openfisca/openfisca-france
- **SmartImmo Guide Scraping** : Voir `OPENFISCA_HEALTHCHECK_GUIDE.md`

---

**✅ Déploiement terminé ! OpenFisca est maintenant accessible en HTTPS et intégré à SmartImmo ! 🚀**


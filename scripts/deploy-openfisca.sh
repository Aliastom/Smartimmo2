#!/bin/bash
#
# Script de déploiement automatique OpenFisca pour SmartImmo
# Usage: sudo ./deploy-openfisca.sh <domain> <email>
# Exemple: sudo ./deploy-openfisca.sh openfisca.example.com admin@example.com
#

set -e  # Exit on error

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Vérifier que le script est exécuté en root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Ce script doit être exécuté en root (sudo)${NC}"
    exit 1
fi

# Vérifier les arguments
if [ $# -ne 2 ]; then
    echo -e "${RED}Usage: $0 <domain> <email>${NC}"
    echo -e "Exemple: $0 openfisca.example.com admin@example.com"
    exit 1
fi

DOMAIN=$1
EMAIL=$2

echo -e "${BLUE}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Déploiement OpenFisca pour SmartImmo        ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}🌐 Domaine: ${DOMAIN}${NC}"
echo -e "${YELLOW}📧 Email: ${EMAIL}${NC}"
echo ""

# 1. Vérifier/installer Docker
echo -e "${BLUE}[1/7]${NC} Vérification de Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}  ⚠️  Docker non trouvé. Installation...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}  ✅ Docker installé${NC}"
else
    echo -e "${GREEN}  ✅ Docker déjà installé ($(docker --version))${NC}"
fi

# Vérifier Docker Compose
if ! command -v docker compose &> /dev/null; then
    echo -e "${RED}  ❌ Docker Compose non trouvé${NC}"
    exit 1
fi

# 2. Télécharger et démarrer OpenFisca
echo -e "${BLUE}[2/7]${NC} Déploiement du conteneur OpenFisca..."
mkdir -p /opt/openfisca
cd /opt/openfisca

# Créer docker-compose.yml
cat > docker-compose.yml <<EOF
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
EOF

# Démarrer
docker compose pull
docker compose up -d

# Attendre que le service soit prêt
echo -e "${YELLOW}  ⏳ Attente du démarrage (max 30s)...${NC}"
for i in {1..30}; do
    if curl -sf http://127.0.0.1:2000/spec > /dev/null 2>&1; then
        echo -e "${GREEN}  ✅ OpenFisca démarré${NC}"
        break
    fi
    sleep 1
    if [ $i -eq 30 ]; then
        echo -e "${RED}  ❌ Timeout: OpenFisca ne répond pas${NC}"
        docker logs openfisca-france
        exit 1
    fi
done

# 3. Installer Nginx
echo -e "${BLUE}[3/7]${NC} Installation de Nginx..."
if ! command -v nginx &> /dev/null; then
    apt-get update -qq
    apt-get install -y nginx
    systemctl enable nginx
    echo -e "${GREEN}  ✅ Nginx installé${NC}"
else
    echo -e "${GREEN}  ✅ Nginx déjà installé${NC}"
fi

# 4. Installer Certbot
echo -e "${BLUE}[4/7]${NC} Installation de Certbot..."
if ! command -v certbot &> /dev/null; then
    apt-get install -y certbot
    echo -e "${GREEN}  ✅ Certbot installé${NC}"
else
    echo -e "${GREEN}  ✅ Certbot déjà installé${NC}"
fi

# 5. Configurer Nginx (HTTP temporaire pour Let's Encrypt)
echo -e "${BLUE}[5/7]${NC} Configuration Nginx temporaire..."
mkdir -p /var/www/certbot

cat > /etc/nginx/sites-available/openfisca <<EOF
server {
    server_name ${DOMAIN};
    listen 80;
    listen [::]:80;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        proxy_pass http://127.0.0.1:2000;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Activer le site
ln -sf /etc/nginx/sites-available/openfisca /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default  # Supprimer le site par défaut

nginx -t
systemctl reload nginx
echo -e "${GREEN}  ✅ Nginx configuré (HTTP)${NC}"

# 6. Obtenir le certificat SSL
echo -e "${BLUE}[6/7]${NC} Obtention du certificat SSL..."
certbot certonly --webroot \
    -w /var/www/certbot \
    -d ${DOMAIN} \
    --email ${EMAIL} \
    --agree-tos \
    --no-eff-email \
    --non-interactive

if [ $? -eq 0 ]; then
    echo -e "${GREEN}  ✅ Certificat SSL obtenu${NC}"
else
    echo -e "${RED}  ❌ Échec obtention certificat SSL${NC}"
    exit 1
fi

# 7. Configurer Nginx avec HTTPS
echo -e "${BLUE}[7/7]${NC} Configuration Nginx finale (HTTPS)..."
cat > /etc/nginx/sites-available/openfisca <<EOF
# Redirection HTTP → HTTPS
server {
    server_name ${DOMAIN};
    listen 80;
    listen [::]:80;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

# Configuration HTTPS
server {
    server_name ${DOMAIN};
    listen 443 ssl http2;
    listen [::]:443 ssl http2;

    # Certificats SSL
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/${DOMAIN}/chain.pem;

    # Configuration SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Logs
    access_log /var/log/nginx/openfisca-access.log;
    error_log /var/log/nginx/openfisca-error.log;

    # Proxy vers OpenFisca
    location / {
        proxy_pass http://127.0.0.1:2000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_connect_timeout 15s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:2000/spec;
        access_log off;
    }
}
EOF

nginx -t
systemctl reload nginx
echo -e "${GREEN}  ✅ Nginx configuré avec HTTPS${NC}"

# Configurer le renouvellement automatique
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -

# Tests finaux
echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Tests de validation                          ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}📊 Test local (HTTP)...${NC}"
if curl -sf http://127.0.0.1:2000/spec > /dev/null; then
    echo -e "${GREEN}✅ OpenFisca répond localement${NC}"
else
    echo -e "${RED}❌ OpenFisca ne répond pas localement${NC}"
fi

echo -e "${YELLOW}🌐 Test externe (HTTPS)...${NC}"
sleep 2  # Attendre propagation DNS si nécessaire
if curl -sf https://${DOMAIN}/spec > /dev/null; then
    echo -e "${GREEN}✅ OpenFisca accessible en HTTPS${NC}"
else
    echo -e "${YELLOW}⚠️  Test HTTPS échoué (DNS pas encore propagé ?)${NC}"
    echo -e "${YELLOW}   Réessayez dans quelques minutes: curl https://${DOMAIN}/spec${NC}"
fi

# Résumé
echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  ✅ Déploiement terminé !                     ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}📋 Prochaines étapes :${NC}"
echo ""
echo -e "1. ${YELLOW}Configurer SmartImmo${NC}"
echo -e "   Ajouter dans .env :"
echo -e "   ${BLUE}OPENFISCA_BASE_URL=https://${DOMAIN}${NC}"
echo ""
echo -e "2. ${YELLOW}Redémarrer SmartImmo${NC}"
echo -e "   ${BLUE}pm2 restart smartimmo${NC} (ou selon votre setup)"
echo ""
echo -e "3. ${YELLOW}Tester dans l'interface admin${NC}"
echo -e "   Aller sur /admin/impots/parametres"
echo -e "   Cliquer sur \"Vérifier OpenFisca\""
echo ""
echo -e "${GREEN}📚 Documentation complète : DEPLOY_OPENFISCA_PRODUCTION.md${NC}"
echo ""
echo -e "${YELLOW}🔗 URLs utiles :${NC}"
echo -e "   API OpenFisca : https://${DOMAIN}/spec"
echo -e "   Health check  : https://${DOMAIN}/health"
echo ""
echo -e "${GREEN}✨ Bon déploiement ! 🚀${NC}"


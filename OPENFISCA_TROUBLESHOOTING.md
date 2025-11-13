# Guide de Dépannage OpenFisca — SmartImmo

Guide rapide pour résoudre les problèmes courants avec OpenFisca.

---

## 🔍 Diagnostics rapides

### 1. OpenFisca ne démarre pas

**Symptômes** :
- `docker ps | grep openfisca` → rien
- Container redémarre en boucle

**Diagnostic** :
```bash
# Voir les logs
docker logs openfisca-france --tail 50

# Vérifier le port
sudo ss -tulpn | grep 2000
```

**Solutions** :
```bash
# Port déjà utilisé → changer de port dans docker-compose.yml
# ou tuer le processus :
sudo lsof -ti:2000 | xargs sudo kill -9

# Image corrompue → re-télécharger
docker compose down
docker rmi openfisca/france:latest
docker compose pull
docker compose up -d

# Problème mémoire → augmenter les limites Docker
# Editer docker-compose.yml et ajouter:
deploy:
  resources:
    limits:
      memory: 2G
```

---

### 2. Erreur 502 Bad Gateway (Nginx)

**Symptômes** :
- `curl https://openfisca.example.com/spec` → 502

**Diagnostic** :
```bash
# Vérifier qu'OpenFisca tourne
docker ps | grep openfisca
curl http://127.0.0.1:2000/spec

# Vérifier les logs Nginx
sudo tail -f /var/log/nginx/openfisca-error.log
```

**Solutions** :
```bash
# OpenFisca down → redémarrer
docker compose restart

# Mauvais port dans nginx → vérifier config
sudo grep "proxy_pass" /etc/nginx/sites-available/openfisca
# Doit afficher: proxy_pass http://127.0.0.1:2000;

# Recharger Nginx
sudo nginx -t
sudo systemctl reload nginx
```

---

### 3. Certificat SSL expiré/invalide

**Symptômes** :
- Erreur SSL dans le navigateur
- `curl https://...` → erreur certificat

**Diagnostic** :
```bash
# Vérifier l'expiration
sudo certbot certificates

# Tester le certificat
openssl s_client -connect openfisca.example.com:443 -servername openfisca.example.com
```

**Solutions** :
```bash
# Renouveler manuellement
sudo certbot renew --force-renewal
sudo systemctl reload nginx

# Vérifier le cron de renouvellement
sudo crontab -l | grep certbot

# Si absent, ajouter:
sudo crontab -e
# Ajouter: 0 3 * * * certbot renew --quiet --post-hook "systemctl reload nginx"
```

---

### 4. SmartImmo: "fetch failed"

**Symptômes** :
- Bouton "Vérifier OpenFisca" → Toast rouge "fetch failed"
- Console navigateur : `ERR_CONNECTION_REFUSED`

**Diagnostic** :
```bash
# Depuis le serveur SmartImmo, tester OpenFisca
curl -v https://openfisca.example.com/spec

# Vérifier la variable d'env
grep OPENFISCA .env
```

**Solutions** :
```bash
# URL incorrecte → corriger .env
OPENFISCA_BASE_URL=https://openfisca.example.com

# HTTPS non configuré → utiliser HTTP temporairement
OPENFISCA_BASE_URL=http://127.0.0.1:2000  # Si même serveur

# Redémarrer SmartImmo
pm2 restart smartimmo

# Firewall bloque → ouvrir port 443
sudo ufw allow 443/tcp
```

---

### 5. Données OpenFisca incorrectes

**Symptômes** :
- "Vérifier OpenFisca" → OK mais `irCount: 0` ou `psRate: null`
- Logs: "Barème IR introuvable"

**Diagnostic** :
```bash
# Tester directement l'API OpenFisca
curl -s http://127.0.0.1:2000/parameters?year=2025 | jq '.impot_revenu.bareme'
curl -s http://127.0.0.1:2000/parameters?year=2025 | jq '.prelevements_sociaux'
```

**Solutions** :
```bash
# Année invalide → tester 2024 ou 2023
curl -s http://127.0.0.1:2000/parameters?year=2024 | jq .

# Version OpenFisca obsolète → mettre à jour
docker compose pull
docker compose up -d --force-recreate

# Vérifier la version
curl -s http://127.0.0.1:2000/spec | jq .info.version

# Mapping incorrect → adapter le code dans:
# src/services/tax/providers/openfisca/map.ts
# selon la structure réelle retournée par OpenFisca
```

---

### 6. Performance lente

**Symptômes** :
- Timeout après 15-30 secondes
- "Vérifier OpenFisca" prend >10s

**Diagnostic** :
```bash
# Vérifier les ressources Docker
docker stats openfisca-france

# Tester la latence
time curl -s http://127.0.0.1:2000/spec > /dev/null
```

**Solutions** :
```bash
# Augmenter les ressources CPU/RAM (docker-compose.yml)
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G

# Augmenter le timeout SmartImmo (.env)
OPENFISCA_TIMEOUT_MS=30000

# Redémarrer le container
docker compose restart

# Vérifier la charge serveur
top
free -h
df -h
```

---

### 7. CORS errors (navigateur)

**Symptômes** :
- Console navigateur : "CORS policy: No 'Access-Control-Allow-Origin'"
- Requêtes bloquées depuis SmartImmo

**Diagnostic** :
```bash
# Vérifier les headers CORS
curl -I https://openfisca.example.com/spec

# Tester avec Origin
curl -H "Origin: https://app.example.com" \
     -I https://openfisca.example.com/spec
```

**Solutions** :
```bash
# Ajouter/corriger CORS dans Nginx (/etc/nginx/sites-available/openfisca)
location / {
    # ...
    add_header Access-Control-Allow-Origin "https://app.example.com" always;
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type" always;
}

# Recharger Nginx
sudo nginx -t
sudo systemctl reload nginx
```

---

### 8. Logs ne s'affichent pas

**Symptômes** :
- `docker logs openfisca-france` → vide
- Difficulté à debugger

**Solutions** :
```bash
# Vérifier le log driver
docker inspect openfisca-france | jq '.[].HostConfig.LogConfig'

# Corriger dans docker-compose.yml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"

# Redémarrer
docker compose up -d --force-recreate

# Augmenter la verbosité
# Dans docker-compose.yml:
environment:
  - LOG_LEVEL=debug
```

---

### 9. DNS ne résout pas

**Symptômes** :
- `ping openfisca.example.com` → erreur
- Certificat SSL impossible à obtenir

**Diagnostic** :
```bash
# Vérifier la résolution DNS
dig +short openfisca.example.com
nslookup openfisca.example.com

# Vérifier depuis un autre serveur
curl -I http://openfisca.example.com
```

**Solutions** :
```bash
# Attendre propagation DNS (jusqu'à 48h)
# Forcer le refresh (selon votre provider DNS)

# Temporaire: utiliser /etc/hosts
echo "VOTRE_IP openfisca.example.com" | sudo tee -a /etc/hosts

# Vérifier la zone DNS chez votre registrar
# A record: openfisca.example.com → IP_SERVEUR
```

---

### 10. Mise à jour cassée

**Symptômes** :
- Après `docker compose pull`, OpenFisca ne fonctionne plus
- Nouvelles erreurs dans les logs

**Solutions** :
```bash
# Rollback vers l'ancienne version
docker images | grep openfisca
# Identifier le tag précédent

# Option 1: Utiliser une image taggée
# Editer docker-compose.yml
image: openfisca/france:42.0.0  # Version spécifique

# Option 2: Revenir à l'image précédente
docker tag openfisca/france:backup openfisca/france:latest

# Redémarrer
docker compose up -d --force-recreate

# Pinner la version dans docker-compose.yml pour éviter ça
```

---

## 🛠️ Commandes utiles

### Logs en temps réel
```bash
# OpenFisca
docker logs openfisca-france -f --tail 100

# Nginx
sudo tail -f /var/log/nginx/openfisca-access.log
sudo tail -f /var/log/nginx/openfisca-error.log
```

### Restart complet
```bash
# Tout redémarrer
docker compose restart
sudo systemctl restart nginx
```

### Nettoyage
```bash
# Supprimer les anciens containers/images
docker system prune -a

# Libérer l'espace logs
sudo truncate -s 0 /var/log/nginx/*.log
docker logs openfisca-france --tail 0
```

### Tests santé
```bash
# Docker health check
docker inspect openfisca-france | jq '.[].State.Health'

# OpenFisca direct
curl -s http://127.0.0.1:2000/spec | jq .info

# Via Nginx HTTPS
curl -s https://openfisca.example.com/health | jq .

# Depuis SmartImmo
curl -s https://app.example.com/api/admin/tax/openfisca/health?year=2025 | jq .
```

---

## 📞 Support

Si le problème persiste :

1. **Collecter les infos** :
   ```bash
   # Versions
   docker --version
   docker compose version
   nginx -v
   curl --version
   
   # Status
   docker ps -a | grep openfisca
   sudo systemctl status nginx
   
   # Logs complets
   docker logs openfisca-france --tail 200 > openfisca.log
   sudo tail -200 /var/log/nginx/openfisca-error.log > nginx-error.log
   ```

2. **Tester depuis zéro** :
   ```bash
   # Reset complet
   docker compose down
   docker rmi openfisca/france:latest
   sudo rm /etc/nginx/sites-enabled/openfisca
   
   # Réinstaller avec le script
   sudo ./scripts/deploy-openfisca.sh openfisca.example.com admin@example.com
   ```

3. **Consulter la documentation** :
   - [Guide de déploiement](DEPLOY_OPENFISCA_PRODUCTION.md)
   - [Guide healthcheck](OPENFISCA_HEALTHCHECK_GUIDE.md)
   - [Doc OpenFisca officielle](https://openfisca.org/doc/)

---

**✅ Bon courage ! La plupart des problèmes se résolvent avec un simple `docker compose restart` 😊**


# OpenFisca — Quick Start Guide

## 🚀 Installation en 5 minutes

### Option 1: Docker (Recommandé) ⭐

```bash
# 1. Démarrer OpenFisca-France
docker run -d \
  --name openfisca-france \
  -p 5000:5000 \
  openfisca/openfisca-france

# 2. Vérifier que ça tourne
curl http://localhost:5000/spec

# 3. Configurer SmartImmo
echo "OPENFISCA_BASE_URL=http://localhost:5000" >> .env.local

# 4. Démarrer SmartImmo
npm run dev

# ✅ C'est prêt !
```

### Option 2: Python/pip

```bash
# 1. Installer
pip install openfisca-france

# 2. Démarrer le serveur
openfisca serve --port 5000

# 3. Configurer SmartImmo
echo "OPENFISCA_BASE_URL=http://localhost:5000" >> .env.local

# 4. Démarrer SmartImmo
npm run dev
```

### Option 3: Instance publique (si disponible)

```bash
# Si une instance publique existe (vérifier avec l'équipe OF)
echo "OPENFISCA_BASE_URL=https://fr.openfisca.org/api" >> .env.local

# Tester
curl https://fr.openfisca.org/api/spec
```

---

## ✅ Vérification

### 1. OpenFisca répond

```bash
curl http://localhost:5000/spec

# Devrait retourner du JSON avec:
# {
#   "openapi": "3.0.0",
#   "info": { "title": "OpenFisca-France Web API", ... }
# }
```

### 2. SmartImmo se connecte

Logs du serveur Next.js :
```
[OpenFisca] Fetching: http://localhost:5000/spec
[OpenFisca] Success: /spec
[OpenFisca] Version: 1.13.0
```

### 3. Scraping récupère des données

Dans la modal de scraping :
```
✅ OpenFisca: 3 section(s) récupérée(s)
  ✅ IR: OK (OpenFisca, confiance: 60%)
  ✅ IR_DECOTE: OK (OpenFisca, confiance: 60%)
  ✅ PS: OK (OpenFisca, confiance: 60%)
```

---

## 🔧 Configuration avancée

### Cache Redis (optionnel)

```bash
# .env.local
OPENFISCA_BASE_URL=http://localhost:5000
REDIS_URL=redis://localhost:6379
OPENFISCA_CACHE_TTL=86400  # 24h en secondes
```

### Ajuster les chemins de mapping

Si la structure OF est différente, éditez `src/services/tax/providers/openfisca/map.ts` :

```typescript
// Exemple: Si le barème est ailleurs
const bareme = ofData?.custom?.path?.to?.bareme?.[year];
```

### Logs de debug

```typescript
// Dans map.ts, ajouter:
console.log('Structure OF reçue:', JSON.stringify(ofData, null, 2));
```

---

## 🐛 Problèmes courants

### "Cannot connect to OpenFisca"

**Vérifier** :
1. Container Docker tourne : `docker ps | grep openfisca`
2. Port 5000 libre : `netstat -an | grep 5000`
3. URL correcte dans `.env.local`

**Redémarrer** :
```bash
docker restart openfisca-france
```

### "Barème IR non trouvé"

**Cause** : Structure OF différente de celle attendue

**Solution** :
```bash
# 1. Récupérer la vraie structure
curl http://localhost:5000/parameters?date=2025-01-01 > debug-of.json

# 2. Analyser debug-of.json

# 3. Ajuster map.ts avec les bons chemins
```

### "Confiance toujours 60%"

**Cause** : Pas de source web concordante

**C'est normal en mode test** car les scrapers web ne fonctionnent pas encore.

**En production** : Une fois les scrapers ajustés, confiance montera à 100%.

---

## 📊 Monitoring

### Dashboard

Créer une page `/admin/openfisca/status` avec :
- ✅ Status: UP/DOWN
- ✅ Version
- ✅ Dernière requête
- ✅ Latence moyenne
- ✅ Taux de cache hit

### Healthcheck périodique

```typescript
// Vérifier toutes les 5 minutes
setInterval(async () => {
  const isUp = await healthcheck();
  if (!isUp) {
    console.error('[OpenFisca] Service DOWN!');
    // Envoyer alerte email
  }
}, 5 * 60 * 1000);
```

---

## 🎯 Utilisation en production

### Avant de publier

1. ✅ OpenFisca en production (pas localhost)
2. ✅ Haute disponibilité (load balancer, replicas)
3. ✅ Monitoring (uptime, latence)
4. ✅ Alertes si down
5. ✅ Backup (scrapers web fonctionnels)

### Mode hybride recommandé

```
Source primaire: OpenFisca (99% des cas)
         ↓
    Indisponible ?
         ↓
Fallback: Scrapers web BOFiP + DGFiP + SP
         ↓
    Échec complet ?
         ↓
Alerte admin + conservation version active
```

---

## 📝 Notes importantes

### OpenFisca-France vs OpenFisca-Core

- **OpenFisca-Core** : Moteur de calcul
- **OpenFisca-France** : Modèle fiscal français

**Vous avez besoin de** : `openfisca-france`

### Versions

OpenFisca sort des releases régulières alignées sur les lois de finances :
- v1.12.x : Loi de finances 2024
- v1.13.x : Loi de finances 2025
- etc.

**Recommandation** : Épingler une version en production.

### Performance

- Premier appel : ~500ms (chargement modèle)
- Appels suivants : ~50ms (cache)
- Cache SmartImmo : 24h
- Trafic : ~10 requêtes/mois (scraping manuel)

---

## ✅ Checklist de démarrage

- [ ] Docker installé
- [ ] Container OpenFisca démarré
- [ ] `/spec` répond
- [ ] Variable `OPENFISCA_BASE_URL` configurée
- [ ] SmartImmo démarre sans erreur
- [ ] Scraping teste OpenFisca
- [ ] Logs montrent "✅ OpenFisca: X sections"
- [ ] Barres de confiance affichées dans UI

---

## 🆘 Support

### Ressources

- **Forum OpenFisca** : https://github.com/openfisca/openfisca-france/discussions
- **Slack** : https://openfisca.org/fr/community
- **Issues** : https://github.com/openfisca/openfisca-france/issues

### Contacts

- **Technique** : Votre équipe dev
- **OpenFisca** : Community Slack

---

**Prêt en 5 minutes ! 🚀**


# Configuration OpenFisca — SmartImmo

## Variables d'environnement

Créez ou modifiez `.env.local` :

```bash
# ============================================================================
# Configuration OpenFisca pour SmartImmo
# ============================================================================

# URL de base de l'API OpenFisca-France (REQUIS si vous utilisez OpenFisca)
OPENFISCA_BASE_URL=http://localhost:5000

# Optionnel: Cache Redis pour OpenFisca
# REDIS_URL=redis://localhost:6379
# OPENFISCA_CACHE_TTL=86400

# ============================================================================
# Configuration Scraping (Optionnel - valeurs par défaut OK)
# ============================================================================

# Seuil minimum de sections OK pour créer une draft
# MIN_SECTIONS_OK=2

# Seuils de confiance pour publication
# MIN_CONFIDENCE_IR=0.8
# MIN_CONFIDENCE_PS=0.8
# MIN_CONFIDENCE_DEFAULT=0.6

# Rate Limiting
# SCRAPE_RATE_LIMIT=1
# SCRAPE_MAX_RETRIES=3
# SCRAPE_RETRY_DELAY=1000
```

## Installation OpenFisca

### Docker (Recommandé)

```bash
docker run -d \
  --name openfisca-france \
  -p 5000:5000 \
  openfisca/openfisca-france
```

### Python

```bash
pip install openfisca-france
openfisca serve --port 5000
```

## Test de connexion

### Méthode 1 : Bouton Healthcheck dans l'Admin

1. Accédez à `/admin/impots/parametres`
2. Onglet "Versions & Barèmes"
3. Cliquez sur **"Vérifier OpenFisca"**

Le bouton affiche :
- ✅ **Icône verte** : OpenFisca opérationnel
- ❌ **Icône rouge** : OpenFisca indisponible ou non configuré
- **Toast détaillé** : Nombre de tranches IR, taux PS, nombre de clés, durée de réponse

### Méthode 2 : API REST

```bash
# Vérifier la santé d'OpenFisca pour 2025
curl http://localhost:3000/api/admin/tax/openfisca/health?year=2025

# Réponse attendue (si OK):
{
  "ok": true,
  "baseUrl": "http://localhost:5000",
  "year": 2025,
  "durationMs": 156,
  "hasIR": true,
  "irCount": 5,
  "hasDecote": true,
  "hasPS": true,
  "psRate": 0.172,
  "hasMicro": true,
  "hasDeficit": true,
  "hasPer": true,
  "keys": ["impot_revenu", "prelevements_sociaux", ...],
  "totalKeys": 42,
  "warnings": []
}

# Réponse si erreur:
{
  "ok": false,
  "baseUrl": "http://localhost:5000",
  "error": "OpenFisca HTTP 500: Internal Server Error",
  "durationMs": 2345,
  "configured": true
}
```

### Méthode 3 : Direct OpenFisca

```bash
# Vérifier qu'OpenFisca répond
curl http://localhost:5000/spec

# Devrait retourner du JSON avec:
# {
#   "openapi": "3.0.0",
#   "info": { "title": "OpenFisca-France Web API" }
# }
```

## Sans OpenFisca

Le module fonctionne **sans OpenFisca**, mais :
- ⚠️ Confiance réduite (max 80% au lieu de 100%)
- ⚠️ Publication IR/PS plus difficile (besoin ≥2 sources web concordantes)
- ✅ Scrapers web prennent le relais automatiquement

C'est un **mode dégradé fonctionnel**.


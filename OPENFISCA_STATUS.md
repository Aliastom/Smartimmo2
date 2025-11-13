# État actuel OpenFisca — SmartImmo

Date : 8 novembre 2025

---

## ✅ Ce qui fonctionne

### 1. Image Docker personnalisée

- ✅ **Image buildée** : `aliastom/openfisca-france:stable`
- ✅ **Version** : OpenFisca-France 174.2.8
- ✅ **Container démarré** : `openfisca-france`
- ✅ **Port mapping** : 8000 (interne) → 2000 (externe)
- ✅ **API accessible** : `http://localhost:2000/spec`
- ✅ **Réponse rapide** : ~26ms

```bash
# Test
curl http://localhost:2000/spec
# ✅ Retourne OpenAPI spec complet
```

### 2. Fichiers créés

| Fichier | État |
|---------|------|
| `infra/openfisca/Dockerfile` | ✅ Créé |
| `infra/openfisca/docker-compose.openfisca.yml` | ✅ Créé et fonctionnel |
| `infra/openfisca/.dockerignore` | ✅ Créé |
| `.github/workflows/build-openfisca.yml` | ✅ Créé |
| `infra/openfisca/README_OPENFISCA_NO_DNS.md` | ✅ Créé |
| `OPENFISCA_DOCKER_CUSTOM.md` | ✅ Créé |

### 3. Healthcheck SmartImmo

- ✅ **API route** : `/api/admin/tax/openfisca/health`
- ✅ **Bouton UI** : "Vérifier OpenFisca" dans `/admin/impots/parametres`
- ✅ **Connexion OK** : Détecte qu'OpenFisca répond
- ⚠️ **Données fiscales** : Extraction non implémentée (voir ci-dessous)

---

## ⚠️ Limitations actuelles

### Mapping des données non terminé

**Problème** : L'API REST OpenFisca fonctionne différemment de ce qu'on pensait.

**Ce qu'on attendait** :
```bash
GET /parameters?year=2025
# Retour attendu :
{
  "impot_revenu": {
    "bareme": [
      { "lower": 0, "upper": 11295, "rate": 0 },
      { "lower": 11295, "upper": 28797, "rate": 0.11 },
      ...
    ]
  },
  "prelevements_sociaux": { "taux": 0.172 }
}
```

**Ce qu'OpenFisca retourne** :
```bash
GET /parameters
# Retour réel :
{
  "impot_revenu.bareme": { "href": "http://localhost:2000/parameter/impot_revenu.bareme" },
  "taxation_capital.prelevements_sociaux.csg": { "href": "..." },
  ...
}
```

**Impact** :
- ✅ Healthcheck indique qu'OpenFisca répond
- ⚠️ Toast affiche "warnings" (normal, données non extraites)
- ❌ Provider OpenFisca (`src/services/tax/providers/openfisca/`) ne peut pas extraire IR/PS

---

## 🔧 Solutions possibles

### Option A : Utiliser l'endpoint `/calculate` (recommandé)

Au lieu de `/parameters`, utiliser `/calculate` avec un cas de test :

```bash
POST /calculate
{
  "persons": { "alice": {} },
  "households": { "household": { "parents": ["alice"] } },
  "period": "2025-01",
  "variables": {
    "salaire_net": { "2025-01": { "alice": 30000 } },
    "impot_revenu": { "2025-01": { "alice": null } }
  }
}
```

OpenFisca calcule l'IR et retourne les formules utilisées (incluant le barème).

### Option B : Appeler `/parameter/{id}` pour chaque section

```bash
GET /parameter/impot_revenu.bareme
GET /parameter/taxation_capital.prelevements_sociaux.csg.taux_global.revenus_du_patrimoine
```

Mais c'est lent (plusieurs requêtes).

### Option C : Désactiver temporairement OpenFisca (mode dégradé)

Le module SmartImmo fonctionne **sans OpenFisca** :
- ✅ Scrapers web (BOFIP, DGFIP, Service-Public)
- ✅ Confiance max 80% (au lieu de 100%)
- ✅ Publication IR/PS si ≥2 sources concordantes

**C'est l'option la plus simple pour l'instant !**

---

## 🎯 Recommandation actuelle

### Pour tester le module de scraping fiscal :

1. **Commentez `OPENFISCA_BASE_URL`** dans `.env.local` :
   ```bash
   # OPENFISCA_BASE_URL=http://localhost:2000
   ```

2. **Redémarrez Next.js** :
   ```bash
   Ctrl+C
   npm run dev
   ```

3. **Testez le scraping** :
   - Allez sur `/admin/impots/parametres`
   - Supprimez les brouillons existants
   - Cliquez "Mettre à jour depuis sources officielles"
   - **Vérifiez qu'il n'y a PLUS de suppressions de données** (grâce au `deepMerge`)

### Le module fonctionnera en mode dégradé :

```
[timestamp] ⚠️ OpenFisca non disponible, utilisation des scrapers web uniquement
[timestamp] Fetch depuis BofipAdapter...
[timestamp] Fetch depuis DgfipAdapter...
[timestamp] Fetch depuis ServicePublicAdapter...
[timestamp] 📋 Sources disponibles par section:
[timestamp]   • IR: 1 source(s) → BOFIP
[timestamp]   • PS: 1 source(s) → SERVICE_PUBLIC
[timestamp]   • MICRO: 1 source(s) → BOFIP
...
```

**Confiance** : 60-80% au lieu de 100%  
**Publication** : OK si IR et PS confirmés par ≥2 sources (ou 1 source + validation manuelle)

---

## 🚀 Prochaines étapes (TODO)

### Court terme

1. ✅ **Tester le scraping sans OpenFisca** → Vérifier que `deepMerge` fonctionne
2. ✅ **Vérifier les diffs** → Plus de suppressions de `micro.bic*`, `per.*`, etc.
3. ✅ **Pusher l'image Docker** : `docker push aliastom/openfisca-france:stable`

### Moyen terme

1. ⏸️ **Implémenter le mapping OpenFisca correct** :
   - Adapter `src/services/tax/providers/openfisca/client.ts`
   - Utiliser `/calculate` ou `/parameter/{id}`
   - Mettre à jour `map.ts` avec la vraie structure
2. ⏸️ **Tester avec OpenFisca actif** → Confiance 100%

### Long terme

1. ⏸️ Configurer GitHub Actions (build automatique)
2. ⏸️ Déploiement production (DNS + HTTPS si besoin)

---

## 📋 Checklist actuelle

| Tâche | État |
|-------|------|
| Image Docker OpenFisca buildée | ✅ Fait |
| Container Docker démarré | ✅ Fait |
| API OpenFisca répond | ✅ Fait (26ms) |
| Healthcheck SmartImmo API | ✅ Fait |
| Healthcheck SmartImmo UI | ✅ Fait (warnings normaux) |
| Mapping données fiscales | ⏸️ TODO |
| Test scraping sans OpenFisca | ⏸️ À tester |
| Test `deepMerge` (pas de suppressions) | ⏸️ À tester |
| Push image Docker Hub | ⏸️ En attente validation |

---

## 🧪 Tests à faire MAINTENANT

### Test 1 : Scraping sans OpenFisca (prioritaire)

**But** : Vérifier que le bug de suppression est corrigé avec `deepMerge`.

1. Commenter `OPENFISCA_BASE_URL` dans `.env.local`
2. Redémarrer Next.js
3. Aller sur `/admin/impots/parametres`
4. Supprimer les anciens brouillons
5. Cliquer "Mettre à jour depuis sources officielles"
6. Attendre le scraping
7. **Vérifier le diff** : Devrait avoir des ajouts, PAS de suppressions

**Résultat attendu** :
- ✅ 0 suppression de `micro.bic*`, `per.*`, etc.
- ✅ Fusion sécurisée section par section
- ✅ Log "X section(s) mise(s) à jour, Y section(s) conservée(s)"

---

**📌 L'intégration OpenFisca complète peut attendre. Testons d'abord le scraping fiscal qui est le cœur du système ! 🎯**


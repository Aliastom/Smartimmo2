# Module OpenFisca — Intégration Complète ✅

> **SmartImmo** — Source primaire programmatique + Fusion à consensus

---

## 🎯 Objectif atteint

OpenFisca-France est maintenant intégré comme **source primaire** pour les barèmes fiscaux, avec un système de **fusion à consensus** garantissant la fiabilité des données.

---

## 📦 Architecture créée

```
src/services/tax/providers/
├── openfisca/
│   ├── client.ts                 ✅ Client HTTP + cache 24h
│   ├── map.ts                    ✅ Mapping OF → TaxPartial
│   ├── OpenfiscaProvider.ts      ✅ Provider principal
│   └── __tests__/
│       └── mapping.test.ts       ✅ Tests mapping
├── consensus/
│   ├── confidence.ts             ✅ Scores de confiance
│   ├── ConsensusMerger.ts        ✅ Fusion à consensus
│   └── __tests__/
│       └── confidence.test.ts    ✅ Tests confiance

src/services/tax/sources/
└── TaxScrapeWorker.ts            🔧 Intégration OpenFisca

src/app/api/admin/tax/versions/[id]/
└── publish/route.ts              🔧 Blocage confiance < seuil
```

---

## 🔄 Flux de données

```
┌─────────────────────┐
│   OpenFisca API     │ Source primaire (confiance +0.6)
│  (programmatique)   │
└──────────┬──────────┘
           │
           ├─ IR brackets (5 tranches)
           ├─ IR décote (seuils + facteur)
           └─ PS rate (17.2%)
           │
           ▼
┌──────────────────────────────────────────┐
│        Fusion à consensus                │
│                                          │
│  + BOFiP   (confiance +0.2 si concordant)│
│  + DGFiP   (confiance +0.2 si concordant)│
│  + Service-Public                        │
└──────────┬───────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│   Score de confiance par section         │
│                                          │
│  IR: 1.0 (OpenFisca + BOFIP concordant) │
│  PS: 0.8 (OpenFisca + divergence)       │
│  MICRO: 0.6 (BOFIP seul)                │
└──────────┬───────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│   Validation & Seuils                    │
│                                          │
│  Sections critiques (IR, PS) ≥ 0.8 ✅    │
│  Autres sections ≥ 0.6 ✅                │
│  Minimum 2 sections OK ✅                │
└──────────┬───────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│   mergeSafely()                          │
│  Remplace SEULEMENT sections 'ok'        │
│  Conserve sections manquantes/invalides  │
└──────────┬───────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│   Version DRAFT créée                    │
│  Status: draft-created | partial-merge   │
│  Notes: source + confiance par section   │
└──────────────────────────────────────────┘
```

---

## 🎯 Système de confiance

### Scoring

| Situation | Score | Publication ? |
|-----------|-------|---------------|
| OpenFisca + ≥1 source concordante | 1.0 (100%) | ✅ Oui |
| OpenFisca + ≥1 source divergente | 0.8 (80%) | ✅ Oui (sections critiques) |
| OpenFisca seul | 0.6 (60%) | ❌ Non (sections critiques) |
| ≥2 sources web concordantes | 0.8 (80%) | ✅ Oui |
| 1 source web (BOFIP) | 0.5 (50%) | ❌ Non (sections critiques) |
| 1 source web (DGFIP/SP) | 0.3-0.4 | ❌ Non |
| Aucune source | 0.0 (0%) | ❌ Non |

### Seuils de publication

**Sections critiques** (IR, PS) :
- ✅ Confiance ≥ 80% requise
- ❌ Publication bloquée si < 80%

**Autres sections** (MICRO, PER, etc.) :
- ✅ Confiance ≥ 60% recommandée
- ⚠️ Warning si < 60%

---

## 🔧 Configuration

### 1. Variables d'environnement

Créer `.env.local` :

```bash
# URL de votre instance OpenFisca-France
OPENFISCA_BASE_URL=http://localhost:5000

# Ou utiliser une instance publique (si disponible)
# OPENFISCA_BASE_URL=https://fr.openfisca.org/api
```

### 2. Installation OpenFisca (local)

```bash
# Option A: Docker (recommandé)
docker run -d -p 5000:5000 openfisca/openfisca-france

# Option B: Python
pip install openfisca-france
openfisca serve

# Vérifier
curl http://localhost:5000/spec
```

### 3. Test de connexion

```bash
# Depuis Node.js
npm run dev

# Vérifier les logs
[OpenFisca] Fetching: http://localhost:5000/spec
[OpenFisca] Success: /spec
[OpenFisca] Version: 1.x.x
```

---

## 🧪 Tests

```bash
# Tests OpenFisca
npm test src/services/tax/providers/openfisca/__tests__/mapping.test.ts

# Tests consensus
npm test src/services/tax/providers/consensus/__tests__/confidence.test.ts

# Tests complétude
npm test src/services/tax/sources/__tests__/completeness.test.ts

# Tous les tests
npm test src/services/tax
```

---

## 🎨 Exemples de résultats

### Cas 1: OpenFisca + Web concordants (IDÉAL)

```
📊 Complétude: 7 OK, 0 manquantes, 0 invalides

  ✅ IR: OK (OpenFisca, confiance: 100%)
  ✅ IR_DECOTE: OK (OpenFisca, confiance: 100%)
  ✅ PS: OK (OpenFisca, confiance: 100%)
  ✅ MICRO: OK (BOFIP, confiance: 80%)
  ✅ DEFICIT: OK (SERVICE_PUBLIC, confiance: 60%)
  ✅ PER: OK (SERVICE_PUBLIC, confiance: 60%)
  ✅ SCI_IS: OK (SERVICE_PUBLIC, confiance: 60%)

✅ Version draft créée: 2025.of-a1b2c3
Status: draft-created
Publication: ✅ Autorisée
```

### Cas 2: OpenFisca OK + Web partiel

```
📊 Complétude: 4 OK, 3 manquantes, 0 invalides

  ✅ IR: OK (OpenFisca, confiance: 100%)
  ✅ IR_DECOTE: OK (OpenFisca, confiance: 60%) ⚠️
  ✅ PS: OK (OpenFisca, confiance: 60%) ⚠️
  ✅ MICRO: OK (BOFIP, confiance: 50%)
  ⚪ DEFICIT: MANQUANTE
  ⚪ PER: MANQUANTE
  ⚪ SCI_IS: MANQUANTE

⚠️ Version draft créée: 2025.of-a1b2c3
Status: partial-merge
Publication: ❌ Bloquée (PS confiance 60% < 80%)
```

### Cas 3: OpenFisca indisponible + Web partiel

```
⚠️ OpenFisca non disponible

📊 Complétude: 2 OK, 5 manquantes, 0 invalides

  ✅ MICRO: OK (BOFIP, confiance: 50%)
  ✅ PER: OK (SERVICE_PUBLIC, confiance: 30%)
  ⚪ IR: MANQUANTE ⛔
  ⚪ PS: MANQUANTE ⛔
  ...

⚠️ Version draft créée: 2025.import-xxx
Status: partial-merge
Publication: ❌ Bloquée (IR et PS manquantes)
```

### Cas 4: Tout échoue

```
⚠️ OpenFisca non disponible
⚠️ BofipAdapter: Erreur 404
⚠️ DgfipAdapter: Timeout
⚠️ ServicePublicAdapter: Erreur
⚠️ LegifranceAdapter: 403 Cloudflare

📊 Complétude: 0 OK, 7 manquantes, 0 invalides

❌ Scraping incomplet
Aucune version draft créée.
```

---

## 🛡️ Garanties de sécurité

### ✅ OpenFisca comme garde-fou

1. **Source programmatique** : Pas de parsing HTML fragile
2. **Versionnée** : Chaque release OF correspond à une loi de finances
3. **Testée** : OpenFisca a ses propres tests unitaires
4. **Open-source** : Code auditable

### ✅ Consensus multi-sources

- OpenFisca **+ au moins 1 source web concordante** = confiance 100%
- OpenFisca **seul** = confiance 60% → bloqué pour IR/PS
- Web seul = confiance variable selon nombre de sources

### ✅ Aucune suppression possible

Même si :
- OpenFisca est down → Web scrapers prennent le relais
- Web scrapers échouent → Sections marquées 'missing', valeurs conservées
- Tout échoue → Aucune draft créée

---

## 📊 Métriques affichées

### Dans la modal

**Barre de confiance par section** :
- 🟢 Vert (≥80%) : Excellente
- 🔵 Bleu (≥60%) : Bonne
- 🟡 Jaune (≥40%) : Moyenne
- 🔴 Rouge (<40%) : Faible

**Source affichée** :
- `(OpenFisca)` : Données OF
- `(BOFIP)` : Données BOFiP
- etc.

### Dans les logs

```
[timestamp] Fetch depuis OpenFisca...
[timestamp] ✅ OpenFisca: 3 section(s) récupérée(s)
[timestamp] Fetch depuis BofipAdapter...
[timestamp] ✅ BofipAdapter: 2 section(s) en 1500ms
...
[timestamp] 📊 Complétude: 5 OK, 2 manquantes, 0 invalides
[timestamp]   ✅ IR: OK (OpenFisca, confiance: 100%)
[timestamp]   ✅ PS: OK (OpenFisca, confiance: 100%)
```

---

## 🚀 Utilisation

### 1. Démarrer OpenFisca

```bash
# Docker (recommandé)
docker run -d \
  -p 5000:5000 \
  --name openfisca-france \
  openfisca/openfisca-france

# Vérifier
curl http://localhost:5000/spec
```

### 2. Configurer SmartImmo

Fichier `.env.local` :
```bash
OPENFISCA_BASE_URL=http://localhost:5000
```

### 3. Tester

```bash
npm run dev

# Aller sur /admin/impots/parametres
# Cliquer "Mettre à jour depuis sources officielles"
```

### 4. Observer les logs

```
[OpenFisca] Fetching: http://localhost:5000/parameters
[OpenFisca] Success: /parameters
[OpenFisca] Version: 1.13.0
[TaxScrapeWorker] ✅ OpenFisca: 3 section(s) récupérée(s)
```

---

## 📝 Structure des données OpenFisca

### Format attendu (exemple)

```json
{
  "parameters": {
    "impot_revenu": {
      "bareme": {
        "2024": [
          { "seuil_min": 0, "seuil_max": 11294, "taux": 0 },
          { "seuil_min": 11294, "seuil_max": 28797, "taux": 0.11 },
          { "seuil_min": 28797, "seuil_max": 82341, "taux": 0.30 },
          { "seuil_min": 82341, "seuil_max": 177106, "taux": 0.41 },
          { "seuil_min": 177106, "seuil_max": null, "taux": 0.45 }
        ]
      },
      "decote": {
        "2024": {
          "seuil_celibataire": 1929,
          "seuil_couple": 3858,
          "facteur": 0.75
        }
      }
    },
    "prelevements_sociaux": {
      "patrimoine": {
        "2025": {
          "taux_global": 0.172
        }
      }
    }
  },
  "version": "1.13.0"
}
```

### Ajustements possibles

Le mapping dans `map.ts` essaie plusieurs chemins :
```typescript
// Chemins possibles pour le barème IR
ofData?.parameters?.impot_revenu?.bareme?.[year-1]
ofData?.impot_revenu?.bareme?.[year]
ofData?.bareme?.[year]
```

**Si votre instance OF a une structure différente**, ajustez dans `map.ts`.

---

## 🎯 Règles de consensus

### 1. OpenFisca TOUJOURS prioritaire si présent

```typescript
sources = [OpenFisca, BOFIP, DGFIP]
       ↓
Choisi: OpenFisca ✅
```

### 2. Concordance ajoute +0.4 confiance

```typescript
OpenFisca: IR = [0%, 11%, 30%, 41%, 45%]
BOFIP:     IR = [0%, 11%, 30%, 41%, 45%] ✅ Concordant
                                         
Confiance: 0.6 (OF) + 0.4 (concordance) = 1.0 ✅
```

### 3. Divergence réduit à +0.2

```typescript
OpenFisca: PS = 17.2%
BOFIP:     PS = 17.4% ⚠️ Divergence

Confiance: 0.6 (OF) + 0.2 (présence autre source) = 0.8 ✅
Warning: "Divergence détectée entre OpenFisca et BOFIP"
```

### 4. Sections bloquantes

```typescript
if (section === 'IR' || section === 'PS') {
  if (confidence < 0.8) {
    blocking.push(section);
    // ❌ Pas de draft créée
  }
}
```

---

## ⚠️ Fallback si OpenFisca indisponible

Si OpenFisca ne répond pas :
1. ⚠️ Log: "OpenFisca non disponible"
2. ✅ Scrapers web utilisés normalement
3. ⚠️ Confiance réduite (max 0.8 au lieu de 1.0)
4. ⚠️ Publication bloquée pour IR/PS sauf si ≥2 sources web concordantes

---

## 🔐 Sécurités en place

### ✅ Validation multi-niveaux

1. **Structure** : Champs requis présents
2. **Valeurs** : Bornes respectées (taux [0,1], montants >0)
3. **Cohérence** : Tranches croissantes, décote logique
4. **Consensus** : Concordance entre sources
5. **Confiance** : Score ≥ seuil

### ✅ Protection anti-suppression

- Sections non scrapées → **conservées**
- Sections invalides → **conservées**
- Confiance insuffisante → **draft non créée ou publication bloquée**

### ✅ Audit trail

- Source par section dans notes
- Score de confiance sauvegardé
- Snapshots de tous les contenus
- Métriques de performance

---

## 🧪 Scénarios testés

### Test 1: OpenFisca OK + BOFIP concordant

```typescript
it('should create draft with max confidence', () => {
  // OpenFisca: IR 5 tranches
  // BOFIP: IR 5 tranches identiques
  // Résultat: confiance 100%, draft créée ✅
});
```

### Test 2: OpenFisca seul (IR/PS)

```typescript
it('should block due to insufficient confidence', () => {
  // OpenFisca seul: confiance 60%
  // Seuil IR/PS: 80%
  // Résultat: pas de draft ❌ (sections bloquantes)
});
```

### Test 3: OpenFisca down + 2 sources web

```typescript
it('should use web sources as fallback', () => {
  // OpenFisca: indisponible
  // BOFIP + DGFIP: concordants
  // Résultat: confiance 80%, draft créée ✅
});
```

---

## 📖 API OpenFisca utilisée

### Endpoints

```bash
# Spec (metadata)
GET /spec

# Paramètres (avec date)
GET /parameters?date=2025-01-01

# Paramètre spécifique
GET /parameter/impot_revenu?date=2025-01-01
GET /parameter/prelevements_sociaux?date=2025-01-01
```

### Stratégies de fetch

Le provider essaie **3 stratégies** dans l'ordre :

1. `GET /parameters?date=YYYY-01-01` (endpoint global)
2. `GET /parameter/{name}?date=YYYY-01-01` (par paramètre)
3. `GET /spec` puis parsing des definitions (fallback)

---

## 🐛 Dépannage

### OpenFisca ne répond pas

```
Erreur: [OpenFisca] Error fetching /spec: connect ECONNREFUSED
```

**Solutions** :
1. Vérifier que le container Docker tourne
2. Vérifier `OPENFISCA_BASE_URL` dans `.env.local`
3. Tester manuellement : `curl http://localhost:5000/spec`

### Structure OF différente

```
Erreur: [OpenFisca] Barème IR non trouvé pour 2025
```

**Solution** :
1. Récupérer manuellement : `curl http://localhost:5000/parameters?date=2025-01-01 > of-2025.json`
2. Analyser la structure dans `of-2025.json`
3. Ajuster les chemins dans `map.ts`

### Confiance toujours 60%

```
⚠️ IR: OK (OpenFisca, confiance: 60%)
```

**Cause** : Pas de source web concordante

**Solutions** :
1. Ajuster les adapters web pour qu'ils fonctionnent
2. Ou accepter 60% et modifier le seuil critique à 0.6 (déconseillé)

---

## 🔮 Roadmap

### v1.1 (court terme)

- [ ] Ajouter cache persistant (Redis) pour OpenFisca
- [ ] Healthcheck au démarrage de l'app
- [ ] Retry automatique si OF timeout
- [ ] Notification email si OF down pendant >24h

### v1.2 (moyen terme)

- [ ] Support multi-pays (OpenFisca-UK, etc.)
- [ ] Détection automatique des releases OF (webhook)
- [ ] Pré-calcul des confidences pour toutes les années
- [ ] Dashboard de monitoring OF + scrapers

### v2.0 (long terme)

- [ ] Pipeline YAML → PR GitHub pour validation
- [ ] ML pour détection d'anomalies entre OF et web
- [ ] API publique de consultation des barèmes
- [ ] Calcul temps réel via OF (pas seulement paramètres)

---

## 📚 Ressources

### OpenFisca

- **Site officiel** : https://openfisca.org/fr
- **GitHub** : https://github.com/openfisca/openfisca-france
- **Documentation** : https://openfisca.org/doc
- **Docker** : https://hub.docker.com/r/openfisca/openfisca-france

### SmartImmo

- **Guide scraping** : `MODULE_SCRAPING_FISCAL_GUIDE.md`
- **Hardening** : `MODULE_SCRAPING_HARDENING_COMPLETE.md`
- **Installation** : `INSTALL_SCRAPING_FISCAL.md`

---

## ✅ Checklist finale

- [x] Client OpenFisca avec cache 24h
- [x] Mapping OF → TaxPartial (IR, décote, PS)
- [x] Provider avec 3 stratégies de fetch
- [x] Système de score de confiance
- [x] ConsensusMerger avec règles
- [x] Intégration au worker
- [x] UI barres de confiance
- [x] Blocage publication si confiance < seuil
- [x] Tests unitaires (mapping, confiance)
- [x] Documentation complète

---

## 🎉 Conclusion

**OpenFisca est maintenant la source primaire de SmartImmo pour les barèmes fiscaux !**

**Ce qui change** :
- ✅ Données IR, décote, PS depuis une **API fiable**
- ✅ Validation croisée avec web scrapers
- ✅ Score de confiance transparent
- ✅ Publication sécurisée (seuil 80%)
- ✅ Fusion non destructive garantie

**Prochaines étapes** :
1. Démarrer OpenFisca (Docker)
2. Configurer `OPENFISCA_BASE_URL`
3. Tester un scraping
4. Observer les scores de confiance

---

**Développé avec ❤️ pour SmartImmo — Novembre 2025**

*Module production-ready avec OpenFisca ! 🚀*


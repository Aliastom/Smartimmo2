# Guide Healthcheck OpenFisca — SmartImmo

## 🎯 Objectif

Vérifier rapidement la disponibilité et la qualité des données OpenFisca sans lancer un scraping complet.

---

## ✅ Ce qui a été implémenté

### 1. API Route : `/api/admin/tax/openfisca/health`

**Fichier** : `src/app/api/admin/tax/openfisca/health/route.ts`

**Fonctionnalités** :
- ✅ Vérifie la connexion à OpenFisca (`OPENFISCA_BASE_URL`)
- ✅ Teste la récupération des paramètres pour une année donnée
- ✅ Extrait les sections disponibles (IR, décote, PS, micro, déficit, PER)
- ✅ Calcule le temps de réponse (durée en ms)
- ✅ Génère des warnings si sections critiques manquantes
- ✅ Timeout de 10 secondes pour éviter les blocages

**Usage API** :
```bash
# GET avec année en paramètre (défaut: année en cours)
curl http://localhost:3000/api/admin/tax/openfisca/health?year=2025

# Réponse (si OK):
{
  "ok": true,
  "baseUrl": "http://localhost:5000",
  "year": 2025,
  "durationMs": 156,
  "hasIR": true,
  "irCount": 5,              // Nombre de tranches IR
  "hasDecote": true,
  "hasPS": true,
  "psRate": 0.172,           // Taux PS (17.2%)
  "hasMicro": true,
  "hasDeficit": true,
  "hasPer": true,
  "keys": ["impot_revenu", "prelevements_sociaux", ...],
  "totalKeys": 42,
  "warnings": []             // Ex: ["Barème IR incomplet (2 tranches)"]
}

# Réponse (si erreur):
{
  "ok": false,
  "baseUrl": "(non configurée)",
  "error": "OPENFISCA_BASE_URL non configurée",
  "durationMs": 23,
  "configured": false
}
```

---

### 2. Bouton Admin UI

**Fichier** : `src/components/admin/fiscal/OpenfiscaHealthButton.tsx`

**Localisation** : `/admin/impots/parametres` → Onglet "Versions & Barèmes"

**Fonctionnalités** :
- 🔘 Bouton **"Vérifier OpenFisca"** avec icône dynamique
- ✅ **Icône verte** (CheckCircle) : OpenFisca opérationnel
- ❌ **Icône rouge** (AlertCircle) : OpenFisca indisponible
- 🔄 **Spinner** pendant la vérification
- 📊 **Toast détaillé** avec :
  - Nombre de tranches IR
  - Taux PS (%)
  - Sections disponibles (Décote, Micro, Déficit, PER)
  - Durée de réponse (ms)
  - Nombre total de paramètres

**États du bouton** :
1. **Initial** : Icône "Activity" grise
2. **Loading** : Spinner animé + texte "Vérification…"
3. **Succès** : Icône verte + toast vert détaillé
4. **Warning** : Icône jaune + toast jaune avec warnings
5. **Erreur** : Icône rouge + toast rouge avec message d'erreur

---

### 3. Logs Worker détaillés

**Fichier** : `src/services/tax/sources/TaxScrapeWorker.ts`

**Logs ajoutés** (affichés dans la modal de scraping) :

```
[timestamp] 12 sections récupérées au total (3 OpenFisca + 9 web)
[timestamp] 📋 Sources disponibles par section:
[timestamp]   • IR: 2 source(s) → OPENFISCA, BOFIP
[timestamp]   • IR_DECOTE: 1 source(s) → OPENFISCA
[timestamp]   • PS: 2 source(s) → OPENFISCA, SERVICE_PUBLIC
[timestamp]   • MICRO: 1 source(s) → BOFIP
[timestamp]   • DEFICIT: 1 source(s) → DGFIP
[timestamp]   • PER: aucune source
[timestamp]   • SCI_IS: aucune source
```

**Avantage** : Permet de diagnostiquer rapidement quelles sources répondent AVANT la fusion.

---

### 4. Documentation

**Fichier** : `CONFIGURATION_OPENFISCA.md`

**Ajouts** :
- Section "Test de connexion" avec 3 méthodes :
  1. **Bouton Healthcheck** dans l'admin (recommandé)
  2. **API REST** via curl
  3. **Direct OpenFisca** (endpoint `/spec`)
- Exemples de réponses JSON détaillées
- Interprétation des warnings

---

## 🚀 Utilisation

### Test rapide (sans OpenFisca)

1. Lancer l'app : `npm run dev`
2. Aller sur `/admin/impots/parametres`
3. Cliquer **"Vérifier OpenFisca"**
4. Voir le toast : "OpenFisca non configuré"

### Test avec OpenFisca

1. **Installer OpenFisca** :
   ```bash
   pip install openfisca-france
   openfisca serve --port 5000
   ```

2. **Configurer** `.env.local` :
   ```bash
   OPENFISCA_BASE_URL=http://localhost:5000
   ```

3. **Redémarrer** l'app : `npm run dev`

4. **Tester** :
   - Aller sur `/admin/impots/parametres`
   - Cliquer **"Vérifier OpenFisca"**
   - ✅ Toast vert : "OpenFisca opérationnel (2025)"
     - IR: 5 tranches • Décote: ✓ • PS: 17.2% • Micro: ✓ • Déficit: ✓ • PER: ✓
     - 156ms • 42 paramètres disponibles

---

## 🐛 Diagnostics courants

### Erreur : "OpenFisca non configuré"

**Cause** : Variable `OPENFISCA_BASE_URL` absente dans `.env.local`

**Solution** :
```bash
# Ajouter dans .env.local
OPENFISCA_BASE_URL=http://localhost:5000
```

### Erreur : "OpenFisca HTTP 500"

**Cause** : OpenFisca ne répond pas ou URL incorrecte

**Solution** :
1. Vérifier qu'OpenFisca tourne : `curl http://localhost:5000/spec`
2. Vérifier l'URL dans `.env.local`
3. Redémarrer OpenFisca : `openfisca serve --port 5000`

### Warning : "Barème IR incomplet (2 tranches)"

**Cause** : OpenFisca ne renvoie pas assez de tranches IR

**Solution** :
- Vérifier la version d'OpenFisca installée
- Tester avec une autre année : `?year=2024`
- Vérifier le mapping dans `src/services/tax/providers/openfisca/map.ts`

### Warning : "Taux PS introuvable"

**Cause** : Le chemin d'extraction du taux PS ne correspond pas à la structure de données d'OpenFisca

**Solution** :
- Vérifier la réponse brute d'OpenFisca :
  ```bash
  curl "http://localhost:5000/parameters?year=2025" | jq .
  ```
- Adapter les chemins dans `src/app/api/admin/tax/openfisca/health/route.ts` (lignes 44-48)

---

## 📊 Métriques observées

Le healthcheck retourne les métriques suivantes (utiles pour le monitoring) :

| Métrique | Description | Valeur type |
|----------|-------------|-------------|
| `durationMs` | Temps de réponse d'OpenFisca | 50-500ms |
| `irCount` | Nombre de tranches IR | 5 |
| `psRate` | Taux PS global | 0.172 (17.2%) |
| `totalKeys` | Nombre de paramètres disponibles | 30-50 |
| `hasIR`, `hasPS`, ... | Disponibilité des sections | true/false |

**Usage pour alerting** :
- Si `durationMs > 5000ms` → Performance dégradée
- Si `irCount < 3` → Données incomplètes
- Si `hasPS === false` → Section critique manquante

---

## 🎁 Bonus : Polling automatique (futur)

Idée pour v2 :
- Polling léger toutes les 24h
- Badge d'état dans l'UI : "OpenFisca : 🟢 OK" / "🔴 KO"
- Notification admin si dégradation

**Implementation** (à faire) :
```tsx
// Dans ParametresClient.tsx
useEffect(() => {
  const checkHealth = async () => {
    const res = await fetch('/api/admin/tax/openfisca/health');
    const data = await res.json();
    setOpenfiscaStatus(data.ok ? 'ok' : 'ko');
  };
  
  checkHealth();
  const interval = setInterval(checkHealth, 24 * 60 * 60 * 1000); // 24h
  return () => clearInterval(interval);
}, []);
```

---

## ✅ Résumé des fichiers créés/modifiés

| Fichier | Type | Description |
|---------|------|-------------|
| `src/app/api/admin/tax/openfisca/health/route.ts` | ✨ Nouveau | API healthcheck |
| `src/components/admin/fiscal/OpenfiscaHealthButton.tsx` | ✨ Nouveau | Bouton UI |
| `src/components/admin/fiscal/VersionsTab.tsx` | ✏️ Modifié | Ajout du bouton |
| `src/services/tax/sources/TaxScrapeWorker.ts` | ✏️ Modifié | Logs détaillés |
| `CONFIGURATION_OPENFISCA.md` | ✏️ Modifié | Doc healthcheck |
| `OPENFISCA_HEALTHCHECK_GUIDE.md` | ✨ Nouveau | Ce guide |

---

## 🚀 Prêt à tester !

```bash
npm run dev
# http://localhost:3000/admin/impots/parametres
# Clic sur "Vérifier OpenFisca" 🎉
```


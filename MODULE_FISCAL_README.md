# 🧮 Module Fiscal SmartImmo — Documentation complète

**Version** : 1.0.0  
**Date** : Novembre 2025  
**Auteur** : SmartImmo Development Team

---

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture](#architecture)
3. [Services](#services)
4. [Pages & Composants UI](#pages--composants-ui)
5. [API Routes](#api-routes)
6. [Calculs fiscaux](#calculs-fiscaux)
7. [Barèmes fiscaux 2025](#barèmes-fiscaux-2025)
8. [Tests](#tests)
9. [Déploiement](#déploiement)
10. [Maintenance](#maintenance)

---

## 🎯 Vue d'ensemble

Le **Module Fiscal SmartImmo** est une solution complète de calcul et d'optimisation fiscale immobilière pour la France. Il couvre :

- ✅ **Impôt sur le revenu (IR)** avec tranches progressives et décote
- ✅ **Prélèvements sociaux (PS)** à 17.2%
- ✅ **Revenus fonciers** (micro-foncier et réel)
- ✅ **Revenus BIC meublés** (LMNP/LMP, micro et réel avec amortissements)
- ✅ **Déficit foncier** avec imputation sur revenu global et reports
- ✅ **Plan Épargne Retraite (PER)** avec optimisation
- ✅ **SCI à l'IS** avec taux réduit/normal
- ✅ **Optimisation travaux** (Phase 1 & 2)
- ✅ **Comparateur PER vs Travaux**
- ✅ **Autofill** depuis les données SmartImmo (transactions, baux, prêts)
- ✅ **Export PDF & CSV**
- ✅ **Mise à jour automatique** des barèmes fiscaux

### 🎨 Captures d'écran

Le module propose 3 pages principales :

1. **`/impots/simulation`** : Simulateur fiscal avec formulaire et résultats détaillés
2. **`/impots/optimizer`** : Comparateur d'optimisations (PER, travaux, stratégies)
3. **`/admin/impots/parametres`** : Gestion des barèmes fiscaux (admin uniquement)

---

## 🏗️ Architecture

### Structure des fichiers

```
src/
├── types/
│   └── fiscal.ts                    # Types TypeScript complets
│
├── services/tax/
│   ├── TaxParamsService.ts          # Gestion des barèmes fiscaux
│   ├── FiscalAggregator.ts          # Agrégation automatique des données
│   ├── Simulator.ts                 # Calculs IR/PS/foncier/BIC/SCI
│   ├── Optimizer.ts                 # Optimisations (PER, travaux)
│   ├── TaxParamsUpdater.ts          # Mise à jour automatique
│   └── __tests__/
│       └── Simulator.test.ts        # Tests unitaires
│
├── components/fiscal/
│   ├── FiscalKPICard.tsx            # Carte KPI réutilisable
│   ├── FiscalDetailDrawer.tsx       # Drawer détails calculs
│   ├── OptimizationComparisonCard.tsx  # Comparaison PER vs Travaux
│   ├── WorksStrategyCard.tsx        # Stratégie travaux (Phase 1 & 2)
│   └── index.ts
│
└── app/
    ├── impots/
    │   ├── simulation/
    │   │   ├── page.tsx             # Page de simulation
    │   │   └── SimulationClient.tsx # Composant client
    │   │
    │   └── optimizer/
    │       ├── page.tsx             # Page d'optimisation
    │       └── OptimizerClient.tsx  # Composant client
    │
    ├── admin/impots/parametres/
    │   ├── page.tsx                 # Page admin paramètres
    │   └── ParametresClient.tsx     # Composant client
    │
    └── api/
        ├── fiscal/
        │   ├── simulate/route.ts    # POST : Simuler
        │   ├── optimize/route.ts    # GET : Optimiser
        │   ├── export-pdf/route.ts  # POST : Export PDF
        │   └── export-csv/route.ts  # POST : Export CSV
        │
        └── admin/fiscal/params/
            ├── route.ts             # GET : Liste versions
            ├── changelog/route.ts   # GET : Changelog
            └── refresh/route.ts     # POST : MAJ barèmes
```

---

## 🔧 Services

### 1. TaxParamsService

**Rôle** : Gestion centralisée des barèmes fiscaux avec versioning.

**Méthodes principales** :
- `get(year, version?)` : Récupère les paramètres fiscaux pour une année
- `getLatest()` : Récupère la dernière version disponible
- `save(params, validatedBy)` : Sauvegarde de nouveaux paramètres
- `update(version, updates, validatedBy)` : Met à jour des paramètres existants
- `listVersions()` : Liste toutes les versions
- `getChangelog(version)` : Récupère le changelog d'une version

**Stockage** : En mémoire (Map) pour l'instant, à migrer en base de données en production.

**Versioning** : Format `YYYY.N` (ex: `2025.1`, `2025.2`)

---

### 2. FiscalAggregator

**Rôle** : Agrégation automatique des données fiscales depuis SmartImmo.

**Méthodes principales** :
- `aggregate(options)` : Agrège toutes les données pour un utilisateur et une année

**Sources de données** :
- **Transactions** : Loyers, charges, travaux (via codes système)
- **Baux** : Détermination du type de bien (NU/LMNP/LMP)
- **Prêts** : Intérêts d'emprunt par année
- **Sociétés de gestion** : Frais de gestion automatiques

**Codes système utilisés** :
```typescript
RECETTE_LOYER           // Loyers encaissés
DEPENSE_TAXE_FONCIERE   // Taxe foncière
DEPENSE_ENTRETIEN       // Travaux d'entretien (déductibles)
DEPENSE_AMELIORATION    // Travaux d'amélioration (capitalisables)
INTERETS_EMPRUNT        // Intérêts d'emprunt
FRAIS_GESTION           // Frais de gestion/agence
```

---

### 3. Simulator

**Rôle** : Cœur du module fiscal — tous les calculs d'impôts.

**Méthodes principales** :
- `simulate(inputs, taxParams)` : Lance une simulation fiscale complète

**Calculs implémentés** :

#### Impôt sur le revenu (IR)
- Tranches progressives 2025 : 0%, 11%, 30%, 41%, 45%
- Calcul par part fiscale
- Décote (seuil 1929€/3858€ pour couple)
- Taux moyen et tranche marginale d'imposition (TMI)

#### Prélèvements sociaux (PS)
- Taux : 17.2% sur revenus du patrimoine
- Base imposable : revenus fonciers + BIC nets

#### Revenus fonciers (location nue)
- **Micro-foncier** : Abattement 30%, plafond 15 000€
- **Réel** : Charges déductibles (intérêts, TF, travaux entretien/réparation, etc.)
- **Déficit foncier** :
  - Imputable sur revenu global : max 10 700€ (hors intérêts)
  - Reportable sur revenus fonciers futurs : 10 ans

#### Revenus BIC (location meublée)
- **Micro-BIC** : Abattement 50%, plafond 77 700€ (tourisme classé : 71%)
- **Réel** : Charges + amortissements (bâtiment, mobilier, frais)
- **LMNP vs LMP** : Distinction selon critères (recettes > 23 000€ + > 50% revenus pro)

#### SCI à l'IS
- Taux réduit : 15% jusqu'à 42 500€
- Taux normal : 25% au-delà
- Pas de PS

#### Plan Épargne Retraite (PER)
- Plafond : 10% des revenus pro ou plancher légal (4 399€)
- Report des reliquats sur 3 ans
- Économie IR = versement × TMI

---

### 4. Optimizer

**Rôle** : Propose des stratégies d'optimisation fiscale.

**Méthodes principales** :
- `optimize(inputs, taxParams)` : Génère des recommandations d'optimisation

**Optimisations implémentées** :

#### Stratégie Travaux (Phase 1 & 2)

**Phase 1 : Ramener revenus imposables à 0€**
- Objectif : Annuler IR + PS sur revenus immobiliers
- Calcul : Montant de travaux = revenus immobiliers nets
- Économie : IR (sur part immo) + PS (17.2% de la base)
- Ratio : € économisé / € investi

**Phase 2 : Créer du déficit foncier reportable**
- Objectif : Générer déficit imputable sur revenu global (max 10 700€)
- Économie : IR uniquement (PS non impactés)
- ⚠️ Avertissement : Stratégie à horizon multi-années

#### Comparateur PER vs Travaux
- Calcul des ratios d'efficacité
- Recommandation selon les ratios et la situation
- Stratégie combinée si pertinente

#### Suggestions supplémentaires
- Optimisation des régimes fiscaux (micro vs réel)
- Timing des travaux (années de hauts revenus)
- Structure juridique (SCI IS si TMI élevé)
- Passage en location meublée (LMNP)

---

### 5. TaxParamsUpdater

**Rôle** : Mise à jour automatique des barèmes fiscaux depuis sources officielles.

**Méthodes principales** :
- `update(year, force?)` : Met à jour les barèmes pour une année
- `updateAll()` : Met à jour toutes les années
- `checkForUpdates()` : Vérifie si une MAJ est nécessaire
- `healthCheck()` : État de santé du service

**Sources officielles** :
- DGFiP (Direction Générale des Finances Publiques)
- Service-Public.fr
- BOFiP (Bulletin Officiel des Finances Publiques)

**Cron job recommandé** : 1×/mois (début de mois)

**Validation** : Vérification de la cohérence des paramètres (tranches, taux, plafonds)

---

## 🎨 Pages & Composants UI

### Pages

#### 1. `/impots/simulation` — Simulateur fiscal

**Layout** : 2 colonnes (formulaire gauche, résultats droite)

**Fonctionnalités** :
- Saisie informations foyer (salaire, parts, couple)
- Option **Autofill** depuis données SmartImmo
- Calcul IR + PS + cash-flow
- Détail par bien et par régime
- Drawer de détails complets (tranches, formules)
- Export PDF/CSV

**KPIs affichés** :
- Salaire imposable
- Impôt foncier
- IR (montant, taux moyen, TMI)
- PS (montant)
- Total impôts
- Bénéfice net immobilier

---

#### 2. `/impots/optimizer` — Optimiseur fiscal

**Layout** : KPIs en haut, stratégies en bas

**Fonctionnalités** :
- Stratégie travaux (Phase 1 & 2) avec ratios
- Comparateur PER vs Travaux
- Suggestions d'optimisation (Top 5)
- Export rapport PDF

**Cartes** :
- `WorksStrategyCard` : Affichage détaillé Phase 1 & 2
- `OptimizationComparisonCard` : Comparaison PER/Travaux/Combiné
- Suggestions avec badges de complexité

---

#### 3. `/admin/impots/parametres` — Admin paramètres fiscaux

**Layout** : Liste versions + détails version sélectionnée

**Fonctionnalités** :
- Visualisation de toutes les versions
- Détails par version (tranches IR, PS, micro, PER, SCI IS)
- Bouton "Mettre à jour les barèmes"
- Historique des modifications (changelog)

**Sécurité** : Réservé aux administrateurs (rôle `admin`)

---

### Composants réutilisables

#### FiscalKPICard
Carte KPI avec icône, valeur, subtitle, trend, badge.

```tsx
<FiscalKPICard
  title="Impôt sur le revenu"
  value={simulation.ir.impotNet}
  icon={TrendingDown}
  iconColor="text-red-600"
  badge={{ text: 'IR', variant: 'destructive' }}
/>
```

#### FiscalDetailDrawer
Drawer affichant tous les détails de calcul (formules, tranches, bases).

```tsx
<FiscalDetailDrawer
  open={detailsOpen}
  onClose={() => setDetailsOpen(false)}
  simulation={simulation}
/>
```

#### OptimizationComparisonCard
Carte de comparaison des stratégies avec recommandation.

#### WorksStrategyCard
Carte détaillée de la stratégie travaux (Phase 1 & 2).

---

## 🌐 API Routes

### Simulation

**POST `/api/fiscal/simulate`**

**Body** :
```json
{
  "year": 2025,
  "foyer": {
    "salaire": 50000,
    "autresRevenus": 0,
    "parts": 2,
    "isCouple": true
  },
  "options": {
    "autofill": true,
    "baseCalcul": "encaisse",
    "optimiserRegimes": true
  }
}
```

**Response** : `SimulationResult`

---

### Optimisation

**GET `/api/fiscal/optimize`**

**Response** : `OptimizationResult`

---

### Export

**POST `/api/fiscal/export-pdf`**

**Body** : `{ simulation: SimulationResult }`

**Response** : Fichier PDF (binary)

---

**POST `/api/fiscal/export-csv`**

**Body** : `{ simulation: SimulationResult }`

**Response** : Fichier CSV (text)

---

### Admin

**GET `/api/admin/fiscal/params`**

**Response** : Liste des versions `TaxParams[]`

---

**GET `/api/admin/fiscal/params/changelog`**

**Response** : Changelog `TaxParamsChangelog[]`

---

**POST `/api/admin/fiscal/params/refresh`**

**Response** : `{ success: boolean, message: string }`

---

## 💰 Calculs fiscaux

### Formules clés

#### Impôt sur le revenu (IR)

1. Calcul du **revenu imposable** :
   ```
   Revenu imposable = Salaire + Autres revenus + Revenus fonciers nets + Revenus BIC nets - Déductions PER
   ```

2. Calcul du **revenu par part** :
   ```
   Revenu par part = Revenu imposable / Nombre de parts
   ```

3. Application des **tranches** :
   ```
   Pour chaque tranche [lower, upper] avec taux rate :
     Impôt tranche = min(Revenu par part, upper) - lower) × rate
   
   Impôt brut = Somme(Impôt tranches) × Nombre de parts
   ```

4. Application de la **décote** (si applicable) :
   ```
   Seuil décote = 1929€ (célibataire) ou 3858€ (couple)
   Décote = max(0, Seuil décote - 0.75 × Impôt brut)
   Impôt net = Impôt brut - Décote
   ```

#### Prélèvements sociaux (PS)

```
Base PS = Revenus fonciers nets + Revenus BIC nets
PS = Base PS × 17.2%
```

#### Déficit foncier

```
Déficit total = |Résultat foncier| si < 0

Déficit imputable revenu global = min(
  Déficit hors intérêts,
  10 700€
)

Déficit reportable = Déficit total - Déficit imputable revenu global
```

#### Cash-flow immobilier

```
Cash-flow brut = Loyers - Charges non financières

Cash-flow net = Cash-flow brut - Intérêts - Impôts (IR + PS)
```

---

## 📊 Barèmes fiscaux 2025

### Tranches IR 2025 (revenus 2024)

| Tranche | Revenu par part | Taux |
|---------|----------------|------|
| 1 | 0€ - 11 294€ | 0% |
| 2 | 11 294€ - 28 797€ | 11% |
| 3 | 28 797€ - 82 341€ | 30% |
| 4 | 82 341€ - 177 106€ | 41% |
| 5 | > 177 106€ | 45% |

### Décote IR 2025

- Célibataire : 1 929€
- Couple : 3 858€
- **Formule** : `Décote = Seuil - (0.75 × Impôt brut)`

### Prélèvements sociaux 2025

- **Taux** : 17.2% sur revenus du patrimoine

### Micro-foncier 2025

- **Abattement** : 30%
- **Plafond** : 15 000€ de revenus bruts

### Micro-BIC 2025 (meublé)

- **Abattement** : 50% (classique)
- **Plafond** : 77 700€
- **Abattement tourisme classé** : 71%
- **Plafond tourisme** : 188 700€

### Déficit foncier 2025

- **Plafond imputation revenu global** : 10 700€
- **Durée report** : 10 ans

### PER 2025

- **Taux plafond** : 10% des revenus professionnels
- **Plancher légal** : 4 399€
- **Report reliquats** : 3 ans

### LMP 2025

- **Recettes minimum** : 23 000€/an
- **% des revenus pro** : > 50%
- **Inscription RCS** : Obligatoire

### SCI à l'IS 2025

- **Taux réduit** : 15% (jusqu'à 42 500€)
- **Taux normal** : 25%

---

## 🧪 Tests

### Lancer les tests

```bash
npm run test src/services/tax/__tests__/Simulator.test.ts
```

### Tests implémentés

1. ✅ **Foncier micro** : Abattement 30% correctement appliqué
2. ✅ **Foncier réel avec déficit** : Déficit < 10 700€ imputable
3. ✅ **Foncier réel déficit élevé** : Plafonnement à 10 700€ + reports
4. ✅ **LMNP réel** : Amortissements correctement déduits
5. ✅ **Calcul IR** : Tranches progressives + décote
6. ✅ **Prélèvements sociaux** : 17.2% sur base correcte
7. ✅ **PER** : Économie IR = versement × TMI

### Couverture de code

Objectif : > 80% sur les services de calcul

---

## 🚀 Déploiement

### Prérequis

- Node.js 18+
- PostgreSQL 14+ (ou SQLite en dev)
- Next.js 14+

### Installation

```bash
# Cloner le repo
git clone https://github.com/votre-org/smartimmo.git
cd smartimmo

# Installer les dépendances
npm install

# Configurer la base de données
npx prisma db push

# Lancer en dev
npm run dev
```

### Variables d'environnement

```env
DATABASE_URL="postgresql://user:password@localhost:5432/smartimmo"
NEXTAUTH_SECRET="votre_secret_nextauth"
NEXTAUTH_URL="http://localhost:3000"
```

### Build production

```bash
npm run build
npm start
```

### Cron job (mise à jour barèmes)

Configurer un cron job pour exécuter la mise à jour automatique :

```bash
# Chaque 1er du mois à 2h du matin
0 2 1 * * curl -X POST https://votre-domaine.com/api/admin/fiscal/params/refresh
```

Ou utiliser une edge function (Vercel Cron Jobs, AWS EventBridge, etc.)

---

## 🛠️ Maintenance

### Mise à jour des barèmes fiscaux

**Manuelle** :
1. Aller sur `/admin/impots/parametres`
2. Cliquer sur "Mettre à jour les barèmes"
3. Vérifier les logs et le changelog

**Automatique** :
- Le service `TaxParamsUpdater` vérifie automatiquement 1×/mois
- Sources : DGFiP, Service-Public, BOFiP
- Validation automatique des paramètres

### Monitoring

**Vérifier l'état de santé** :
```typescript
const health = await TaxParamsUpdater.healthCheck();
console.log(health);
// {
//   healthy: true,
//   lastUpdate: Date,
//   nextUpdate: Date,
//   sources: { DGFIP: true, SERVICE_PUBLIC: true, ... }
// }
```

### Logs

Tous les services loggent leurs actions :
- `TaxParamsService` : Sauvegarde/MAJ des paramètres
- `FiscalAggregator` : Agrégation des données
- `Simulator` : Calculs effectués
- `Optimizer` : Optimisations générées
- `TaxParamsUpdater` : Mises à jour des barèmes

### Rollback

En cas d'erreur sur une version de barèmes :

```typescript
await TaxParamsService.delete('2025.2'); // Supprimer la version erronée
// La version 2025.1 sera utilisée par défaut
```

---

## 📞 Support

Pour toute question ou bug :

- 📧 Email : support@smartimmo.fr
- 🐛 Issues : https://github.com/votre-org/smartimmo/issues
- 📖 Documentation : https://docs.smartimmo.fr

---

## 📝 Changelog

### Version 1.0.0 (Novembre 2025)

✨ **Nouveautés** :
- Module fiscal complet IR/PS/foncier/BIC/SCI
- Autofill automatique depuis données SmartImmo
- Optimiseur PER vs Travaux
- Mise à jour automatique barèmes fiscaux
- Export PDF/CSV
- Tests unitaires complets
- Documentation complète

---

## 📄 Licence

© 2025 SmartImmo. Tous droits réservés.

---

**🎉 Le module fiscal SmartImmo est maintenant opérationnel et prêt à l'emploi !**


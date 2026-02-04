# Inventaire des Règles Métier — Échéances Récurrentes

## 1. Inputs UI

### Filtres
- **Recherche** : texte libre (filtre sur `label`)
- **Type** : enum `EcheanceType` (LOYER, CHARGE, TAXE, ASSURANCE, AUTRE)
- **Sens** : enum `SensEcheance` (CREDIT, DEBIT)
- **Périodicité** : enum `Periodicite` (MONTHLY, QUARTERLY, YEARLY, ONE_TIME)
- **Bail** : filtre par `leaseId`
- **Récupérable** : booléen (`recuperable`)
- **Actif/Inactif** : booléen (`isActive`)
- **Bien** : filtre par `propertyId` (fixe dans PropertyEcheancesClient)

### Tri
- Par défaut : aucune (ordre d'insertion)
- Possibilité : Date de début, Montant, Libellé (non implémenté actuellement)

### Cartes KPI filtrantes
- **Revenus** : filtre `sens === 'CREDIT'`
- **Charges** : filtre `sens === 'DEBIT'`
- **Actives** : filtre `isActive === true`

### Période (pour graphiques)
- **Début** : format YYYY ou YYYY-MM
- **Fin** : format YYYY ou YYYY-MM
- **Mode** : `monthly` ou `yearly`

## 2. KPI & Agrégats

### KPIs
- **Revenus annuels** : somme des montants convertis en annuel pour `sens === 'CREDIT'` et `isActive === true`
- **Charges annuelles** : somme des montants convertis en annuel pour `sens === 'DEBIT'` et `isActive === true`
- **Total échéances** : nombre total d'échéances (actives + inactives, excluant soft-deleted)
- **Échéances actives** : nombre d'échéances avec `isActive === true`

### Graphiques
- **Cumulatif** : évolution des montants cumulés par période (mois/année)
- **Par type** : répartition des montants par type d'échéance
- **Récupérables** : répartition récupérable vs non récupérable

### Conversion périodicité → annuel
- `MONTHLY` : montant × 12
- `QUARTERLY` : montant × 4
- `YEARLY` : montant × 1
- `ONE_TIME` : montant × 0 (non récurrent)

## 3. Règles Métier CRUD

### Création
- **Validation** :
  - `label` : requis, min 1 caractère
  - `type` : requis, enum valide
  - `periodicite` : requis, enum valide
  - `montant` : requis, positif
  - `sens` : requis, enum valide
  - `startAt` : requis, date valide
  - `endAt` : optionnel, si fourni doit être >= `startAt`
  - `propertyId` : optionnel, si fourni doit exister et appartenir à l'organisation
  - `leaseId` : optionnel, si fourni doit exister, appartenir à l'organisation, et être lié au `propertyId` si fourni
- **Valeurs par défaut** :
  - `recuperable` : `false`
  - `isActive` : `true`
  - `endAt` : `null` (pas de fin prévue)

### Mise à jour
- **Validation** : identique à la création (champs optionnels)
- **Champs immuables** : aucun (tous modifiables)
- **Soft delete** : si `isActive` passe à `false` et `endAt` est `null`, fixer `endAt` à `now`

### Suppression
- **Soft delete par défaut** :
  - `isActive` → `false`
  - `endAt` → `now` si `endAt` était `null`
- **Hard delete** : optionnel (query param `hard=1`), ADMIN uniquement
- **Cascade** : aucune (les échéances ne sont pas liées à d'autres entités en cascade)

## 4. Documents
- **Aucun lien direct** : les échéances ne génèrent pas de documents automatiquement
- **Liens manuels** : possibles via DocumentLink (non implémenté actuellement)

## 5. Sécurité orgId
- **Toutes les opérations** : filtrées par `organizationId`
- **Vérification ownership** :
  - `propertyId` doit appartenir à l'organisation
  - `leaseId` doit appartenir à l'organisation et être lié au `propertyId` si fourni

## 6. Navigation App-Shell
- **URL** : `/app?view=property&propertyId=...&tab=deadlines`
- **Navigation interne** : uniquement via `/app?view=...`
- **Pas de liens mode normal** depuis app-shell

## 7. Différences à éliminer
- **Aucune différence majeure** : les échéances sont simples, pas de logique complexe comme les commissions
- **Uniformiser** : utiliser Domain Service au lieu de repository direct dans PropertyEcheancesClient

## 8. Incertitudes
- **Liens documents** : non implémenté, à documenter si besoin futur
- **Tri** : non implémenté dans l'UI, à ajouter si demandé
- **Pagination** : actuellement chargement de toutes les échéances en mémoire, à optimiser si volumétrie importante


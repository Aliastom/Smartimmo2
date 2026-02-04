# Inventaire des règles métier — Baux (Leases)

## Contexte

Ce document recense toutes les règles métier, validations, KPIs, et comportements CRUD pour les Baux dans Smartimmo, en vue de la transformation app-shell offline-first conforme aux Domain Services.

**Page cible app-shell :** `/app?view=property&propertyId=...&tab=lease`  
**Page référence mode normal :** `/biens/[id]?tab=baux` ou `/biens/[id]/baux`

---

## 1. Inputs UI

### 1.1. Filtres

- **Recherche textuelle** : filtre sur nom du bien (`Property.name`) ou nom du locataire (`Tenant.firstName + Tenant.lastName`)
- **Bien (Property)** : filtre par `propertyId` (dans le contexte property tab, toujours fixé)
- **Locataire (Tenant)** : filtre par `tenantId`
- **Type** : `residential` | `commercial` | `garage`
- **Meublé** : `vide` | `meuble` | `garage`
- **Statut** : `BROUILLON` | `ENVOYÉ` | `SIGNÉ` | `ACTIF` | `RÉSILIÉ`
- **Date de début** : `startDateFrom` / `startDateTo`
- **Date de fin** : `endDateFrom` / `endDateTo`
- **Indexation** : `none` | `insee` | `manual` + dates d'indexation
- **Loyer** : `rentMin` / `rentMax`
- **Dépôt** : `depositMin` / `depositMax`

### 1.2. Tri

- **Date de début** (`startDate`) : asc/desc
- **Date de fin** (`endDate`) : asc/desc
- **Loyer** (`rentAmount`) : asc/desc

### 1.3. Cartes KPI filtrantes

- **Actifs** : filtre `status === 'ACTIF'`
- **Expirant bientôt** : filtre sur `endDate` proche (à définir : 3 mois ?)
- **Indexation due** : filtre sur baux avec indexation à renouveler (à définir)

---

## 2. KPI & Agrégats

### 2.1. KPIs (LeasesKpiBar)

- **Total baux** : nombre total de baux (filtré par `propertyId` si scope property)
- **Baux actifs** : nombre de baux avec `status === 'ACTIF'`
- **Baux expirant bientôt** : nombre de baux avec `endDate` dans les 3 prochains mois
- **Loyers mensuels totaux** : somme des `rentAmount` pour les baux actifs
- **Cautions totales** : somme des `deposit` pour tous les baux

### 2.2. Graphiques

- **Évolution des loyers** (`LeasesRentEvolutionChart`) :
  - Vue mensuelle : évolution du loyer total par mois
  - Vue annuelle : évolution du loyer total par année
- **Répartition par type de meublé** (`LeasesByFurnishedChart`) :
  - Camembert : `vide` vs `meuble` vs `garage`
- **Cautions & Loyers cumulés** (`LeasesDepositsRentsChart`) :
  - Barres : cautions totales vs loyers cumulés

---

## 3. Règles métier CRUD

### 3.1. Création (`createLease`)

**Validations :**
- ✅ `propertyId` requis, doit exister et appartenir à l'organisation
- ✅ `tenantId` requis, doit exister et appartenir à l'organisation
- ✅ `type` : enum `residential` | `commercial` | `garage`
- ✅ `furnishedType` : enum `vide` | `meuble` | `garage` (défaut: `vide`)
- ✅ `startDate` requis (Date)
- ✅ `endDate` optionnel (Date | null)
- ✅ `rentAmount` > 0
- ✅ `deposit` ≥ 0
- ✅ `paymentDay` : 1-31 ou null (défaut: null)
- ✅ `indexationType` : enum `none` | `insee` | `manual` (défaut: `none`)
- ✅ `chargesRecupMensuelles` ≥ 0 (optionnel)
- ✅ `chargesNonRecupMensuelles` ≥ 0 (optionnel)

**Validations croisées :**
- ✅ `endDate > startDate` (si `endDate` fournie)
- ✅ `deposit ≤ plafond` selon `furnishedType` :
  - `meuble` : `deposit ≤ rentAmount * 2`
  - `vide` : `deposit ≤ rentAmount`

**Règles métier :**
- ✅ **Vérification chevauchement** : aucun autre bail actif (`status === 'ACTIF'`) ne doit chevaucher les dates
  - Logique de chevauchement complexe (gère `endDate === null` = récurrence infinie)
- ✅ **Calcul automatique `endDate`** :
  - Si `status === 'SIGNÉ'` ou `status === 'ACTIF'` ET `endDate` non fournie :
    - `meuble` : `endDate = startDate + 1 an`
    - `vide` : `endDate = startDate + 3 ans`
- ✅ **Transition statut** :
  - Si `status === 'SIGNÉ'` ET `startDate <= now` → `status = 'ACTIF'`
  - Sinon `status = 'BROUILLON'` par défaut

**Valeurs par défaut :**
- `furnishedType = 'vide'` si non fourni
- `deposit = 0` si non fourni
- `paymentDay = null` si non fourni
- `indexationType = 'none'` si non fourni
- `notes = ''` si non fourni

### 3.2. Mise à jour (`updateLease`)

**Validations :**
- ✅ Tous les champs sont optionnels (mise à jour partielle)
- ✅ `endDate` peut être `null` ou chaîne vide `''` → converti en `null`
- ✅ Conversion dates : `startDate`/`endDate` string → Date

**Règles métier :**
- ✅ **Calcul automatique `endDate`** :
  - Si `status` passe à `'SIGNÉ'` ou `'ACTIF'` (depuis `'BROUILLON'` ou `'ENVOYÉ'`)
  - ET `endDate` non fournie dans les params
  - → Calculer selon `furnishedType` (meublé=1an, vide=3ans)
- ✅ **Transitions de statut** :
  - `ENVOYÉ → BROUILLON` : autorisé (annulation)
  - `SIGNÉ → ENVOYÉ` : autorisé (retour arrière)
  - Autres transitions nécessitent validation (à définir)

### 3.3. Suppression (`deleteLease`)

**Protections :**
- ✅ **Baux actifs** : si `status === 'ACTIF'` → erreur "Ce bail est actif et ne peut pas être supprimé directement. Résiliez-le d'abord."
- ✅ **Transactions liées** : si transactions liées ET `status !== 'RÉSILIÉ'` → erreur "Ce bail ne peut pas être supprimé car il contient des transactions. Résiliez-le d'abord."
- ✅ **Baux résiliés** : peuvent être supprimés même avec transactions

**Comportement :**
- ✅ Hard delete (suppression définitive)

### 3.4. Résiliation (transition statut)

**Règle :**
- ✅ Mettre `status = 'RÉSILIÉ'` (via `updateLease`)
- ✅ Un bail résilié peut ensuite être supprimé même avec transactions

---

## 4. Documents & Actions

### 4.1. Génération de quittance

- Action disponible depuis le drawer (`LeaseActionsManager`)
- Génère un PDF de quittance
- Après génération : refresh ciblé `leases:refresh`

### 4.2. Téléchargement bail signé

- Si `signedPdfUrl` existe → ouverture dans nouvel onglet
- Sinon → erreur "Aucun bail signé disponible"

---

## 5. Sécurité & Organisation

### 5.1. `organizationId`

- ✅ Toutes les opérations CRUD filtrent par `organizationId`
- ✅ `organizationId` vient de la session (via `useCurrentOrganization`)
- ✅ Interdit de déduire `organizationId` depuis l'URL

### 5.2. Ownership

- ✅ Vérification que `propertyId` appartient à l'organisation (via `PropertyRepository.findFirst`)
- ✅ Vérification que `tenantId` appartient à l'organisation (via `TenantRepository.findFirst`)

---

## 6. Navigation app-shell

### 6.1. Navigation interne

- Navigation uniquement via `/app?view=...`
- Pas de liens "mode normal" depuis app-shell

### 6.2. Événements de refresh

- ✅ Événement ciblé : `leases:refresh` avec `detail: { scope: 'property', propertyId, reason: 'crud' | 'delete' }`
- ✅ Scope `'property'` : pour les tabs property
- ✅ Scope `'global'` : pour la page globale `/app?view=baux`
- ✅ Anti-loop : ignorer les événements identiques dans une fenêtre de 300ms

---

## 7. Différences à éliminer

### 7.1. Mode app-shell vs normal

**Actuellement :**
- ❌ `PropertyLeasesClient.tsx` utilise directement `getLeaseRepositoryOffline()` au lieu de `LeaseService`
- ❌ Les modales (`LeaseFormComplete`, `LeaseEditModal`) peuvent utiliser directement le repository

**Objectif :**
- ✅ Tous les CRUD passent par `LeaseService` (factory `createLeaseServiceWithMode(mode)`)
- ✅ Les modales utilisent le service, pas le repository direct

### 7.2. Refresh global

**Actuellement :**
- ⚠️ À vérifier : les filtres/tri/cartes KPI provoquent-ils un refresh global ?

**Objectif :**
- ✅ Filtres/tri/cartes = filtrage en mémoire uniquement (pas de fetch)
- ✅ Pas de remount de `PropertyDetailView` ou de l'onglet
- ✅ Pas de reset scroll / flash loader global

---

## 8. Incertitudes / À définir

1. **Filtre "Expirant bientôt"** : quelle période ? (3 mois ? 6 mois ?)
2. **Filtre "Indexation due"** : comment déterminer qu'une indexation est due ?
3. **Transitions de statut** : quelles transitions sont autorisées en dehors de `ENVOYÉ → BROUILLON` et `SIGNÉ → ENVOYÉ` ?
4. **Génération de quittance** : est-ce un effet server-only ? (nécessite un round-trip push→pull en app-shell online ?)

---

## 9. Hooks & Data Flow

### 9.1. `useLeasesData`

- ✅ Mode app-shell : charge depuis IndexedDB uniquement
- ✅ Filtre par `propertyId` si fourni
- ⚠️ À vérifier : écoute-t-il `leases:refresh` ?

### 9.2. `useLeasesKpis`

- ✅ Mode app-shell : calcule depuis IndexedDB
- ✅ Filtre par `propertyId` si fourni
- ⚠️ À vérifier : écoute-t-il `leases:refresh` ?

### 9.3. `useLeasesCharts`

- ✅ Mode app-shell : calcule depuis IndexedDB
- ✅ Filtre par `propertyId` si fourni
- ⚠️ À vérifier : écoute-t-il `leases:refresh` ?

---

## 10. Conformité mobile-first

### 10.1. Composants à vérifier

- ✅ `LeasesFilters` : utilise-t-il `SmartSelect` au lieu de `<select>` ?
- ✅ `LeaseFormComplete` : utilise-t-il `SmartSelect` et `SmartDatePicker` ?
- ✅ `LeaseEditModal` : utilise-t-il `SmartSelect` et `SmartDatePicker` ?
- ✅ Graphiques : ont-ils `min-w-0` pour éviter la troncature mobile ?
- ✅ Drawer : utilise-t-il `h-screen` au lieu de `h-full` ?
- ✅ Icônes header : sont-elles espacées avec `gap-2` ou `gap-3` ?

---

## 11. Checklist Definition of Done

- [ ] Zéro fetch réseau métier en app-shell
- [ ] CRUD via `LeaseService` uniquement (pas de repository direct)
- [ ] Modales conformes (utilisent le service)
- [ ] Navigation app-shell only
- [ ] KPI/graphes calculés depuis IndexedDB
- [ ] **FILTRES/TRI/CARTES = pas de refresh global / pas de remount**
- [ ] Hooks écoutent `leases:refresh` avec filtrage par `propertyId`
- [ ] Conformité mobile-first (SmartSelect, SmartDatePicker, min-w-0, etc.)
- [ ] Tests conformance + E2E verts
- [ ] Docs à jour



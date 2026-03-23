# Module BAUX — Plan d'implémentation UI

> Implémentation progressive de la nouvelle structure fiche bail.
> Compatible avec l'architecture Lease / LeaseFinancialConfig / Échéances / Transactions.
>
> **Voir aussi** : `BAUX-MODULE-UX-ITERATION-V2.md` — cockpit d'exploitation, priorité Paiements, structure formulaire création.

---

## 1. Vue d'ensemble

### 1.1 Objectif

Remplacer progressivement `LeaseDrawerNew` par une fiche bail moderne (style Finary/Linear) avec :

- Header cockpit (infos clés + alertes)
- Section Paiements (timeline mensuelle fusion échéances + transactions)
- Section Configuration financière
- Section Contrat
- Section Documents

### 1.2 Stratégie progressive

| Phase | Contenu | Risque |
|-------|---------|--------|
| **0** | Créer `useLeaseFinancialData` (fallback lease) | Faible |
| **1** | Nouveau composant `LeaseDetailView` avec structure, sans timeline | Faible |
| **2** | Section Paiements (timeline mensuelle) | Moyen |
| **3** | Brancher `getLeaseFinancialData()` quand disponible | Faible |
| **4** | Remplacer LeaseDrawerNew par LeaseDetailView | Moyen |

---

## 2. Structure des fichiers

### 2.1 Nouveaux fichiers

```
src/
├── features/
│   └── leases/
│       ├── components/
│       │   ├── LeaseDetailView.tsx          # Conteneur principal (remplace drawer)
│       │   ├── LeaseDetailHeader.tsx        # Cockpit (locataire, bien, statut, montants, alertes)
│       │   ├── LeaseDetailPaymentsSection.tsx   # Timeline mensuelle payé / en attente / en retard
│       │   ├── LeaseDetailFinancialConfigSection.tsx  # baseRent, charges, total, indexation
│       │   ├── LeaseDetailContractSection.tsx   # Type, dates, dépôt, clauses
│       │   └── LeaseDetailDocumentsSection.tsx  # Bail signé, quittances, avenants
│       └── hooks/
│           ├── useLeaseFinancialData.ts     # Hook wrapper (fallback lease → getLeaseFinancialData)
│           └── useLeasePaymentsTimeline.ts  # Fusion échéances + transactions par mois
```

### 2.2 Fichiers modifiés

| Fichier | Modification |
|---------|--------------|
| `PropertyLeasesClient.tsx` | Utiliser `LeaseDetailView` au lieu de `LeaseDrawerNew` (Phase 4) |
| `LeasesPageCore.tsx` | Idem si utilisé en mode liste globale |
| `LeasesClient.tsx` (app/baux) | Idem |
| `LeaseDrawerNew.tsx` | Conserver en fallback ou supprimer après migration |

### 2.3 Emplacement des composants

Les composants sont dans `features/leases/components/` pour :

- Réutilisabilité (liste globale, contexte bien, app-shell)
- Cohérence avec les autres features (transactions, échéances)

---

## 3. Composants React

### 3.1 LeaseDetailView (conteneur principal)

**Rôle** : Orchestrer les sections, gérer le layout, fournir les données aux enfants.

**Props** :

```typescript
interface LeaseDetailViewProps {
  lease: LeaseWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (lease: LeaseWithDetails) => void;
  onDelete?: (lease: LeaseWithDetails) => void;
  onGenerateReceipt?: (lease: LeaseWithDetails) => void;
  mode?: 'app-shell' | 'normal';
}
```

**Structure interne** :

- Header fixe ( LeaseDetailHeader )
- Contenu scrollable avec sections en colonne ou empilées
- Footer avec actions (Modifier, Générer quittance, Supprimer)

**Layout** : Panel latéral (desktop) ou plein écran (mobile), comme LeaseDrawerNew. Réutiliser les classes Tailwind existantes pour compatibilité.

---

### 3.2 LeaseDetailHeader (cockpit)

**Rôle** : Afficher les infos clés en un coup d'œil.

**Contenu** :

| Élément | Source | Affichage |
|---------|--------|-----------|
| Locataire | lease.Tenant | Nom prénom, lien vers fiche |
| Bien | lease.Property | Nom, adresse courte |
| Statut | lease.status | Badge (Actif, Brouillon, Résilié) |
| Total mensuel | useLeaseFinancialData().totalDueByTenant | Montant mis en évidence |
| Prochaine échéance | useLeasePaymentsTimeline | Date + statut (payé / en attente / en retard) |
| Dernier paiement | useLeasePaymentsTimeline | Date + montant |
| Alertes | Calcul local | Indexation due, retard, résiliation prochaine |

**Données** : Reçoit `lease` + `financialData` + `paymentsSummary` en props. Pas de fetch interne.

---

### 3.3 LeaseDetailPaymentsSection (timeline mensuelle)

**Rôle** : Fusion échéances + transactions pour afficher le statut de chaque mois.

**Logique** :

1. Période affichée : 12 mois passés + 12 mois à venir (configurable).
2. Pour chaque mois (YYYY-MM) :
   - **Attendu** : somme des montants des échéances LOYER_ATTENDU (ou RECETTE_LOYER) dont l'occurrence tombe ce mois.
   - **Réalisé** : somme des transactions liées au bail pour ce mois (loyer encaissé).
   - **Statut** :
     - `payé` : réalisé >= attendu (avec tolérance 1€)
     - `en_retard` : mois passé, attendu > 0, réalisé < attendu
     - `en_attente` : mois futur ou mois courant non encore dû

**Affichage** : Grille ou liste de cartes par mois. Chaque ligne : Mois | Attendu | Réalisé | Statut (badge couleur).

**Données** : Hook `useLeasePaymentsTimeline(leaseId, propertyId, organizationId, mode)`.

---

### 3.4 LeaseDetailFinancialConfigSection

**Rôle** : Afficher la configuration financière (LeaseFinancialConfig ou fallback Lease).

**Contenu** :

- Loyer hors charges (baseRent)
- Charges récupérables mensuelles
- Total dû par le locataire (calculé)
- Jour de paiement
- Dépôt de garantie
- Règle d'indexation (IRL, etc.)

**Actions** :

- Bouton "Modifier" → ouvre LeaseEditModal (onglet financier) ou drawer d'édition.
- Bouton "Créer un avenant" → placeholder Phase 2.

**Données** : `useLeaseFinancialData(leaseId, organizationId, mode)`.

---

### 3.5 LeaseDetailContractSection

**Rôle** : Afficher les infos contractuelles (Lease).

**Contenu** :

- Type de bail (vide, meublé, commercial)
- Dates (début, fin)
- Préavis
- Dépôt de garantie (aussi dans config financière — afficher une seule fois, dans la section la plus pertinente ; recommandation : config financière)
- Notes / clauses particulières

**Données** : `lease` en props.

---

### 3.6 LeaseDetailDocumentsSection

**Rôle** : Lister les documents liés au bail.

**Contenu** :

- Bail signé
- Quittances (par mois/année)
- Avenants (Phase 2)

**Données** : DocumentLink + Document, comme dans LeaseDrawerNew. Réutiliser la logique `loadSignedLease` ou extraire dans un hook `useLeaseDocuments(leaseId)`.

---

## 4. Hooks et récupération des données

### 4.1 useLeaseFinancialData

**Objectif** : Fournir les montants financiers avec fallback sur lease pendant la transition.

```typescript
// src/features/leases/hooks/useLeaseFinancialData.ts

interface LeaseFinancialData {
  baseRent: number;
  chargesRecoverableMonthly: number;
  chargesNonRecoverableMonthly: number;
  deposit: number | null;
  paymentDay: number | null;
  totalDueByTenant: number;
  ownerContractualIncome: number;
  indexationRule?: IndexationRule | null;
}

function useLeaseFinancialData(
  leaseId: string | null,
  organizationId: string | null,
  lease: LeaseWithDetails | null,  // Fallback
  options?: { mode: 'app-shell' | 'normal' }
): LeaseFinancialData | null
```

**Logique** :

1. Si `getLeaseFinancialData` existe (Phase 3+) : l'appeler et retourner le résultat.
2. Sinon : mapper depuis `lease` :
   - baseRent ← lease.rentAmount ?? 0
   - chargesRecoverableMonthly ← lease.chargesRecupMensuelles ?? 0
   - chargesNonRecoverableMonthly ← lease.chargesNonRecupMensuelles ?? 0
   - deposit ← lease.deposit ?? null
   - paymentDay ← lease.paymentDay ?? null
   - totalDueByTenant = baseRent + chargesRecoverableMonthly
   - ownerContractualIncome = baseRent

---

### 4.2 useLeasePaymentsTimeline

**Objectif** : Fusionner échéances et transactions pour la timeline mensuelle.

```typescript
// src/features/leases/hooks/useLeasePaymentsTimeline.ts

interface MonthStatus {
  yearMonth: string;  // YYYY-MM
  label: string;      // "Janvier 2025"
  expected: number;   // Montant attendu (échéances)
  realized: number;   // Montant encaissé (transactions)
  status: 'payé' | 'en_attente' | 'en_retard';
  transactionIds?: string[];
  echeanceIds?: string[];
}

function useLeasePaymentsTimeline(
  leaseId: string | null,
  propertyId: string | null,
  organizationId: string | null,
  options?: { 
    mode: 'app-shell' | 'normal';
    monthsPast?: number;
    monthsFuture?: number;
  }
): { months: MonthStatus[]; loading: boolean }
```

**Logique** :

1. Charger les échéances du bail (leaseId) : `useEcheancesData` ou `getEcheanceRepositoryOffline().getByLeaseId()`.
2. Charger les transactions du bail : `getTransactionRepositoryOffline().getByLeaseId()` ou API.
3. Pour chaque mois dans la plage :
   - Calculer `expected` : somme des montants des occurrences d'échéances LOYER_ATTENDU / RECETTE_LOYER pour ce mois (via `expandEcheances` ou `computeOccurrences`).
   - Calculer `realized` : somme des transactions liées au bail dont la date (ou month/year) correspond.
   - Déterminer `status` selon les règles ci-dessus.
4. Retourner le tableau trié par mois.

**Sources** :

- Échéances : `EcheanceRepositoryOffline`, filtre `leaseId`.
- Transactions : `TransactionRepositoryOffline`, filtre `leaseId`.
- Liens échéance-transaction : `EcheanceTransactionLink` pour savoir quelles transactions couvrent quelles occurrences (optionnel pour Phase 1 ; on peut simplifier en comparant montants par mois).

---

### 4.3 useLeaseDocuments (optionnel)

Extraire la logique de chargement des documents depuis LeaseDrawerNew dans un hook réutilisable.

```typescript
function useLeaseDocuments(
  leaseId: string | null,
  organizationId: string | null,
  isOpen: boolean
): { documents: Document[]; loading: boolean; refresh: () => void }
```

---

## 5. Intégration avec l'existant

### 5.1 PropertyLeasesClient

**Actuel** : Clic sur une ligne → `setSelectedLease` → `LeaseDrawerNew` s'affiche.

**Nouveau (Phase 4)** :

- Remplacer `LeaseDrawerNew` par `LeaseDetailView`.
- Passer les mêmes props : `lease`, `isOpen`, `onClose`, `onEdit`, `onDelete`, `onGenerateReceipt`.
- `LeaseDetailView` peut avoir le même comportement visuel (drawer/panel) pour ne pas casser le flux.

### 5.2 Pas de duplication

- Les modals `LeaseEditModal`, `LeaseActionsManager`, `DeleteConfirmModal` restent inchangés.
- `LeaseDetailView` les déclenche via `onEdit`, `onGenerateReceipt`, etc.
- La liste des baux (`LeasesTableNew`) reste inchangée.

### 5.3 Mode app-shell vs normal

- Les hooks `useLeaseFinancialData` et `useLeasePaymentsTimeline` acceptent `mode`.
- En app-shell : lecture IndexedDB (EcheanceRepositoryOffline, TransactionRepositoryOffline).
- En normal : API ou Prisma (à définir selon l'existant).

---

## 6. Ordre d'implémentation

### Étape 1 : useLeaseFinancialData (fallback)

- Créer le hook avec mapping depuis lease.
- Tester avec un bail existant.

### Étape 2 : LeaseDetailView + sections statiques

- Créer `LeaseDetailView` avec layout.
- Créer `LeaseDetailHeader` (avec financialData en props).
- Créer `LeaseDetailFinancialConfigSection`, `LeaseDetailContractSection`, `LeaseDetailDocumentsSection`.
- Brancher `useLeaseFinancialData` et les données lease.
- Afficher en parallèle de LeaseDrawerNew (feature flag ou onglet de test).

### Étape 3 : useLeasePaymentsTimeline

- Créer le hook.
- Implémenter la logique de fusion (échéances + transactions).
- Créer `LeaseDetailPaymentsSection`.

### Étape 4 : Remplacement

- Remplacer `LeaseDrawerNew` par `LeaseDetailView` dans PropertyLeasesClient.
- Vérifier LeasesPageCore, LeasesClient.
- Supprimer ou déprécier LeaseDrawerNew.

### Étape 5 : getLeaseFinancialData (quand dispo)

- Adapter `useLeaseFinancialData` pour appeler le service.
- Garder le fallback lease si le service retourne null.

---

## 7. Dépendances et contraintes

### 7.1 Dépendances existantes

- `LeaseWithDetails` : `@/lib/services/leasesService`
- `useLeasesData` : `@/features/leases/hooks/useLeasesData`
- `useEcheancesData` : `@/features/echeances/hooks/useEcheancesData`
- `getTransactionRepositoryOffline` : `@/lib/offline/repositories/TransactionRepositoryOffline`
- `getEcheanceRepositoryOffline` : `@/lib/offline/repositories/EcheanceRepositoryOffline`
- `expandEcheances`, `computeOccurrences` : `@/lib/echeances/expandEcheances`, `echeanceOccurrences`

### 7.2 Pas de breaking changes

- L'ouverture/fermeture du détail bail reste identique (même événement, même state).
- Les callbacks `onEdit`, `onDelete`, `onGenerateReceipt` gardent la même signature.
- Le mode app-shell reste prioritaire (IndexedDB).

---

## 8. Récapitulatif des composants

| Composant | Rôle | Données |
|-----------|------|---------|
| LeaseDetailView | Conteneur, layout | lease, callbacks |
| LeaseDetailHeader | Cockpit | lease, financialData, paymentsSummary |
| LeaseDetailPaymentsSection | Timeline mensuelle | useLeasePaymentsTimeline |
| LeaseDetailFinancialConfigSection | Config financière | useLeaseFinancialData |
| LeaseDetailContractSection | Contrat | lease |
| LeaseDetailDocumentsSection | Documents | useLeaseDocuments ou logique existante |

---

## 9. Prochaines étapes techniques

1. Créer le dossier `src/features/leases/components/`.
2. Implémenter `useLeaseFinancialData` avec fallback.
3. Implémenter `LeaseDetailView` + sections sans timeline.
4. Tester en mode app-shell sur un bien avec baux.
5. Implémenter `useLeasePaymentsTimeline` et `LeaseDetailPaymentsSection`.
6. Remplacer LeaseDrawerNew.

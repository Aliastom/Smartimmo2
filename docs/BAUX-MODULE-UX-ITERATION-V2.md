# Module BAUX — Itération V2 (Cockpit & priorité exploitation)

> Révision produit orientée usage réel.  
> Objectif : faire du détail bail un vrai cockpit d'exploitation, pas une fiche descriptive.

---

## 1. Fiche bail = cockpit d'exploitation

### 1.1 Les 5 questions immédiates

À l'ouverture, l'utilisateur doit avoir une réponse **en moins de 3 secondes** à :

| Question | Où la répondre | Format |
|----------|----------------|--------|
| **Suis-je payé ?** | Cockpit + section Paiements | Dernier paiement (date + montant) + statut mois courant |
| **Quelle est la prochaine échéance ?** | Cockpit | Date + montant attendu + statut (à piloter / couverte) |
| **Quelle est la dernière transaction ?** | Cockpit | Date + montant + lien vers détail |
| **Y a-t-il une alerte ?** | Cockpit (bandeau) | Badge(s) : retard, indexation due, résiliation prochaine |
| **Quelle action faire maintenant ?** | Actions primaires (cockpit) | CTA visible : Enregistrer paiement, Générer quittance, Piloter échéance |

### 1.2 Structure révisée : Header / Cockpit

**Principe** : Le header n'est plus une simple carte d'identité. C'est un **cockpit d'exploitation**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ COCKPIT                                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Identité]              │ [État financier]     │ [Actions primaires]         │
│ • Locataire             │ • Total mensuel      │ • Enregistrer un paiement   │
│ • Bien                  │ • Prochaine échéance │ • Générer quittance         │
│ • Statut                │   (date + statut)    │ • Piloter échéance          │
│                         │ • Dernier paiement   │ (selon contexte)            │
│                         │   (date + montant)   │                             │
├─────────────────────────┴─────────────────────┴─────────────────────────────┤
│ [Alertes] Retard · Indexation due · Résiliation dans 90 j                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Détail des blocs :**

#### Bloc Identité (compact)
- Locataire : nom, lien vers fiche
- Bien : nom, lien vers fiche
- Statut : badge (Actif, Brouillon, Résilié)
- Période : début — fin (ou "en cours")

#### Bloc État financier (priorité)
- **Total mensuel** : `totalDueByTenant` — ce que le locataire paie chaque mois
- **Prochaine échéance** :
  - Date (ex. "5 mars 2025")
  - Montant attendu
  - Statut : `à_piloter` | `payée` | `en_retard`
  - Si aucune : "Aucune échéance à venir"
- **Dernier paiement** :
  - Date + montant
  - Statut : `ok` | `retard` | `aucun`
  - Lien "Voir" vers la transaction

#### Bloc Alertes (bandeau, conditionnel)
- Affiché uniquement s'il y a au moins une alerte
- Types : `retard`, `indexation_due`, `resiliation_proche`, `bail_expirant`
- Chaque alerte : icône + libellé court + lien d'action

#### Bloc Actions primaires (CTAs)
- **Enregistrer un paiement** : toujours visible si bail actif
- **Générer quittance** : si bail actif
- **Piloter échéance** : si prochaine échéance en statut `à_piloter`
- Pas plus de 3 actions ; les autres dans un menu "Plus"

---

## 2. Section Paiements : bloc central

### 2.1 Position et priorité

La section Paiements est **le premier bloc de contenu** après le cockpit. Pas après la config financière ni le contrat. C'est là que l'utilisateur passe le plus de temps pour suivre les encaissements.

### 2.2 Modèle exact : `useLeasePaymentsTimeline`

```typescript
// Statuts pour l'UI (exhaustifs)
type MonthPaymentStatus = 'payé' | 'en_attente' | 'en_retard' | 'à_venir';

interface LeasePaymentsTimelineMonth {
  yearMonth: string;           // "2025-03"
  label: string;               // "Mars 2025"
  labelShort?: string;         // "Mar. 25" (pour affichage compact)
  
  // Montants
  expected: number;            // Somme attendue (échéances loyer)
  realized: number;            // Somme encaissée (transactions)
  gap: number;                 // realized - expected (positif = trop perçu)
  
  // Statut (règle métier)
  status: MonthPaymentStatus;
  
  // Contexte pour actions
  dueDate?: string;            // YYYY-MM-DD du jour de paiement (ex. 2025-03-05)
  transactionIds: string[];    // IDs des transactions pour ce mois
  echeanceIds: string[];       // IDs des échéances couvertes
  
  // Optionnel : détail pour tooltip
  transactionsSummary?: Array<{
    id: string;
    date: string;
    amount: number;
    label: string;
  }>;
}

interface LeasePaymentsTimelineResult {
  months: LeasePaymentsTimelineMonth[];
  loading: boolean;
  
  // Agrégés pour le cockpit (éviter recalcul)
  nextDue: {
    month: LeasePaymentsTimelineMonth;
    status: 'à_piloter' | 'payée' | 'en_retard';
  } | null;
  lastPayment: {
    month: LeasePaymentsTimelineMonth;
    date: string;      // Date réelle du dernier encaissement
    amount: number;
  } | null;
  alerts: Array<{
    type: 'retard' | 'indexation_due' | 'resiliation_proche' | 'bail_expirant';
    message: string;
    actionHref?: string;
  }>;
}
```

### 2.3 Règles de statut par mois

| Condition | status |
|-----------|--------|
| Mois **futur** (strictement après mois courant) | `à_venir` |
| Mois **courant** ou **passé** ET `realized >= expected - 0.01` | `payé` |
| Mois **passé** ET `expected > 0` ET `realized < expected - 0.01` | `en_retard` |
| Mois **courant** ET `realized < expected` ET date d'échéance pas encore dépassée | `en_attente` |
| Mois **courant** ET `realized < expected` ET date d'échéance dépassée | `en_retard` |

**À venir** = mois strictement dans le futur (ex. on est en mars 2025 → avril 2025 et plus = à_venir).

### 2.4 Affichage UI

- Grille ou liste verticale : une ligne/carte par mois
- Chaque ligne : Mois | Attendu | Réalisé | Statut (badge couleur) | Action (si applicable)
- Mois en retard : badge rouge, action "Enregistrer paiement" pré-remplie
- Mois à piloter (courant, non payé) : badge orange, action "Piloter"
- Mois payé : badge vert, lien vers transaction(s)
- Mois à venir : badge gris, pas d'action

---

## 3. Création du bail : nouvelle structure du formulaire

### 3.1 Principe : séparation stricte contrat / financier

L'onglet "Informations essentielles" ne contient **aucun** champ financier.  
Tous les montants (loyer, charges, caution, jour de paiement, indexation) sont dans "Conditions financières".

### 3.2 Structure exacte du wizard

#### Étape 1 — Informations essentielles (contrat)

| Champ | Obligatoire | Notes |
|-------|-------------|-------|
| Bien | Oui | SmartSelect |
| Locataire | Oui | SmartSelect |
| Type de bail | Oui | Résidentiel, Commercial, Garage |
| Type de meublé | Oui | Vide, Meublé, Garage |
| Date de début | Oui | DatePicker |
| Date de fin | Non | Optionnel ; peut être calculée selon type |
| Préavis (mois) | Non | noticeMonths |

**À retirer de cette étape :**
- Loyer mensuel
- Caution / dépôt de garantie
- Charges récupérables / non récupérables
- Jour de paiement
- Indexation

#### Étape 2 — Conditions financières

| Champ | Obligatoire | Notes |
|-------|-------------|-------|
| Loyer hors charges | Oui | baseRent |
| Charges récupérables mensuelles | Non (défaut 0) | |
| Charges non récupérables mensuelles | Non (défaut 0) | |
| Dépôt de garantie | Non (défaut 0) | Avec rappel plafond (1 mois vide, 2 mois meublé) |
| Jour de paiement | Oui (défaut 5) | 1-31 |
| Type d'indexation | Non | Aucune, IRL, Manuelle |

**Bloc calculé en temps réel :**
- Total mensuel (loyer + charges récup.) = ce que paie le locataire

#### Étape 3 — Clauses et conditions (optionnel)

| Champ | Obligatoire |
|-------|-------------|
| Notes / clauses particulières | Non |

#### Étape 4 — Récapitulatif et enregistrement

- Récap contrat + financier
- Bouton "Créer le bail"
- Option : "Créer les échéances de loyer pour les 12 prochains mois" (coché par défaut)

### 3.3 Fichiers à modifier

- `LeaseFormComplete.tsx` : déplacer les champs de `renderBasicInfo` vers `renderFinancialInfo`
- `LeaseEditModal.tsx` : aligner la structure des onglets (Contrat vs Financier)

---

## 4. Hiérarchie révisée de la fiche bail

### 4.1 Ordre des sections (orienté usage)

| # | Section | Rôle | Quand l'utilisateur y va |
|---|---------|------|--------------------------|
| 1 | **Cockpit** | Répondre aux 5 questions + actions | Toujours (premier écran) |
| 2 | **Paiements** | Suivre les encaissements mois par mois | Très souvent |
| 3 | **Configuration financière** | Voir/modifier les paramètres | Parfois (réindexation, avenant) |
| 4 | **Contrat** | Cadre juridique (type, dates, préavis) | Rarement (consultation) |
| 5 | **Documents** | Bail signé, quittances | Parfois (génération, consultation) |
| 6 | **Métadonnées** | Dates création/modif, ID | Rarement (debug, support) |

### 4.2 Règles de priorité visuelle

- **Cockpit** : toujours visible (sticky ou premier bloc)
- **Paiements** : pas de collapse par défaut ; contenu immédiatement visible
- **Configuration, Contrat, Documents** : peuvent être en sections repliables (accordion) pour alléger
- **Métadonnées** : en bas, collapse par défaut, ou lien "Détails techniques"

---

## 5. Implémentation progressive

### 5.1 À faire immédiatement (Phase 1 — impact visible)

| Élément | Action | Effort |
|---------|--------|--------|
| **Cockpit** | Refondre LeaseDetailHeader : 3 colonnes (Identité | État financier | Actions), bandeau alertes, CTAs primaires | 1 j |
| **Hiérarchie** | Réordonner les sections : Paiements en 2e position, après le cockpit | 0.5 j |
| **Section Paiements** | Créer useLeasePaymentsTimeline + LeaseDetailPaymentsSection avec le modèle `MonthPaymentStatus` | 1.5 j |
| **Formulaire création** | Déplacer loyer, charges, caution, paymentDay, indexation de "Informations essentielles" vers "Conditions financières" dans LeaseFormComplete | 0.5 j |

**Total Phase 1** : ~3.5 j. Résultat : cockpit exploitable, paiements central, formulaire cohérent.

### 5.2 À reporter en Phase 2

| Élément | Raison du report |
|---------|------------------|
| **Métadonnées** (section dédiée) | Peu prioritaire ; peut rester masqué ou absent |
| **Actions contextuelles** (ex. "Piloter échéance" si prochaine = à_piloter) | Dépend de useLeasePaymentsTimeline ; on peut commencer par actions fixes |
| **Alertes dynamiques** (indexation due, résiliation proche) | Calcul plus complexe ; Phase 1 peut afficher "Aucune alerte" |
| **Créer un avenant** | Fonctionnalité Phase 2 architecture |
| **useLeaseDocuments** (hook dédié) | Réutiliser la logique existante de LeaseDrawerNew pour l'instant |

### 5.3 À garder temporairement en l'état

| Élément | Justification |
|---------|---------------|
| **LeaseEditModal** | Structure onglets complexe ; ajuster en Phase 2 une fois LeaseFormComplete stabilisé |
| **Liste des baux** (LeasesTableNew) | Pas dans le périmètre fiche bail |
| **Modals** (Delete, CannotDelete, LeaseActionsManager) | Déjà fonctionnels |
| **Sync / offline** | Inchangé ; les nouveaux composants utilisent les mêmes repositories |

### 5.4 Ordre d'exécution recommandé

1. **useLeaseFinancialData** (fallback) + **useLeasePaymentsTimeline** (modèle complet)
2. **LeaseDetailHeader** refondu (cockpit)
3. **LeaseDetailPaymentsSection** (timeline)
4. **LeaseDetailView** : réordonner les sections (Paiements en 2e)
5. **LeaseFormComplete** : déplacer les champs financiers
6. Remplacement LeaseDrawerNew par LeaseDetailView

---

## 6. Récapitulatif : avant / après

| Aspect | Avant | Après |
|--------|-------|-------|
| **Header** | Identité + résumé financier statique | Cockpit (identité + état + actions + alertes) |
| **Première section** | Résumé financier ou échéances | Paiements (timeline mensuelle) |
| **Question "suis-je payé ?"** | Nécessite de scroller | Réponse dans le cockpit |
| **Actions** | Footer, secondaires | CTAs primaires dans le cockpit |
| **Création bail** | Loyer/caution dans "Informations essentielles" | Tout le financier dans "Conditions financières" |
| **Hiérarchie** | Descriptive (contrat, finan, échéances…) | Orientée usage (cockpit → paiements → config → contrat → documents) |

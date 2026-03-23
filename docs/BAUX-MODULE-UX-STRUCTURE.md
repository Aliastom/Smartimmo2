# Module BAUX — Structure UX et Produit

> Réflexion produit / UX / structure. Pas de code, pas de design graphique.  
> Niveau : product designer senior SaaS + expert métier immobilier.

---

## 1. Structure globale du module

### 1.1 Vues principales

| Vue | Rôle | Contexte d'accès |
|-----|------|------------------|
| **Liste des baux** | Vue agrégée, filtres, KPIs (loyers encaissés, retards, échéances) | Navigation globale (app/baux) ou depuis un bien |
| **Fiche bail** | Vue détaillée d'un bail — cœur du module | Depuis liste, bien, locataire, ou recherche |
| **Création de bail** | Parcours guidé en étapes (contrat → financier → optionnel) | Bouton "Nouveau bail" (contexte bien ou global) |
| **Édition** | Modification ciblée, pas de refonte du formulaire création | Depuis fiche bail (sections éditables) |

### 1.2 Vues secondaires / contextuelles

| Vue | Rôle | Déclencheur |
|-----|------|-------------|
| **Indexation** | Réindexer le loyer (IRL, etc.) — impacte LeaseFinancialConfig | Action depuis fiche bail ou échéance "Indexation due" |
| **Résiliation** | Clôturer le bail (dates, préavis, documents) | Action depuis fiche bail |
| **Renouvellement / Avenant** | Nouvelle config financière dans le temps | Action depuis fiche bail (Phase 2) |
| **Génération documents** | Bail vierge, quittance, état des lieux | Actions depuis fiche bail |
| **Pilotage échéances** | Créer transaction depuis une échéance | Depuis vue Échéances ou Dashboard |

### 1.3 Hiérarchie de navigation

```
App
├── Baux (liste)
│   ├── Fiche bail [id]
│   │   ├── Édition (inline ou drawer selon section)
│   │   ├── Indexation (modal ou page dédiée)
│   │   ├── Résiliation (wizard)
│   │   └── Documents (génération)
│   └── Nouveau bail (wizard)
│
└── Bien [id]
    └── Onglet Baux
        └── (même structure, filtrée au bien)
```

La fiche bail doit être accessible par URL canonique (`/app?view=baux` ou `/biens/[id]?tab=leases`) + détail par ID. Pas de duplication de logique — la fiche bail est la même qu'on y arrive depuis la liste globale ou depuis un bien.

---

## 2. Structure d'une fiche bail

### 2.1 Principe directeur

La fiche bail répond à **3 questions** que se pose l'utilisateur :

1. **C'est quoi ?** → Contrat (qui, où, quand, quel type)
2. **Combien ?** → Configuration financière (loyer, charges, caution, indexation)
3. **Où en est-on ?** → Exploitation (paiements, échéances, documents)

Chaque bloc a un **objectif utilisateur** clair. Ce qui est **paramétrage** (config) est distinct de ce qui est **résultat** (transactions, projections).

---

### 2.2 Header (infos clés)

**Contenu :**

- Bien (nom, adresse) + lien vers fiche bien
- Locataire(s) (nom) + lien vers fiche locataire
- Statut (Brouillon, Actif, Résilié) — badge visuel
- Période (début — fin ou "en cours")
- Loyer mensuel total (ce que paie le locataire) — **calculé** depuis LeaseFinancialConfig

**Objectif utilisateur :** Identifier le bail en 5 secondes. Pas besoin de scroller pour savoir "de quel bail on parle".

**Affiché vs calculé :** Loyer total = `baseRent + chargesRecoverableMonthly` (totalDueByTenant). Le reste est stocké.

---

### 2.3 Bloc CONTRAT

**Contenu :**

- Type de bail (vide, meublé, commercial, garage)
- Dates (début, fin si applicable)
- Durée contractuelle (3 ans, 9 ans, etc.)
- Préavis (en mois)
- Clauses particulières / notes libres
- Document signé (lien si disponible)

**Objectif utilisateur :** Comprendre le cadre juridique. Ces éléments sont **peu modifiables** une fois le bail actif (ou alors via avenant).

**Affiché vs calculé :** Tout affiché. La durée peut être dérivée des dates pour vérification.

**Ce qui n'est PAS ici :** Loyer, charges, caution, jour de paiement — ils sont dans Configuration financière.

---

### 2.4 Bloc CONFIGURATION FINANCIÈRE

**Contenu :**

- Loyer hors charges (baseRent)
- Charges récupérables mensuelles
- Charges non récupérables (info seulement, pas dans le total locataire)
- Total dû par le locataire (calculé) — mise en évidence
- Jour de paiement (1–31)
- Dépôt de garantie
- Règle d'indexation (IRL, ICC, manuelle, aucune)

**Objectif utilisateur :** Voir et modifier les **paramètres** qui déterminent les flux (échéances, transactions). C'est le "moteur" financier du bail.

**Affiché vs calculé :**

- Affiché : baseRent, charges récup., charges non récup., paymentDay, deposit, indexation
- Calculé : totalDueByTenant (= baseRent + charges récup.)

**Important :** Ce bloc correspond à **LeaseFinancialConfig**. En cas d'avenant futur, on pourra afficher une timeline (config 1 du 01/01/24 au 30/06/24, config 2 à partir du 01/07/24).

---

### 2.5 Bloc ÉCHÉANCES (projection)

**Contenu :**

- Liste des échéances récurrentes liées au bail (loyer attendu, charges, taxes, etc.)
- Prochaine échéance à piloter
- Statut de couverture (couverte / non couverte par une transaction)
- Lien vers création de transaction

**Objectif utilisateur :** Anticiper ce qui doit être encaissé ou payé. Les échéances sont des **projections** — elles ne sont pas "réelles" tant qu'une transaction ne les matérialise pas.

**Affiché vs calculé :**

- Affiché : liste des échéances (montant, fréquence, statut)
- Calculé : prochaine date, montant attendu, statut de couverture

**Ce qui n'est PAS ici :** La configuration qui génère les échéances (c'est dans Configuration financière). Ici on voit le **résultat** de cette config.

---

### 2.6 Bloc TRANSACTIONS (réel)

**Contenu :**

- Liste des transactions liées au bail (loyers encaissés, charges, dépôt, régularisation)
- Solde / situation (optionnel : ce qui a été encaissé vs attendu)
- Bouton "Enregistrer un paiement"

**Objectif utilisateur :** Voir ce qui a **vraiment** été encaissé. C'est le réel, par opposition aux échéances (projection).

**Affiché vs calculé :**

- Affiché : transactions (date, montant, nature, statut)
- Calculé : totaux par période, écarts échéance/transaction

---

### 2.7 Bloc DOCUMENTS

**Contenu :**

- Documents liés au bail (contrat signé, quittances, états des lieux)
- Actions : générer bail vierge, quittance, état des lieux
- Types de documents par statut (brouillon vs actif)

**Objectif utilisateur :** Centraliser les preuves et les générations. Les documents sont des **outputs** du bail, pas des paramètres.

---

### 2.8 Bloc WORKFLOW (optionnel selon maturité)

**Contenu :**

- Étapes de signature (si workflow électronique)
- Rappels (indexation due, résiliation prochaine)
- Historique des actions significatives

**Objectif utilisateur :** Savoir "où en est" le bail dans son cycle de vie (signature, réindexation, résiliation).

---

### 2.9 Hiérarchie visuelle recommandée

```
┌─────────────────────────────────────────────────────────┐
│ HEADER (bien, locataire, statut, période, loyer total)  │
├─────────────────────────────────────────────────────────┤
│ CONTRAT          │ Configuration financière (collapsible│
│ (éditable)       │ ou onglet selon densité)             │
├──────────────────┼──────────────────────────────────────┤
│ ÉCHÉANCES        │ TRANSACTIONS                         │
│ (projection)     │ (réel)                               │
├──────────────────┴──────────────────────────────────────┤
│ DOCUMENTS                                               │
└─────────────────────────────────────────────────────────┘
```

- **Contrat + Config financière** : souvent consultés ensemble au début, puis rarement modifiés.
- **Échéances + Transactions** : consultation fréquente pour le suivi. Les placer côte à côte aide à faire le lien projection / réel.
- **Documents** : plus secondaire, en bas ou en onglet.

---

## 3. Parcours utilisateur

### 3.1 Créer un bail

**Flow proposé (wizard en 2–3 étapes) :**

**Étape 1 — Contexte contractuel (obligatoire)**  
- Sélection du bien (obligatoire)  
- Sélection du locataire (obligatoire)  
- Type de bail (vide, meublé, etc.)  
- Date de début  
- Date de fin (optionnel, peut être calculée)  
- Préavis  

**Objectif :** Poser le cadre. Pas de montant ici — on réduit la charge cognitive.

**Étape 2 — Configuration financière (obligatoire)**  
- Loyer hors charges  
- Charges récupérables  
- Charges non récupérables (optionnel)  
- Jour de paiement  
- Dépôt de garantie  
- Indexation  

**Objectif :** Paramétrer les flux. Le total "dû par le locataire" est calculé et affiché en temps réel.

**Étape 3 — Optionnel (résumé + actions)**  
- Récapitulatif  
- Option : générer le bail vierge maintenant  
- Option : créer les échéances de loyer (suggestion)  
- Enregistrer  

**Principes :**

- Une étape = une question ("Qui, quoi, où ?" puis "Combien ?").
- Pas de mélange contrat/financier dans la même étape.
- Validation progressive (on peut enregistrer en brouillon après l’étape 1).
- Suggestion intelligente : "Souhaitez-vous créer les échéances de loyer pour les 12 prochains mois ?" (Oui / Non / Plus tard).

---

### 3.2 Modifier un bail

**Règle :** Modifier par section, pas via un formulaire monolithique.

- **Contrat :** Édition inline ou drawer "Modifier le contrat". Champs verrouillables si bail actif (avec indication "Modification via avenant recommandée").
- **Configuration financière :** Édition inline ou drawer "Modifier la configuration financière". En Phase 2 avec avenants : "Créer un avenant" plutôt que modifier la config actuelle.

**Pas de formulaire géant** : on édite ce qu’on veut, où on est.

---

### 3.3 Gérer un avenant / renouvellement

**Avenant = nouvelle configuration financière à une date d’effet.**

Flow proposé (Phase 2) :

1. Depuis la fiche bail : "Créer un avenant".
2. Date d’effet (par défaut : fin du préavis ou date de renouvellement).
3. Nouveaux paramètres (loyer, charges, etc.) — pré-remplis avec la config actuelle.
4. Raison (réindexation, renouvellement, accord amiable).
5. Enregistrement → nouvelle LeaseFinancialConfig avec `effectiveFrom`.

**UX :** Timeline ou historique des configs sur la fiche bail : "Config actuelle (depuis 01/07/24)" avec lien vers l’historique.

**Renouvellement :** Cas particulier d’avenant. On peut proposer un flow "Renouveler le bail" qui crée une nouvelle config avec les mêmes ou de nouveaux paramètres.

---

### 3.4 Suivre un bail actif

**Cas d’usage principal :** "Où en est ce bail ce mois-ci ?"

- Header : loyer total, statut, période.
- Bloc Échéances : prochaine échéance, couverte ou non.
- Bloc Transactions : dernier encaissement, retard éventuel.
- Alertes : indexation due, résiliation prochaine.

**Objectif :** Répondre en quelques secondes sans ouvrir plusieurs écrans. Les KPIs (retard, prochaine échéance) peuvent être dans le header ou un bandeau.

---

## 4. Principes UX clés

### 4.1 Visible immédiatement

- **Header :** Bien, locataire, statut, période, loyer total.
- **Prochaine échéance** et son statut (couverte / non couverte).
- **Dernier paiement** (date, montant) ou indicateur de retard.
- **Actions contextuelles** : Enregistrer un paiement, Générer une quittance.

### 4.2 Secondaire (accessible mais pas prioritaire)

- Détail du contrat (type, préavis, clauses).
- Historique complet des transactions.
- Liste exhaustive des documents.
- Paramètres d’indexation avancés.

### 4.3 Ce qui ne doit PAS être dans le bail

- **Gestion des impayés** : c’est un flux (transaction) + une alerte, pas un paramètre du bail.
- **Simulation fiscale** : module dédié, pas dans la fiche bail.
- **Gestion locative déléguée** : paramètres (taux, mode) sur le bien ou l’organisation.
- **Détail des charges** (eau, chauffage, etc.) : trop granulaire pour un bail standard ; à garder pour un module "Charges détaillées" si besoin.

### 4.4 Réduction de la charge cognitive

1. **Une question par écran** (wizard) : contrat d’abord, financier ensuite.
2. **Différenciation visuelle** : contrat (icône document), config (icône euro), exploitation (icône calendrier/transaction).
3. **Calculs automatiques** : total dû, prochaine échéance — l’utilisateur ne calcule pas.
4. **Valeurs par défaut** : jour de paiement = 5, indexation = IRL si vide, etc.
5. **Progressive disclosure** : détails avancés (charges non récup., notes) dans des sections repliables.
6. **Langage métier** : "Loyer hors charges", "Charges récupérables", "Total dû par le locataire" — pas de jargon technique.

---

## 5. Alignement avec le modèle technique

| Entité technique | Où dans la UI | Rôle |
|------------------|---------------|------|
| **Lease** | Bloc Contrat, Header (bien, locataire, dates, statut) | Contrat juridique |
| **LeaseFinancialConfig** | Bloc Configuration financière | Paramètres financiers |
| **EcheanceRecurrente** | Bloc Échéances | Projections (loyer attendu, charges, etc.) |
| **Transaction** | Bloc Transactions | Réalisations (encaissements) |
| **RentIndexation** | Historique dans Config financière ou section dédiée | Historique des réindexations |
| **Document** | Bloc Documents | Pièces attachées au bail |

**Règle d’or :** Un champ technique n’apparaît qu’à un seul endroit logique. Pas de doublon (ex. loyer dans le contrat ET dans la config). Le header peut afficher un **résumé** calculé (totalDueByTenant) sans dupliquer la config.

---

## 6. Erreurs à éviter

### 6.1 Pièges UX classiques

- **Formulaire trop long** : tout sur une page → wizard ou sections clairement séparées.
- **Mélange des responsabilités** : contrat + financier + exploitation dans le même bloc → séparer.
- **Absence de hiérarchie** : tout au même niveau → header + blocs prioritaires.
- **Actions cachées** : "Enregistrer un paiement" enterré → actions visibles dans le header ou bandeau.
- **Jargon technique** : "LeaseFinancialConfig", "EcheanceRecurrente" → noms métier (Configuration financière, Échéances).

### 6.2 Incohérences fréquentes dans les apps immo

- **Loyer = montant total ou hors charges ?** : Clarifier "Loyer hors charges" vs "Total dû (loyer + charges)".
- **Charges récupérables vs non récupérables** : Expliquer (ou tooltip) : récupérables = provision payée par le locataire, non récupérables = à la charge du propriétaire.
- **Caution vs dépôt** : Un seul terme (dépôt de garantie) pour éviter la confusion.
- **Échéance vs transaction** : Échéance = prévision, Transaction = fait. Ne pas les mélanger visuellement.

### 6.3 Ce qu’il ne faut surtout pas faire

- **Modifier la config financière sans traçabilité** : En cas d’avenant, garder l’historique (effectiveFrom).
- **Afficher des montants calculés sans indiquer la source** : "Total basé sur la config actuelle (depuis 01/07/24)".
- **Créer un bail sans pouvoir le sauvegarder en brouillon** : permettre d’enregistrer étape 1 seulement.
- **Obliger à tout remplir d’un coup** : champs optionnels clairement identifiés, étapes optionnelles.
- **Dupliquer l’édition** : une seule façon d’éditer la config (inline ou drawer), pas un formulaire différent pour création et édition.

---

## 7. Évolution progressive

Cette structure peut être mise en place **progressivement** :

**Phase 1 (MVP)**  
- Fiche bail avec blocs Contrat, Config financière, Transactions, Documents.  
- Création en wizard 2 étapes (contrat + financier).  
- Pas d’historisation des configs (un seul LeaseFinancialConfig par bail).

**Phase 2**  
- Bloc Échéances intégré.  
- Avenants / historisation des configs.  
- Timeline des configs sur la fiche.

**Phase 3**  
- Workflow de signature.  
- Rappels (indexation, résiliation).  
- Tableau de bord "Baux à piloter".

Chaque phase reste cohérente avec le modèle : Lease + LeaseFinancialConfig + Échéances + Transactions.

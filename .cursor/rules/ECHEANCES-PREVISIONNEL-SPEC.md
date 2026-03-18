# Échéances – Refonte prévisionnelle / patrimoniale

## 1. Nouveau modèle cible

### 1.1 Philosophie

- **Une échéance n’est pas une facture** : c’est une **règle de projection** qui décrit une charge ou une recette récurrente future.
- Le **paiement réel** est représenté dans l’onglet **Transactions**.
- L’échéance sert à :
  - **Prévoir** les flux (charges / revenus) sur 12 mois ou plus.
  - Servir de **repère métier** pour vérifier si une transaction réelle a été créée pour une occurrence donnée.
  - Permettre **suggestions et liaison** bidirectionnelle avec les transactions.

### 1.2 Deux dimensions de statut (séparées)

| Dimension | Valeurs | Signification |
|-----------|--------|----------------|
| **Statut temporel** | À venir | Prochaine occurrence dans le futur. |
| | Échue | Au moins une occurrence est passée (date &lt; aujourd’hui). |
| | Désactivée | `isActive = false`. |
| **Statut de génération** | Générée | Au moins une transaction est liée pour cette échéance (pour la période concernée). |
| | À générer | Échéance échue (ou à venir selon produit) sans transaction liée. |
| | Partielle | Plusieurs occurrences, certaines couvertes par des transactions (extensible). |

**À ne plus utiliser** : retard, payé, impayé, en retard, acquitté.

**Formulations métier** :
- « À venir dans X jours / mois »
- « Échéance passée »
- « Transaction générée » / « Générée »
- « Aucune transaction associée » / « À générer »
- « Génération partielle » (si besoin plus tard)

---

## 2. À supprimer / renommer

### 2.1 À supprimer

- Toute logique et libellé **« En retard »** au sens paiement (badges, KPIs, messages).
- Vocabulaire **facture / acquittement / payé / impayé** dans l’onglet Échéances.
- Colonne ou badge **« Urgence »** basé sur le retard de paiement (à remplacer par statut temporel + statut génération).

### 2.2 À renommer / adapter

- **Urgence « overdue »** → **« Échue »** (statut temporel) + **« À générer »** ou **« Générée »** (statut génération).
- **« Prochaine échéance »** : conserver, mais sous-titré par **statut temporel** (À venir / Échue) et **statut génération** (Générée / À générer).
- **KPI « En retard »** → supprimé ; à la place : **« À générer »** (nombre d’échéances échues sans transaction liée) et éventuellement **« Transactions générées »**.

---

## 3. Synchro bidirectionnelle

### 3.1 Échéance → Transaction

- Quand une occurrence est **échue** (ou à J pour « à venir » selon règle produit) :
  - Statut génération = **À générer** si aucune transaction liée.
  - Actions possibles :
    - **Créer la transaction** (bouton) : ouvre la création de transaction pré-remplie (bien, bail, montant, date, catégorie suggérée).
    - Plus tard : **génération automatique** si `generationMode = automatic`.
- Si une transaction est déjà liée pour cette occurrence → statut **Générée**, pas de double génération.

### 3.2 Transaction → Échéance

- À la **création / modification** d’une transaction :
  - Lancer un **matching** (voir § 4) sur les échéances du même bien (et bail si présent).
  - **Match fort** → liaison automatique (création d’un enregistrement dans la table de liaison).
  - **Match probable** → proposer une confirmation (« Associer à l’échéance X ? »).
  - **Match faible** → ne pas lier automatiquement ; en détail échéance, suggérer « Lier une transaction existante » avec liste des candidats.

### 3.3 Éviter les doublons

- Une **occurrence** (date d’échéance donnée) ne doit pas avoir plus d’une transaction liée « principale » si on décide 1 occurrence = 1 transaction (ou bien gérer « partielle » si une transaction couvre plusieurs occurrences).
- Règle proposée : **une échéance** peut être liée à **plusieurs transactions** (une par occurrence ou regroupement) ; **une transaction** est liée à **au plus une échéance** (liaison principale).

---

## 4. Logique de matching échéance ↔ transaction

### 4.1 Critères

- Même **bien** (`propertyId`).
- Même **bail** si présent sur l’échéance.
- Même **sens** (charge / revenu) : `echeance.sens` ↔ déduire sens transaction (ex. `amount < 0` ou catégorie).
- **Type / catégorie** : mapping type échéance → catégories compatibles (ex. PNO → « Assurance », Taxe foncière → « Impôts »).
- **Montant** : égal ou proche (tolérance en %, ex. ±5 %).
- **Date** : date de la transaction dans une **fenêtre** autour de l’occurrence (ex. ±1 mois pour annuel, ±15 j pour mensuel).
- **Libellé** : mots-clés communs (normalisation, sans accent, trim).

### 4.2 Niveaux de confiance

| Niveau | Critères typiques | Comportement |
|--------|-------------------|--------------|
| **Fort** | Bien + bail (si présent) + sens + montant proche + date dans fenêtre + libellé proche | Liaison automatique. |
| **Probable** | Bien + sens + montant proche + date dans fenêtre | Proposer confirmation à l’utilisateur. |
| **Faible** | Bien + sens seulement, ou 1–2 critères | Ne pas lier auto ; suggérer en détail échéance. |

### 4.3 Table de liaison proposée

```prisma
model EcheanceTransactionLink {
  id             String   @id @default(cuid())
  echeanceId     String
  transactionId  String
  matchType      String   // "auto" | "manual" | "suggested"
  confidenceScore Float?  // 0-1 si utile
  occurrenceDate String?  // YYYY-MM-DD de l'occurrence couverte (optionnel)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  Echeance    EcheanceRecurrente @relation(fields: [echeanceId], references: [id], onDelete: Cascade)
  Transaction Transaction       @relation(fields: [transactionId], references: [id], onDelete: Cascade)

  @@unique([echeanceId, transactionId])
  @@index([echeanceId])
  @@index([transactionId])
}
```

- **Transaction** : ajouter `EcheanceTransactionLink[]` (ou `EcheanceTransactionLinks`).
- **EcheanceRecurrente** : ajouter `EcheanceTransactionLink[]`.

Une transaction ne peut être liée qu’à **une** échéance (contrainte métier côté app : une seule liaison « principale » par transaction si on veut éviter le fractionnement pour la v1).

---

## 5. Changements UI détaillés

### 5.1 KPIs (haut de page)

- **Charges à venir (12 mois)** – inchangé.
- **Revenus à venir (12 mois)** – inchangé.
- **Échéances actives** – inchangé.
- **À générer** – nombre d’échéances (actives, échues) sans transaction liée pour l’occurrence concernée.
- **Transactions générées** – nombre de liens échéance–transaction (ou nombre d’échéances ayant au moins une transaction liée).
- Optionnel : **Échéances échues non générées** (alias « À générer » ciblé échues).

Supprimer : **En retard**.

### 5.2 Bloc hero « Prochaine échéance à piloter »

- Conserver : libellé, type, montant, date prochaine occurrence, sens (Charge/Revenu), récupérable si pertinent.
- **Remplacer** le badge « En retard de X jours » par :
  - **Statut temporel** : « À venir dans X mois » / « Échéance passée » / « Désactivée ».
  - **Statut génération** : « Générée » / « À générer ».
- Actions :
  - Voir le détail
  - Modifier
  - **Créer la transaction** (si à générer)
  - **Voir la transaction liée** (si générée)
  - Désactiver / Activer

### 5.3 Tableau

| Colonne | Contenu |
|---------|--------|
| Libellé | Inchangé. |
| Type | Inchangé. |
| Périodicité | Inchangé. |
| Montant | Inchangé. |
| Prochaine occurrence | Date + court libellé temporel (« À venir dans X mois » / « Échue »). |
| **Statut projection** | À venir / Échue / Désactivée (badge). |
| **Statut génération** | Générée / À générer / Partielle (badge). Si générée : « 1 transaction liée » (cliquable). |
| Actions | Éditer, ouvrir détail, etc. |

Supprimer : colonne **Urgence** (remplacée par les deux statuts ci-dessus).

### 5.4 Filtres

- Toutes, Actives, Désactivées.
- À venir, Échues.
- Générées, À générer.
- Charges, Revenus, Récupérables.

### 5.5 Side panel détail échéance

- **Header** : libellé, montant par occurrence, type, sens, actif, prochaine occurrence, **statut projection**, **statut génération**.
- **Impact prévisionnel** : montant par occurrence, périodicité, récupérable, estimation annuelle, dates début/fin.
- **Section Transactions liées** :
  - Nombre et liste compacte (date, libellé, montant, lien vers transaction).
  - Statut : Générée / À générer / Partielle.
  - Boutons : **Créer la transaction**, **Lier une transaction existante**, **Voir la transaction**, **Délier**.
- **Actions** : Modifier, Dupliquer, Désactiver/Réactiver, Supprimer.
- Supprimer tout wording « paiement / acquittement ».

### 5.6 Modal création / édition

- Conserver champs existants.
- Texte d’aide : « Cette échéance est une projection récurrente ; le paiement réel sera saisi dans l’onglet Transactions. »
- Optionnel (champ technique prêt pour la suite) : `generationMode` : manual / suggested / automatic (non exposé ou en « Options avancées »).

---

## 6. Implémentation technique

### 6.1 Modèle de données

1. **Migration Prisma** : créer `EcheanceTransactionLink`, ajouter les relations sur `EcheanceRecurrente` et `Transaction`.
2. **IndexedDB / offline** : ajouter store ou champs pour les liens (sync avec Supabase comme pour le reste).

### 6.2 Logique de calcul des statuts

- **Statut temporel** (par échéance, pour une occurrence cible = prochaine ou « dernière échue ») :
  - Si `!isActive` → **Désactivée**.
  - Si prochaine occurrence &gt; aujourd’hui → **À venir**.
  - Si prochaine occurrence ≤ aujourd’hui ou dernière occurrence &lt; aujourd’hui → **Échue**.
- **Statut génération** (par échéance, pour la période pertinente) :
  - Compter les liens `EcheanceTransactionLink` pour cette échéance (éventuellement filtrés par `occurrenceDate`).
  - 0 lien → **À générer**.
  - ≥ 1 lien → **Générée** (ou **Partielle** si on distingue par occurrence plus tard).

### 6.3 Matching (service dédié)

- **Fichier** : `src/domain/services/echeanceTransactionMatching.ts` (ou `lib/echeances/matching.ts`).
- Entrées : une transaction **ou** une échéance + liste des échéances / transactions du bien.
- Sortie : liste de paires (échéance, transaction) avec `confidenceScore` et `matchType`.
- Utilisation : à la sauvegarde d’une transaction (côté API ou client selon architecture) ; à l’ouverture du détail échéance (suggestions « Lier une transaction »).

### 6.4 Fichiers / composants à modifier

| Fichier / zone | Changements |
|----------------|------------|
| `prisma/schema.prisma` | Modèle `EcheanceTransactionLink`, relations. |
| `src/types/echeance.ts` | Types statut temporel, statut génération ; exports libellés. |
| `src/lib/echeances/echeanceCashflowHelpers.ts` | Remplacer `urgency` / « retard » par statut temporel + message « À venir » / « Échue » ; ajouter dépendance aux liens (si dispo en client). |
| `src/app/app/views/property/tabs/PropertyEcheancesClient.tsx` | KPIs, hero, tableau (colonnes, filtres), suppression « En retard ». |
| `src/components/echeances/PropertyEcheancesHero.tsx` | Statut projection + statut génération ; CTA « Créer la transaction » / « Voir la transaction ». |
| `src/components/echeances/EcheanceDrawer.tsx` | Sections statuts + « Transactions liées » + actions Créer / Lier / Délier. |
| `src/components/echeances/EcheanceModal.tsx` | Texte d’aide prévisionnel ; option `generationMode` si souhaité. |
| Hooks / API | Charger les liens échéance–transaction ; calcul « À générer » / « Générée ». |
| Onglet Transactions | Détection match à la création/édition ; suggestion « Associer à l’échéance X » ; affichage « Échéance liée » en détail. |

### 6.5 Plan d’implémentation par étapes

1. **Modèle et vocabulaire (sans liaison)**  
   - Migration Prisma + types TS pour `EcheanceTransactionLink`.  
   - Dans `echeanceCashflowHelpers` : remplacer « retard » / urgency par **statut temporel** (À venir / Échue / Désactivée) et messages « À venir dans X mois » / « Échéance passée ».  
   - Adapter KPIs, hero, tableau, side panel et filtres au nouveau vocabulaire (sans encore afficher « Générée » / « À générer » basé sur les liens).

2. **Lecture des liens (si API/IDB prêts)**  
   - API ou couche offline pour lire les liens par échéance / par transaction.  
   - Calcul statut génération (Générée / À générer) et affichage dans l’UI (hero, tableau, side panel).

3. **Liaison manuelle**  
   - Dans le side panel échéance : « Lier une transaction existante » (liste des transactions du bien, choix).  
   - Création/suppression d’un `EcheanceTransactionLink` via API / service offline.

4. **Création de transaction depuis l’échéance**  
   - Bouton « Créer la transaction » : ouvre la modale/écran de création de transaction pré-remplie (bien, bail, montant, date, sens) et crée le lien après création.

5. **Matching automatique (transaction → échéance)**  
   - À la création/édition d’une transaction : appel du service de matching ; liaison auto si match fort ; proposition de confirmation si match probable.

6. **Suggestions côté Transactions**  
   - Dans la liste ou détail transaction : afficher « Échéance liée : X » si lien existant ; proposer « Associer à l’échéance Y » si match probable.

7. **Optionnel**  
   - Génération automatique (cron ou trigger) selon `generationMode` ; historique de génération dans le side panel.

---

## 7. Récapitulatif livrable

- **Nouveau modèle** : échéance = règle de projection ; statuts temporel (À venir / Échue / Désactivée) et génération (Générée / À générer / Partielle).
- **Supprimé** : retard, payé, impayé, colonne Urgence basée sur retard.
- **Synchro** : échéance → transaction (Créer la transaction, lien) ; transaction → échéance (matching fort/probable/faible, liaison auto ou proposée).
- **Table** : `EcheanceTransactionLink` (echeanceId, transactionId, matchType, confidenceScore, occurrenceDate).
- **UI** : KPIs, hero, tableau, filtres, side panel et modal alignés sur ce modèle et ce vocabulaire.

Ce document sert de spécification de référence pour l’implémentation par étapes ci-dessus.

---

## 8. Implémenté (première phase)

- **Modèle Prisma** : `EcheanceTransactionLink` ajouté dans `schema.prisma` avec relations sur `EcheanceRecurrente` et `Transaction`. Créer la migration avec `npx prisma migrate dev --name add_echeance_transaction_link` lorsque la base est disponible.
- **Types** : `EcheanceStatutTemporel` (desactive | a_venir | echue), `EcheanceStatutGeneration` (generee | a_generer | partielle), labels et couleurs dans `types/echeance.ts`.
- **Helpers** : `echeanceCashflowHelpers.ts` refactoré : plus de notion « retard » ; `temporalStatus` (À venir / Échue / Désactivée), `temporalBadgeMeta`, `generationBadgeMeta`, `getStatutGeneration`, `countEcheancesEchues`.
- **UI onglet bien** : KPI « En retard » remplacé par « Échues » ; filtre rapide « Échues » ; colonne « Statut projection » (remplace Urgence) ; colonne « Statut génération » (À générer pour l’instant) ; hero et drawer utilisent `temporalBadgeMeta` et messages « Échéance passée » / « À venir dans X mois ».
- **À faire ensuite** : API/IndexedDB pour les liens, chargement `linkedCount` par échéance, section « Transactions liées » dans le drawer, bouton « Créer la transaction », matching transaction → échéance.

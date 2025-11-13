# Guide des Transactions

Ce guide explique comment gérer les transactions financières dans Smartimmo (recettes, dépenses, rapprochements).

---

## Types de transactions

Dans Smartimmo, toutes les opérations financières sont enregistrées comme des **transactions**.

### Recettes (flux entrants)

- **Loyers** : Paiements mensuels des locataires
- **Dépôts de garantie** : Sommes versées en début de bail
- **Régularisation de charges** (si positif)
- **Indemnités d'assurance**
- **Subventions** (rénovation énergétique, etc.)

### Dépenses (flux sortants)

- **Charges de copropriété**
- **Travaux et réparations**
- **Taxe foncière**
- **Primes d'assurance** (PNO, loyers impayés)
- **Honoraires** (gestion, comptable, notaire)
- **Intérêts d'emprunt**
- **Régularisation de charges** (si négatif)

---

## Créer une transaction

1. **Accéder à la page Transactions** : Menu principal → "Transactions"
2. **Nouvelle transaction** : Cliquez sur "+ Nouvelle transaction"
3. **Renseigner les champs** :
   - **Date** : Date de l'opération
   - **Montant** : Somme (positive pour recette, négative pour dépense)
   - **Nature** : Type de transaction (voir ci-dessous)
   - **Bien** : Propriété concernée (optionnel si transaction globale)
   - **Locataire** : Si c'est un loyer ou dépôt de garantie
   - **Catégorie comptable** : Pour la comptabilité (charges, revenus, etc.)
   - **Description** : Détails complémentaires
4. **Joindre un justificatif** : Facture, relevé bancaire, quittance (recommandé)

---

## Natures de transactions

Les **natures** permettent de catégoriser précisément chaque opération. Exemples :

| Code | Libellé | Type | Comptabilité |
|------|---------|------|--------------|
| LOY | Loyer | Recette | 7531x - Loyers |
| DEP_GAR | Dépôt de garantie | Recette | 4197 - Caution |
| CHG_COPRO | Charges copropriété | Dépense | 614x - Charges |
| TRV | Travaux | Dépense | 615x - Entretien |
| TAX_FONC | Taxe foncière | Dépense | 6352 - Impôts |
| INT_EMP | Intérêts emprunt | Dépense | 6611 - Intérêts |

Vous pouvez personnaliser les natures dans **Admin → Natures & Catégories**.

---

## Rapprochement bancaire

Le rapprochement bancaire consiste à **associer vos transactions Smartimmo avec vos relevés bancaires** pour vérifier la cohérence.

### Pourquoi rapprocher ?

- Éviter les oublis (transaction non enregistrée)
- Détecter les erreurs de saisie
- Avoir une vue fiable de votre trésorerie

### Comment rapprocher dans Smartimmo ?

1. **Onglet Transactions** : Filtrer par période (ex : mois dernier)
2. **Télécharger votre relevé bancaire** (CSV ou PDF)
3. **Cocher les transactions rapprochées** : Cliquez sur l'icône de rapprochement à côté de chaque transaction validée
4. **Vérifier le solde** : Le solde Smartimmo doit correspondre au solde bancaire

**Astuce** : Vous pouvez joindre un extrait de relevé bancaire directement à la transaction.

---

## Filtres et recherche

Utilisez les filtres pour retrouver rapidement une transaction :

- **Période comptable** : Mois/année
- **Bien** : Filtrer par propriété
- **Locataire** : Voir toutes les transactions d'un locataire
- **Nature** : Loyers uniquement, travaux uniquement, etc.
- **Statut de rapprochement** : Non rapprochées, rapprochées

---

## Export comptable

Smartimmo permet d'exporter vos transactions pour votre expert-comptable ou déclaration fiscale.

### Formats disponibles

- **CSV** : Compatible Excel, LibreOffice
- **PDF** : Tableau récapitulatif avec totaux
- **(À venir) Format FEC** : Fichier des Écritures Comptables (norme française)

### Procédure d'export

1. **Filtrer** les transactions (ex : année 2024)
2. **Cliquer sur "Exporter"** (en haut à droite)
3. **Choisir le format** (CSV ou PDF)
4. **Télécharger** le fichier

---

## Régularisation des charges

Si vous avez facturé des provisions de charges aux locataires, vous devez faire une **régularisation annuelle** :

1. **Calculer les charges réelles** (relevé du syndic, factures)
2. **Comparer avec les provisions** versées par le locataire
3. **Créer une transaction** :
   - Si trop-perçu → Remboursement (dépense)
   - Si insuffisant → Complément (recette)
4. **Informer le locataire** : Joindre le décompte des charges

---

## Déclaration fiscale (revenus fonciers)

Les transactions Smartimmo facilitent votre déclaration d'impôts.

### Régime Micro-Foncier

- **Conditions** : Revenus locatifs < 15 000 €/an
- **Abattement** : 30% automatique
- **Déclaration** : Somme des loyers encaissés (formulaire 2042)

### Régime Réel

- **Avantages** : Déduction de toutes les charges réelles
- **Déclaration** : Formulaire 2044 (détail recettes/dépenses)
- **Export Smartimmo** : Utilisez l'export CSV filtré sur l'année fiscale

**Catégories déductibles** (régime réel) :
- Charges de copropriété
- Travaux d'entretien et réparation (sauf amélioration)
- Taxe foncière
- Primes d'assurance
- Intérêts d'emprunt
- Honoraires de gestion

---

## Tableaux de bord et KPI

Smartimmo génère automatiquement des indicateurs financiers :

- **Évolution mensuelle** : Recettes vs Dépenses (graphique)
- **Répartition par catégorie** : Visualiser les postes de dépenses
- **Taux de rendement** : (Loyers - Charges) / Valeur du bien
- **Trésorerie cumulée** : Solde en temps réel

Consultez l'onglet **Dashboard** pour une vue d'ensemble.

---

## Bonnes pratiques

1. **Enregistrer rapidement** : Saisir chaque transaction dès réception/paiement
2. **Joindre des justificatifs** : Factures, relevés (preuve en cas de contrôle fiscal)
3. **Rapprocher mensuellement** : Éviter l'accumulation d'écarts
4. **Utiliser les bonnes natures** : Facilite la comptabilité et les exports
5. **Sauvegarder régulièrement** : Export CSV mensuel pour archive

---

## Ressources complémentaires

- [Impots.gouv.fr - Revenus fonciers](https://www.impots.gouv.fr/particulier/questions/comment-declarer-mes-revenus-fonciers)
- [Service-Public.fr - Charges récupérables](https://www.service-public.fr/particuliers/vosdroits/F31638)
- [Guide comptabilité locative (PDF)](https://www.anil.org/documentation/)


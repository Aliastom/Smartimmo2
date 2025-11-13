# Guide de Démarrage - Onboarding Smartimmo

Bienvenue dans Smartimmo ! Ce guide pas-à-pas vous accompagne pour configurer votre compte et commencer à gérer votre patrimoine immobilier.

---

## Étape 1 : Création du compte

1. **Inscription** : Rendez-vous sur [app.smartimmo.fr](https://app.smartimmo.fr) et créez votre compte
2. **Validation email** : Cliquez sur le lien reçu par email
3. **Première connexion** : Connectez-vous avec vos identifiants

---

## Étape 2 : Configuration du profil

### Informations propriétaire

Renseignez vos informations personnelles (utilisées pour les documents officiels) :

1. **Menu Profil** (icône utilisateur en haut à droite)
2. **Compléter** :
   - Nom complet
   - Adresse
   - Téléphone
   - Email de contact
3. **Enregistrer**

Ces informations apparaîtront sur les quittances de loyer et baux générés par Smartimmo.

---

## Étape 3 : Ajouter votre premier bien

### Créer une propriété

1. **Menu Biens** → **+ Nouveau bien**
2. **Renseigner les informations** :
   - **Adresse complète** (autocomplétée via API Adresse)
   - **Type de bien** : Appartement, Maison, Parking, Commerce, etc.
   - **Surface** (m²)
   - **Nombre de pièces**
   - **Valeur d'acquisition** (pour calcul de rendement)
   - **Date d'acquisition**
3. **Ajouter des photos** (optionnel mais recommandé)
4. **Enregistrer**

### Compléter les détails (optionnel)

- **DPE** : Classe énergétique (A à G)
- **Taxe foncière** : Montant annuel
- **Charges de copropriété** : Si applicable
- **Description** : Caractéristiques particulières

---

## Étape 4 : Ajouter un locataire

Si votre bien est déjà loué :

1. **Menu Locataires** → **+ Nouveau locataire**
2. **Informations** :
   - Nom et prénom
   - Email (pour envoi automatique des quittances)
   - Téléphone
   - Date de naissance
   - Profession (optionnel)
3. **Enregistrer**

**Note** : Un locataire peut être lié à plusieurs baux (si vous gérez plusieurs propriétés pour lui).

---

## Étape 5 : Créer un bail

### Nouveau bail

1. **Menu Baux** → **+ Nouveau bail**
2. **Informations obligatoires** :
   - **Bien** : Sélectionner la propriété
   - **Locataire(s)** : Ajouter un ou plusieurs locataires
   - **Date de début** : Date d'effet du bail
   - **Loyer mensuel** : Montant hors charges
   - **Charges** : Provision mensuelle (0 si inclus dans le loyer)
   - **Dépôt de garantie** : Généralement 1 mois de loyer HC
   - **Type de bail** : Vide (3 ans), Meublé (1 an), Commercial (9 ans)
3. **Options** :
   - **Date de fin** : Laisser vide pour renouvellement automatique
   - **Clause de révision** : IRL (par défaut)
   - **Paiement** : Virement, chèque, prélèvement
4. **Télécharger le bail signé** : PDF du contrat scanné
5. **Enregistrer**

Le bail sera automatiquement **activé** à sa date de début.

---

## Étape 6 : Enregistrer les premières transactions

### Dépôt de garantie

1. **Menu Transactions** → **+ Nouvelle transaction**
2. **Informations** :
   - **Date** : Date de réception
   - **Montant** : Ex : 800 € (positif)
   - **Nature** : Dépôt de garantie
   - **Bien** : Sélectionner la propriété
   - **Locataire** : Sélectionner le locataire
   - **Description** : "Dépôt de garantie bail du [date]"
3. **Enregistrer**

### Premier loyer

1. **Nouvelle transaction**
2. **Informations** :
   - **Date** : Date de réception du paiement
   - **Montant** : Ex : 850 € (loyer + charges)
   - **Nature** : Loyer
   - **Bien** : Votre propriété
   - **Locataire** : Votre locataire
   - **Mois comptable** : Janvier 2025 (format YYYY-MM)
3. **Joindre un justificatif** : Capture du virement bancaire (optionnel)
4. **Enregistrer**

### Génération automatique de quittance

1. **Onglet Baux** → Sélectionner le bail
2. **Onglet Quittances**
3. **Générer la quittance** du mois (si loyer enregistré)
4. **Télécharger le PDF** et l'envoyer au locataire

---

## Étape 7 : Enregistrer les dépenses

### Exemple : Taxe foncière

1. **Nouvelle transaction**
2. **Informations** :
   - **Date** : Date de paiement
   - **Montant** : Ex : -1200 € (négatif pour dépense)
   - **Nature** : Taxe foncière
   - **Bien** : Votre propriété
   - **Catégorie comptable** : Impôts et taxes
3. **Joindre** : Avis de taxe foncière (PDF)
4. **Enregistrer**

### Exemple : Travaux

1. **Nouvelle transaction**
2. **Informations** :
   - **Date** : Date de paiement
   - **Montant** : Ex : -450 € (négatif)
   - **Nature** : Travaux d'entretien
   - **Bien** : Votre propriété
   - **Catégorie** : Entretien et réparations
   - **Description** : "Réparation chaudière"
3. **Joindre** : Facture du prestataire
4. **Enregistrer**

---

## Étape 8 : Consulter le tableau de bord

### Vue d'ensemble

1. **Menu Dashboard**
2. **Indicateurs** :
   - Revenus du mois
   - Dépenses du mois
   - Solde (trésorerie)
   - Nombre de baux actifs
   - Rendement locatif
3. **Graphiques** :
   - Évolution mensuelle (recettes vs dépenses)
   - Répartition par catégorie
   - Patrimoine immobilier

Le dashboard se met à jour automatiquement à chaque transaction.

---

## Étape 9 : Paramétrer les alertes (optionnel)

Smartimmo vous envoie des notifications pour :

- **Loyer impayé** : 3 jours après la date d'échéance
- **Indexation IRL** : Date anniversaire du bail
- **Fin de bail** : 6 mois avant l'échéance
- **Quittance à émettre** : Début de chaque mois

Personnalisez vos alertes dans **Paramètres → Notifications**.

---

## Étape 10 : Inviter votre comptable (optionnel)

Si vous travaillez avec un expert-comptable :

1. **Paramètres → Utilisateurs**
2. **Inviter un utilisateur** : Email de votre comptable
3. **Rôle** : Comptable (accès lecture seule + export)
4. **Envoyer l'invitation**

Votre comptable pourra consulter vos transactions et exporter les données (CSV, PDF).

---

## Récapitulatif du workflow

```
1. Créer un bien
   ↓
2. Ajouter un locataire
   ↓
3. Créer un bail (lier bien + locataire)
   ↓
4. Enregistrer le dépôt de garantie (transaction)
   ↓
5. Chaque mois :
   - Enregistrer le loyer (transaction)
   - Générer la quittance
   - Enregistrer les dépenses (travaux, charges, etc.)
   ↓
6. Consulter le dashboard (KPI, graphiques)
   ↓
7. Export pour comptable (mensuel ou annuel)
```

---

## Ressources et aide

### Documentation
- [Guide des Baux](./guide_baux.md)
- [Guide des Transactions](./guide_transactions.md)
- [Glossaire Fiscal](./glossaire_fiscal.md)

### Support
- **Email** : support@smartimmo.fr
- **Chat** : Bulle en bas à droite (heures ouvrables)
- **FAQ** : [smartimmo.fr/faq](https://smartimmo.fr/faq)

### Vidéos tutoriels
- [Créer son premier bien](https://youtube.com/smartimmo)
- [Générer une quittance](https://youtube.com/smartimmo)
- [Export comptable](https://youtube.com/smartimmo)

---

## Astuces pour bien démarrer

1. **Commencez simple** : Créez un bien, un locataire, un bail. Vous pourrez en ajouter d'autres ensuite.
2. **Importez vos données** : Si vous avez un historique Excel, contactez le support pour import massif.
3. **Enregistrez régulièrement** : Saisir les transactions au fil de l'eau (1x/semaine) plutôt qu'en fin de mois.
4. **Utilisez les filtres** : Gagnez du temps avec les filtres de recherche (par bien, par période, etc.).
5. **Joignez les justificatifs** : Facilitez les contrôles fiscaux et évitez de chercher les documents.

---

**Bienvenue dans Smartimmo ! 🎉**  
Vous êtes prêt à gérer votre patrimoine immobilier efficacement.


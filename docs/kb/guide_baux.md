# Guide des Baux

Ce guide couvre les opérations essentielles liées aux baux dans Smartimmo.

---

## Création d'un bail

Pour créer un nouveau bail dans Smartimmo :

1. **Accéder à la page Baux** : Depuis le menu principal, cliquez sur "Baux"
2. **Créer un nouveau bail** : Cliquez sur "Nouveau bail"
3. **Renseigner les informations obligatoires** :
   - Bien immobilier concerné
   - Locataire(s)
   - Date de début du bail
   - Loyer mensuel (charges comprises ou non)
   - Dépôt de garantie (généralement 1 mois de loyer hors charges)
   - Type de bail (vide, meublé, commercial)
4. **Télécharger le bail signé** : Une fois le contrat signé par les deux parties, uploadez le document PDF

Le bail sera automatiquement activé à sa date de début.

---

## Indexation du loyer (IRL)

L'Indice de Référence des Loyers (IRL) permet d'indexer le loyer annuellement.

### Qu'est-ce que l'IRL ?

L'IRL est un indice publié trimestriellement par l'INSEE. Il sert de référence pour réviser les loyers des logements vides et meublés.

### Comment indexer un loyer dans Smartimmo ?

1. Vérifier la **date anniversaire** du bail (généralement 1 an après la date de début)
2. Récupérer l'IRL du trimestre de référence (disponible sur [INSEE.fr](https://www.insee.fr/fr/statistiques))
3. Calculer le nouveau loyer avec la formule :
   ```
   Nouveau loyer = Loyer actuel × (IRL nouveau / IRL ancien)
   ```
4. Mettre à jour le loyer dans Smartimmo (une alerte vous rappellera la date d'indexation)

**Important** : L'indexation est plafonnée à l'évolution de l'IRL. Vous ne pouvez pas augmenter le loyer arbitrairement.

### Liens utiles
- [IRL sur service-public.fr](https://www.service-public.fr/particuliers/vosdroits/F13723)
- [Calculateur IRL officiel](https://www.anil.org/outils/calcul-loyer/)

---

## Renouvellement de bail

### Bail d'habitation (loi du 6 juillet 1989)

- **Durée minimale** : 3 ans (6 ans pour personne morale)
- **Renouvellement automatique** : Sauf congé donné par l'une des parties
- **Préavis propriétaire** : 6 mois avant la fin du bail (motifs limitatifs)
- **Préavis locataire** : 3 mois (1 mois en zone tendue)

Dans Smartimmo, un bail arrivant à échéance se renouvelle automatiquement sauf si vous indiquez une date de fin.

### Bail meublé

- **Durée minimale** : 1 an (9 mois pour étudiant)
- Mêmes règles de renouvellement que le bail vide

---

## Fin de bail

Lors de la fin d'un bail :

1. **Préavis** : Le locataire ou le propriétaire donne congé selon les délais légaux
2. **État des lieux de sortie** : Comparer avec l'état des lieux d'entrée
3. **Restitution du dépôt de garantie** :
   - Maximum 1 mois si état conforme
   - Maximum 2 mois si dégradations (retenues justifiées)
4. **Quittances finales** : Émettre la dernière quittance de loyer
5. **Clôture dans Smartimmo** : Indiquer la date de fin effective

**Attention** : La restitution du dépôt de garantie doit intervenir dans un délai légal (1 ou 2 mois selon les cas).

---

## Gestion des charges

### Charges récupérables

Les charges récupérables sont les dépenses que le propriétaire peut demander au locataire de rembourser :

- Eau froide et chaude
- Chauffage collectif
- Ascenseur (entretien, électricité)
- Taxe d'enlèvement des ordures ménagères
- Entretien des espaces verts et parties communes

### Régularisation des charges

Une fois par an, vous devez comparer les provisions versées avec les charges réelles et procéder à une régularisation (remboursement ou complément).

Dans Smartimmo, créez une transaction de type "Régularisation charges" avec le montant (positif ou négatif).

---

## Quittances de loyer

### Obligation légale

Le propriétaire doit fournir une quittance de loyer **gratuitement** si le locataire la demande. Elle atteste du paiement intégral du loyer et des charges.

### Émettre une quittance dans Smartimmo

1. Aller dans la fiche du bail
2. Onglet "Quittances"
3. Générer automatiquement la quittance du mois (si le loyer est payé)
4. Télécharger le PDF et l'envoyer au locataire

**Bon à savoir** : Si le loyer n'est que partiellement payé, émettez un **reçu partiel** (et non une quittance).

---

## Impayés et relances

En cas d'impayé de loyer :

1. **Relance amiable** : Contactez le locataire rapidement (email, courrier simple)
2. **Mise en demeure** : Courrier recommandé avec accusé de réception après 2-3 semaines
3. **Clause résolutoire** : Si prévue au bail, vous pouvez résilier le bail après mise en demeure
4. **Procédure judiciaire** : En dernier recours, saisir le tribunal

Smartimmo vous alerte automatiquement en cas de loyer impayé et peut générer des lettres de relance types.

---

## Ressources complémentaires

- [ANIL - Agence Nationale pour l'Information sur le Logement](https://www.anil.org/)
- [Service-Public.fr - Location immobilière](https://www.service-public.fr/particuliers/vosdroits/N20)
- [Loi du 6 juillet 1989 (bail habitation)](https://www.legifrance.gouv.fr/)


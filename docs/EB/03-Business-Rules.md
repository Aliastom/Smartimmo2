# 📋 **Expression de Besoin - Règles Métier**

## 🎯 **Résumé Exécutif**

Ce document détaille les règles métier fondamentales de l'application SmartImmo, organisées par domaine fonctionnel. Ces règles garantissent la cohérence des calculs, le respect de la législation fiscale française et la qualité des données.

---

## 💰 **Règles de Calcul Financier**

### **1. Calcul de la Rentabilité**

#### **Rendement Brut**
```typescript
rendementBrut = (loyersAnnuelsHC / prixAcquisition) * 100

// Avec : loyersAnnuelsHC = Somme des loyers charges comprises sur 12 mois
//        prixAcquisition = Prix d'achat + frais de notaire + travaux initiaux
```

#### **Rendement Net**
```typescript
rendementNet = (cashFlowAnnuel / fondsPropres) * 100

// Avec : cashFlowAnnuel = loyers - charges - crédit - fiscalité
//        fondsPropres = apport personnel initial
```

#### **TRI (Taux de Rendement Interne)** [À VALIDER]
```typescript
// Calcul approximatif sur 10 ans
// Flux : Année 0 = -investissement initial
//        Années 1-10 = cash-flows annuels actualisés
//        Année 10 = +valeur de revente estimée
```

### **2. Gestion des Charges Récupérables**

#### **Principe Général**
- **Charges récupérables** : Peuvent être refacturées au locataire selon quote-part
- **Charges non récupérables** : À la charge exclusive du propriétaire

#### **Répartition par Catégorie**
```typescript
CATEGORIES_RECUPERABLES = [
  'eau froide', 'chauffage collectif', 'ascenseur',
  'entretien espaces communs', 'taxes ordures ménagères',
  'gardiennage', 'assurance immeuble'
]

CATEGORIES_NON_RECUPERABLES = [
  'taxe foncière', 'assurance PNO propriétaire',
  'gros travaux', 'intérêts d emprunt', 'frais de gestion'
]
```

#### **Calcul de Régularisation Annuelle**
```typescript
// 1. Calcul du total provisionné pendant l'année
totalProvisionne = somme des provisions mensuelles * 12

// 2. Calcul du total réel des charges récupérables
totalReel = somme des charges récupérables de l'année

// 3. Régularisation pour le locataire
regularisation = totalReel - totalProvisionne

// 4. Si régularisation > 0 : locataire doit payer le complément
//    Si régularisation < 0 : propriétaire doit rembourser l'excédent
```

---

## ⚖️ **Règles Fiscales Françaises**

### **1. Régime Fiscal des Revenus Fonciers**

#### **Micro-Foncier (pour revenus < 15 000 €/an)**
```typescript
// Abattement forfaitaire de 30% sur les loyers
revenuImposableMicro = loyersAnnuelsHC * 0.70

// Pas de déduction possible des charges réelles
// Seuil 2025 : 15 000 € de loyers maximum
```

#### **Régime Réel**
```typescript
// Déduction de toutes les charges réelles
revenuImposableReel = loyersAnnuelsHC - chargesDeductibles

// Charges déductibles = charges propriétaire + intérêts d'emprunt + travaux
// Si résultat négatif = déficit foncier imputable
```

### **2. Déficit Foncier**

#### **Imputation sur Revenus Fonciers**
```typescript
// Imputation sur l'année en cours (revenus positifs uniquement)
deficitImpute = min(deficitFoncier, revenusFonciersPositifs)

// Maximum imputable par an : 10 700 €
// Excédent reportable sur les 10 années suivantes
```

#### **Report sur Revenus Globaux**
```typescript
// Si déficit > 10 700 € ET revenus fonciers > 0
deficitReportable = deficitFoncier - deficitImpute

// Imputable sur revenus globaux du foyer fiscal
// Maximum : 10 700 €/an pendant 6 ans (déficit travaux)
// Ou 10 ans (déficit intérêts d'emprunt)
```

### **3. Prélèvements Sociaux (17,2%)**

#### **Assiette de Calcul**
```typescript
// Seuls les revenus fonciers positifs sont soumis aux PS
assiettePS = max(revenusFonciersNets, 0)

// Taux 2025 : 17,2% (CSG + CRDS + CASA)
montantPS = assiettePS * 0.172
```

#### **Règle Spéciale Déficit**
- **Si déficit foncier** : Aucun PS à payer (revenus négatifs)
- **Si revenus positifs** : PS calculés sur le bénéfice net

### **4. Décote Fiscale IR**

#### **Barème Décote 2025**
```typescript
// Pour célibataire/veuf/divorcé
SEUIL_CELIBATAIRE = 1964  // €
FORFAIT_CELIBATAIRE = 889  // €

// Calcul de la décote
if (IR_brut <= SEUIL_CELIBATAIRE) {
  decote = FORFAIT_CELIBATAIRE - (IR_brut * 0.4525)
} else {
  decote = 0
}

// IR net = max(IR_brut - decote, 0)

// Pour couple
SEUIL_COUPLE = 3054  // €
FORFAIT_COUPLE = 1486  // €
```

### **5. Parts Fiscales**

#### **Composition du Foyer**
```typescript
// Base : 1 part pour célibataire
// +1 part pour conjoint marié/pacsé
// +0,5 part par enfant à charge (1er et 2ème)
// +1 part par enfant à charge (à partir du 3ème)

// Exemple : Couple + 2 enfants = 3 parts
//           Célibataire + 1 enfant = 1,5 parts
```

#### **Impact sur l'IR**
```typescript
// Quotient familial = revenu imposable / nombre de parts
// IR = barème(quotient familial) * nombre de parts

// Plafonnement quotient familial : 1 759 €/demi-part supplémentaire
```

### **6. PER et Épargne Salariale**

#### **Déduction PER**
```typescript
// Taux de déduction : 30% du versement
// Plafond : 10% des revenus professionnels (max 35 194 € en 2025)

// Économie fiscale = versement_PER * TMI_marginal * 0.30
```

#### **Abondement Entreprise**
```typescript
// Somme versée par l'entreprise (souvent 100-300% du versement salarié)
// Non imposable dans la limite des plafonds légaux
```

---

## 🏠 **Règles de Gestion Locative**

### **1. Indexation des Loyers**

#### **Application de l'IRL**
```typescript
// IRL = Indice de Référence des Loyers (publié trimestriellement par l'INSEE)
// Périodicité : annuelle à la date anniversaire du bail

nouveauLoyer = loyerActuel * (IRL_nouveau / IRL_ancien)

// Maximum : +3,5% en zone tendue (2024-2025)
// Pas d'indexation si clause contraire dans le bail
```

#### **Notification Obligatoire**
- **Délai** : 1 mois avant la date d'échéance
- **Support** : Lettre recommandée ou remise en main propre
- **Contenu** : Ancien loyer, nouvel indice, nouveau loyer calculé

### **2. Dépôt de Garantie**

#### **Montant Maximum**
```typescript
// Location nue : 1 mois de loyer HC
// Location meublée : 2 mois de loyer HC

// Exceptions : étudiants = 1 mois maximum (quel que soit le type)
```

#### **Restitution**
```typescript
// Délai : 1 mois si état des lieux identique
//        2 mois si état des lieux différent

// Intérêts : 0,75% par mois de retard
```

### **3. Charges et Régularisation**

#### **Provision Mensuelle**
```typescript
// Estimée en début d'année selon charges de l'année précédente
provisionMensuelle = (chargesAnnuelles / 12)

// Ajustée lors de la régularisation annuelle
```

#### **Récupération sur Locataire**
```typescript
// Seules les charges récupérables peuvent être refacturées
// Quote-part selon surface ou tantièmes
// Régularisation annuelle obligatoire
```

---

## 🏦 **Règles de Gestion des Prêts**

### **1. Tableau d'Amortissement**

#### **Calcul Mensualité**
```typescript
// Formule classique de calcul de mensualité
mensualite = capital * (tauxMensuel / (1 - (1 + tauxMensuel)^(-duree)))

// Avec : tauxMensuel = tauxAnnuel / 12
//        duree = durée en mois
```

#### **Répartition Capital/Intérêts**
```typescript
// Premier mois : intérêts élevés, capital faible
// Dernier mois : intérêts faibles, capital élevé

interets = capitalRestant * tauxMensuel
capitalRembourse = mensualite - interets
nouveauCapitalRestant = capitalRestant - capitalRembourse
```

### **2. Déductibilité Fiscale**

#### **Intérêts d'Emprunt**
```typescript
// Déductibles à 100% des revenus fonciers
// Même si le prêt finance d'autres biens (règle du prorata)

// Calcul du prorata = (capital emprunté pour ce bien / capital total emprunté)
```

#### **Assurance Emprunteur**
```typescript
// Déductible au prorata de la quote-part du bien
// Pas de déduction sur la quote-part personnelle
```

---

## ⚠️ **Cas Edge et Gestion des Erreurs**

### **1. Vacance Locative**
```typescript
// Période sans locataire = revenus = 0
// Charges propriétaire continuent à courir
// Possibilité de déduction fiscale des charges pendant la vacance

// Calcul du taux d'occupation = (jours loués / 365) * 100
```

### **2. Loyer Partiel**
```typescript
// Si bail en cours d'année : prorata temporis
revenusAnnuels = (loyerMensuel * 12) * (moisOccupes / 12)

// Même règle pour les charges récupérables
```

### **3. Changement de Régime Fiscal**
```typescript
// Passage micro-foncier → régime réel : possible chaque année
// Passage régime réel → micro-foncier : irréversible pendant 3 ans

// Conservation des charges en cours lors du changement
```

### **4. Succession de Locataires**
```typescript
// Résiliation bail N, signature bail N+1
// Période de carence = charges propriétaire uniquement
// Possibilité de travaux entre deux baux
```

### **5. Gestion des Impayés**
```typescript
// Détection automatique des retards > 15 jours
// Envoi de relances automatiques (J+8, J+30, J+60)
// Mise en demeure à J+90
// Signalement au garant/fichier des impayés
```

---

## 📊 **Règles de Calcul des KPIs**

### **1. Cash-Flow Mensuel**
```typescript
cashFlowMensuel = loyersPercus - (chargesProprietaire + mensualiteCredit + fiscalite)

// Cash-flow positif = capacité d'épargne
// Cash-flow négatif = besoin de financement complémentaire
```

### **2. Taux d'Occupation**
```typescript
tauxOccupation = (joursLoués / joursTotal) * 100

// Objectif : > 95% pour un investissement locatif
// < 90% = problème de gestion locative
```

### **3. Rendement Net Net**
```typescript
rendementNetNet = (cashFlowAnnuel / fondsPropres) * 100

// Inclut TOUS les coûts : fiscalité, charges, crédit, vacances
// Réel indicateur de performance économique
```

---

## 🔄 **Règles d'Automatisation**

### **1. Génération d'Échéancier**
```typescript
// Création automatique des lignes de loyer selon bail
// Dates d'échéance selon jour de paiement défini
// Indexation automatique selon périodicité

// Exemple : Bail du 01/01/2025, loyer 1000€, paiement le 5 du mois
// Génère : 05/01/2025, 05/02/2025, ..., 05/12/2025
```

### **2. Alertes Automatiques**
```typescript
ALERTES_SYSTEME = [
  'retard_paiement_8j',      // Relance automatique
  'retard_paiement_30j',     // Mise en demeure
  'echeance_bail_3mois',    // Prévenir renouvellement
  'indexation_loyer_1mois',  // Préparer indexation
  'assurance_1mois',         // Renouvellement assurance
  'taxe_fonciere_15j',       // Préparation paiement
  'revision_charges_1mois'   // Préparation régularisation
]
```

### **3. Détection de Fraude**
```typescript
// Vérification cohérence des données saisies
// Plausibilité des montants (loyer vs surface, charges vs type de bien)
// Détection des anomalies statistiques
```

---

## 📋 **Règles de Validation des Données**

### **1. Contrôles de Saisie**
```typescript
VALIDATIONS_OBLIGATOIRES = [
  'prix_acquisition > 0',
  'surface > 0',
  'loyer_hc > 0',
  'date_acquisition < aujourd_hui',
  'email_locataire format valide',
  'code_postal format français'
]
```

### **2. Contrôles de Cohérence**
```typescript
REGLES_COHERENCE = [
  'loyer_hc > charges_mensuelles',
  'prix_vente > prix_acquisition',  // Si vente déclarée
  'date_fin_bail > date_debut_bail',
  'age_locataire > 18',
  'surface_garage < surface_maison'
]
```

### **3. Contrôles Fiscaux**
```typescript
// Vérification des plafonds légaux
- deficit_foncier_annuel <= 10700  // Imputation annuelle max
- versement_PER <= plafond_10_pourcent_revenus
- charges_deductibles_pertinentes  // Selon année fiscale

// Vérification de la législation applicable
- barème_IR selon année fiscale
- seuils_micro_foncier selon année
- taux_PS selon année
```

---

## 🔒 **Règles de Sécurité et Confidentialité**

### **1. Protection des Données Locataires**
```typescript
DONNEES_SENSIBLES = [
  'coordonnees_bancaires',
  'numero_securite_sociale',
  'piece_identite',
  'situation_familiale',
  'revenus_personnels'
]

// Chiffrement obligatoire avant stockage
// Accès restreint aux seules données nécessaires
// Journalisation de tous les accès
```

### **2. Gestion des Droits d'Accès**
```typescript
ROLES_UTILISATEURS = [
  'admin',           // Accès complet
  'utilisateur',     // Accès à ses propres données
  'consultation',    // Lecture seule des rapports
  'conseiller'       // Accès délégué par l'utilisateur
]

// Chaque action vérifie les permissions
// Audit trail automatique
```

### **3. Conformité RGPD**
```typescript
OBLIGATIONS_RGPD = [
  'consentement_explicite_collecte',
  'finalite_donnees_claire',
  'minimisation_donnees',
  'exactitude_donnees',
  'limitation_conservation',  // 7 ans données fiscales
  'integrite_confidentialite',
  'responsabilite_prestataire'
]

// Registre des traitements tenu à jour
// DPO désigné et contactable
// Procédures de violation de données
```

---

## 📈 **Évolution des Règles**

### **Mise à Jour Annuelle**
- **Barèmes fiscaux** : Mise à jour automatique le 1er janvier
- **Indices** : IRL, taux PS, seuils micro-foncier
- **Plafond** : PER, épargne salariale, déficit foncier

### **Versionnage des Règles**
- **Numéro de version** : Incrémenté à chaque changement législatif
- **Historique** : Conservation des anciennes règles pour simulations rétrospectives
- **Tests de non-régression** : Validation automatique des calculs

### **Gestion des Exceptions**
- **Régimes spéciaux** : Monuments historiques, Malraux, Pinel [À VALIDER]
- **Situations particulières** : Nue-propriété, usufruit, SCI transparente
- **Évolutions législatives** : Adaptation rapide aux changements de loi

---

## ✅ **Tests des Règles Métier**

### **Couverture de Tests**
- **Tests unitaires** : Chaque fonction de calcul individuellement
- **Tests d'intégration** : Workflows complets (bail → fiscalité → rapports)
- **Tests de charge** : Performance avec gros volumes de données
- **Tests de sécurité** : Tentatives d'accès non autorisé

### **Jeux d'Essai**
- **Cas nominaux** : Situations standards de propriétaires
- **Cas limites** : Plafonds fiscaux, seuils micro-foncier
- **Cas d'erreur** : Données invalides, calculs impossibles
- **Cas edge** : Baux courts, changements en cours d'année

### **Validation Légale**
- **Vérification fiscale** : Conformité avec documentation officielle
- **Audit externe** : Validation par expert-comptable partenaire [À VALIDER]
- **Mise à jour** : Process de validation avant déploiement des nouvelles règles


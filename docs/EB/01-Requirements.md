# 📋 **Expression de Besoin - Exigences Fonctionnelles**

## 🎯 **Résumé Exécutif**

Ce document détaille les exigences fonctionnelles complètes de l'application SmartImmo selon la méthodologie INVEST (Independent, Negotiable, Valuable, Estimable, Small, Testable). Les user stories sont accompagnées de critères d'acceptation en format Gherkin.

---

## 📋 **User Stories - Must Have (MoSCoW)**

### **US-GESTION-PROPRIETES-001 : Gestion du portefeuille immobilier**
**En tant que** propriétaire immobilier, **je veux** pouvoir gérer l'ensemble de mes biens immobiliers **afin de** suivre et optimiser mon patrimoine.

**Critères d'acceptation :**
```
Étant donné que je suis connecté à mon compte SmartImmo
Quand j'accède à la section "Mes Biens"
Alors je vois la liste de tous mes biens immobiliers avec leurs informations essentielles
Et je peux ajouter un nouveau bien en remplissant un formulaire détaillé
Et je peux modifier les informations d'un bien existant
Et je peux supprimer un bien avec confirmation
Et je peux filtrer et trier la liste selon différents critères
```

### **US-GESTION-PROPRIETES-002 : Fiche détaillée d'un bien**
**En tant que** propriétaire, **je veux** consulter une fiche complète pour chaque bien **afin de** gérer tous les aspects administratifs et financiers.

**Critères d'acceptation :**
```
Étant donné qu'un bien immobilier existe dans mon portefeuille
Quand je clique sur ce bien dans la liste
Alors j'accède à une vue détaillée avec tous les onglets nécessaires
Et l'onglet "Informations générales" affiche : type, adresse, surface, pièces, date d'acquisition, prix d'achat, frais de notaire
Et l'onglet "Locataire" affiche : informations du locataire actuel, bail en cours
Et l'onglet "Documents" permet de gérer les fichiers associés
Et l'onglet "Performance" affiche les indicateurs financiers
```

### **US-BAUX-001 : Gestion des baux et locataires**
**En tant que** propriétaire, **je veux** gérer les baux et les locataires **afin de** assurer le suivi juridique et administratif des locations.

**Critères d'acceptation :**
```
Étant donné que je possède un bien immobilier
Quand j'associe un locataire à ce bien
Alors je peux créer un nouveau bail avec : type (nu/LMNP/meublé), locataire(s), loyer HC, charges, dépôt de garantie
Et je peux définir les modalités : durée, indexation IRL, clauses particulières
Et je peux renouveler un bail existant
Et je peux résilier un bail avec préavis
Et le système génère automatiquement l'échéancier des loyers
```

### **US-LOYERS-001 : Suivi des loyers**
**En tant que** propriétaire, **je veux** suivre les loyers perçus et prévus **afin de** gérer ma trésorerie et détecter les impayés.

**Critères d'acceptation :**
```
Étant donné que j'ai des baux actifs
Quand j'accède à la section "Loyers"
Alors je vois un calendrier avec les loyers prévus et perçus
Et je peux saisir manuellement un loyer perçu
Et le système détecte automatiquement les retards de paiement
Et je reçois des alertes pour les impayés
Et je peux générer des quittances de loyer PDF
Et je peux exporter l'historique des loyers
```

### **US-CHARGES-001 : Gestion des charges et dépenses**
**En tant que** propriétaire, **je veux** catégoriser et suivre mes charges **afin de** optimiser ma fiscalité et gérer mes dépenses.

**Critères d'acceptation :**
```
Étant donné que je possède des biens immobiliers
Quand j'accède à la section "Charges"
Alors je peux saisir une nouvelle dépense avec : montant, date, catégorie, récupérabilité
Et je peux définir des charges récurrentes (mensuelles/annuelles)
Et le système distingue automatiquement récupérables vs non récupérables
Et je peux répartir les charges entre les locataires selon les baux
Et je peux exporter les charges pour ma déclaration fiscale
```

### **US-PRETS-001 : Gestion des prêts immobiliers**
**En tant que** propriétaire, **je veux** suivre mes emprunts immobiliers **afin de** optimiser ma fiscalité et gérer mon endettement.

**Critères d'acceptation :**
```
Étant donné que j'ai financé un bien par emprunt
Quand j'associe un prêt à un bien immobilier
Alors je saisis : banque, capital emprunté, taux d'intérêt, durée, assurance
Et le système calcule automatiquement le tableau d'amortissement
Et je peux consulter le capital restant dû à tout moment
Et je peux déduire les intérêts d'emprunt pour ma fiscalité
Et je reçois des alertes avant les échéances importantes
```

### **US-FISCALITE-001 : Simulateur fiscal intégré**
**En tant que** propriétaire, **je veux** simuler l'impact fiscal de mes revenus fonciers **afin de** choisir le régime fiscal optimal.

**Critères d'acceptation :**
```
Étant donné que je déclare des revenus fonciers
Quand j'utilise le simulateur fiscal
Alors je saisis mes revenus et charges de l'année
Et le système calcule automatiquement l'IR selon le barème en vigueur
Et je peux comparer micro-foncier vs régime réel
Et le système applique automatiquement la décote fiscale
Et je peux simuler l'impact du déficit foncier
Et le système génère un rapport de synthèse pour mes déclarations
```

### **US-DASHBOARD-001 : Tableau de bord personnalisé**
**En tant que** propriétaire, **je veux** un aperçu global de mon patrimoine **afin de** prendre des décisions éclairées.

**Critères d'acceptation :**
```
Étant donné que j'ai plusieurs biens immobiliers
Quand j'accède au tableau de bord
Alors je vois les KPIs principaux : cash-flow mensuel, rentabilité nette, TRI
Et j'ai un graphique d'évolution du patrimoine
Et je vois les alertes importantes (impayés, échéances, travaux à prévoir)
Et je peux personnaliser les widgets affichés
Et les données se mettent à jour automatiquement
```

---

## 📋 **User Stories - Should Have (MoSCoW)**

### **US-CONNECTEURS-001 : Import de données**
**En tant que** propriétaire expérimenté, **je veux** importer mes données depuis Excel **afin de** gagner du temps lors de la migration.

### **US-SCENARIOS-001 : Simulations avancées**
**En tant que** investisseur, **je veux** simuler des scénarios futurs **afin de** évaluer les opportunités d'investissement.

### **US-ANALYTICS-001 : Analyses prédictives**
**En tant que** propriétaire, **je veux** des prévisions de performance **afin de** anticiper les évolutions du marché.

---

## 📋 **User Stories - Could Have (MoSCoW)**

### **US-API-BANCAIRE-001 : Agrégation bancaire**
**En tant que** utilisateur premium, **je veux** synchroniser automatiquement mes comptes bancaires **afin de** réduire la saisie manuelle.

### **US-MARKETPLACE-001 : Place de marché**
**En tant que** investisseur, **je veux** découvrir des opportunités d'investissement **afin de** diversifier mon patrimoine.

---

## 🔧 **Exigences Non Fonctionnelles (NFR)**

### **Performance**
- **Temps de réponse** : < 500ms pour les calculs fiscaux
- **Chargement pages** : < 2s sur connexion 3G
- **Disponibilité** : 99.9% uptime
- **Scalabilité** : Support 50 000 utilisateurs simultanés

### **Sécurité**
- **Authentification** : OAuth 2.0 + 2FA optionnel
- **Autorisation** : RBAC (Admin/Utilisateur/Consultation)
- **Chiffrement** : AES-256 pour données sensibles
- **Conformité** : RGPD complet + certification bancaire [À VALIDER]

### **Observabilité**
- **Logs** : Centralisés avec niveaux configurables
- **Monitoring** : Métriques clés (latence, erreurs, utilisation)
- **Alertes** : Notification automatique des incidents
- **Tracing** : Suivi des requêtes distribuées

### **UX/Accessibilité**
- **Design** : Mobile-first responsive
- **Accessibilité** : WCAG 2.1 AA compliant
- **Navigation** : Intuitive avec fil d'Ariane
- **Feedback** : Messages d'état clairs

### **Internationalisation**
- **Langue** : Français par défaut
- **Monnaie** : Euro (€)
- **Formats** : Date (JJ/MM/AAAA), nombres (1 234,56)
- **Fiscalité** : Législation française uniquement

---

## 📊 **Jeu de Données de Démo**

### **Biens Immobiliers**
1. **Maison - Villa Familiale**
   - Adresse : 123 rue de la Paix, 75001 Paris
   - Surface : 120 m², 5 pièces
   - Date d'acquisition : 15/03/2020
   - Prix d'achat : 450 000 €
   - Frais de notaire : 35 000 €
   - Type : Maison individuelle
   - Statut : Louée

2. **Appartement - Centre Ville**
   - Adresse : 45 avenue des Champs-Élysées, 75008 Paris
   - Surface : 65 m², 3 pièces
   - Date d'acquisition : 01/09/2022
   - Prix d'achat : 380 000 €
   - Frais de notaire : 28 000 €
   - Type : Appartement
   - Statut : Loué

3. **Garage - Parking Sécurisé**
   - Adresse : 12 rue du Parking, 69001 Lyon
   - Surface : 15 m²
   - Date d'acquisition : 10/06/2021
   - Prix d'achat : 25 000 €
   - Frais de notaire : 3 000 €
   - Type : Garage
   - Statut : Loué

### **Locataires**
1. **Dupont Family**
   - Bail : Location nue, 3 ans
   - Loyer HC : 2 200 €/mois
   - Charges : 150 €/mois (récupérables)
   - Dépôt de garantie : 4 400 €
   - Début bail : 01/01/2023

2. **Martin Pierre**
   - Bail : Location meublée LMNP
   - Loyer HC : 1 800 €/mois
   - Charges : 100 €/mois (récupérables)
   - Dépôt de garantie : 3 600 €
   - Début bail : 15/09/2022

### **Prêt Immobilier**
- **Banque : Crédit Agricole**
- **Capital : 320 000 €**
- **Taux : 1.35%**
- **Durée : 20 ans**
- **Mensualité : 1 450 €**
- **Assurance : 45 €/mois**

### **Loyers et Charges (12 mois)**
**Mois courants** : Tous les loyers perçus à temps
**Charges récurrentes** :
- Taxe foncière : 1 200 €/an
- Assurance PNO : 480 €/an
- Frais de gestion : 2.5% des loyers
- Entretien : Variable selon besoins

---

## ✅ **Critères d'Acceptation Généraux**

### **Fonctionnels**
- [ ] Tous les calculs fiscaux sont exacts selon législation française 2025
- [ ] Les exports PDF sont professionnels et complets
- [ ] Les données sont persistées de manière fiable
- [ ] L'interface est responsive sur tous les devices

### **Sécurité**
- [ ] Authentification sécurisée obligatoire
- [ ] Données chiffrées en transit et au repos
- [ ] Conformité RGPD complète
- [ ] Gestion des rôles et permissions

### **Performance**
- [ ] Temps de réponse < 2s pour toutes les actions
- [ ] Interface fluide sans latence perceptible
- [ ] Gestion efficace des erreurs réseau
- [ ] Optimisation pour les connexions lentes

### **UX**
- [ ] Navigation intuitive et cohérente
- [ ] Messages d'erreur explicites et actionnables
- [ ] Feedback visuel pour toutes les actions
- [ ] Accessibilité WCAG 2.1 AA respectée


# 📋 **Expression de Besoin - UX & UI**

## 🎯 **Résumé Exécutif**

Ce document définit l'expérience utilisateur (UX) et l'interface utilisateur (UI) de l'application SmartImmo. Basé sur les principes du design thinking et les meilleures pratiques UX, il garantit une expérience intuitive, professionnelle et accessible pour tous les profils d'utilisateurs.

---

## 🎨 **Charte Graphique et Design System**

### **1. Palette de Couleurs**

#### **Couleurs Principales**
```css
/* Confiance et Professionnalisme */
--primary-900: #1e3a8a;    /* Bleu profond - confiance, stabilité */
--primary-800: #1e40af;    /* Bleu moyen - actions importantes */
--primary-700: #1d4ed8;    /* Bleu clair - éléments interactifs */
--primary-100: #dbeafe;    /* Bleu très clair - fonds subtils */

/* Succès et Économies */
--success-800: #166534;    /* Vert foncé - économie réalisée */
--success-700: #15803d;    /* Vert moyen - montants positifs */
--success-100: #dcfce7;    /* Vert clair - fonds succès */

/* Attention et Négatifs */
--warning-600: #d97706;    /* Orange - attention, avertissements */
--danger-700: #b91c1c;     /* Rouge foncé - pertes, erreurs */
--danger-600: #dc2626;     /* Rouge moyen - montants négatifs */
--danger-100: #fee2e2;     /* Rouge clair - fonds erreur */

/* Neutres et Structure */
--neutral-900: #111827;    /* Noir - titres principaux */
--neutral-700: #374151;    /* Gris foncé - texte secondaire */
--neutral-600: #4b5563;    /* Gris moyen - labels */
--neutral-500: #6b7280;    /* Gris - texte désactivé */
--neutral-200: #e5e7eb;    /* Gris clair - bordures */
--neutral-100: #f3f4f6;    /* Gris très clair - séparateurs */
--neutral-50: #f9fafb;     /* Blanc cassé - fond principal */
--white: #ffffff;          /* Blanc pur - cartes, surfaces */
```

#### **Couleurs Contextuelles**
```css
/* États des composants */
--hover-primary: #1e40af;  /* Hover sur éléments primaires */
--focus-ring: #3b82f6;     /* Anneau focus accessibility */

/* Surfaces */
--surface-primary: #ffffff;    /* Cartes principales */
--surface-secondary: #f9fafb;  /* Fonds secondaires */
--surface-tertiary: #f3f4f6;   /* Séparateurs */

/* Textes */
--text-primary: #111827;       /* Texte principal */
--text-secondary: #6b7280;     /* Texte secondaire */
--text-disabled: #9ca3af;      /* Texte désactivé */
```

### **2. Typographie**

#### **Hiérarchie Typographique**
```css
/* Titres */
--font-display: 'Inter', system-ui, sans-serif;

h1: {
  size: 'text-3xl',      /* 30px */
  weight: 'font-bold',
  color: 'text-neutral-900',
  lineHeight: 'leading-tight'
}

h2: {
  size: 'text-2xl',      /* 24px */
  weight: 'font-semibold',
  color: 'text-neutral-900',
  lineHeight: 'leading-snug'
}

h3: {
  size: 'text-xl',       /* 20px */
  weight: 'font-semibold',
  color: 'text-neutral-800',
  lineHeight: 'leading-snug'
}

h4: {
  size: 'text-lg',       /* 18px */
  weight: 'font-semibold',
  color: 'text-neutral-800',
  lineHeight: 'leading-normal'
}

/* Corps de texte */
large: {
  size: 'text-base',     /* 16px */
  weight: 'font-normal',
  color: 'text-neutral-700',
  lineHeight: 'leading-relaxed'
}

body: {
  size: 'text-sm',       /* 14px */
  weight: 'font-normal',
  color: 'text-neutral-600',
  lineHeight: 'leading-relaxed'
}

small: {
  size: 'text-xs',       /* 12px */
  weight: 'font-medium',
  color: 'text-neutral-500',
  lineHeight: 'leading-normal'
}

/* Spécialisés */
caption: {
  size: 'text-xs',
  weight: 'font-normal',
  color: 'text-neutral-500'
}

label: {
  size: 'text-sm',
  weight: 'font-medium',
  color: 'text-neutral-700'
}
```

### **3. Espacement et Layout**

#### **Système de Grille**
```css
/* Grille principale */
grid-cols-1: 100%
grid-cols-2: 50% / 50%
grid-cols-3: 33.33% / 33.33% / 33.33%
grid-cols-4: 25% / 25% / 25% / 25%

/* Espacements */
gap-1: 4px    /* Très serré */
gap-2: 8px    /* Serré */
gap-3: 12px   /* Normal */
gap-4: 16px   /* Confortable */
gap-6: 24px   /* Aéré */
gap-8: 32px   /* Très aéré */

/* Padding interne */
p-2: 8px      /* Compact */
p-3: 12px     /* Standard */
p-4: 16px     /* Confortable */
p-6: 24px     /* Spacieux */
p-8: 32px     /* Très spacieux */
```

---

## 🧭 **Architecture de Navigation**

### **1. Structure de Navigation**

```
┌─────────────────────────────────────────────────────────────────┐
│                              HEADER                             │
├─────────────────────────────────────────────────────────────────┤
│  Logo  │  Navigation principale  │  Actions utilisateur  │ Menu │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    BARRE DE RECHERCHE (optionnelle)            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                         CONTENU PRINCIPAL                       │
│                                                                 │
│  ┌─────────────┬─────────────────────────────────────────────┐  │
│  │   SIDEBAR   │               MAIN CONTENT                 │  │
│  │   (Menu)    │                                             │  │
│  │             │  ┌─────────────────────────────────────┐    │  │
│  │  Dashboard  │  │           PAGE HEADER               │    │  │
│  │  Propriétés │  │  (Titre + Actions)                  │    │  │
│  │  Locataires │  ├─────────────────────────────────────┤    │  │
│  │  Loyers     │  │                                     │    │  │
│  │  Fiscalité  │  │           CONTENU PAGE               │    │  │
│  │  Prêts      │  │  (Formulaires, Tableaux, Graphiques)│    │  │
│  │  Documents  │  │                                     │    │  │
│  │  Paramètres │  └─────────────────────────────────────┘    │  │
│  └─────────────┘                                             │  │
└─────────────────────────────────────────────────────────────────┘
```

### **2. Navigation Mobile**
```typescript
// Menu hamburger pour écrans < 768px
MOBILE_NAV = {
  'overlay': true,                    // Menu en superposition
  'slide-in': 'left',                 // Animation depuis la gauche
  'backdrop-blur': true,              // Flou d'arrière-plan
  'swipe-gesture': true               // Fermeture par swipe
}
```

### **3. Breadcrumbs**
```typescript
// Fil d'Ariane contextuel
BREADCRUMB_PATTERN = [
  'Accueil',
  'Mes Biens',
  'Appartement Paris 15ème',
  'Locataire actuel'
]

// Masquage automatique sur mobile
```

---

## 🃏 **Composants UI Réutilisables**

### **1. Cartes (Cards)**

#### **Carte Standard**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Informations générales</CardTitle>
    <CardDescription>Détails du bien immobilier</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      {/* Contenu de la carte */}
    </div>
  </CardContent>
  <CardFooter>
    <Button variant="outline">Modifier</Button>
    <Button>Enregistrer</Button>
  </CardFooter>
</Card>
```

#### **Carte KPI**
```tsx
<KpiCard
  title="Total impôts à payer"
  value="12 450 €"
  change="+2.5%"
  trend="up"
  icon={<EuroIcon />}
  color="blue"
/>
```

### **2. Tableaux de Données**

#### **Table Standard**
```tsx
<DataTable
  columns={[
    { key: 'name', label: 'Nom', sortable: true },
    { key: 'rent', label: 'Loyer', sortable: true, format: 'currency' },
    { key: 'status', label: 'Statut', sortable: true },
    { key: 'actions', label: 'Actions' }
  ]}
  data={properties}
  pagination={true}
  search={true}
  filters={[
    { key: 'status', options: ['rented', 'vacant'] },
    { key: 'type', options: ['apartment', 'house'] }
  ]}
/>
```

### **3. Formulaires**

#### **Field Types**
```tsx
// Champs de base
<TextField label="Nom du bien" placeholder="Villa familiale" />
<NumberField label="Loyer mensuel" prefix="€" />
<SelectField label="Type de bien" options={propertyTypes} />
<DateField label="Date d'acquisition" />
<FileField label="Documents" accept=".pdf,.jpg,.png" multiple />

// Champs avancés
<CurrencyField label="Prix d'achat" />
<AddressField label="Adresse complète" />
<TaxNumberField label="Numéro fiscal" />
```

### **4. Graphiques et Visualisations**

#### **Types de Graphiques**
```tsx
// Évolution temporelle
<LineChart
  data={monthlyRents}
  xAxis="month"
  yAxis="amount"
  color="primary"
/>

// Répartition
<PieChart
  data={expenseCategories}
  label="category"
  value="amount"
/>

// Comparaison
<BarChart
  data={yearlyComparison}
  categories={['2023', '2024', '2025']}
/>

// Métriques
<GaugeChart
  value={occupancyRate}
  max={100}
  thresholds={[80, 95]}
/>
```

---

## 📱 **Responsive Design**

### **1. Breakpoints**
```css
/* Mobile First */
mobile: '320px - 767px'     /* Téléphones */
tablet: '768px - 1023px'    /* Tablettes */
desktop: '1024px - 1439px'  /* Desktop standard */
wide: '1440px+'             /* Grands écrans */

/* Optimisations par device */
MOBILE_OPTIMIZATIONS = {
  'touch-targets': 'min 44px',
  'font-scaling': 'respect user preferences',
  'reduced-animations': 'respect prefers-reduced-motion',
  'viewport-meta': 'width=device-width, initial-scale=1.0'
}
```

### **2. Layout Adaptatif**

#### **Mobile (< 768px)**
```css
/* Navigation hamburger */
/* Cards empilées */
/* Formulaire en pleine largeur */
/* Tableaux horizontaux scrollables */
```

#### **Tablette (768px - 1023px)**
```css
/* Sidebar réduite */
/* Grille 2 colonnes */
/* Navigation visible mais compacte */
```

#### **Desktop (1024px+)**
```css
/* Layout 3 colonnes */
/* Sidebar complète */
/* Navigation complète */
```

---

## ♿ **Accessibilité (WCAG 2.1 AA)**

### **1. Navigation au Clavier**
```typescript
// Focus management
FOCUS_MANAGEMENT = {
  'tab-order': 'logique et cohérent',
  'focus-visible': 'anneau focus coloré',
  'skip-links': 'sauts vers contenu principal',
  'escape': 'fermeture modales/menus'
}

// Raccourcis clavier
KEYBOARD_SHORTCUTS = {
  'Ctrl+K': 'ouvrir recherche',
  'Ctrl+N': 'nouveau élément',
  'Escape': 'fermer modal/annuler',
  'Tab': 'navigation suivante',
  'Shift+Tab': 'navigation précédente'
}
```

### **2. Screen Readers**
```typescript
// Labels et descriptions
ARIA_LABELS = {
  'buttons': 'aria-label explicite',
  'forms': 'aria-describedby pour aide',
  'navigation': 'aria-current pour page active',
  'tables': 'aria-rowcount, aria-colcount',
  'charts': 'aria-describedby avec résumé'
}

// Descriptions longues
LONG_DESCRIPTIONS = {
  'charts': 'résumé textuel des données',
  'calculations': 'explication de la formule',
  'results': 'interprétation du résultat'
}
```

### **3. Contraste et Visibilité**
```css
CONTRAST_REQUIREMENTS = {
  'text-normal': '4.5:1 minimum',
  'text-large': '3:1 minimum',
  'interactive': '3:1 minimum',
  'focus-indicators': 'contraste élevé'
}
```

---

## 🎯 **Parcours Utilisateur Clés**

### **1. Onboarding Nouveau Propriétaire**

#### **Étape 1 : Bienvenue**
```flow
WelcomeModal
├── Titre accrocheur
├── Avantages clés (3-4 points)
├── CTA "Commencer" / "Plus tard"
└── Skip option
```

#### **Étape 2 : Configuration Initiale**
```flow
SetupWizard
├── Informations personnelles
│   ├── Nom, prénom, email
│   ├── Situation familiale
│   └── Régime matrimonial
├── Paramètres fiscaux
│   ├── Tranche marginale d'imposition
│   ├── Nombre de parts fiscales
│   └── Options fiscales particulières
└── Objectifs d'investissement
    ├── Horizon de placement
    ├── Rendement attendu
    └── Tolérance au risque
```

#### **Étape 3 : Premier Bien**
```flow
FirstPropertyFlow
├── Saisie rapide (adresse + type)
├── Import automatique [À VALIDER]
├── Validation des données
└── Tour guidé des fonctionnalités
```

### **2. Gestion Locative Quotidienne**

#### **Encaissement des Loyers**
```flow
RentCollectionFlow
├── Dashboard → Alertes impayés
├── Sélection du locataire
├── Saisie du paiement reçu
├── Génération automatique quittance
└── Mise à jour des indicateurs
```

#### **Régularisation Annuelle**
```flow
AnnualRegularizationFlow
├── Collecte des charges de l'année
├── Calcul automatique des régularisations
├── Répartition par locataire
├── Génération des décomptes
└── Envoi aux locataires
```

### **3. Simulation Fiscale**

#### **Préparation Déclaration**
```flow
TaxDeclarationFlow
├── Sélection année fiscale
├── Collecte automatique des données
├── Vérification des calculs
├── Simulation différents scénarios
├── Choix régime fiscal optimal
└── Export PDF pour déclaration
```

---

## 📊 **États et Feedback Utilisateur**

### **1. États de Chargement**
```typescript
LOADING_STATES = {
  'skeleton': 'composants skeleton pendant chargement',
  'spinner': 'spinner centralisé pour actions longues',
  'progress': 'barre de progression pour processus multi-étapes',
  'pulse': 'animation pulse pour éléments en attente'
}
```

### **2. Messages de Feedback**
```typescript
FEEDBACK_MESSAGES = {
  'success': {
    'icon': 'CheckCircleIcon',
    'color': 'green',
    'duration': '3 secondes'
  },
  'error': {
    'icon': 'XCircleIcon',
    'color': 'red',
    'duration': '5 secondes',
    'action': 'bouton réessayer si applicable'
  },
  'warning': {
    'icon': 'ExclamationTriangleIcon',
    'color': 'orange',
    'duration': '4 secondes'
  },
  'info': {
    'icon': 'InformationCircleIcon',
    'color': 'blue',
    'duration': '3 secondes'
  }
}
```

### **3. États Vide**
```typescript
EMPTY_STATES = {
  'no-properties': {
    'icon': 'HomeIcon',
    'title': 'Aucun bien immobilier',
    'description': 'Ajoutez votre premier bien pour commencer',
    'action': 'Bouton "Ajouter un bien"'
  },
  'no-tenants': {
    'icon': 'UsersIcon',
    'title': 'Aucun locataire',
    'description': 'Créez votre premier bail',
    'action': 'Bouton "Créer un bail"'
  },
  'no-data': {
    'icon': 'ChartBarIcon',
    'title': 'Données insuffisantes',
    'description': 'Ajoutez des données pour voir les analyses',
    'action': 'Lien vers formulaire approprié'
  }
}
```

---

## 🎭 **Animations et Transitions**

### **1. Transitions Fluides**
```css
/* Transitions système */
transition-all duration-200 ease-in-out

/* États hover/focus */
:hover{transform:scale(1.05)}
.hover\:shadow-lg:hover{box-shadow:var(--shadow-lg)}
.focus\:ring-2:focus{outline:2px solid var(--focus-ring)}

/* Animations d'entrée */
.animate-fade-in{opacity:0;animation:fade-in .2s ease-in-out forwards}
.animate-slide-up{transform:translateY(8px);animation:slide-up .2s ease-out forwards}
.animate-slide-down{transform:translateY(-8px);animation:slide-down .2s ease-out forwards}
```

### **2. Micro-Interactions**
```typescript
// Feedback immédiat
onClick: {
  'scale': '0.98 pendant 100ms',
  'shadow': 'réduit temporairement'
}

// Chargement progressif
loading: {
  'skeleton': 'apparition progressive',
  'spinner': 'rotation fluide'
}

// Validation formulaire
validation: {
  'success': 'bordure verte + icône check',
  'error': 'bordure rouge + message d erreur'
}
```

---

## 🔍 **Recherche et Filtres**

### **1. Recherche Globale**
```typescript
// Recherche intelligente
<SearchInput
  placeholder="Rechercher un bien, locataire, document..."
  suggestions={true}
  recentSearches={true}
  filters={availableFilters}
/>
```

### **2. Filtres Avancés**
```typescript
// Filtres contextuels
<FilterPanel>
  <FilterGroup title="Statut">
    <CheckboxFilter options={['Loué', 'Vacant', 'En travaux']} />
  </FilterGroup>

  <FilterGroup title="Type de bien">
    <RadioFilter options={['Appartement', 'Maison', 'Garage']} />
  </FilterGroup>

  <FilterGroup title="Fourchette de loyer">
    <RangeFilter min={500} max={5000} step={100} />
  </FilterGroup>
</FilterPanel>
```

---

## 📋 **Gestion des Erreurs**

### **1. Erreurs de Validation**
```typescript
// Messages d'erreur contextuels
VALIDATION_ERRORS = {
  'required': 'Ce champ est obligatoire',
  'email': 'Format d email invalide',
  'number': 'Doit être un nombre positif',
  'date': 'Date invalide',
  'file-size': 'Fichier trop volumineux (max 10MB)',
  'file-type': 'Type de fichier non supporté'
}
```

### **2. Erreurs Système**
```typescript
// Gestion des erreurs techniques
SYSTEM_ERRORS = {
  'network': {
    'title': 'Erreur de connexion',
    'message': 'Vérifiez votre connexion internet',
    'action': 'Réessayer'
  },
  'server': {
    'title': 'Erreur serveur',
    'message': 'Une erreur inattendue s est produite',
    'action': 'Réessayer / Contacter support'
  },
  'permission': {
    'title': 'Accès refusé',
    'message': 'Vous n avez pas les permissions nécessaires',
    'action': 'Demander accès'
  }
}
```

---

## 🌐 **Internationalisation**

### **1. Structure i18n**
```typescript
// Fichiers de traduction
locales/
├── fr/
│   ├── common.json      // Termes généraux
│   ├── forms.json       // Labels formulaires
│   ├── errors.json      // Messages d'erreur
│   └── fiscal.json      // Termes fiscaux
└── en/                  // Anglais [À VALIDER]
    ├── common.json
    └── ...

// Usage dans composants
const { t } = useTranslation('common');
<h1>{t('dashboard.title')}</h1>
```

### **2. Formats Localisés**
```typescript
// Formats français
LOCALIZATION = {
  'currency': '1 234,56 €',
  'date': '15/03/2025',
  'number': '1 234,56',
  'percentage': '12,5 %',
  'date-input': '2025-03-15'
}
```

Cette charte UX/UI garantit une expérience utilisateur cohérente, professionnelle et accessible, adaptée aux besoins spécifiques des investisseurs immobiliers particuliers français.


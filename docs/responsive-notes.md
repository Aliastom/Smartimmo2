# 📱 Documentation Responsive - Smartimmo

## Vue d'ensemble

Ce document décrit les choix de design responsive appliqués à l'application Smartimmo pour garantir une expérience utilisateur optimale sur tous les appareils : smartphone, tablette et desktop.

---

## 🎯 Breakpoints utilisés

L'application utilise les breakpoints Tailwind CSS standard :

- **Mobile** : `< 640px` (sm) - Smartphones
- **Tablette** : `≥ 640px` (sm) à `< 1024px` (lg) - Tablettes
- **Desktop** : `≥ 1024px` (lg) - Écrans desktop
- **Large Desktop** : `≥ 1280px` (xl) - Grands écrans

### Détails des breakpoints
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

---

## 🏗️ Layout global

### AppShell

**Composant** : `src/components/layout/AppShell.tsx`

**Structure responsive** :
- **Topbar** : Fixe en haut (`fixed top-0`), visible sur toutes les pages sauf auth
  - Hauteur : `h-16` (64px)
  - Bouton hamburger : Visible uniquement sur mobile (`lg:hidden`)
  - Logo : Texte masqué sur très petits écrans (`hidden sm:block`)
  
- **Sidebar** :
  - **Mobile** : Overlay fixe qui s'ouvre via bouton hamburger (`fixed`, masquée par défaut `-translate-x-full`)
  - **Desktop** : Fixe à gauche (`lg:relative lg:translate-x-0`)
  - Largeur : `w-64` (expanded) / `w-16` (collapsed)
  - Position : `lg:top-16` (pour laisser l'espace à la topbar)

- **Contenu principal** :
  - Padding : `p-4 sm:p-6` (responsive)
  - Marges latérales : `lg:pl-64` (sidebar expanded) / `lg:pl-16` (sidebar collapsed)
  - Marge haute : `lg:pt-16` (pour laisser l'espace à la topbar)

**Fermeture automatique sur mobile** : La sidebar se ferme automatiquement après navigation sur mobile (< 1024px).

---

## 📊 Grilles et cartes

### StatCard - Cartes de statistiques

**Composant** : `src/components/ui/StatCard.tsx`

**Grilles responsive** :
```tsx
// 1 colonne sur mobile, 2 sur tablette, 4 sur desktop
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
```

**Exemples d'utilisation** :
- Dashboard : `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- Biens : `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Documents : `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5`
- Locataires : `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`

### Graphiques

**Composant** : Utilisation de `ResponsiveContainer` de Recharts

**Structure** :
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <ResponsiveContainer width="100%" height={300}>
    {/* Chart */}
  </ResponsiveContainer>
</div>
```

**Hauteurs recommandées** :
- Mobile : `250px` - `300px`
- Desktop : `300px` - `400px`

---

## 📋 Tableaux

**Composant** : `src/components/ui/Table.tsx`

**Principe** : Tous les tableaux sont enveloppés dans un conteneur `overflow-x-auto` pour permettre le scroll horizontal sur mobile.

**Structure** :
```tsx
<div className="overflow-x-auto">
  <table className="w-full min-w-full">
    {/* Table content */}
  </table>
</div>
```

**Classes responsives pour les cellules** :
- Padding : `px-6 py-4` (desktop) / `px-4 py-2` (mobile avec compact mode)
- Texte : `text-sm` (responsive par défaut)

---

## 📝 Formulaires

### Layout des champs

**Principe** : Une colonne sur mobile, deux colonnes sur desktop.

**Structure standard** :
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {/* Champs */}
</div>
```

### Composants adaptés

- `EcheanceFormDrawer` : `grid-cols-1 md:grid-cols-2`
- `EcheanceModal` : `grid-cols-1 md:grid-cols-2`
- `LoanDrawer` : `grid-cols-1 md:grid-cols-2`
- `PropertyForm` : `grid-cols-1 md:grid-cols-2`
- `ProfilClient` : `grid-cols-1 md:grid-cols-2`

### Modales

**Largeur** : Utilisation des tailles standard DaisyUI/Tailwind
- Mobile : `max-w-full` (pleine largeur moins marges)
- Desktop : `max-w-xl`, `max-w-2xl`, `max-w-4xl` selon le contenu

---

## 📐 Typographie

### Titres

**SectionTitle** : `src/components/ui/SectionTitle.tsx`

```tsx
// Titre principal
<h1 className="text-2xl sm:text-3xl font-bold">
```

**Pages principales** :
- Dashboard : `text-2xl sm:text-3xl`
- Page d'accueil : `text-4xl sm:text-5xl`
- Login : `text-3xl sm:text-4xl`

### Textes

**Description** :
```tsx
<p className="text-sm sm:text-base text-gray-600">
```

**Labels de formulaire** :
```tsx
<label className="block text-sm font-medium">
```

---

## 🎨 Espacements

### Padding principal

**Contenu** : `p-4 sm:p-6`
- Mobile : `16px` (1rem)
- Desktop : `24px` (1.5rem)

**Cartes** : `p-4 sm:p-6`

### Gap dans les grilles

- Standard : `gap-4` (16px)
- Compact : `gap-3` (12px)
- Large : `gap-6` (24px)

### Marges verticales

- Sections : `space-y-4 sm:space-y-6`
- Entre cartes : `gap-4`

---

## 🧩 Composants spécifiques

### SectionTitle

**Responsive** :
- Layout : `flex-col sm:flex-row`
- Titre : `text-2xl sm:text-3xl`
- Description : `text-sm sm:text-base`
- Actions : `gap-2 sm:gap-3`

### Topbar

**Responsive** :
- Bouton hamburger : `lg:hidden`
- Logo texte : `hidden sm:block`
- Recherche : `hidden md:block`
- Padding : `px-4 lg:px-6`

### Sidebar

**Responsive** :
- Bouton collapse : `lg:block hidden`
- Navigation items : Collapse sur mobile après navigation

---

## ✅ Zones particulièrement adaptées

### 1. Dashboard (`/dashboard`)

**Adaptations** :
- Header : `flex-col sm:flex-row`
- KPIs : `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- Graphiques : `grid-cols-1 lg:grid-cols-2`
- Filtres : Empilés sur mobile, en ligne sur desktop

### 2. Page Biens (`/biens`)

**Adaptations** :
- StatCards : `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Tableau : `overflow-x-auto` pour scroll horizontal
- Filtres : Responsive avec dropdown sur mobile

### 3. Page Transactions (`/transactions`)

**Adaptations** :
- Tableau large : Scroll horizontal sur mobile
- Filtres : Drawer sur mobile, sidebar sur desktop
- Graphiques : `ResponsiveContainer` avec hauteur adaptative

### 4. Page Locataires (`/locataires`)

**Adaptations** :
- StatCards : `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- Tableau : Scroll horizontal
- Formulaire : `grid-cols-1 md:grid-cols-2`

### 5. Page Documents (`/documents`)

**Adaptations** :
- StatCards : `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5`
- Liste : Cards empilées sur mobile, grille sur desktop
- Filtres : Simplifiés sur mobile

### 6. Formulaires et Modales

**Adaptations** :
- Tous les formulaires : `grid-cols-1 md:grid-cols-2`
- Boutons : `w-full sm:w-auto` si nécessaire
- Modales : Largeur adaptative selon le contenu

---

## 🔍 Points d'attention

### Tables larges

**Problème** : Les tableaux avec beaucoup de colonnes débordent sur mobile.

**Solution** : Toujours envelopper dans `<div className="overflow-x-auto">` et utiliser `min-w-full` sur la table pour forcer le scroll horizontal.

### Graphiques

**Problème** : Les graphiques Recharts peuvent avoir une largeur fixe.

**Solution** : Utiliser `ResponsiveContainer` avec `width="100%"` et une hauteur adaptative (`height={300}` sur desktop, `height={250}` sur mobile si nécessaire).

### Boutons dans les formulaires

**Problème** : Les boutons peuvent être trop serrés sur mobile.

**Solution** : Utiliser `flex-col sm:flex-row gap-2 sm:gap-3` pour empiler les boutons sur mobile.

### Navigation mobile

**Problème** : La sidebar prend trop de place sur mobile.

**Solution** : Sidebar en overlay (`fixed`) qui s'ouvre via bouton hamburger et se ferme automatiquement après navigation.

---

## 📝 Checklist responsive

Avant de déployer, vérifier :

- [ ] Tous les tableaux ont `overflow-x-auto`
- [ ] Tous les graphiques utilisent `ResponsiveContainer`
- [ ] Toutes les grilles utilisent `grid-cols-1` comme base
- [ ] Tous les formulaires utilisent `grid-cols-1 md:grid-cols-2`
- [ ] Tous les titres utilisent des tailles responsive (`text-2xl sm:text-3xl`)
- [ ] Le padding principal est `p-4 sm:p-6`
- [ ] La sidebar se ferme automatiquement sur mobile après navigation
- [ ] Les boutons sont accessibles sur mobile (pas trop petits)
- [ ] Les modales sont scrollables sur mobile
- [ ] La topbar est fixe et toujours visible sur desktop

---

## 🎯 Résultat attendu

### Smartphone (360-430px)
- ✅ Sidebar masquée, accessible via bouton hamburger
- ✅ Contenu en une seule colonne lisible
- ✅ Cartes empilées verticalement
- ✅ Tableaux scrollables horizontalement
- ✅ Formulaires en une colonne
- ✅ Graphiques adaptés avec `ResponsiveContainer`

### Tablette (768-1024px)
- ✅ Layout 1 à 2 colonnes selon la page
- ✅ Sidebar visible ou compacte
- ✅ Cartes en 2-3 colonnes
- ✅ Formulaires en 2 colonnes

### Desktop (≥ 1024px)
- ✅ Comportement inchangé ou amélioré
- ✅ Sidebar fixe à gauche
- ✅ Topbar fixe en haut
- ✅ Layout multi-colonnes optimal

---

## 📚 Références

- [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [Recharts ResponsiveContainer](https://recharts.org/en-US/api/ResponsiveContainer)
- [DaisyUI Responsive](https://daisyui.com/)

---

**Dernière mise à jour** : Janvier 2025



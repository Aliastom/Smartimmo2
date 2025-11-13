# Navigation Moderne SmartImmo

## Vue d'ensemble

La navigation moderne de SmartImmo utilise une approche responsive avec navbar sticky et drawer daisyUI pour offrir une expérience utilisateur optimale sur tous les appareils.

## Architecture

### 🏗️ **Composants principaux**

1. **`AppNavbar`** - Navbar sticky avec logo, recherche, notifications, thème switcher
2. **`AppDrawer`** - Drawer daisyUI pour mobile/tablet avec navigation complète
3. **`AppSidebar`** - Sidebar fixe pour desktop (écrans xl+)
4. **`ModernAppShell`** - Layout principal qui orchestre tous les composants

### 📱 **Comportement responsive**

- **Mobile/Tablet (< xl)** : Navbar + Drawer
- **Desktop (xl+)** : Navbar + Sidebar fixe

## Composants détaillés

### **AppNavbar**

```tsx
<AppNavbar
  onMenuClick={handleMenuClick}
  showSearch={true}
  showNotifications={true}
  showUserMenu={true}
/>
```

**Fonctionnalités :**
- Logo avec initiale stylisée
- Barre de recherche (masquée sur mobile)
- Notifications avec badge
- Theme switcher intégré
- Menu utilisateur avec dropdown
- Burger menu pour ouvrir le drawer

**Props :**
- `onMenuClick: () => void` - Callback pour ouvrir le drawer
- `showSearch?: boolean` - Afficher la barre de recherche (défaut: true)
- `showNotifications?: boolean` - Afficher les notifications (défaut: true)
- `showUserMenu?: boolean` - Afficher le menu utilisateur (défaut: true)

### **AppDrawer**

```tsx
<AppDrawer
  isOpen={isDrawerOpen}
  onClose={handleDrawerClose}
/>
```

**Fonctionnalités :**
- Navigation complète avec liens principaux
- Section Administration séparée
- États actifs visuels
- Icônes pour chaque lien
- Effets hover et focus
- Fermeture par clic extérieur
- Animations fluides (slide + fade)

**Props :**
- `isOpen: boolean` - État d'ouverture du drawer
- `onClose: () => void` - Callback pour fermer le drawer

### **AppSidebar**

```tsx
<AppSidebar />
```

**Fonctionnalités :**
- Même navigation que le drawer
- Toujours visible sur desktop
- États actifs persistants
- Section Administration
- Footer avec infos utilisateur
- Responsive (masquée sur < xl)

### **ModernAppShell**

```tsx
<ModernAppShell>
  {children}
</ModernAppShell>
```

**Fonctionnalités :**
- Orchestration de tous les composants
- Gestion de l'état du drawer
- Layout responsive automatique
- Container pour le contenu principal

## Navigation

### **Liens principaux**

- **Accueil** (`/`) - Page d'accueil
- **Biens** (`/properties`) - Gestion des propriétés
- **Documents** (`/documents`) - Gestion des documents
- **Transactions** (`/transactions`) - Gestion financière
- **Locataires** (`/tenants`) - Gestion des locataires
- **Analyses** (`/analytics`) - Tableaux de bord

### **Administration**

- **Types de documents** (`/admin/document-types`) - Configuration des types
- **Mapping Nature ↔ Catégories** (`/admin/accounting-mapping`) - Mapping comptable

### **Liens secondaires**

- **Paramètres** (`/settings`) - Configuration utilisateur
- **Aide** (`/help`) - Documentation et support

## États visuels

### **États actifs**

Les liens actifs sont mis en évidence avec :
- Background `bg-primary`
- Texte `text-primary-content`
- Icône colorée
- Shadow légère

### **Effets hover/focus**

- Scale légère (`scale-[0.98]`)
- Background `bg-base-200`
- Transitions fluides (200ms)

### **Responsive breakpoints**

- **sm** : 640px+ (burger menu visible)
- **md** : 768px+ (recherche visible)
- **xl** : 1280px+ (sidebar fixe)

## Accessibilité

### **ARIA Labels**

- `aria-label` sur tous les boutons d'action
- `role="button"` sur les éléments interactifs
- `aria-hidden="true"` sur les éléments décoratifs

### **Navigation clavier**

- Tab order logique
- Focus visible avec `focus-visible:`
- Escape pour fermer le drawer
- Enter/Space pour activer les liens

### **Screen readers**

- Structure sémantique HTML5
- Textes alternatifs appropriés
- États annoncés (ouvert/fermé)

## Thèmes et styles

### **Classes daisyUI utilisées**

```css
/* Navbar */
.navbar, .navbar-start, .navbar-center, .navbar-end
.btn, .btn-ghost, .btn-circle, .btn-square
.input-group, .input, .input-bordered

/* Drawer */
.drawer, .drawer-side, .drawer-content
.menu, .menu-title, .menu-item
.dropdown, .dropdown-content

/* Sidebar */
.sidebar, .sidebar-content
.card, .card-body, .card-title
.divider, .badge

/* États */
.active, .focus-visible, .hover
.bg-primary, .text-primary-content
.bg-base-100, .text-base-content
```

### **Variables CSS personnalisées**

```css
:root {
  --navbar-height: 4rem;
  --sidebar-width: 16rem;
  --drawer-width: 20rem;
}
```

## Performance

### **Optimisations**

- Composants React optimisés avec `useCallback`
- Animations CSS natives (transform, opacity)
- Lazy loading des icônes Lucide
- Bundle size minimal
- Pas de re-render inutiles

### **Animations**

- Drawer : `transform: translateX()` (300ms ease-in-out)
- Hover : `transform: scale()` (200ms ease)
- Focus : `background-color` transition (150ms ease)

## Utilisation

### **Intégration dans le layout**

```tsx
// src/app/layout.tsx
import { ModernAppShell } from '../ui/layouts/ModernAppShell';

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <ThemeProvider>
          <QueryProvider>
            <ModernAppShell>{children}</ModernAppShell>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### **Ajouter un nouveau lien**

1. **Dans `AppDrawer.tsx` et `AppSidebar.tsx`** :

```tsx
const navigationItems: NavItem[] = [
  // ... liens existants
  {
    href: '/nouvelle-page',
    label: 'Nouvelle Page',
    icon: NouvelleIcon,
  },
];
```

2. **Icône Lucide** :

```tsx
import { NouvelleIcon } from 'lucide-react';
```

### **Personnaliser les props**

```tsx
<AppNavbar
  showSearch={false}           // Masquer la recherche
  showNotifications={false}    // Masquer les notifications
  showUserMenu={false}         // Masquer le menu utilisateur
/>
```

## Tests

### **Pages de test**

- **`/navigation-test`** - Test complet de la navigation
- **`/navigation-demo`** - Démonstration interactive

### **Scénarios de test**

1. **Mobile (< 640px)** :
   - Burger menu visible
   - Drawer s'ouvre au clic
   - Navigation fonctionnelle
   - Fermeture par clic extérieur

2. **Tablet (640px - 1280px)** :
   - Recherche visible
   - Drawer pour navigation
   - Sidebar masquée

3. **Desktop (1280px+)** :
   - Sidebar fixe visible
   - Tous les éléments de navbar
   - Navigation directe

### **Tests d'accessibilité**

- Navigation au clavier complète
- Screen reader compatibility
- Contrastes WCAG 2.1
- Focus management

## Maintenance

### **Mise à jour des liens**

Les liens de navigation sont centralisés dans les constantes `navigationItems` et `adminItems` dans `AppDrawer.tsx` et `AppSidebar.tsx`.

### **Ajout d'icônes**

Utiliser les icônes Lucide React pour la cohérence :

```tsx
import { NouvelleIcon } from 'lucide-react';
```

### **Personnalisation des thèmes**

La navigation s'adapte automatiquement aux thèmes daisyUI grâce aux classes CSS sémantiques (`bg-primary`, `text-base-content`, etc.).

## Dépannage

### **Problèmes courants**

1. **Drawer ne s'ouvre pas** :
   - Vérifier l'état `isDrawerOpen`
   - Vérifier le callback `onMenuClick`

2. **Sidebar masquée sur desktop** :
   - Vérifier la classe `xl:flex`
   - Vérifier la largeur d'écran (1280px+)

3. **États actifs incorrects** :
   - Vérifier la fonction `isActive()`
   - Vérifier le `pathname` de Next.js

4. **Animations saccadées** :
   - Vérifier les classes CSS
   - Vérifier les transitions daisyUI

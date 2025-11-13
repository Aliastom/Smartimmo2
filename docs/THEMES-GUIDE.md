# Guide des thèmes SmartImmo

## Vue d'ensemble

SmartImmo utilise **daisyUI** + **next-themes** pour gérer les thèmes avec un système de thème custom "smartimmo" et des thèmes par défaut.

## Thèmes disponibles

### 1. **smartimmo** (par défaut)
Thème custom conçu pour SmartImmo avec les couleurs de la marque :
- **Primary** : Bleu SmartImmo (#1d4ed8)
- **Secondary** : Gris (#6b7280)  
- **Accent** : Vert succès (#15803d)
- **Error** : Rouge (#dc2626)
- **Warning** : Orange (#d97706)

### 2. **light**
Thème clair par défaut de daisyUI

### 3. **dark** 
Thème sombre par défaut de daisyUI

### 4. **corporate**
Thème corporate professionnel de daisyUI

## Utilisation

### Changer de thème programmatiquement

```typescript
import { useTheme } from 'next-themes';

function MyComponent() {
  const { theme, setTheme } = useTheme();
  
  return (
    <button onClick={() => setTheme('dark')}>
      Mode sombre
    </button>
  );
}
```

### Utiliser les classes daisyUI

```tsx
// Couleurs principales
<div className="bg-primary text-primary-content">Primary</div>
<div className="bg-secondary text-secondary-content">Secondary</div>
<div className="bg-accent text-accent-content">Accent</div>

// Couleurs sémantiques
<div className="bg-success text-success-content">Success</div>
<div className="bg-warning text-warning-content">Warning</div>
<div className="bg-error text-error-content">Error</div>
<div className="bg-info text-info-content">Info</div>

// Arrière-plans
<div className="bg-base-100 text-base-content">Fond principal</div>
<div className="bg-base-200 text-base-content">Fond secondaire</div>
<div className="bg-base-300 text-base-content">Fond tertiaire</div>
```

### Composants daisyUI

```tsx
// Boutons
<button className="btn btn-primary">Primary</button>
<button className="btn btn-secondary">Secondary</button>

// Badges
<span className="badge badge-primary">Primary</span>
<span className="badge badge-success">Success</span>

// Alertes
<div className="alert alert-success">
  <span>Succès !</span>
</div>

// Cartes
<div className="card bg-base-100 shadow-xl">
  <div className="card-body">
    <h2 className="card-title">Titre</h2>
    <p>Contenu</p>
  </div>
</div>
```

## Configuration

### Tailwind config

```typescript
// tailwind.config.ts
export default {
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      "light",
      "dark", 
      "corporate",
      {
        smartimmo: {
          "primary": "#1d4ed8",
          "secondary": "#6b7280",
          "accent": "#15803d",
          "neutral": "#374151",
          "base-100": "#ffffff",
          "base-200": "#f9fafb",
          "base-300": "#f3f4f6",
          "base-content": "#111827",
          "success": "#15803d",
          "warning": "#d97706",
          "error": "#dc2626",
          "info": "#1d4ed8",
        },
      }
    ],
  },
}
```

### ThemeProvider

```tsx
// src/providers/ThemeProvider.tsx
import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({ children, ...props }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="smartimmo"
      enableSystem={false}
      disableTransitionOnChange={false}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
```

## Transitions

Les transitions douces (0.3s) sont automatiquement appliquées pour :
- `background-color`
- `color` 
- `border-color`
- `box-shadow` (pour les éléments interactifs)

## Test

Visitez `/theme-test` pour tester tous les thèmes et voir les composants daisyUI en action.

## Migration depuis Tailwind pur

Remplacer les classes Tailwind par les classes daisyUI équivalentes :

```tsx
// Avant (Tailwind pur)
<div className="bg-blue-600 text-white p-4 rounded-lg">

// Après (daisyUI)
<div className="bg-primary text-primary-content p-4 rounded-lg">
```

## Bonnes pratiques

1. **Utiliser les classes sémantiques** : `bg-primary` au lieu de `bg-blue-600`
2. **Respecter la hiérarchie** : `bg-base-100` pour les fonds principaux
3. **Utiliser les couleurs sémantiques** : `bg-success` pour les succès, `bg-error` pour les erreurs
4. **Tester sur tous les thèmes** : Vérifier que vos composants s'affichent bien sur tous les thèmes

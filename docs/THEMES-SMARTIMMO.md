# Thèmes SmartImmo - Documentation

## Vue d'ensemble

SmartImmo dispose de trois thèmes personnalisés daisyUI, chacun avec sa propre personnalité visuelle et ses caractéristiques techniques.

## Thèmes disponibles

### 1. `smartimmo` - Thème Principal
**Personnalité :** Équilibré et professionnel
**Couleur principale :** Bleu (#1d4ed8)
**Style :** Moderne, équilibré, adapté à tous les contextes

#### Caractéristiques techniques :
- **Rayons :** Modérés (0.5rem boutons, 0.75rem cartes)
- **Animations :** Fluides (0.25s boutons, 0.2s inputs)
- **Ombres :** Neutres avec teinte bleue subtile
- **Focus ring :** Bleu avec opacité 0.1

#### Palette de couleurs :
```css
primary: #1d4ed8      /* Bleu professionnel */
secondary: #6b7280    /* Gris neutre */
accent: #15803d       /* Vert accent */
info: #0ea5e9         /* Bleu ciel */
success: #22c55e      /* Vert moderne */
warning: #f59e0b      /* Orange ambre */
error: #ef4444        /* Rouge moderne */
```

### 2. `smartimmo-warm` - Thème Chaud
**Personnalité :** Accueillant et chaleureux
**Couleur principale :** Rouge (#dc2626)
**Style :** Arrondi, convivial, parfait pour l'accueil client

#### Caractéristiques techniques :
- **Rayons :** Arrondis (0.75rem boutons, 1rem cartes)
- **Animations :** Plus lentes (0.3s boutons, 0.25s inputs)
- **Ombres :** Teintées rouge avec opacité 0.15
- **Focus ring :** Rouge avec opacité 0.15

#### Palette de couleurs :
```css
primary: #dc2626      /* Rouge chaleureux */
secondary: #ea580c    /* Orange secondaire */
accent: #16a34a       /* Vert accent chaud */
info: #0ea5e9         /* Bleu ciel (conservé) */
success: #16a34a      /* Vert chaud */
warning: #ea580c      /* Orange chaud */
error: #dc2626        /* Rouge chaud */
```

### 3. `smartimmo-cool` - Thème Froid
**Personnalité :** Professionnel et géométrique
**Couleur principale :** Bleu profond (#1e40af)
**Style :** Géométrique, corporate, adapté aux interfaces techniques

#### Caractéristiques techniques :
- **Rayons :** Géométriques (0.375rem boutons, 0.5rem cartes)
- **Animations :** Rapides (0.2s boutons, 0.15s inputs)
- **Ombres :** Teintées bleu profond avec opacité 0.12
- **Focus ring :** Bleu profond avec opacité 0.12

#### Palette de couleurs :
```css
primary: #1e40af      /* Bleu profond */
secondary: #475569    /* Gris bleuté */
accent: #059669       /* Vert émeraude */
info: #0284c7         /* Bleu cyan */
success: #059669      /* Vert émeraude */
warning: #0d9488      /* Teal (vert-bleu) */
error: #dc2626        /* Rouge (conservé) */
```

## Accessibilité (WCAG AA)

### Contraste des couleurs
Tous les thèmes respectent les standards WCAG AA :
- **Ratio minimum :** 4.5:1 pour le texte normal
- **Ratio élevé :** 7:1 pour le texte important
- **Validation :** Testé avec les outils de contraste standards

### États interactifs
- **Hover :** Transitions fluides avec feedback visuel
- **Focus :** Ring de focus visible (3px, couleur cohérente)
- **Active :** Échelle réduite (0.95-0.98) pour le feedback tactile
- **Disabled :** Opacité réduite (0.5) avec cursor not-allowed

### Animations
- **Durée :** Adaptée au thème (0.15s-0.3s)
- **Easing :** ease-out pour les animations sortantes
- **Reduced motion :** Respect de `prefers-reduced-motion`

## Variables CSS personnalisées

Chaque thème définit ses propres variables CSS :

```css
--rounded-btn: [0.375rem-0.75rem]     /* Rayons boutons */
--rounded-box: [0.5rem-1rem]          /* Rayons cartes */
--rounded-badge: [0.75rem-1.25rem]    /* Rayons badges */
--animation-btn: [0.2s-0.3s]          /* Durée animation boutons */
--animation-input: [0.15s-0.25s]      /* Durée animation inputs */
--btn-focus-scale: [0.95-0.98]        /* Échelle focus */
--shadow: [couleur thématique]        /* Ombres principales */
--shadow-sm: [couleur thématique]     /* Ombres légères */
--shadow-lg: [couleur thématique]     /* Ombres importantes */
--focus-ring: [couleur thématique]    /* Ring de focus */
```

## Utilisation

### Dans les composants React
```tsx
import { useTheme } from 'next-themes';

function MyComponent() {
  const { theme, setTheme } = useTheme();
  
  return (
    <button 
      onClick={() => setTheme('smartimmo-warm')}
      className="btn btn-primary"
    >
      Activer le thème chaud
    </button>
  );
}
```

### Dans les classes Tailwind
```html
<!-- Les classes daisyUI s'adaptent automatiquement au thème -->
<div className="card bg-base-100 shadow-lg">
  <div className="card-body">
    <h2 className="card-title text-primary">Titre</h2>
    <p className="text-base-content">Contenu</p>
  </div>
</div>
```

## Tests et validation

### Page de test
Une page de test complète est disponible à `/theme-test-smartimmo` pour :
- Visualiser tous les composants
- Tester les contrastes
- Valider les animations
- Comparer les thèmes

### Outils de validation
- **Contraste :** WebAIM Contrast Checker
- **Accessibilité :** axe-core, Lighthouse
- **Couleurs :** Color Oracle (simulation daltonisme)

## Recommandations d'usage

### Thème `smartimmo`
- **Usage :** Interface principale, tableau de bord
- **Contexte :** Tous les utilisateurs, tous les contextes
- **Avantage :** Équilibré et professionnel

### Thème `smartimmo-warm`
- **Usage :** Accueil client, interfaces conviviales
- **Contexte :** Espaces d'accueil, formulaires d'inscription
- **Avantage :** Accueillant et rassurant

### Thème `smartimmo-cool`
- **Usage :** Interfaces techniques, tableaux de données
- **Contexte :** Administration, rapports, analytics
- **Avantage :** Professionnel et précis

## Maintenance

### Ajout de nouvelles couleurs
1. Définir la couleur dans les 3 thèmes
2. Tester les contrastes WCAG AA
3. Mettre à jour la page de test
4. Documenter dans ce fichier

### Modification des variables CSS
1. Modifier dans `tailwind.config.ts`
2. Tester sur tous les composants
3. Valider l'accessibilité
4. Mettre à jour la documentation

## Support navigateur

- **Chrome/Edge :** 88+
- **Firefox :** 85+
- **Safari :** 14+
- **Mobile :** iOS 14+, Android 10+

Les thèmes utilisent des fonctionnalités CSS modernes avec fallbacks appropriés.


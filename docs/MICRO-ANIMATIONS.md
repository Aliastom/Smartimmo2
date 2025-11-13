# Micro-animations SmartImmo

## Vue d'ensemble

Les micro-animations de SmartImmo offrent des interactions fluides et cohérentes pour améliorer l'expérience utilisateur. Elles utilisent des classes utilitaires Tailwind CSS pour des performances optimales.

## Classes utilitaires

### 🎯 **Animations de base**

#### **Hover-float**
```css
.hover-float {
  @apply transition-transform duration-150 ease-out;
}
.hover-float:hover {
  @apply -translate-y-0.5;
}
```
- **Usage** : Cards, éléments interactifs
- **Effet** : Légère élévation au survol (2px vers le haut)
- **Durée** : 150ms

#### **Hover-pop**
```css
.hover-pop {
  @apply transition-transform duration-200 ease-out;
}
.hover-pop:hover {
  @apply scale-105;
}
```
- **Usage** : Boutons, éléments cliquables
- **Effet** : Mise à l'échelle au survol (5% plus grand)
- **Durée** : 200ms

#### **Press**
```css
.press {
  @apply transition-transform duration-100 ease-out;
}
.press:active {
  @apply scale-98;
}
```
- **Usage** : Tous les éléments cliquables
- **Effet** : Compression au clic (2% plus petit)
- **Durée** : 100ms

#### **Hover-glow**
```css
.hover-glow {
  @apply transition-shadow duration-200 ease-out;
}
.hover-glow:hover {
  @apply shadow-lg shadow-primary/25;
}
```
- **Usage** : Cards importantes, boutons spéciaux
- **Effet** : Lueur colorée au survol
- **Durée** : 200ms

#### **Hover-bounce**
```css
.hover-bounce {
  @apply transition-transform duration-200 ease-out;
}
.hover-bounce:hover {
  @apply -translate-y-1;
}
```
- **Usage** : Badges, notifications, éléments ludiques
- **Effet** : Rebond léger au survol (4px vers le haut)
- **Durée** : 200ms

#### **Hover-slide**
```css
.hover-slide {
  @apply transition-transform duration-200 ease-out;
}
.hover-slide:hover {
  @apply translate-x-1;
}
```
- **Usage** : Items de menu, liens de navigation
- **Effet** : Glissement horizontal au survol (4px vers la droite)
- **Durée** : 200ms

#### **Hover-rotate**
```css
.hover-rotate {
  @apply transition-transform duration-200 ease-out;
}
.hover-rotate:hover {
  @apply rotate-3;
}
```
- **Usage** : Icônes, éléments décoratifs
- **Effet** : Rotation légère au survol (3 degrés)
- **Durée** : 200ms

#### **Hover-scale**
```css
.hover-scale {
  @apply transition-transform duration-200 ease-out;
}
.hover-scale:hover {
  @apply scale-110;
}
```
- **Usage** : Liens, éléments interactifs importants
- **Effet** : Mise à l'échelle au survol (10% plus grand)
- **Durée** : 200ms

### ⚡ **Animations continues**

#### **Pulse-gentle**
```css
.pulse-gentle {
  @apply animate-pulse;
  animation-duration: 2s;
  animation-iteration-count: infinite;
}
```
- **Usage** : États de chargement, éléments d'attention
- **Effet** : Pulsation douce continue

#### **Spin-slow**
```css
.spin-slow {
  @apply animate-spin;
  animation-duration: 3s;
}
```
- **Usage** : Indicateurs de chargement, icônes rotatives
- **Effet** : Rotation lente continue

#### **Wiggle**
```css
.wiggle {
  @apply transition-transform duration-200 ease-out;
}
.wiggle:hover {
  @apply animate-pulse;
  animation-duration: 0.5s;
}
```
- **Usage** : Éléments d'attention, notifications
- **Effet** : Oscillation au survol

#### **Fade-in**
```css
.fade-in {
  @apply transition-opacity duration-300 ease-out;
}
.fade-in:hover {
  @apply opacity-90;
}
```
- **Usage** : Éléments subtils, liens secondaires
- **Effet** : Apparition en fondu
- **Durée** : 300ms

## Classes composées

### 🎨 **Composants prêts à l'emploi**

#### **Card-interactive**
```css
.card-interactive {
  @apply hover-float hover-glow press;
}
```
- **Usage** : Cards principales, éléments interactifs
- **Combinaison** : Float + Glow + Press

#### **Btn-primary-animated**
```css
.btn-primary-animated {
  @apply hover-pop press;
}
```
- **Usage** : Boutons primaires, actions importantes
- **Combinaison** : Pop + Press

#### **Menu-item-animated**
```css
.menu-item-animated {
  @apply hover-slide fade-in press;
}
```
- **Usage** : Items de navigation, liens de menu
- **Combinaison** : Slide + Fade + Press

#### **Badge-animated**
```css
.badge-animated {
  @apply hover-bounce;
}
```
- **Usage** : Badges, étiquettes, notifications
- **Effet** : Bounce simple

#### **Icon-animated**
```css
.icon-animated {
  @apply hover-rotate;
}
```
- **Usage** : Icônes, boutons d'icônes
- **Effet** : Rotation simple

#### **Link-animated**
```css
.link-animated {
  @apply hover-scale press;
}
```
- **Usage** : Liens, boutons de lien
- **Combinaison** : Scale + Press

## Spécifications techniques

### ⚙️ **Configuration**

- **Durées** : 100ms (press) à 300ms (fade-in)
- **Easing** : `ease-out` pour des animations naturelles
- **Transform** : `translate`, `scale`, `rotate`
- **Performance** : CSS natif, pas de JavaScript
- **Compatibilité** : Tous les navigateurs modernes

### 📏 **Valeurs de transformation**

```css
/* Translations */
-translate-y-0.5  /* 2px vers le haut */
-translate-y-1    /* 4px vers le haut */
translate-x-1     /* 4px vers la droite */

/* Scales */
scale-105         /* 105% (5% plus grand) */
scale-110         /* 110% (10% plus grand) */
scale-98          /* 98% (2% plus petit) */

/* Rotations */
rotate-3          /* 3 degrés */

/* Shadows */
shadow-lg shadow-primary/25  /* Lueur avec opacité 25% */
```

## Guide d'utilisation

### 🎯 **Bonnes pratiques**

1. **Cohérence** : Utilisez les mêmes animations pour les mêmes types d'éléments
2. **Modération** : Ne surchargez pas l'interface d'animations
3. **Performance** : Privilégiez les transformations CSS (transform, opacity)
4. **Accessibilité** : Respectez `prefers-reduced-motion`

### 📱 **Responsive**

Les animations s'adaptent automatiquement à tous les écrans :
- **Mobile** : Animations légères pour économiser la batterie
- **Desktop** : Animations plus riches pour l'engagement
- **Tablet** : Compromis entre performance et expérience

### ♿ **Accessibilité**

```css
@media (prefers-reduced-motion: reduce) {
  .hover-float,
  .hover-pop,
  .press,
  .hover-glow,
  .hover-bounce,
  .hover-slide,
  .hover-rotate,
  .hover-scale,
  .fade-in,
  .pulse-gentle,
  .spin-slow,
  .wiggle {
    transition: none !important;
    animation: none !important;
  }
}
```

## Exemples d'usage

### **Card interactive**
```tsx
<div className="card bg-base-100 shadow-xl card-interactive">
  <div className="card-body">
    <h2 className="card-title">Titre</h2>
    <p>Contenu de la card</p>
    <div className="card-actions justify-end">
      <button className="btn btn-primary btn-primary-animated">
        Action
      </button>
    </div>
  </div>
</div>
```

### **Menu avec animations**
```tsx
<nav className="space-y-2">
  {items.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      className="menu-item-animated flex items-center gap-3 px-4 py-3 rounded-lg"
    >
      <item.icon className="h-5 w-5" />
      <span>{item.label}</span>
    </Link>
  ))}
</nav>
```

### **Boutons animés**
```tsx
<div className="flex gap-4">
  <button className="btn btn-primary btn-primary-animated">
    Bouton principal
  </button>
  
  <button className="btn btn-secondary hover-bounce press">
    Bouton secondaire
  </button>
  
  <button className="btn btn-accent hover-glow press">
    Bouton spécial
  </button>
</div>
```

### **Badges animés**
```tsx
<div className="flex gap-2">
  <div className="badge badge-primary badge-animated">Nouveau</div>
  <div className="badge badge-secondary badge-animated">Important</div>
  <div className="badge badge-accent badge-animated">Urgent</div>
</div>
```

### **Icônes animées**
```tsx
<div className="flex gap-4">
  <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center icon-animated">
    <HomeIcon className="w-6 h-6" />
  </div>
  
  <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center hover-bounce">
    <BellIcon className="w-6 h-6" />
  </div>
</div>
```

## Tests et démonstration

### **Page de test**
Visitez `/animations-test` pour voir toutes les animations en action :
- Cards avec différentes animations
- Boutons avec effets variés
- Badges et icônes animés
- Animations continues
- Liens interactifs

### **Intégration**
Les animations sont déjà intégrées dans :
- **Navigation** : Items de menu avec `menu-item-animated`
- **Navbar** : Boutons avec `hover-pop` et `press`
- **Cards** : Pages de démonstration avec `card-interactive`

## Maintenance

### **Ajout d'animations**
Pour ajouter de nouvelles animations :

1. **Définir la classe** dans `globals.css`
2. **Utiliser `@apply`** avec les classes Tailwind
3. **Tester** sur différents appareils
4. **Documenter** l'usage et les spécifications

### **Personnalisation**
Pour personnaliser les animations existantes :

```css
/* Personnaliser la durée */
.hover-float {
  @apply transition-transform duration-300 ease-out; /* 300ms au lieu de 150ms */
}

/* Personnaliser l'effet */
.hover-pop:hover {
  @apply scale-110; /* 110% au lieu de 105% */
}
```

### **Performance**
- Utilisez `transform` et `opacity` pour les meilleures performances
- Évitez d'animer `width`, `height`, `margin`, `padding`
- Testez sur des appareils moins puissants
- Respectez `prefers-reduced-motion`

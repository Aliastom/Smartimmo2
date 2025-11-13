# Thématisation Complète SmartImmo

## Vue d'ensemble

Ce guide documente l'implémentation d'une thématisation 100% cohérente utilisant les tokens daisyUI pour garantir qu'un changement de thème affecte absolument tous les éléments de l'interface.

## 🎯 Objectifs

- **Uniformité visuelle** : Tous les composants s'adaptent automatiquement aux changements de thème
- **Maintenabilité** : Utilisation exclusive des tokens daisyUI, interdiction des couleurs codées en dur
- **Accessibilité** : Contraste WCAG AA respecté sur tous les thèmes
- **Performance** : Transitions fluides et cohérentes

## 🛠️ Outils et Scripts

### Scripts disponibles

```bash
# Vérifier les couleurs interdites
npm run lint-theme

# Remplacer les couleurs par lot (dry-run)
npm run replace-colors:dry

# Remplacer les couleurs par lot (applique les changements)
npm run replace-colors
```

### Garde-fous automatiques

Le script `lint-theme` échoue si ces patterns sont trouvés :
- `bg-white`, `bg-black`, `text-white`, `text-black`
- `text-gray-\d+`, `bg-gray-\d+`, `border-gray-\d+`
- Couleurs hexadécimales : `#[0-9A-Fa-f]{3,6}`
- Couleurs RGB/RGBA/HSL : `rgb(`, `rgba(`, `hsl(`, `hsla(`

## 🎨 Tokens daisyUI

### Fichier principal : `src/ui/tokens.ts`

Ce fichier exporte tous les tokens nécessaires pour une thématisation cohérente :

```typescript
import { 
  Surface, 
  Card, 
  BtnPrimary, 
  Field, 
  NavItem,
  combineClasses 
} from '@/ui/tokens';
```

### Catégories de tokens

#### 🏠 **Surfaces**
- `Surface` : Surface de base avec bordure
- `SurfaceMuted` : Surface atténuée
- `SurfaceElevated` : Surface avec ombre

#### 🃏 **Cards**
- `Card` : Carte standard
- `CardInteractive` : Carte interactive avec hover
- `CardHover` : Carte avec animation hover

#### 🔘 **Boutons**
- `BtnPrimary` : Bouton primaire
- `BtnSecondary` : Bouton secondaire
- `BtnGhost` : Bouton fantôme
- `BtnOutline` : Bouton avec bordure

#### 📝 **Formulaires**
- `Field` : Champ de saisie standard
- `FieldError` : Champ en erreur
- `Select` : Liste déroulante
- `Textarea` : Zone de texte

#### 🧭 **Navigation**
- `NavItem` : Item de navigation normal
- `NavItemActive` : Item de navigation actif
- `NavIndicator` : Indicateur vertical d'activité

#### 📊 **Tables**
- `Table` : Tableau avec rayures
- `TableHeader` : En-tête de tableau
- `TableRowHover` : Survol de ligne

#### 🪟 **Modals**
- `Modal` : Container modal
- `ModalBox` : Boîte de modal
- `ModalHeader` : En-tête de modal
- `ModalFooter` : Pied de modal

## 🧩 Composants génériques

### Fichier : `src/ui/components/generic/`

Composants prêts à l'emploi utilisant les tokens :

#### `AppCard`
```tsx
<AppCard variant="interactive" onClick={handleClick}>
  <h3>Titre</h3>
  <p>Contenu</p>
</AppCard>
```

#### `AppModal`
```tsx
<AppModal
  isOpen={isOpen}
  onClose={onClose}
  title="Titre"
  primaryAction={{
    label: "Confirmer",
    onClick: handleConfirm
  }}
>
  Contenu de la modal
</AppModal>
```

#### `AppTable`
```tsx
<AppTable headers={["Nom", "Email", "Actions"]}>
  <AppTableRow>
    <AppTableCell>Jean Dupont</AppTableCell>
    <AppTableCell>jean@example.com</AppTableCell>
    <AppTableCell>
      <AppButton variant="ghost" size="sm">Modifier</AppButton>
    </AppTableCell>
  </AppTableRow>
</AppTable>
```

#### `AppForm`
```tsx
<AppInput
  label="Nom"
  value={name}
  onChange={setName}
  error={errors.name}
  required
/>
```

## 🎭 Thèmes disponibles

### Thèmes personnalisés
- **smartimmo** : Bleu professionnel (`#2563eb`)
- **smartimmo-warm** : Orange chaud (`#d97706`) sur fond crème
- **smartimmo-cool** : Bleu clair (`#60a5fa`) sur fond sombre

### Thèmes standard
- **light** : Thème clair daisyUI
- **dark** : Thème sombre daisyUI  
- **corporate** : Thème corporate daisyUI

## 🏗️ Architecture des composants

### Topbar
```tsx
import { Topbar, AvatarBrand, ActionButton } from '@/ui/tokens';

<nav className={Topbar}>
  <div className={AvatarBrand}>S</div>
  <button className={ActionButton}>Menu</button>
</nav>
```

### Sidebar
```tsx
import { Sidebar, NavItem, NavItemActive, NavIndicator } from '@/ui/tokens';

<aside className={Sidebar}>
  <Link className={combineClasses(NavItem, isActive && NavItemActive)}>
    {isActive && <div className={NavIndicator} />}
    <Icon className="h-5 w-5" />
    <span>Label</span>
  </Link>
</aside>
```

## 🔄 Transitions et animations

### Classes disponibles
- `Hover` : Animation hover avec translation
- `HoverSubtle` : Animation hover subtile
- `Focus` : États de focus cohérents
- `FadeIn`, `SlideIn`, `ScaleIn` : Animations d'entrée

### Accessibilité
- `FocusVisible` : Focus visible au clavier
- `ReducedMotion` : Respect de `prefers-reduced-motion`
- `ScreenReaderOnly` : Contenu pour lecteurs d'écran

## ✅ Checklist d'implémentation

### Pour chaque composant
- [ ] Utiliser les tokens de `src/ui/tokens.ts`
- [ ] Aucune couleur codée en dur
- [ ] États hover/active/focus définis
- [ ] Contraste WCAG AA respecté
- [ ] Transitions fluides

### Pour chaque page
- [ ] Tester avec tous les thèmes disponibles
- [ ] Vérifier la lisibilité en mode sombre/clair
- [ ] Valider la navigation au clavier
- [ ] Tester avec `prefers-reduced-motion`

### Scripts de validation
- [ ] `npm run lint-theme` passe sans erreur
- [ ] `npm run replace-colors:dry` ne trouve pas de couleurs interdites
- [ ] Tous les composants changent visuellement lors du changement de thème

## 🚀 Migration existante

### Étapes recommandées

1. **Audit initial**
   ```bash
   npm run lint-theme
   npm run replace-colors:dry
   ```

2. **Remplacement par lot**
   ```bash
   npm run replace-colors
   ```

3. **Migration composants**
   - Remplacer les composants existants par les versions génériques
   - Utiliser les tokens dans les nouveaux composants

4. **Tests de régression**
   - Tester chaque thème sur toutes les pages
   - Vérifier l'accessibilité

## 📋 Alternatives recommandées

| ❌ Interdit | ✅ Recommandé |
|-------------|---------------|
| `bg-white` | `bg-base-100` |
| `text-black` | `text-base-content` |
| `bg-gray-200` | `bg-base-200` |
| `text-gray-600` | `text-base-content/80` |
| `border-gray-300` | `border-base-300` |
| `bg-blue-500` | `bg-primary` |
| `text-blue-600` | `text-primary` |
| `bg-green-500` | `bg-success` |
| `text-red-500` | `text-error` |

## 🎯 Résultats attendus

### Critères de succès
- **Changement de thème** : TOUS les éléments changent visuellement
- **Aucune couleur interdite** : Script `lint-theme` passe
- **Accessibilité** : Contraste AA sur tous les thèmes
- **Performance** : Transitions fluides < 200ms
- **Maintenabilité** : Code centralisé dans `tokens.ts`

### Tests d'acceptation
1. Changer de thème → interface complètement transformée
2. Mode sombre → tous les textes lisibles
3. Navigation clavier → focus visible partout
4. `prefers-reduced-motion` → animations désactivées
5. Aucune couleur hexadécimale dans le code source

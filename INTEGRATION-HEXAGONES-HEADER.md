# Intégration des Mini Hexagones dans le Header

## 🎯 Objectif Atteint

Les mini hexagones de navigation sont maintenant **intégrés directement dans le header**, centrés entre le titre et les boutons d'action, créant une navigation fluide et élégante.

## 📐 Architecture

### 1. Modification du Composant `SectionTitle`

**Fichier:** `src/components/ui/SectionTitle.tsx`

Ajout d'un nouveau prop `centerContent` qui permet d'afficher du contenu au centre du header :

```typescript
interface SectionTitleProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  centerContent?: React.ReactNode;  // ← NOUVEAU
  className?: string;
}
```

**Structure du layout:**
```
┌──────────────────────────────────────────────────────────┐
│  [Titre/Description]  [🔷 HEXAGONES CENTRÉS 🔷]  [Actions] │
└──────────────────────────────────────────────────────────┘
```
- L'hexagone de la page actuelle est mis en surbrillance (style hover permanent)
- Les 6 hexagones sont toujours visibles pour une navigation complète

### 2. Composant `PropertyMiniHexNav`

**Fichier:** `src/components/bien/PropertyMiniHexNav.tsx`

- Simplifié pour s'afficher sans wrapper superflu
- Pas de fond, pas de bordure, pas de padding
- Juste les hexagones purs avec leurs animations

## 🔧 Intégrations

### Pages avec Mini Hexagones dans le Header

1. **Page Baux** (`/biens/[id]/leases`)
   ```tsx
   <SectionTitle
     title="Baux"
     description={`Baux du bien ${propertyName}`}
     centerContent={<PropertyMiniHexNav propertyId={propertyId} currentPage="baux" />}
     actions={...}
   />
   ```

2. **Page Baux (FR)** (`/biens/[id]/baux`)
   - Même intégration

3. **Page Transactions** (`/biens/[id]/transactions`)
   ```tsx
   <SectionTitle
     title={`Transactions - ${propertyName}`}
     description="Suivi des revenus et dépenses de ce bien"
     centerContent={<PropertyMiniHexNav propertyId={propertyId} currentPage="transactions" />}
     actions={...}
   />
   ```

4. **Page Documents** (`/biens/[id]/documents`)
   ```tsx
   <SectionTitle
     title={`Documents - ${propertyName}`}
     description="Tous les documents liés à ce bien immobilier"
     centerContent={<PropertyMiniHexNav propertyId={propertyId} currentPage="documents" />}
     actions={...}
   />
   ```

### Pages sans Hexagones

Les onglets simples de `PropertyDetailClient` (Photos, Rentabilité, Paramètres) n'ont **pas** de hexagones car :
- Ils utilisent un header simplifié
- Ils sont moins utilisés
- Ils n'ont pas de `SectionTitle` structuré

## 🎨 Rendu Final

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                        │
│  Baux            ⬡ ⬡ ⬡ 🔷 ⬡ ⬡              [← Retour] [+ Nouveau]    │
│  Baux du bien 146A                                                     │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```
                      ↑ Hexagone actif (en bleu)

Les 6 hexagones affichés :
- Flottent au centre du header
- Sans fond ni bordure du composant
- Avec animations au hover
- **L'hexagone de la page actuelle est mis en surbrillance** :
  - Bordures bleues épaisses
  - Icône bleue
  - Scale légèrement augmenté
  - Non cliquable (curseur par défaut)

## ✅ Avantages

1. **Navigation omniprésente** : Toujours visible en haut de page
2. **Design épuré** : Pas de panel supplémentaire, juste les hexagones
3. **Ergonomie** : Accès rapide aux autres sections du bien
4. **Cohérence** : Même expérience sur toutes les pages principales
5. **Flexibilité** : Peut être réutilisé sur d'autres pages avec `SectionTitle`
6. **Repère visuel clair** : L'hexagone actif indique immédiatement où vous êtes
7. **Prévention des erreurs** : L'hexagone actif n'est pas cliquable

## 🚀 Utilisation Future

Pour ajouter les hexagones à une nouvelle page :

```tsx
import { PropertyMiniHexNav } from '@/components/bien/PropertyMiniHexNav';

<SectionTitle
  title="Votre Titre"
  description="Votre description"
  centerContent={
    <PropertyMiniHexNav 
      propertyId={propertyId} 
      currentPage="transactions" // ou 'documents', 'baux', 'photos', 'rentabilite', 'parametres'
    />
  }
  actions={...}
/>
```

## 📝 Notes Techniques

- **Responsive** : Les hexagones s'adaptent automatiquement sur mobile
- **Performance** : Pas de re-render inutile, composant léger
- **Accessibilité** : Les liens restent cliquables et navigables au clavier
- **CSS** : Classes `.hexagon-menu-mini` et `.hexagon-item-mini` dans `globals.css`

## 🔄 Améliorations Futures Possibles

- Ajouter des tooltips au hover
- Ajouter des badges de notification (ex: "3 docs non classés")
- Animer l'apparition des hexagones
- Ajouter des raccourcis clavier (1-6 pour naviguer)


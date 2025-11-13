# Implémentation de la Navigation Hexagonale Mini

## 🎯 Objectif

Créer une version mini des hexagones de navigation qui s'affiche horizontalement en dessous du header dans toutes les pages d'un bien, en masquant l'hexagone de la page courante (6 hexagones au lieu de 7).

## 📁 Fichiers Créés

### 1. Composant Principal
**`src/components/bien/PropertyMiniHexNav.tsx`**
- Composant réutilisable qui affiche 6 mini hexagones en ligne horizontale
- Props :
  - `propertyId`: ID du bien pour construire les liens
  - `currentPage`: Page actuelle pour mettre en surbrillance l'hexagone correspondant
- Valeurs possibles pour `currentPage` : `'transactions' | 'documents' | 'photos' | 'baux' | 'rentabilite' | 'parametres'`
- **Comportement** : Tous les hexagones sont affichés, celui de la page actuelle est mis en surbrillance avec le style hover permanent et n'est pas cliquable

### 2. Styles CSS
**`src/app/globals.css`** (lignes 1269-1463)
- Classes CSS pour les mini hexagones :
  - `.hexagon-menu-mini` : Container flex horizontal
  - `.hexagon-item-mini` : Item hexagonal (50% de la taille originale)
  - `.hex-content-mini` : Contenu (icône + titre)
  - Animations hover identiques à la version complète
  - Responsive mobile avec flex-wrap

## 🔧 Intégrations

### Pages où les mini hexagones ont été intégrés :

1. **Page Baux du Bien**
   - Fichier : `src/app/biens/[id]/baux/PropertyLeasesClient.tsx`
   - Position : Après le `SectionTitle`, avant les graphiques
   - Page masquée : `baux`

2. **Page Documents du Bien**
   - Fichier : `src/app/biens/[id]/documents/PropertyDocumentsClient.tsx`
   - Position : Après le `SectionTitle`, avant les graphiques
   - Page masquée : `documents`

3. **Page Transactions du Bien (onglet)**
   - Fichier : `src/app/biens/[id]/PropertyDetailClient.tsx`
   - Position : En haut du contenu de l'onglet
   - Page masquée : `transactions`

4. **Page Photos du Bien (onglet)**
   - Fichier : `src/app/biens/[id]/PropertyDetailClient.tsx`
   - Page masquée : `photos`

5. **Page Rentabilité du Bien (onglet)**
   - Fichier : `src/app/biens/[id]/PropertyDetailClient.tsx`
   - Page masquée : `rentabilite`

6. **Page Paramètres du Bien (onglet)**
   - Fichier : `src/app/biens/[id]/PropertyDetailClient.tsx`
   - Page masquée : `parametres`

## 🎨 Caractéristiques

### Design
- **Taille** : 50% de la version complète
  - Largeur hexagone : 100px (au lieu de 200px)
  - Hauteur : 86.6px (au lieu de 173.2px)
- **Disposition** : Horizontale uniquement (pas de 2e ligne)
- **Espacement** : Overlap de -15px entre hexagones
- **Position** : Sticky en haut (top-[64px], z-20)

### Navigation
Hexagones disponibles (dans l'ordre) :
1. 🧾 **Transactions** → `/biens/[id]/transactions`
2. 📄 **Documents** → `/biens/[id]?tab=documents`
3. 📷 **Photos** → `/biens/[id]?tab=photos`
4. 📋 **Baux** → `/biens/[id]/baux`
5. 📊 **Rentabilité** → `/biens/[id]?tab=profitability`
6. ⚙️ **Paramètres** → `/biens/[id]?tab=settings`

**Comportement spécial** :
- L'hexagone de la page actuelle est affiché avec le style hover permanent (bordures bleues épaisses, icône bleue, scale augmenté)
- Il n'est pas cliquable (curseur par défaut au lieu de pointer)
- Les autres hexagones sont cliquables et ont l'effet hover au survol

**Note** : L'hexagone "À VENIR" n'est pas inclus dans la version mini.

### Animations
- **Animations hover** identiques à la version complète
  - Scale au hover (1.15x et 1.2x)
  - Bordures qui s'épaississent (2px → 3px) et changent de couleur (gris → bleu)
  - Animation `focus-in-contract` sur le titre au hover
  - Transition fluide sur l'icône (couleur bleue)
- **Hexagone actif** (page courante)
  - Style hover permanent appliqué automatiquement
  - Pas d'animation répétée sur le titre (juste le style final)
  - z-index élevé pour se démarquer
  - Curseur par défaut (non cliquable)

### Responsive
- **Desktop** : Tous les hexagones en ligne
- **Mobile** : Flex-wrap avec espacement de 10px

## 📝 Utilisation

Pour intégrer dans une nouvelle page :

```tsx
import { PropertyMiniHexNav } from '@/components/bien/PropertyMiniHexNav';

// Dans votre composant
<PropertyMiniHexNav 
  propertyId={propertyId} 
  currentPage="transactions" // ou 'documents', 'photos', 'baux', 'rentabilite', 'parametres'
/>
```

## ✅ Avantages

1. **Navigation cohérente** : Même expérience dans toutes les pages du bien
2. **Économie d'espace** : Version compacte qui ne prend pas trop de place
3. **Contexte clair** : L'utilisateur voit toujours où il est et où il peut aller
4. **Réutilisable** : Un seul composant pour toutes les pages
5. **Repère visuel** : L'hexagone actif est mis en surbrillance pour indiquer la page courante
6. **Accessibilité** : L'hexagone actif n'est pas cliquable, évitant les clics inutiles

## 🧪 Tests

Pour tester :
1. Lancer le serveur : `npm run dev`
2. Naviguer vers un bien : `http://localhost:3000/biens/[id]/baux`
3. Vérifier que 6 hexagones s'affichent (sans "Baux")
4. Cliquer sur un hexagone pour naviguer
5. Vérifier que l'hexagone de la nouvelle page est masqué

## 🔄 Prochaines étapes possibles

- Ajouter des compteurs/badges sur certains hexagones (ex: nb documents non classés)
- Ajouter des indicateurs d'état (ex: couleur différente si données manquantes)
- Créer des pages dédiées pour Photos, Rentabilité et Paramètres (actuellement en onglets)


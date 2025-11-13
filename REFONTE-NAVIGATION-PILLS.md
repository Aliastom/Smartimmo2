# Refonte de la Navigation : Pills Professionnelles

## 🎯 Objectif

Remplacer les mini-hexagones par une **barre de sous-navigation sticky** moderne avec onglets arrondis (pills), badges et actions contextuelles, tout en conservant les gros hexagones uniquement sur la page d'aperçu comme raccourcis visuels.

## ✅ Réalisations

### 1. Nouveau Composant `PropertySubNav`

**Fichier** : `src/components/bien/PropertySubNav.tsx`

Composant réutilisable avec :
- **7 onglets pills** : Transactions, Documents, Photos, Baux, Rentabilité, Paramètres, À venir
- **Badges dynamiques** : Affichent les compteurs (transactions, documents, photos, baux)
- **Actions contextuelles** : Boutons à droite (Uploader, Nouvelle transaction, etc.)
- **Sticky positioning** : Reste visible au scroll (top-16, z-30)
- **Scrollable horizontal** sur mobile avec scrollbar masquée
- **Persistance des filtres** : Conserve les query params utiles (q, search, from, to, sort, order, view, status, type)
- **Réinitialisation pagination** : Supprime automatiquement page/cursor
- **Accessibilité** : aria-current="page", navigation clavier, labels explicites

### 2. Intégrations Complètes

Toutes les pages du bien ont été mises à jour :

#### **Pages avec données réelles**
1. ✅ **Transactions** (`/biens/[id]/transactions`)
   - Badge : nombre de transactions
   - Action : Bouton "Nouvelle transaction"

2. ✅ **Documents** (`/biens/[id]/documents`)
   - Badge : nombre de documents
   - Action : Bouton "Uploader"

3. ✅ **Baux** (`/biens/[id]/baux` + `/biens/[id]/leases`)
   - Badge : nombre de baux
   - Action : Bouton "Nouveau bail"

#### **Pages avec structure créée**
4. ✅ **Photos** (`/biens/[id]/photos`)
   - Nouvelle page avec PropertySubNav
   - Action : Bouton "Ajouter des photos"
   - État vide avec message d'invitation

5. ✅ **Rentabilité** (`/biens/[id]/rentabilite`)
   - Nouvelle page avec PropertySubNav
   - Présentation des fonctionnalités à venir
   - Cards descriptives

6. ✅ **Paramètres** (`/biens/[id]/parametres`)
   - Nouvelle page avec PropertySubNav
   - Cards pour Notifications, Accès, Sécurité, Général
   - Structure prête pour implémentation

7. ✅ **À venir** (`/biens/[id]/a-venir`)
   - Page "Coming Soon" stylée
   - Présentation des fonctionnalités futures
   - Design attractif avec animations

#### **Page d'aperçu**
8. ✅ **Aperçu** (`/biens/[id]`)
   - PropertySubNav ajouté en haut
   - **Gros hexagones conservés** comme raccourcis visuels
   - Double navigation : Pills pro + Hexagones visuels

### 3. Suppressions Effectuées

- ❌ **Mini-hexagones supprimés** de toutes les sous-pages
- ❌ Composant `PropertyMiniHexNav` n'est plus utilisé (peut être supprimé)
- ❌ Supprimé de `SectionTitle.centerContent` (plus nécessaire)

### 4. Styles CSS

**Ajouts dans `globals.css`** :
```css
.scrollbar-hide {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;  /* Chrome, Safari, Opera */
}
```

**Classes DaisyUI utilisées** :
- `btn btn-sm rounded-full` : Onglets pills
- `btn-primary` : Onglet actif
- `btn-ghost` : Onglets inactifs
- `badge badge-sm` : Compteurs
- `badge-secondary` : Badge sur onglet actif
- `badge-ghost` : Badge sur onglet inactif

## 📐 Architecture

### Structure de la Sous-Nav

```
┌─────────────────────────────────────────────────────────────┐
│ [Pills avec badges]                    [Actions contextuelles] │
└─────────────────────────────────────────────────────────────┘
```

### Comportement des Onglets

1. **Actif** :
   - Style : `btn-primary` (bleu, blanc)
   - Badge : `badge-secondary`
   - `aria-current="page"`

2. **Inactif** :
   - Style : `btn-ghost` (transparent, gris)
   - Badge : `badge-ghost`
   - Hover : scale(1.05)

3. **Mobile** :
   - Scroll horizontal fluide
   - Scrollbar masquée
   - Tap targets optimisés (flex-shrink-0)

### Persistance des Paramètres

**Paramètres conservés** lors du changement d'onglet :
- `q`, `search` : Recherche
- `from`, `to` : Dates
- `sort`, `order` : Tri
- `view` : Vue
- `status`, `type` : Filtres

**Paramètres réinitialisés** :
- `page`, `cursor` : Pagination
- Autres params spécifiques à la page

## 🎨 Design

### Barre Sticky
- Position : `top-16` (sous le header principal)
- Z-index : `z-30` (au-dessus du contenu)
- Background : `bg-white/95` avec `backdrop-blur-sm`
- Bordure : `border-b border-gray-200`
- Padding : `py-3` (compact)

### Onglets Pills
- Taille : `btn-sm` (compact)
- Forme : `rounded-full` (complètement arrondis)
- Gap : `gap-2` (espacement cohérent)
- Casse : `normal-case` (pas de majuscules forcées)

### Badges
- Taille : `badge-sm` (petits)
- Position : À droite du label
- Couleurs : Secondary (actif) / Ghost (inactif)
- Aria-label : Descriptif pour accessibilité

## 🔧 Utilisation

### Exemple basique
```tsx
<PropertySubNav propertyId={propertyId} />
```

### Avec compteurs
```tsx
<PropertySubNav
  propertyId={propertyId}
  counts={{
    transactions: 42,
    documents: 15,
    photos: 8,
    baux: 3,
  }}
/>
```

### Avec action contextuelle
```tsx
<PropertySubNav
  propertyId={propertyId}
  counts={counts}
  rightAction={
    <Button onClick={handleAction}>
      <Plus className="h-4 w-4 mr-2" />
      Ajouter
    </Button>
  }
/>
```

## 📊 Compteurs par Page

| Page | Badge Source | Clé |
|------|-------------|-----|
| Transactions | `totalCount` | `transactions` |
| Documents | `totalCount` | `documents` |
| Photos | À implémenter | `photos` |
| Baux | `totalCount` | `baux` |
| Rentabilité | - | - |
| Paramètres | - | - |
| À venir | - | - |

## ✨ Avantages

1. **UX Pro** : Navigation claire et intuitive
2. **Mobile-first** : Scroll horizontal fluide
3. **Accessibilité** : ARIA, keyboard nav, focus visible
4. **Performance** : Léger, CSS optimisé
5. **Maintenabilité** : Un seul composant réutilisable
6. **Consistance** : Même expérience sur toutes les pages
7. **Contexte** : Actions pertinentes toujours visibles
8. **Filtres préservés** : Expérience utilisateur fluide

## 🧪 Tests à Effectuer

### Navigation
- [ ] Cliquer sur chaque onglet
- [ ] Vérifier l'onglet actif (style + aria-current)
- [ ] Navigation clavier (Tab + Enter)
- [ ] Scroll horizontal sur mobile

### Badges
- [ ] Badges affichés avec les bons compteurs
- [ ] Badges masqués si compteur = 0 ou undefined
- [ ] Style différent actif/inactif

### Persistance des Filtres
- [ ] Appliquer des filtres sur une page
- [ ] Changer d'onglet
- [ ] Vérifier que les filtres sont conservés
- [ ] Vérifier que la pagination est réinitialisée

### Actions Contextuelles
- [ ] Bouton "Nouvelle transaction" sur Transactions
- [ ] Bouton "Uploader" sur Documents
- [ ] Bouton "Nouveau bail" sur Baux
- [ ] Boutons fonctionnels et bien positionnés

### Responsive
- [ ] Desktop : tous les onglets visibles
- [ ] Tablet : scroll si nécessaire
- [ ] Mobile : scroll fluide, scrollbar masquée
- [ ] Tap targets suffisamment grands

### Accessibilité
- [ ] Screen reader : labels corrects
- [ ] Keyboard : navigation complète
- [ ] Focus : bien visible
- [ ] ARIA : aria-current, aria-label

## 🚀 Améliorations Futures

1. **Animations** : Transitions plus fluides entre onglets
2. **Indicateur actif** : Barre sous l'onglet actif qui glisse
3. **Raccourcis clavier** : Ctrl+1-7 pour accès rapide
4. **Notifications** : Badges rouges pour alertes
5. **Tooltips** : Au hover sur les icônes
6. **Drag & drop** : Réorganiser l'ordre des onglets
7. **Favoris** : Masquer/afficher certains onglets

## 📝 Notes Techniques

- Les gros hexagones restent sur la page d'aperçu car ils sont **visuellement attrayants** et **contextuellement pertinents** (vue d'ensemble)
- La sous-nav est **cohérente** sur toutes les pages pour une navigation fluide
- Les actions sont **contextuelles** : chaque page a ses boutons pertinents
- Le système de **persistance** évite de perdre les filtres lors de la navigation
- Les **badges** donnent un aperçu rapide des données sans quitter la page

## ⚠️ Fichiers Obsolètes

Peuvent être supprimés (si confirmé) :
- `src/components/bien/PropertyMiniHexNav.tsx`
- CSS des mini-hexagones dans `globals.css` (classes `.hexagon-item-mini`, etc.)

Ont été modifiés pour retirer `centerContent` :
- `src/components/ui/SectionTitle.tsx` (prop `centerContent` conservée pour rétro-compatibilité mais non utilisée)


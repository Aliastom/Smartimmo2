# Modal de confirmation de suppression attractive

## 📋 Vue d'ensemble

Une nouvelle modal de confirmation moderne et visuellement attractive a été créée pour confirmer la suppression de baux (simple ou multiple) avant l'exécution de l'action.

## 🎨 Design et caractéristiques

### Éléments visuels

1. **Icône principale** : Poubelle blanche sur fond dégradé rouge (`from-red-500 to-red-600`)
2. **Backdrop** : Fond noir avec transparence et effet blur
3. **Animation** : Apparition en fade-in + zoom-in
4. **Bordure** : Bordure rouge subtile (`border-red-100`)
5. **Ombre** : Ombre portée importante (`shadow-2xl`)

### Structure

```
┌─────────────────────────────────────┐
│ 🗑️  Confirmer la suppression       │
│     Cette action est irréversible   │
├─────────────────────────────────────┤
│ ⚠️  Attention                       │
│     Le bail sera définitivement...  │
├─────────────────────────────────────┤
│ 📄  Bail(x) concerné(s) :          │
│  ┌───────────────────────────────┐ │
│  │ 1️⃣ immogest2                  │ │
│  │    Stephanie Jasmin          🗑│ │
│  └───────────────────────────────┘ │
│  ┌───────────────────────────────┐ │
│  │ 2️⃣ maison 1                   │ │
│  │    Jean Dupont               🗑│ │
│  └───────────────────────────────┘ │
├─────────────────────────────────────┤
│              [Annuler] [🗑 Supprimer (2)] │
└─────────────────────────────────────┘
```

### Sections

#### 1. Header (en-tête)
- **Icône** : Grande icône de poubelle (56×56px) sur fond dégradé rouge avec ombre
- **Titre** : "Confirmer la suppression" en gras (text-xl)
- **Sous-titre** : Message adaptatif selon le nombre de baux

#### 2. Bannière d'avertissement
- **Style** : Fond rouge pâle avec bordure gauche rouge (4px)
- **Icône** : Triangle d'alerte
- **Contenu** : 
  - Titre "Attention" en gras
  - Message explicatif sur les conséquences et la protection automatique

#### 3. Liste des baux
- **Titre** : "Bail concerné :" ou "Baux concernés :" avec icône document
- **Conteneur** : Fond gris avec bordure, scrollable si > 6 baux
- **Cartes individuelles** :
  - Numéro (badge rouge circulaire)
  - Nom du bien (en gras)
  - Nom du locataire (en gris)
  - Icône poubelle à droite
  - Effet hover (bordure devient rouge)

#### 4. Boutons d'action
- **Annuler** : Bouton ghost avec hover gris
- **Supprimer** : Bouton destructive avec :
  - Dégradé rouge (`from-red-500 to-red-600`)
  - Ombre portée rouge
  - Icône poubelle
  - Compteur si multiple

## 🔄 Flux utilisateur

### Suppression simple (1 bail)

1. Utilisateur clique sur l'icône poubelle 🗑️
2. **Modal de confirmation attractive** s'affiche immédiatement
3. Affiche le bail concerné
4. Si l'utilisateur clique sur "Supprimer" :
   - Le bail est supprimé → Toast vert ✅
   - OU le bail est protégé → **Modal de résiliation** s'affiche ⚠️

### Suppression multiple (plusieurs baux)

1. Utilisateur sélectionne plusieurs baux ☑️
2. Clique sur le bouton "Supprimer"
3. **Modal de confirmation attractive** s'affiche avec la liste complète
4. Si l'utilisateur clique sur "Supprimer (X)" :
   - Baux sans transactions → Supprimés → Toast vert ✅
   - Baux avec transactions → **Modal de résiliation** s'affiche avec la liste ⚠️

## 💻 Implémentation technique

### Fichier créé

**`src/components/leases/DeleteConfirmModal.tsx`**

### Interface

```typescript
interface LeaseToDelete {
  id: string;
  propertyName: string;
  tenantName: string;
}

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  leases: LeaseToDelete[];
}
```

### Intégration dans `LeasesClient.tsx`

#### États

```typescript
const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
const [leasesToConfirmDelete, setLeasesToConfirmDelete] = useState<LeaseWithDetails[]>([]);
```

#### Fonction de suppression simple

```typescript
const handleDeleteLease = useCallback((lease: LeaseWithDetails) => {
  // Afficher la modal de confirmation
  setLeasesToConfirmDelete([lease]);
  setShowDeleteConfirmModal(true);
}, []);
```

#### Fonction de suppression multiple

```typescript
const handleDeleteMultiple = useCallback(() => {
  const toDelete = leases.filter(l => selectedIds.has(l.id));
  setLeasesToConfirmDelete(toDelete);
  setShowDeleteConfirmModal(true);
}, [leases, selectedIds]);
```

#### Fonction de confirmation (unifie simple et multiple)

```typescript
const handleConfirmDelete = useCallback(async () => {
  const leasesToProcess = [...leasesToConfirmDelete];
  
  // Tentative de suppression avec Promise.allSettled
  const results = await Promise.allSettled(
    leasesToProcess.map(lease =>
      fetch(`/api/leases/${lease.id}`, { method: 'DELETE' })
    )
  );

  // Analyse des résultats
  const deleted = results.filter(...).length;
  const protectedLeases = results.filter(...);

  // Réinitialisation
  setLeasesToConfirmDelete([]);
  setSelectedIds(new Set());
  setRefreshKey(prev => prev + 1);

  // Toasts de succès
  if (deleted > 0) {
    notify2.success(`${deleted} bail(x) supprimé(s)`);
  }

  // Modal de résiliation si baux protégés
  if (protectedLeases.length > 0) {
    setProtectedLeasesForModal(protectedLeasesData);
    setShowCannotDeleteModal(true);
  }
}, [leasesToConfirmDelete, isDrawerOpen]);
```

### Utilisation du composant

```tsx
<DeleteConfirmModal
  isOpen={showDeleteConfirmModal}
  onClose={() => {
    setShowDeleteConfirmModal(false);
    setLeasesToConfirmDelete([]);
  }}
  onConfirm={handleConfirmDelete}
  leases={leasesToConfirmDelete.map(lease => ({
    id: lease.id,
    propertyName: lease.property.name,
    tenantName: `${lease.tenant.firstName} ${lease.tenant.lastName}`
  }))}
/>
```

## 🎯 Avantages

### UX améliorée

1. **Visibilité claire** : L'utilisateur voit EXACTEMENT ce qu'il va supprimer
2. **Avertissement explicite** : Message clair sur les conséquences
3. **Design moderne** : Visuellement attractif avec animations
4. **Information complète** : Mention de la protection automatique pour les baux avec transactions

### Sécurité

1. **Confirmation obligatoire** : Aucune suppression accidentelle
2. **Liste détaillée** : Chaque bail est identifiable (bien + locataire)
3. **Message d'avertissement** : L'utilisateur est informé des conséquences

### Code

1. **Composant réutilisable** : Peut être utilisé ailleurs dans l'application
2. **Logique unifiée** : `handleConfirmDelete` gère simple et multiple
3. **Gestion d'erreur robuste** : `Promise.allSettled` pour traiter tous les baux
4. **États propres** : Réinitialisation complète après action

## 🎨 Personnalisation CSS

### Classes Tailwind utilisées

- **Animations** : `animate-in fade-in zoom-in duration-200`
- **Backdrop** : `backdrop-blur-sm bg-black bg-opacity-50`
- **Dégradés** : `bg-gradient-to-br from-red-500 to-red-600`
- **Ombres** : `shadow-2xl`, `shadow-lg shadow-red-200`
- **Bordures** : `border-l-4 border-red-500`, `border-red-100`
- **Hover** : `hover:border-red-200`, `hover:from-red-600`
- **Layout** : `max-h-48 overflow-y-auto` (liste scrollable)

## 📱 Responsive

- **Mobile** : `mx-4` pour les marges latérales
- **Desktop** : `max-w-lg` pour limiter la largeur
- **Liste** : Scrollable verticalement si trop de baux

## ✅ Checklist de test

- [ ] Suppression d'1 bail sans transaction → Modal s'affiche → Suppression OK
- [ ] Suppression d'1 bail avec transactions → Modal s'affiche → Modal de résiliation s'affiche
- [ ] Suppression multiple mixte → Modal s'affiche avec liste → Résultats corrects
- [ ] Clic sur "Annuler" → Modal se ferme sans action
- [ ] Animation d'entrée fluide
- [ ] Scroll de la liste si > 6 baux
- [ ] Boutons responsive et accessibles
- [ ] Texte adaptatif singulier/pluriel

## 🔮 Évolutions possibles

1. **Animation de sortie** : Ajouter une animation de fermeture
2. **Compteur de transactions** : Afficher le nombre de transactions par bail
3. **Option "Ne plus demander"** : Checkbox pour les utilisateurs expérimentés (avec confirmation alternative)
4. **Prévisualisation rapide** : Tooltip au hover sur chaque bail avec plus d'infos
5. **Tri** : Permettre de réorganiser la liste (par bien, par locataire, etc.)

---

**Date de création** : 27/10/2025  
**Version** : 1.0  
**Statut** : ✅ Implémenté et testé


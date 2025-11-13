# Système de modales AppModal

## Vue d'ensemble

AppModal est un composant de modal réutilisable basé sur daisyUI et framer-motion, conçu pour remplacer toutes les modales custom de SmartImmo.

## Fonctionnalités

### 🎨 **daisyUI Integration**
- Classes daisyUI natives (`modal`, `modal-box`, `btn`)
- Support automatique des thèmes
- Boutons avec variants (primary, secondary, ghost, outline)
- Tailles adaptatives (sm à 7xl)

### ✨ **Transitions framer-motion**
- Fade in/out du backdrop
- Scale + slide de la modal
- Transitions fluides (0.2s)
- AnimatePresence pour les transitions de sortie

### ♿ **Accessibilité**
- Fermeture par Escape
- Fermeture par clic extérieur
- Focus management automatique
- ARIA labels appropriés
- Prévention du scroll du body

### 📱 **Responsive**
- Tailles adaptatives selon le contenu
- Scroll automatique pour les contenus longs
- Mobile-friendly

## Utilisation de base

```tsx
import { AppModal } from '@/ui/shared/AppModal';

function MyComponent() {
  const [open, setOpen] = useState(false);

  return (
    <AppModal
      open={open}
      onClose={() => setOpen(false)}
      title="Ma modal"
      size="md"
      primaryAction={{
        label: 'Enregistrer',
        onClick: handleSave,
      }}
      secondaryAction={{
        label: 'Annuler',
        onClick: () => setOpen(false),
        variant: 'outline',
      }}
    >
      <p>Contenu de la modal</p>
    </AppModal>
  );
}
```

## Props principales

### **AppModalProps**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | - | État d'ouverture de la modal |
| `onClose` | `() => void` | - | Fonction de fermeture |
| `title` | `string?` | - | Titre de la modal |
| `children` | `React.ReactNode` | - | Contenu de la modal |
| `primaryAction` | `ModalAction?` | - | Action principale (bouton de droite) |
| `secondaryAction` | `ModalAction?` | - | Action secondaire (bouton de gauche) |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl' \| '2xl' \| '3xl' \| '4xl' \| '5xl' \| '6xl' \| '7xl'` | `'md'` | Taille de la modal |
| `closeOnEscape` | `boolean` | `true` | Fermeture par Escape |
| `closeOnClickOutside` | `boolean` | `true` | Fermeture par clic extérieur |
| `showCloseButton` | `boolean` | `true` | Afficher le bouton X |
| `className` | `string` | `''` | Classes CSS supplémentaires |

### **ModalAction**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | - | Texte du bouton |
| `onClick` | `() => void` | - | Action au clic |
| `variant` | `'primary' \| 'secondary' \| 'ghost' \| 'outline'` | `'primary'` | Style du bouton |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Taille du bouton |
| `disabled` | `boolean` | `false` | Bouton désactivé |
| `loading` | `boolean` | `false` | État de chargement |

## Helpers et utilitaires

### **createModalActions**

Helper pour créer rapidement des actions courantes :

```tsx
import { createModalActions } from '@/ui/shared/AppModal';

const actions = {
  save: createModalActions.save(handleSave, loading, disabled),
  cancel: createModalActions.cancel(handleCancel),
  delete: createModalActions.delete(handleDelete, loading),
  close: createModalActions.close(handleClose),
  confirm: createModalActions.confirm(handleConfirm, loading),
};
```

### **Hooks utilitaires**

```tsx
import { useModal, useModals } from '@/ui/shared/ModalHelpers';

// Modal simple
const modal = useModal();

// Plusieurs modales
const { openModal, closeModal, isOpen } = useModals();
```

### **Composants spécialisés**

```tsx
import { ConfirmationModal, InfoModal } from '@/ui/shared/ModalHelpers';

// Modal de confirmation
<ConfirmationModal
  open={open}
  onClose={onClose}
  onConfirm={onConfirm}
  title="Confirmer"
  message="Êtes-vous sûr ?"
  variant="danger"
/>

// Modal d'information
<InfoModal
  open={open}
  onClose={onClose}
  title="Information"
  message="Message d'information"
/>
```

## Composants de structure

### **ModalHeader, ModalBody, ModalFooter**

Pour une meilleure organisation du contenu :

```tsx
import { AppModal, ModalHeader, ModalBody, ModalFooter } from '@/ui/shared/AppModal';

<AppModal open={open} onClose={onClose}>
  <ModalHeader>
    <h2>Mon titre personnalisé</h2>
    <button onClick={onClose}>×</button>
  </ModalHeader>
  
  <ModalBody>
    <p>Contenu principal</p>
  </ModalBody>
  
  <ModalFooter>
    <button>Action personnalisée</button>
  </ModalFooter>
</AppModal>
```

## Migration depuis les modales custom

### **Avant (modal custom)**

```tsx
return (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 w-full max-w-md">
      <div className="flex items-center justify-between mb-4">
        <h2>Titre</h2>
        <button onClick={onClose}>×</button>
      </div>
      
      <form onSubmit={handleSubmit}>
        {/* Contenu */}
        
        <div className="flex justify-end gap-2 pt-4">
          <button type="button" onClick={onClose}>Annuler</button>
          <button type="submit">Enregistrer</button>
        </div>
      </form>
    </div>
  </div>
);
```

### **Après (AppModal)**

```tsx
return (
  <AppModal
    open={isOpen}
    onClose={onClose}
    title="Titre"
    size="md"
    primaryAction={{
      label: 'Enregistrer',
      onClick: () => form.requestSubmit(),
    }}
    secondaryAction={{
      label: 'Annuler',
      onClick: onClose,
      variant: 'outline',
    }}
  >
    <form onSubmit={handleSubmit}>
      {/* Contenu */}
    </form>
  </AppModal>
);
```

## Exemples d'utilisation

### **Modal de formulaire**

```tsx
<AppModal
  open={open}
  onClose={onClose}
  title="Créer un utilisateur"
  size="lg"
  primaryAction={{
    label: 'Créer',
    onClick: handleCreate,
    disabled: !isValid,
  }}
  secondaryAction={{
    label: 'Annuler',
    onClick: onClose,
    variant: 'outline',
  }}
>
  <UserForm onSubmit={handleCreate} />
</AppModal>
```

### **Modal de confirmation**

```tsx
<AppModal
  open={open}
  onClose={onClose}
  title="Supprimer l'élément"
  size="sm"
  primaryAction={{
    label: 'Supprimer',
    onClick: handleDelete,
    variant: 'primary',
  }}
  secondaryAction={{
    label: 'Annuler',
    onClick: onClose,
    variant: 'outline',
  }}
>
  <p>Êtes-vous sûr de vouloir supprimer cet élément ?</p>
</AppModal>
```

### **Modal avec chargement**

```tsx
<AppModal
  open={open}
  onClose={onClose}
  title="Traitement en cours"
  primaryAction={{
    label: 'Enregistrer',
    onClick: handleSave,
    loading: isLoading,
    disabled: isLoading,
  }}
>
  <p>Veuillez patienter pendant le traitement...</p>
</AppModal>
```

## Bonnes pratiques

### **1. Gestion d'état**
- Utiliser `useModal()` pour une modal simple
- Utiliser `useModals()` pour plusieurs modales
- Éviter les états globaux pour les modales

### **2. Accessibilité**
- Toujours fournir un titre significatif
- Utiliser des labels appropriés pour les actions
- Tester la navigation au clavier

### **3. Performance**
- Éviter de rendre le contenu si la modal n'est pas ouverte
- Utiliser `React.memo` pour les composants lourds dans les modales

### **4. UX**
- Choisir la bonne taille selon le contenu
- Utiliser des actions claires et cohérentes
- Fournir un feedback visuel (loading states)

## Tests

Visitez `/modal-simple-test` pour voir toutes les fonctionnalités en action :
- Modales de différentes tailles
- Actions avec états de chargement
- Transitions fluides
- Accessibilité (Escape, clic extérieur)

Visitez `/modal-helpers-simple` pour voir les helpers et utilitaires :
- `createModalActions`
- `useModal` et `useModals`
- `ConfirmationModal` et `InfoModal`

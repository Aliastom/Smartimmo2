# 🎯 Guide de Migration : Alertes Natives → Modales Homogènes

## ✅ Implémentation terminée

Un système complet de modales homogènes a été créé pour remplacer les `alert()` et `confirm()` natifs du navigateur.

---

## 📁 Fichiers créés

### Composants UI
- **`src/components/ui/AlertModal.tsx`** : Modal pour les alertes (info, success, warning, error)
- **`src/components/ui/ConfirmModal.tsx`** : Modal pour les confirmations (danger, warning, primary)

### Hook & Contexte
- **`src/hooks/useAlert.tsx`** : Hook `useAlert()` avec `AlertProvider`
  - `showAlert(options)` → Promise<void>
  - `showConfirm(options)` → Promise<boolean>

### Intégration
- **`src/app/layout.tsx`** : `AlertProvider` ajouté au layout global

---

## 🎨 Utilisation

### 1. Remplacer `alert()` simple

**Avant :**
```typescript
alert('Message d'erreur');
```

**Après :**
```typescript
import { useAlert } from '@/hooks/useAlert';

const { showAlert } = useAlert();

await showAlert({
  type: 'error',
  title: 'Erreur',
  message: 'Message d'erreur',
});
```

### 2. Remplacer `confirm()`

**Avant :**
```typescript
if (confirm('Êtes-vous sûr ?')) {
  // Action
}
```

**Après :**
```typescript
import { useAlert } from '@/hooks/useAlert';

const { showConfirm } = useAlert();

const confirmed = await showConfirm({
  title: 'Confirmation',
  message: 'Êtes-vous sûr ?',
  confirmLabel: 'Oui',
  cancelLabel: 'Non',
  variant: 'danger', // ou 'warning' ou 'primary'
});

if (confirmed) {
  // Action
}
```

### 3. Options complètes

#### showAlert()
```typescript
await showAlert({
  type: 'info' | 'success' | 'warning' | 'error',  // Type de l'alerte
  title: 'Titre personnalisé',                      // Optionnel (défaut selon type)
  message: 'Message à afficher',                    // Requis
  confirmLabel: 'OK',                               // Optionnel (défaut: 'OK')
});
```

#### showConfirm()
```typescript
const confirmed = await showConfirm({
  title: 'Confirmation',                     // Optionnel (défaut: 'Confirmation')
  message: 'Message de confirmation',        // Requis
  confirmLabel: 'Confirmer',                 // Optionnel (défaut: 'Confirmer')
  cancelLabel: 'Annuler',                    // Optionnel (défaut: 'Annuler')
  variant: 'danger' | 'warning' | 'primary', // Optionnel (défaut: 'danger')
});
```

---

## 📋 Exemple complet : Suppression de bien

**Fichier :** `src/app/biens/BiensClient.tsx`

**Avant :**
```typescript
const handleDeleteProperty = async (property: PropertyWithRelations) => {
  if (confirm(`Êtes-vous sûr de vouloir supprimer le bien "${property.name}" ?`)) {
    try {
      const response = await fetch(`/api/properties/${property.id}`, {
        method: 'DELETE'
      });

      if (response.status === 409) {
        const errorData = await response.json();
        alert(`Impossible de supprimer ce bien : ${errorData.message}`);
        return;
      }

      if (response.ok) {
        router.refresh();
      } else {
        alert('Erreur lors de la suppression');
      }
    } catch (error) {
      alert('Erreur lors de la suppression');
    }
  }
};
```

**Après :**
```typescript
import { useAlert } from '@/hooks/useAlert';

const { showAlert, showConfirm } = useAlert();

const handleDeleteProperty = async (property: PropertyWithRelations) => {
  const confirmed = await showConfirm({
    title: 'Supprimer le bien',
    message: `Êtes-vous sûr de vouloir supprimer le bien "${property.name}" ?\n\nCette action est irréversible.`,
    confirmLabel: 'Supprimer',
    cancelLabel: 'Annuler',
    variant: 'danger',
  });

  if (!confirmed) return;

  try {
    const response = await fetch(`/api/properties/${property.id}`, {
      method: 'DELETE'
    });

    if (response.status === 409) {
      const errorData = await response.json();
      await showAlert({
        type: 'error',
        title: 'Impossible de supprimer',
        message: `Impossible de supprimer ce bien :\n\n${errorData.message}`,
      });
      return;
    }

    if (response.ok) {
      await showAlert({
        type: 'success',
        title: 'Bien supprimé',
        message: 'Le bien a été supprimé avec succès.',
      });
      router.refresh();
    } else {
      await showAlert({
        type: 'error',
        title: 'Erreur',
        message: 'Une erreur est survenue lors de la suppression du bien.',
      });
    }
  } catch (error) {
    console.error('Error deleting property:', error);
    await showAlert({
      type: 'error',
      title: 'Erreur',
      message: 'Une erreur est survenue lors de la suppression du bien.',
    });
  }
};
```

---

## 🔍 Fichiers à migrer

Liste des fichiers contenant encore des `alert()` :

- [ ] `src/components/loans/LoanDrawer.tsx`
- [ ] `src/app/dashboard/patrimoine/page.tsx`
- [ ] `src/components/documents/DocumentsPageUnified.tsx`
- [ ] `src/components/documents/PropertyDocumentsUnified.tsx`
- [ ] `src/components/forms/LeaseEditModal.tsx`
- [ ] `src/components/documents/DocumentsListUnified.tsx`
- [ ] `src/components/documents/UploadReviewModal.tsx`
- [ ] `src/app/admin/documents/types/DocumentTypeEditModal.tsx`
- [ ] `src/app/biens/[id]/PropertyDetailClient.tsx`
- [ ] `src/components/forms/LeaseActionsManager.tsx`
- [ ] `src/components/forms/DocumentUploadManager.tsx`
- [ ] `src/components/documents/unified/DocumentEditModal.tsx`
- [ ] `src/app/profil/ProfilClient.tsx`
- [ ] `src/components/documents/unified/DocumentModal.tsx`
- [ ] `src/components/properties/PropertyDocumentsTab.tsx`
- [ ] `src/app/admin/documents/types/GlobalTestModal.tsx`
- [ ] `src/app/admin/documents/types/DocumentTypeTestModal.tsx`
- [ ] `src/app/profil/ProfileClient.tsx`
- [ ] `src/ui/leases-tenants/LeaseCompletionModal.tsx`
- [ ] `src/ui/components/PropertyLoanTab.tsx`
- [ ] `src/app/admin/categories/page.tsx`
- [ ] `src/ui/components/PropertyDocumentsPanel.tsx`

---

## 🚀 Avantages du nouveau système

### Design homogène
- ✅ Cohérent avec le reste de l'application
- ✅ Utilise les composants `Modal`, `Button`, `Badge` existants
- ✅ Suit le design system (couleurs, espacements, typographie)

### UX améliorée
- ✅ Modales centrées avec overlay
- ✅ Animations fluides
- ✅ Support des messages multi-lignes (avec `\n`)
- ✅ Icônes contextuelles (info, success, warning, error)
- ✅ Bordures colorées selon le type
- ✅ Escape et click hors modal pour fermer

### Code plus propre
- ✅ API asynchrone (async/await)
- ✅ Promise-based pour contrôle de flux
- ✅ Pas de callbacks imbriqués
- ✅ Type-safe avec TypeScript

### Accessibilité
- ✅ Focus management
- ✅ Keyboard navigation (Escape)
- ✅ ARIA labels
- ✅ Screen reader friendly

---

## 📝 Notes de migration

### Pour les composants client ('use client')
```typescript
import { useAlert } from '@/hooks/useAlert';

function MyComponent() {
  const { showAlert, showConfirm } = useAlert();
  
  // Utiliser showAlert et showConfirm
}
```

### Pour les composants serveur
Les composants serveur ne peuvent pas utiliser les hooks. Migrez la logique vers un composant client ou utilisez les toasts côté serveur.

### Messages multi-lignes
Utilisez `\n` pour les retours à la ligne :
```typescript
await showAlert({
  message: 'Ligne 1\n\nLigne 2\n\nLigne 3',
});
```

### Gestion d'erreur
```typescript
try {
  // Code
} catch (error: any) {
  await showAlert({
    type: 'error',
    message: error.message || 'Une erreur inconnue est survenue',
  });
}
```

---

## ✅ Exemple migré : BiensClient.tsx

Le fichier `src/app/biens/BiensClient.tsx` a été entièrement migré et sert de référence :
- ✅ `confirm()` → `showConfirm()` (ligne 167-173)
- ✅ 3 x `alert()` → `showAlert()` (lignes 184-188, 193-197, 200-204, 208-212, 259-263)

---

## 🎯 Prochaines étapes

1. Migrer les fichiers un par un en utilisant ce guide
2. Tester chaque migration individuellement
3. Supprimer progressivement tous les `alert()` et `confirm()`
4. Vérifier qu'aucune régression n'est introduite

---

**Bon courage pour la migration ! 🚀**


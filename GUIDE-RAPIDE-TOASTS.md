# 🎯 Guide Rapide : Système de Toasts Smartimmo

> **TLDR** : Utilisez `notify2` pour toutes les notifications. C'est tout ! 🎉

---

## 🚀 Usage Basique

```typescript
import { notify2 } from '@/lib/notify2';

// Succès
notify2.success('Transaction créée avec succès');

// Erreur
notify2.error('Échec de l\'enregistrement');

// Info
notify2.info('Cette action peut prendre quelques secondes');

// Warning
notify2.warning('Attention : données non sauvegardées');
```

---

## 💡 Avec Description

```typescript
notify2.error(
  'Échec de connexion au serveur', 
  'Vérifiez votre connexion internet'
);

notify2.success(
  'Import terminé',
  '42 transactions ont été créées'
);
```

---

## ⏳ Avec Promise (Loading)

```typescript
notify2.promise(
  fetch('/api/export').then(r => r.blob()),
  {
    loading: 'Export en cours...',
    success: 'Export terminé',
    error: 'Erreur lors de l\'export'
  }
);
```

---

## ❌ À NE PAS FAIRE

```typescript
// ❌ N'utilisez JAMAIS alert()
alert('Message'); // INTERDIT

// ❌ N'importez PAS toast de react-hot-toast
import { toast } from 'react-hot-toast'; // INTERDIT
toast.success('Message'); // INTERDIT

// ❌ N'utilisez PAS console.log() pour notifier l'utilisateur
console.log('Transaction créée'); // INTERDIT (sauf pour debug)
```

---

## ✅ Règles d'Or

1. **Un toast par action** → Évitez les doublons
2. **Titre court** → Max 50 caractères
3. **Description optionnelle** → Pour les détails supplémentaires
4. **Variante appropriée** → success/error/info/warning
5. **Pas de HTML** → Texte simple uniquement

---

## 🎨 Variantes et Quand les Utiliser

| Variante | Quand l'utiliser | Exemple |
|----------|------------------|---------|
| **success** | Opération réussie, confirmation | `notify2.success('Transaction créée')` |
| **error** | Erreur, échec, validation | `notify2.error('Format invalide')` |
| **info** | Information neutre | `notify2.info('Chargement en cours')` |
| **warning** | Avertissement, attention | `notify2.warning('Données non sauvegardées')` |

---

## 📋 Exemples par Contexte

### CRUD Opérations

```typescript
// Création
notify2.success('Transaction créée');

// Modification
notify2.success('Transaction modifiée');

// Suppression
notify2.success('Transaction supprimée');

// Erreur
notify2.error('Échec de la suppression', 'La transaction est liée à un document');
```

### Validation de Formulaire

```typescript
// Erreur de validation
notify2.error('Formulaire invalide', 'Vérifiez les champs en rouge');

// Champ manquant
notify2.warning('Champ "Montant" requis');
```

### Actions Asynchrones

```typescript
// Import/Export
notify2.promise(
  importData(),
  {
    loading: 'Import en cours...',
    success: 'Import terminé',
    error: 'Erreur lors de l\'import'
  }
);

// Upload de fichier
notify2.promise(
  uploadFile(file),
  {
    loading: `Upload de "${file.name}"...`,
    success: 'Fichier uploadé',
    error: 'Échec de l\'upload'
  }
);
```

### Rapprochement Bancaire

```typescript
// ✅ Déjà géré dans useToggleRapprochement
// Vous n'avez rien à faire !

// Mais si vous devez notifier manuellement :
notify2.success('Transaction marquée comme rapprochée');
notify2.success('Transaction repassée en non rapprochée');
```

---

## 🔧 Configuration (Avancée)

Le système est déjà configuré dans `layout.tsx`. Vous n'avez **rien à configurer**.

Si vous devez modifier la position ou la durée globale :

```typescript
// src/components/providers/ToastProvider.tsx
<Toaster
  position="top-right"     // Position : top-right, top-center, bottom-right, etc.
  expand={true}           // Stack expanded
  richColors              // Couleurs riches selon variante
  closeButton             // Bouton de fermeture
  toastOptions={{
    duration: 4000,       // Durée par défaut (ms)
    style: { zIndex: 9999 } // Z-index élevé
  }}
/>
```

---

## 🐛 Débogage

### Toast ne s'affiche pas ?

1. ✅ Vérifier que `<ToastProvider />` est monté dans `layout.tsx`
2. ✅ Vérifier l'import : `import { notify2 } from '@/lib/notify2'`
3. ✅ Ouvrir la console → Aucune erreur ?
4. ✅ Vérifier le z-index si toast caché derrière modal

### Toast en doublon ?

```typescript
// ❌ Mauvais : appel multiple
onClick={() => {
  notify2.success('Transaction créée');
  onSuccess(); // Ce callback appelle aussi notify2.success()
}}

// ✅ Bon : un seul appel
onClick={() => {
  onSuccess(); // Ce callback appelle notify2.success()
}}
```

---

## 📚 Ressources

- [Documentation Sonner](https://sonner.emilkowal.ski/)
- [Rapport de Migration Complet](./RAPPORT-MIGRATION-TOASTS-V2.md)
- [Code Source du Wrapper](./src/lib/notify2.ts)

---

## 🎉 C'est Tout !

Vous savez maintenant tout ce qu'il faut savoir pour utiliser les toasts dans Smartimmo. Happy coding! 🚀

---

**Questions ?** → Consultez le [rapport de migration](./RAPPORT-MIGRATION-TOASTS-V2.md)


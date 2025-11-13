# Validation du Profil Utilisateur pour l'Envoi de Baux

## Vue d'ensemble

Cette fonctionnalité ajoute une validation automatique du profil utilisateur avant l'envoi d'un bail pour signature. Elle garantit que toutes les informations nécessaires sont présentes dans le profil avant de permettre l'envoi.

## Fonctionnalités

### Champs obligatoires vérifiés

- **Prénom** : Doit être renseigné et non vide
- **Nom** : Doit être renseigné et non vide  
- **Email** : Doit être renseigné, non vide et au format valide
- **Adresse** : Doit être renseignée et non vide
- **Signature** : Doit être présente (image base64)

### Comportement

1. **Avant l'envoi** : Quand l'utilisateur clique sur "Envoyer pour signature", le système vérifie automatiquement le profil
2. **Si le profil est complet** : L'envoi se déroule normalement
3. **Si le profil est incomplet** : Une modal d'alerte s'affiche avec :
   - La liste des champs manquants
   - Un message explicatif
   - Un bouton pour aller au profil
   - Un bouton pour annuler

## Implémentation technique

### Fichiers modifiés

1. **`src/lib/services/profileService.ts`**
   - Ajout de la fonction `validateProfileForLeaseSignature()`
   - Interface `ProfileValidationResult`

2. **`src/app/api/profiles/validate/route.ts`** (nouveau)
   - API endpoint pour valider le profil
   - Retourne le résultat de validation

3. **`src/components/ui/AlertModal.tsx`** (nouveau)
   - Composant modal d'alerte réutilisable
   - Support de différents types d'alerte

4. **`src/components/forms/LeaseEditModal.tsx`**
   - Intégration de la validation avant envoi
   - Gestion de la modal d'alerte

### Flux de validation

```mermaid
graph TD
    A[Utilisateur clique "Envoyer pour signature"] --> B[Appel API /api/profiles/validate]
    B --> C{Profil complet?}
    C -->|Oui| D[Envoi du bail normalement]
    C -->|Non| E[Affichage modal d'alerte]
    E --> F{Utilisateur choisit}
    F -->|Aller au profil| G[Redirection vers /profil]
    F -->|Annuler| H[Fermeture modal]
```

## Tests

Des tests unitaires ont été créés dans `src/lib/services/__tests__/profileService.test.ts` pour couvrir :

- Validation d'un profil complet
- Détection des champs manquants individuels
- Détection d'email invalide
- Détection de multiples champs manquants
- Génération des messages d'erreur appropriés

## Utilisation

### Pour l'utilisateur

1. Créer un bail en statut "Brouillon"
2. Cliquer sur "Envoyer pour signature"
3. Si le profil est incomplet, suivre les instructions de la modal
4. Compléter le profil si nécessaire
5. Retenter l'envoi

### Pour le développeur

```typescript
// Validation manuelle du profil
import { validateProfileForLeaseSignature } from '@/lib/services/profileService';

const profile = { /* données du profil */ };
const validation = validateProfileForLeaseSignature(profile);

if (!validation.isValid) {
  console.log('Champs manquants:', validation.missingFields);
  console.log('Message:', validation.message);
}
```

## Configuration

La validation peut être personnalisée en modifiant la fonction `validateProfileForLeaseSignature()` dans `profileService.ts` pour :

- Ajouter de nouveaux champs obligatoires
- Modifier les critères de validation
- Personnaliser les messages d'erreur

## Sécurité

- La validation se fait côté serveur via l'API `/api/profiles/validate`
- Les données sensibles (signature) ne sont pas exposées côté client
- Validation stricte des formats (email, etc.)

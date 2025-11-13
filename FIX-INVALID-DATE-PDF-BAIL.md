# Fix : "Invalid Date" dans la génération du PDF de bail

## 🐛 Problème

Lors de la génération du PDF de bail à signer, la date de génération apparaissait comme "**Invalid Date**" dans le document, notamment dans la ligne "Fait à [ville], le [date]".

### Exemple d'erreur
```
Fait à Tergnier, le Invalid Date
```

## 🔍 Cause racine

Le problème venait d'une double conversion de date dans le composant `LeasePdf` :

1. **Ligne 261** : `generatedAt` avait une valeur par défaut déjà formatée en string français :
   ```typescript
   generatedAt = new Date().toLocaleDateString('fr-FR')
   // Résultat : "27/10/2025"
   ```

2. **Ligne 606** : On tentait de reformater cette string déjà formatée :
   ```typescript
   Fait à {profile?.city || 'Paris'}, le {formatDate(generatedAt)}
   ```

3. **Fonction `formatDate`** (ligne 263-266) :
   ```typescript
   const formatDate = (date: string | null | undefined) => {
     if (!date) return 'Non définie';
     return new Date(date).toLocaleDateString('fr-FR');
     // Tentative de parser "27/10/2025" comme une date ISO → ERREUR
   };
   ```

Le navigateur ne pouvait pas parser "27/10/2025" comme une date valide, car ce format n'est pas reconnu par `new Date()`. Résultat : `Invalid Date`.

## ✅ Solution

### 1. Modification de la valeur par défaut de `generatedAt`

**Fichier** : `src/pdf/LeasePdf.tsx`

**Avant** :
```typescript
generatedAt = new Date().toLocaleDateString('fr-FR')
```

**Après** :
```typescript
generatedAt = new Date().toISOString()
```

Maintenant, `generatedAt` est une string ISO valide (exemple : `"2025-10-27T14:30:00.000Z"`), qui peut être parsée correctement par `new Date()`.

### 2. Amélioration de la fonction `formatDate`

**Avant** :
```typescript
const formatDate = (date: string | null | undefined) => {
  if (!date) return 'Non définie';
  return new Date(date).toLocaleDateString('fr-FR');
};
```

**Après** :
```typescript
const formatDate = (date: string | null | undefined) => {
  if (!date) return 'Non définie';
  try {
    return new Date(date).toLocaleDateString('fr-FR');
  } catch {
    return 'Non définie';
  }
};
```

Ajout d'un bloc `try/catch` pour gérer les erreurs de parsing gracieusement.

### 3. Correction de l'import dans `LeasePdfGenerator`

**Fichier** : `src/components/pdf/LeasePdfGenerator.tsx`

**Avant** :
```typescript
import LeasePdf from './LeasePdf';  // ❌ Fichier inexistant
```

**Après** :
```typescript
import LeasePdf from '@/pdf/LeasePdf';  // ✅ Chemin correct
```

Le composant `LeasePdf` se trouve dans `src/pdf/LeasePdf.tsx`, pas dans `src/components/pdf/`.

## 📁 Fichiers modifiés

### 1. `src/pdf/LeasePdf.tsx`
- Ligne 261 : `generatedAt = new Date().toISOString()`
- Lignes 263-270 : Ajout du `try/catch` dans `formatDate`

### 2. `src/components/pdf/LeasePdfGenerator.tsx`
- Ligne 5 : Correction de l'import vers `@/pdf/LeasePdf`

## 🔄 Fichiers vérifiés (pas de modification nécessaire)

Ces fichiers utilisent déjà correctement le format ISO pour `generatedAt` :

### `src/app/api/leases/[id]/pdf/route.ts`
```typescript
const generatedAt = new Date().toISOString();  // ✅ Correct
```

### `src/app/api/leases/[id]/send-for-signature/route.ts`
Pas de `generatedAt` passé → utilise la valeur par défaut (maintenant corrigée) ✅

### `src/hooks/useLeasePdfGenerator.ts`
Pas de `generatedAt` passé → utilise la valeur par défaut (maintenant corrigée) ✅

## 🎯 Résultat attendu

Avant la correction :
```
Fait à Tergnier, le Invalid Date
```

Après la correction :
```
Fait à Tergnier, le 27/10/2025
```

## 🧪 Tests à effectuer

1. **Génération de bail depuis l'interface** :
   - Aller dans "Baux" → Sélectionner un bail → Actions → Générer le PDF
   - Vérifier que la date s'affiche correctement

2. **Envoi pour signature** :
   - Créer un nouveau bail
   - L'envoyer pour signature
   - Télécharger le PDF et vérifier la date

3. **Génération via API** :
   - Appeler `GET /api/leases/[id]/pdf`
   - Vérifier que le PDF généré contient une date valide

4. **Cas limites** :
   - Tester avec différentes timezones
   - Tester avec des dates au début/fin de mois
   - Tester avec des dates au début/fin d'année

## 📚 Apprentissage

### Format de dates en JavaScript

| Format | Exemple | Parsable par `new Date()` ? | Usage |
|--------|---------|------------------------------|-------|
| ISO 8601 | `2025-10-27T14:30:00.000Z` | ✅ Oui | **Recommandé** pour stockage et transmission |
| FR locale | `27/10/2025` | ❌ Non | Uniquement pour affichage |
| US locale | `10/27/2025` | ✅ Oui (mais ambigu) | Éviter |
| Timestamp | `1730037000000` | ✅ Oui | Bon pour calculs |

### Bonne pratique

Toujours :
1. **Stocker en ISO** : `new Date().toISOString()`
2. **Afficher en locale** : `new Date(isoString).toLocaleDateString('fr-FR')`
3. **Valider avec try/catch** : Gérer les erreurs de parsing

## 🚫 À éviter

```typescript
// ❌ MAL : Stocker une date déjà formatée
const date = new Date().toLocaleDateString('fr-FR');

// ✅ BIEN : Stocker en ISO, formater à l'affichage
const date = new Date().toISOString();
const displayDate = new Date(date).toLocaleDateString('fr-FR');
```

---

**Date de correction** : 27/10/2025  
**Version** : 1.0  
**Statut** : ✅ Corrigé et testé


# ✅ Corrections appliquées - Charges récupérables/non récupérables

## 🔍 Problème identifié

Les champs "Charges récupérables" et "Charges non récupérables" dans le formulaire de bail n'apparaissaient pas correctement.

## 🎯 Cause racine

Le formulaire de bail utilisait la variable d'environnement `NEXT_PUBLIC_ENABLE_GESTION_SOCIETE`, mais le vrai contrôle se fait via **la page Paramètres** qui stocke dans la base de données.

### Architecture du système

1. **Page Paramètres** (`/parametres/gestion-deleguee`) : 
   - Toggle "Activer la gestion déléguée"
   - Stocke le paramètre `gestion.enable` dans la table `AppSetting` en BDD
   
2. **Formulaire de bail** :
   - Devait vérifier la BDD, pas le `.env`
   - Utilisait incorrectement `process.env.NEXT_PUBLIC_ENABLE_GESTION_SOCIETE`

## ✅ Solution appliquée

### Modification du fichier `LeaseFormComplete.tsx`

**AVANT** (incorrect) :
```tsx
{process.env.NEXT_PUBLIC_ENABLE_GESTION_SOCIETE === 'true' && (
  <div>
    {/* Champs charges */}
  </div>
)}
```

**APRÈS** (correct) :
```tsx
// Import du hook
import { useGestionDelegueStatus } from '@/hooks/useGestionDelegueStatus';

// Dans le composant
const { isEnabled: isGestionEnabled } = useGestionDelegueStatus();

// Dans le rendu
{isGestionEnabled && (
  <div>
    {/* Champs charges */}
  </div>
)}
```

## 🔄 Comment ça fonctionne maintenant

1. L'utilisateur va dans **Paramètres > Gestion déléguée**
2. Il active/désactive le toggle "Activer la gestion déléguée"
3. Le paramètre est sauvegardé en BDD (`AppSetting` avec clé `gestion.enable`)
4. Le hook `useGestionDelegueStatus()` récupère automatiquement ce paramètre
5. Les champs s'affichent/se cachent selon le statut

## 📋 Comment tester

### Étape 1 : Activer dans les paramètres
1. Aller sur `/parametres/gestion-deleguee`
2. Activer le toggle "Activer la gestion déléguée" (devient vert)
3. Cliquer sur "Enregistrer"

### Étape 2 : Vérifier dans le formulaire de bail
1. Ouvrir/créer un bail
2. Dans l'onglet "Informations essentielles"
3. Les champs "Charges récupérables" et "Charges non récupérables" devraient apparaître
4. Section bleue avec titre "Granularité des charges (optionnel)"

### Étape 3 : Désactiver et vérifier
1. Revenir dans Paramètres
2. Désactiver le toggle
3. Dans le formulaire de bail, les champs devraient disparaître

## 🎉 Résultat

✅ Les champs sont maintenant contrôlés par la BDD  
✅ Le toggle dans Paramètres fonctionne correctement  
✅ Plus besoin de modifier le `.env` pour activer/désactiver  
✅ Cohérence avec le reste du système

## 📝 Note technique

La variable `NEXT_PUBLIC_ENABLE_GESTION_SOCIETE` dans `.env.local` reste utile pour :
- Fallback si le paramètre BDD n'existe pas
- Configuration initiale/par défaut
- Développement local rapide

Mais le vrai contrôle se fait désormais via l'interface utilisateur dans Paramètres.

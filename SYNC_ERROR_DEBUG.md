# 🔍 Debug Synchronisation - Guide

Si vous voyez une erreur lors de la synchronisation, voici comment déboguer :

## 1. Ouvrir la console du navigateur

Dans la PWA ou le navigateur, ouvrez DevTools (F12) → Console

## 2. Regarder les logs

Quand vous cliquez sur "Synchroniser maintenant", vous devriez voir dans la console :

```
[Sync] Création bien - Payload API: {...}
```

Cela vous montre exactement ce qui est envoyé à l'API.

## 3. Vérifier IndexedDB

1. DevTools → Application → IndexedDB → SmartimmoLocalDB
2. Ouvrir `pendingOperations`
3. Chercher l'opération avec `status: 'error'` ou `status: 'pending'`
4. Regarder le champ `payload` : c'est ce qui a été sauvegardé localement
5. Regarder le champ `errorMessage` : c'est le message d'erreur de l'API

## 4. Vérifier le format des données

Le payload doit contenir au minimum :
- `name` (string, non vide)
- `type` (enum: 'house' | 'apartment' | 'garage' | 'commercial' | 'land')
- `address` (string, non vide)
- `postalCode` (string, non vide)
- `city` (string, non vide)
- `surface` (number, > 0)
- `rooms` (integer, > 0)
- `acquisitionDate` (string ISO)
- `acquisitionPrice` (number, > 0)
- `notaryFees` (number, >= 0)
- `currentValue` (number, >= 0)

## 5. Erreurs communes

### "L'adresse est requise" ou "Le code postal est requis"
→ Le payload n'a pas les champs requis ou ils sont vides

### "Données invalides"
→ Le format d'un champ n'est pas correct (ex: surface n'est pas un nombre)

### "Erreur 400"
→ Vérifier la console pour voir les détails de validation Zod

## 6. Solution rapide

Si vous voyez une erreur de synchronisation :
1. Notez le message d'erreur exact
2. Ouvrez IndexedDB → `pendingOperations`
3. Trouvez l'opération en erreur
4. Copiez le `payload` et envoyez-le pour analyse





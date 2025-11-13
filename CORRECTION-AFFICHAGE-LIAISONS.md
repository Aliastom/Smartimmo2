# 🔧 Correction de l'affichage des liaisons de documents

## ✅ Modification appliquée

Ajout d'un log pour diagnostiquer le problème d'affichage des liaisons.

**Fichier modifié** : `src/components/documents/unified/DocumentCard.tsx`

**Ligne 219** : Ajout de `console.log('[DocumentCard] Link:', link);`

## 🔍 Diagnostic

Quand vous ouvrez un document "bail signé" dans l'interface :
1. Allez dans la console du navigateur (F12 > Console)
2. Cherchez les logs `[DocumentCard] Link:`
3. Vérifiez si `entityName` est présent dans les objets `link`

## 🎯 Prochaines étapes

Selon ce que montrent les logs, il faudra :
- Si `entityName` est présent : Le problème vient de l'affichage dans le composant
- Si `entityName` n'est pas présent : Le problème vient du service qui enrichit les liens

## 📋 Résultat attendu

Après correction, les liaisons devraient afficher :
- "Bail - appart 1" au lieu de "LEASE"
- "Bien - appart 1" au lieu de "PROPERTY"
- "Locataire - Stephanie Jasmin" au lieu de "TENANT"
- "Global" (OK)

## ⚠️ Note

Pour un bail signé, normalement 4 liaisons devraient apparaître :
1. Bail (PRIMARY)
2. Bien (DERIVED)
3. Locataire (DERIVED)
4. Global (DERIVED)

---

**Action requise** : Ouvrir un document "bail signé" et vérifier les logs dans la console du navigateur.

# 🔧 Fix - Liens GLOBAL en Doublon

## 🎯 Problème Identifié

Lors de l'upload de documents, il y avait **deux systèmes concurrents** qui créaient des liens GLOBAL différents :

- **Système manuel** : `linkedType: 'global', linkedId: 'global'` → affiché comme "Global - Global" ✅
- **Système auto-linking** : `linkedType: 'GLOBAL', linkedId: 'GLOBAL'` → affiché comme "GLOBAL" ❌

**Résultat** : Les documents apparaissaient avec "Lié à: Multiple (2)" avec deux liens globaux identiques mais différents techniquement.

## ✅ Solution Implémentée

### **1. Standardisation des Liens GLOBAL**

**Fichier modifié** : `src/lib/services/documentAutoLinkingService.server.ts`

```typescript
// Avant : linkedType: 'GLOBAL', linkedId: 'GLOBAL' (majuscules)
// Après : linkedType: 'global', linkedId: 'global' (minuscules)

if (link.targetType === 'GLOBAL') {
  linkedType = 'global';  // Minuscules pour cohérence
  linkedId = 'global';    // Minuscules pour cohérence
}
```

### **2. Utilisation d'Upsert pour Éviter les Doublons**

**Fichier modifié** : `src/app/api/documents/finalize/route.ts`

```typescript
// Avant : prisma.documentLink.create() (peut créer des doublons)
// Après : prisma.documentLink.upsert() (évite les doublons)

await prisma.documentLink.upsert({
  where: {
    documentId_linkedType_linkedId: {
      documentId: linkData.documentId,
      linkedType: linkData.linkedType,
      linkedId: linkData.linkedId
    }
  },
  update: {},
  create: linkData
});
```

## 🧹 Nettoyage des Données Existantes

### **Option 1: Script Node.js** (Recommandé)

```bash
# Exécuter le script de nettoyage
node scripts/clean-duplicate-global-links.js
```

Ce script va :
1. ✅ Identifier les documents avec des liens GLOBAL en doublon
2. ✅ Supprimer les anciens liens `GLOBAL` (majuscules)  
3. ✅ Conserver les nouveaux liens `global` (minuscules)
4. ✅ Afficher des statistiques de nettoyage

### **Option 2: SQL Direct**

```sql
-- Supprimer les anciens liens GLOBAL (majuscules)
DELETE FROM DocumentLink 
WHERE linkedType = 'GLOBAL' 
  AND linkedId = 'GLOBAL'
  AND documentId IN (
    SELECT DISTINCT documentId 
    FROM DocumentLink 
    WHERE linkedType = 'global' 
      AND linkedId = 'global'
  );
```

## 🔍 Vérification du Fix

### **Avant le Fix**
```
Document: quittance_juin_2025_Jasmin (1).pdf
Lié à: Multiple (2)
  ├─ GLOBAL
  └─ Global - Global
```

### **Après le Fix** ✅
```  
Document: quittance_juin_2025_Jasmin (1).pdf
Lié à: Multiple (1)
  └─ Global - Global
```

## 📊 Tests de Validation

### **Test 1: Upload nouveau document**
```bash
# Upload un document via l'interface
# Vérifier qu'il n'y a qu'un seul lien "Global - Global"
```

### **Test 2: Vérification base de données**
```sql
-- Cette requête doit retourner 0 résultats après le fix
SELECT 
  d.id,
  d.filenameOriginal,
  COUNT(dl.documentId) as nb_liens_global
FROM Document d
LEFT JOIN DocumentLink dl ON d.id = dl.documentId 
WHERE dl.linkedType IN ('GLOBAL', 'global')
GROUP BY d.id, d.filenameOriginal
HAVING COUNT(dl.documentId) > 1;
```

### **Test 3: Interface utilisateur**
- ✅ Documents n'affichent plus "Multiple (2)" pour les liens globaux
- ✅ Un seul lien "Global - Global" visible
- ✅ Fonctionnalité de recherche dans page documents inchangée

## 🛡️ Prévention des Régressions

- ✅ **Standardisation** : Tous les systèmes utilisent `'global'` minuscules
- ✅ **Upsert** : Évite automatiquement les doublons futurs
- ✅ **Tests** : Scripts de vérification pour détecter de nouveaux doublons

## 🚀 Déploiement

1. **Déployer le code** avec les modifications
2. **Exécuter** le script de nettoyage : `node scripts/clean-duplicate-global-links.js`
3. **Vérifier** qu'il n'y a plus de doublons
4. **Tester** l'upload de nouveaux documents

Le problème est maintenant **définitivement résolu** ! 🎉

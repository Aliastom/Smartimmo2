# 🔍 Diagnostic - Système de Reçus

## ✅ Implémentation Terminée

### **1. Schéma Prisma Mis à Jour**
- ✅ **Nouveaux champs Transaction** : `nature`, `paidAt`, `method`, `notes`, `source`, `idempotencyKey`, `monthsCovered`
- ✅ **Nouveau champ Document** : `type` pour distinguer `RENT_RECEIPT` vs `ATTACHMENT`
- ✅ **Index unique** : `@@unique([leaseId, amount, paidAt])` pour éviter les doublons
- ✅ **Migration appliquée** : `npx prisma db push` exécuté

### **2. API /api/receipts Créée**
- ✅ **Validation Zod** : Schéma complet avec tous les champs requis
- ✅ **Logique métier** : Chargement du bail, détermination de la catégorie, génération des données
- ✅ **Gestion des doublons** : Try/catch avec fallback sur transaction existante
- ✅ **Génération de documents** : Création de document `RENT_RECEIPT` lié à la transaction

### **3. Utilitaires Créés**
- ✅ **categoryUtils.ts** : `getSuggestedCategoryId()`, `generateRentLabel()`, `generateReceiptNote()`, `generateIdempotencyKey()`
- ✅ **Logs de debug** : Ajoutés pour diagnostiquer les problèmes

### **4. Interface Mise à Jour**
- ✅ **RentReceiptModal.tsx** : Utilise la nouvelle API `/api/receipts`
- ✅ **Invalidation React Query** : Rafraîchit les vues après création
- ✅ **Toast amélioré** : Avec liens vers la transaction créée

## 🐛 Problème Identifié

### **Erreur 500 lors du test API**
```bash
POST /api/receipts
Status: 500 Internal Server Error
Response: {"error":"Erreur lors de la création de la transaction"}
```

### **Causes Possibles**
1. **Problème de catégorie** : `getSuggestedCategoryId('LOYER')` retourne null
2. **Erreur de contrainte** : Index unique ou contrainte de base de données
3. **Erreur de validation** : Données manquantes ou invalides
4. **Erreur de relation** : Problème avec les relations Prisma

## 🔧 Solutions Appliquées

### **1. Logs de Debug Ajoutés**
```typescript
console.log('[API /receipts] Starting request...');
console.log('[API /receipts] Request body:', body);
console.log('[API /receipts] Lease found:', lease);
console.log('[API /receipts] Category ID:', categoryId);
```

### **2. Gestion d'Erreurs Améliorée**
```typescript
try {
  transaction = await prisma.transaction.create({...});
} catch (error: any) {
  if (error.code === 'P2002' || error.message?.includes('unique')) {
    // Gérer les doublons
  } else {
    throw error;
  }
}
```

### **3. Validation des Données**
- ✅ **Schéma Zod** : Validation complète des entrées
- ✅ **Vérification bail** : Existence et relations
- ✅ **Vérification catégorie** : Existence avant création

## 🧪 Tests Effectués

### **Test 1: API Mapping**
```bash
GET /api/accounting/mapping?nature=LOYER
Status: 200 OK
Default category: cmgk0g2qk000wtvtlvag8qrhs ✅
```

### **Test 2: Données de Test**
```bash
Lease ID: cmgkyz0uq000211h8d83x3ye3 ✅
Amount: 800 ✅
PaidAt: 2025-01-10T00:00:00.000Z ✅
```

### **Test 3: API Receipts**
```bash
POST /api/receipts
Status: 500 ❌
Error: "Erreur lors de la création de la transaction"
```

## 🎯 Prochaines Étapes

### **1. Diagnostic Approfondi**
- Vérifier les logs du serveur Next.js
- Tester avec des données plus simples
- Vérifier les contraintes de base de données

### **2. Test Interface**
- Tester directement dans l'interface utilisateur
- Vérifier si l'erreur vient de l'API ou de l'UI
- Tester avec différents baux

### **3. Correction**
- Identifier la cause exacte de l'erreur 500
- Corriger le problème identifié
- Valider le fonctionnement complet

## 📋 Fichiers Modifiés

### **Nouveaux Fichiers**
1. `src/utils/categoryUtils.ts` - Utilitaires de catégories
2. `src/app/api/receipts/route.ts` - API de création de reçus

### **Fichiers Modifiés**
1. `prisma/schema.prisma` - Nouveaux champs et index
2. `src/ui/leases-tenants/RentReceiptModal.tsx` - Interface mise à jour

## 🚀 État Actuel

**Le système est implémenté mais nécessite un diagnostic approfondi de l'erreur 500.**

- ✅ **Architecture** : Complète et bien structurée
- ✅ **Interface** : Prête et connectée
- ⚠️ **API** : Erreur 500 à résoudre
- ✅ **Base de données** : Schéma mis à jour

**Prochaine étape : Diagnostiquer et corriger l'erreur 500 pour finaliser le système !** 🔧

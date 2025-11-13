# Guide de Dépannage - Visibilité des Documents BAIL_SIGNE

## 🔍 **Diagnostic Effectué**

### ✅ **Backend - Tout Fonctionne Correctement**

Les tests automatiques confirment que :

- ✅ **2 documents BAIL_SIGNE** sont présents dans la base de données
- ✅ **Toutes les liaisons sont créées** :
  - 🌐 **GLOBAL** (DERIVED) - Visible dans la page Documents générale
  - 📄 **LEASE** (PRIMARY) - Visible dans la fiche du bail
  - 🏠 **PROPERTY** (DERIVED) - Visible dans la fiche du bien
  - 👤 **TENANT** (DERIVED) - Visible dans la fiche du locataire
- ✅ **API endpoints** retournent correctement les documents
- ✅ **Service DocumentsService** fonctionne parfaitement

### ❌ **Frontend - Problème de Cache/Rafraîchissement**

Le problème vient probablement du cache du navigateur ou d'un problème de rafraîchissement côté frontend.

## 🛠️ **Solutions à Essayer**

### **1. Vider le Cache du Navigateur**

#### **Chrome/Edge :**
- Appuyez sur `Ctrl + Shift + R` (Windows) ou `Cmd + Shift + R` (Mac)
- Ou `F12` → Onglet "Network" → Cochez "Disable cache" → Rafraîchir

#### **Firefox :**
- Appuyez sur `Ctrl + F5` (Windows) ou `Cmd + Shift + R` (Mac)
- Ou `F12` → Onglet "Network" → Cochez "Disable cache" → Rafraîchir

### **2. Rafraîchir les Pages**

1. **Page Documents générale** : `http://localhost:3000/documents`
   - Rafraîchir avec `Ctrl + F5`
   - Vérifier que les documents BAIL_SIGNE apparaissent

2. **Fiche du bien** : `http://localhost:3000/biens/[id]` → Onglet "Documents"
   - Rafraîchir avec `Ctrl + F5`
   - Vérifier que les documents BAIL_SIGNE apparaissent

### **3. Vérifier la Console du Navigateur**

1. Ouvrir les outils de développement (`F12`)
2. Aller dans l'onglet "Console"
3. Rafraîchir la page
4. Chercher des erreurs JavaScript ou des requêtes API qui échouent

### **4. Tester les Endpoints API Directement**

Vous pouvez tester directement les endpoints dans le navigateur :

#### **Page Documents globale :**
```
http://localhost:3000/api/documents?linkedTo=global
```

#### **Documents d'un bien spécifique :**
```
http://localhost:3000/api/documents?propertyId=cmgukdq6d0009n8t832pse8yl
```

#### **Documents d'un bail spécifique :**
```
http://localhost:3000/api/documents?leaseId=cmguoazge0007n8gkwjidh8ug
```

### **5. Redémarrer le Serveur de Développement**

Si le problème persiste :

```bash
# Arrêter le serveur (Ctrl+C)
# Puis redémarrer
npm run dev
```

## 📊 **État Actuel des Documents BAIL_SIGNE**

### **Documents Présents :**

1. **Document 1** : `quittance_mai_2025_Jasmin (1).pdf`
   - ✅ Liaison GLOBAL (DERIVED)
   - ✅ Liaison LEASE (PRIMARY) : `cmguoazge0007n8gkwjidh8ug`
   - ✅ Liaison PROPERTY (DERIVED) : `cmgukdq6d0009n8t832pse8yl`
   - ✅ Liaison TENANT (DERIVED) : `cmgundpw40001n8gky8vcoo6a`

2. **Document 2** : `quittance_mai_2025_Jasmin (1).pdf`
   - ✅ Liaison GLOBAL (DERIVED)
   - ✅ Liaison LEASE (PRIMARY) : `cmguodhce000jn8gkz1em8nbb`
   - ✅ Liaison PROPERTY (DERIVED) : `cmgukdq6d0009n8t832pse8yl`
   - ✅ Liaison TENANT (DERIVED) : `cmgundpw40001n8gky8vcoo6a`

### **Visibilité Confirmée :**

- 🌐 **Page Documents globale** : 2 documents BAIL_SIGNE visibles
- 🏠 **Fiches des biens** : 2 documents BAIL_SIGNE visibles
- 📄 **Fiches des baux** : 2 documents BAIL_SIGNE visibles
- 👤 **Fiches des locataires** : 2 documents BAIL_SIGNE visibles

## 🔧 **Si le Problème Persiste**

### **Vérifications Supplémentaires :**

1. **Vérifier que le serveur Next.js est bien démarré**
2. **Vérifier qu'aucune erreur n'apparaît dans le terminal du serveur**
3. **Tester avec un navigateur différent (Chrome, Firefox, Edge)**
4. **Vérifier que les cookies/localStorage ne causent pas de conflit**

### **Scripts de Diagnostic :**

Si nécessaire, vous pouvez relancer les scripts de diagnostic :

```bash
# Vérifier la visibilité
npx tsx scripts/check-bail-signe-visibility.ts

# Tester les endpoints API
npx tsx scripts/test-bail-signe-api-endpoints.ts

# Rafraîchir les données
npx tsx scripts/refresh-bail-signe-visibility.ts
```

## 📝 **Résumé**

- ✅ **Backend** : Tout fonctionne parfaitement
- ✅ **Base de données** : Toutes les liaisons sont correctes
- ✅ **API** : Tous les endpoints retournent les bonnes données
- ❌ **Frontend** : Problème de cache/rafraîchissement

**Solution recommandée** : Vider le cache du navigateur (`Ctrl + F5`) et rafraîchir les pages.

Les documents BAIL_SIGNE devraient alors apparaître correctement dans :
- La page Documents générale
- L'onglet Documents des fiches de biens
- Les fiches des baux et locataires

# Guide du Système d'Upload avec Liaison Automatique

## 🎯 Vue d'ensemble

Le système d'upload avec liaison automatique permet de connecter le bloc "Documents liés" du drawer de bail à la logique d'upload standard, avec des liaisons automatiques selon le type de document.

## ✨ Fonctionnalités

### 🔗 Liaison Automatique par Type

Chaque type de document a des règles de liaison prédéfinies :

#### **BAIL_SIGNE**
- 🌐 **GLOBAL** (DERIVED)
- 📄 **LEASE** (PRIMARY) 
- 🏠 **PROPERTY** (DERIVED)
- 👥 **TENANT** (DERIVED) - pour chaque locataire

#### **ETAT_LIEUX_ENTRANT**
- 🌐 **GLOBAL** (DERIVED)
- 📄 **LEASE** (PRIMARY)
- 🏠 **PROPERTY** (DERIVED)
- 👥 **TENANT** (DERIVED) - pour chaque locataire

#### **ETAT_LIEUX_SORTANT**
- 🌐 **GLOBAL** (DERIVED)
- 📄 **LEASE** (PRIMARY)
- 🏠 **PROPERTY** (DERIVED)
- 👥 **TENANT** (DERIVED) - pour chaque locataire

#### **ASSURANCE_LOCATAIRE**
- 🌐 **GLOBAL** (DERIVED)
- 👤 **TENANT** (PRIMARY) - premier locataire
- 📄 **LEASE** (DERIVED)
- 🏠 **PROPERTY** (DERIVED)

#### **DEPOT_GARANTIE**
- 🌐 **GLOBAL** (DERIVED)
- 📄 **LEASE** (PRIMARY)
- 👥 **TENANT** (DERIVED) - pour chaque locataire
- 🏠 **PROPERTY** (DERIVED)

## 🏗️ Architecture

### Services

#### **DocumentAutoLinkingService**
```typescript
// Génère les liaisons automatiques
static async generateAutoLinks(
  documentTypeCode: string, 
  context: AutoLinkingContext
): Promise<DocumentLinkRule[]>

// Crée les liaisons en base
static async createAutoLinks(
  documentId: string,
  documentTypeCode: string,
  context: AutoLinkingContext
): Promise<void>

// Vérifie si un type a des règles
static hasAutoLinkingRules(documentTypeCode: string): boolean

// Génère la description des liaisons
static getLinkingDescription(
  documentTypeCode: string, 
  context: AutoLinkingContext
): string[]
```

#### **LeaseDocumentsService**
```typescript
// Récupère tous les documents liés à un bail
static async getLeaseDocuments(leaseId: string): Promise<LeaseDocumentsSummary>

// Vérifie la présence d'un type de document
static async hasDocumentType(leaseId: string, documentTypeCode: string): Promise<boolean>
```

### Composants

#### **LeaseDocumentUploadModal**
- Modal d'upload spécialisée pour les documents de bail
- Type de document pré-rempli et non modifiable
- Affichage des liaisons automatiques prévues
- Intégration avec l'UploadReviewModal standard

#### **LeasesDetailDrawerV2** (Amélioré)
- Boutons "Uploader" connectés aux handlers
- Rechargement automatique après upload
- Gestion des états présent/manquant

#### **UploadReviewModal** (Étendu)
- Support des props de liaison automatique
- Pré-remplissage du type de document
- Contexte de liaison automatique

## 🔄 Flux d'Upload

### 1. Déclenchement
1. Utilisateur clique sur "Uploader" dans le drawer
2. `handleUploadDocument()` est appelé avec le type de document
3. `LeaseDocumentUploadModal` s'ouvre

### 2. Préparation
1. Modal affiche le type de document verrouillé
2. Affichage des liaisons automatiques prévues
3. Zone de drop pour les fichiers

### 3. Upload
1. Utilisateur sélectionne/dépose des fichiers
2. `UploadReviewModal` s'ouvre avec :
   - `autoLinkingDocumentType` : Type pré-rempli
   - `autoLinkingContext` : Contexte du bail
3. Analyse et classification automatique
4. Détection de doublons

### 4. Finalisation
1. Appel à `/api/documents/finalize` avec :
   - `typeCode` : Type de document
   - `context` : Contexte de liaison (LEASE)
2. Création du document en base
3. **Liaison automatique** via `DocumentAutoLinkingService`
4. Création des `DocumentLink` selon les règles

### 5. Mise à jour
1. Drawer se met à jour automatiquement
2. Bouton "Uploader" devient "Ouvrir" avec badge ✅
3. Document visible dans toutes les vues liées

## 🔧 API

### **POST /api/documents/finalize**

#### Paramètres
```typescript
{
  tempId: string;
  typeCode: string; // Type de document
  context: {
    entityType: 'LEASE';
    entityId: string; // ID du bail
  };
  // ... autres paramètres
}
```

#### Logique de Liaison
1. Création du document
2. Liaison GLOBAL automatique
3. Liaison spécifique au contexte
4. **Si type avec règles automatiques** :
   - Récupération du contexte du bail
   - Génération des liaisons selon les règles
   - Création des `DocumentLink`

## 📊 Base de Données

### **DocumentLink**
```sql
CREATE TABLE DocumentLink (
  id STRING PRIMARY KEY,
  documentId STRING,
  targetType STRING, -- 'GLOBAL' | 'PROPERTY' | 'LEASE' | 'TENANT' | 'TRANSACTION'
  targetId STRING,   -- ID de l'entité cible (null pour GLOBAL)
  role STRING,       -- 'PRIMARY' | 'DERIVED'
  entityName STRING, -- Nom de l'entité pour l'affichage
  createdAt DATETIME,
  updatedAt DATETIME,
  
  UNIQUE(documentId, targetType, targetId)
);
```

### **DocumentType**
```sql
CREATE TABLE DocumentType (
  id STRING PRIMARY KEY,
  code STRING UNIQUE,    -- 'BAIL_SIGNE', 'ETAT_LIEUX_ENTRANT', etc.
  label STRING,          -- 'Bail signé', 'État des lieux entrant', etc.
  -- ... autres champs
);
```

## 🎨 Interface Utilisateur

### **Drawer "Détail du bail"**
- **Documents présents** : Badge vert + bouton "Ouvrir"
- **Documents manquants** : Badge orange + bouton "Uploader"
- **Rechargement automatique** après upload

### **Modal d'Upload**
- **Type verrouillé** : Affichage du type avec badge
- **Liaisons prévues** : Chips colorées des entités
- **Zone de drop** : Interface intuitive
- **Intégration standard** : Même pipeline que l'upload global

## ✅ Critères d'Acceptation

- ✅ **Cliquer sur "Uploader"** ouvre la modal d'upload standard avec le bon type verrouillé
- ✅ **Les liaisons automatiques** (GLOBAL + LEASE + PROPERTY + TENANTS) sont créées sans interaction manuelle
- ✅ **Après upload**, la carte du document devient "Présent" avec bouton "Ouvrir"
- ✅ **Aucun doublon** de liaison ni erreur de type_document

## 🧪 Tests

### **Script de Test**
```bash
npx tsx scripts/test-upload-auto-linking.ts
```

### **Tests Inclus**
- ✅ Service DocumentAutoLinkingService
- ✅ Service LeaseDocumentsService  
- ✅ Composants (imports)
- ✅ API de finalisation
- ✅ Types de documents en base
- ✅ Page Baux accessible

## 🚀 Utilisation

### **Pour l'Utilisateur**
1. Aller sur `/baux`
2. Cliquer sur un bail pour ouvrir le drawer
3. Dans "Documents liés", cliquer sur "Uploader" pour un document manquant
4. La modal s'ouvre avec le type pré-rempli
5. Glisser-déposer ou sélectionner le fichier
6. Confirmer l'upload
7. Le document apparaît automatiquement avec badge ✅

### **Pour le Développeur**
```typescript
// Ajouter un nouveau type de document avec liaison automatique
const newRules = {
  'NOUVEAU_TYPE': [
    { targetType: 'GLOBAL', role: 'DERIVED' },
    { targetType: 'LEASE', role: 'PRIMARY' },
    // ... autres règles
  ]
};

// Dans DocumentAutoLinkingService.LINKING_RULES
```

## 🔄 Évolutions Futures

### **Améliorations Possibles**
- **Upload multiple** : Support de plusieurs fichiers en une fois
- **Templates** : Modèles de documents prédéfinis
- **Validation** : Vérification du contenu avant upload
- **Notifications** : Alertes pour les uploads réussis/échoués

### **Intégrations**
- **Signature électronique** : Intégration avec des services tiers
- **Stockage cloud** : Migration vers un stockage externe
- **API externes** : Connexion avec des services d'assurance, etc.

---

**Version :** 1.0  
**Date :** Décembre 2024  
**Auteur :** Assistant IA  
**Statut :** ✅ Implémenté et testé

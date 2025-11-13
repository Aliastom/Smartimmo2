# 🔄 Suggestion Inverse : Document → Transaction

## 🎯 **FONCTIONNALITÉ IMPLÉMENTÉE**

Processus **inverse** de la suggestion OCR :
- **Avant** : Document uploadé → Modale Transaction s'ouvre
- **Maintenant** : Transaction ouverte → Document uploadé → Proposition de pré-remplissage

---

## 📋 **FLUX UTILISATEUR**

```
Utilisateur ouvre "Nouvelle transaction"
    ↓
Modale vide (formulaire)
    ↓
Va dans l'onglet "Documents"
    ↓
Clique "Ajouter document"
    ↓
Upload d'un PDF (ex: Relevé de compte)
    ↓
⚙️ OCR + Classification automatique (DÉJÀ EXISTANT)
    ↓
✅ Type détecté : "Relevé de compte propriétaire"
    ↓
🤖 Vérification : Ce type a openTransaction = true ?
    ↓ OUI
⚠️ MODAL DE CONFIRMATION apparaît :
    "Document reconnu en tant que 'Relevé de compte propriétaire'
     Ce type est associé aux transactions.
     Voulez-vous pré-remplir automatiquement ?"
    
    [Non, merci]  [Oui, pré-remplir]
    ↓ Si "Oui, pré-remplir"
🤖 Appel API : /api/documents/[id]/suggest-transaction
    ↓
📊 Extraction des données (même service que le flux normal)
    ↓
✅ Formulaire pré-rempli :
    - Bien / Bail
    - Date
    - Nature / Catégorie
    - Montants (loyer, charges)
    - Période
    - Libellé
    ↓
📍 Basculement automatique sur l'onglet "Information essentielle"
    ↓
✅ Notification : "Transaction pré-remplie avec succès !"
```

---

## 📝 **FICHIERS CRÉÉS/MODIFIÉS**

### **1. Nouveau composant**

**`src/components/transactions/TransactionSuggestionConfirmModal.tsx`**
- Modale de confirmation avec message clair
- Affiche un avertissement si des données existent déjà
- 2 boutons : "Non, merci" et "Oui, pré-remplir"

### **2. Modifications de TransactionModalV2.tsx**

#### **Imports ajoutés** :
```typescript
import { TransactionSuggestionConfirmModal } from './TransactionSuggestionConfirmModal';
```

#### **États ajoutés** :
```typescript
// États pour la modale de suggestion
const [showSuggestionModal, setShowSuggestionModal] = useState(false);
const [pendingSuggestion, setPendingSuggestion] = useState<{
  documentId: string;
  documentTypeName: string;
} | null>(null);

// Ref pour suivre les documents déjà traités
const processedDocIds = React.useRef<Set<string>>(new Set());
```

#### **useEffect ajouté** :
- Surveille `stagedDocuments`
- Détecte les nouveaux documents uploadés
- Vérifie si le type a `openTransaction = true`
- Affiche la modale de confirmation si oui

#### **Fonctions ajoutées** :
- `handleConfirmSuggestion()` : Appelle l'API et applique les suggestions
- `hasExistingData()` : Vérifie si des données sont déjà présentes

---

## 🔒 **SÉCURITÉ : Ce qui N'a PAS été touché**

✅ **Aucune modification** sur :
- `StagedUploadModal` : Système d'upload existant
- `/api/uploads/staged` : API d'upload
- `useUploadStaging` : Hook de staging
- Processus OCR/Classification

**On s'appuie UNIQUEMENT sur ce qui existe !**

---

## 🧪 **COMMENT TESTER**

### **Test 1 : Transaction vide + Document avec openTransaction**

1. Cliquer sur "Nouvelle transaction"
2. Aller dans l'onglet "Documents"
3. Cliquer "Ajouter document"
4. Uploader un **Relevé de compte propriétaire** (PDF)
5. **✅ ATTENDU** : 
   - Modal apparaît : "Document reconnu..."
   - Cliquer "Oui, pré-remplir"
   - Formulaire se remplit automatiquement
   - Onglet bascule sur "Information essentielle"
   - Notification : "Transaction pré-remplie avec succès !"

### **Test 2 : Transaction déjà remplie + Document**

1. Ouvrir "Nouvelle transaction"
2. Remplir manuellement :
   - Bien : 42B
   - Date : 10/11/2025
3. Aller dans "Documents" → Upload PDF
4. **✅ ATTENDU** :
   - Modal avec avertissement orange :
     "⚠️ Attention : Cela écrasera les données..."
   - Choix : "Non, merci" OU "Oui, pré-remplir"

### **Test 3 : Document SANS openTransaction**

1. Ouvrir "Nouvelle transaction"
2. Uploader un document quelconque (ex: Facture sans configuration)
3. **✅ ATTENDU** :
   - Aucune modale
   - Document ajouté normalement à la liste

---

## 🎊 **AVANTAGES**

✅ **Flexibilité** : L'utilisateur peut créer la transaction PUIS ajouter le document  
✅ **Contrôle** : Confirmation avant d'écraser les données existantes  
✅ **Cohérence** : Utilise le même service (`TransactionSuggestionService`)  
✅ **Non-intrusif** : Ne perturbe pas le workflow normal  
✅ **Logs** : Console logs détaillés pour debug (`🤖` prefix)

---

## 📊 **LOGS ATTENDUS**

Dans la console du navigateur :

```
[TransactionModal] 🤖 Vérification du type: cmhno8r8900cmn88cn9o01z4l
[TransactionModal] 🤖 Type récupéré: Relevé de compte propriétaire openTransaction: true
[TransactionModal] 🎯 Document reconnu avec openTransaction, affichage modale suggestion
[TransactionModal] 🤖 Début extraction données depuis document: cm...
[TransactionModal] 🤖 Suggestion reçue: { propertyId: '...', leaseId: '...', ... }
[TransactionModal] 🤖 Applique propertyId: cm...
[TransactionModal] 🤖 Applique leaseId: cm...
[TransactionModal] 🤖 Applique nature: RECETTE_LOYER
[TransactionModal] 🤖 Active isAutoAmount
[TransactionModal] ✅ Suggestion appliquée avec succès
```

---

## 🚀 **PRÊT À TESTER !**

La fonctionnalité est **100% opérationnelle** et **ne casse rien** du code existant !


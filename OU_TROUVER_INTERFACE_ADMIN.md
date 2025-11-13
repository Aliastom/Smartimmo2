# 📍 Où trouver l'interface admin OCR ?

## 🎯 C'est intégré dans votre admin existant !

L'interface de configuration OCR → Transaction est maintenant **intégrée directement** dans votre modale d'édition de types de documents.

---

## 📍 **Accès**

### Étape 1 : Aller dans l'admin des types de documents

```
🏠 Menu → Admin → Types de documents
OU
URL directe : /admin/documents/types
```

### Étape 2 : Modifier un type de document

1. Cliquez sur n'importe quel type de document dans la liste
2. La modale "Modifier le type de document" s'ouvre

### Étape 3 : Scroller jusqu'à la nouvelle section

Vous verrez une nouvelle carte (Card) avec :

```
┌──────────────────────────────────────────────┐
│ 🤖 Extraction automatique OCR → Transaction  │
├──────────────────────────────────────────────┤
│                                              │
│ Configurez les regex et mappings pour       │
│ suggérer automatiquement des transactions... │
│                                              │
│ [État de la configuration]                  │
│                                              │
└──────────────────────────────────────────────┘
```

---

## 🎨 **Interface visible selon l'état**

### Si NON configuré

```
┌──────────────────────────────────────────────┐
│ 🤖 Configuration OCR → Transaction          │
├──────────────────────────────────────────────┤
│ ⚠️ Pas encore configuré                     │
│                                              │
│ Démarrer depuis un template :                │
│ [📄 Relevé]  [🧾 Facture]  [📋 Quittance]   │
│                                              │
│       [⚙️ Configurer manuellement]          │
└──────────────────────────────────────────────┘
```

### Si configuré

```
┌──────────────────────────────────────────────┐
│ 🤖 Configuration OCR → Transaction     ✅    │
├──────────────────────────────────────────────┤
│ Champs extraits :                            │
│ [periode] [montant] [bien] [reference]      │
│                                              │
│ Template : "Loyer {periode} - {bien}"       │
│ Seuil : 0.6                                  │
│                                              │
│       [⚙️ Modifier la configuration]         │
└──────────────────────────────────────────────┘
```

---

## 🚀 **Utilisation rapide**

### Pour configurer un nouveau type

1. **Ouvrir** : Admin → Types de documents → Cliquer sur un type
2. **Scroller** : Descendre jusqu'à "Extraction automatique OCR"
3. **Template** : Cliquer sur un template (Relevé, Facture, Quittance)
4. **Sauvegarder** : Les champs se remplissent automatiquement
5. **✅ C'est tout !**

### Pour un type personnalisé

1. Cliquer sur "⚙️ Configurer manuellement"
2. **Onglet Regex** : Ajouter vos champs (montant, période, bien...)
3. **Onglet Mapping** : Associer natures → catégories
4. **Onglet Avancé** : Ajuster le seuil de confiance
5. Cliquer sur "✓ Enregistrer"

---

## 📋 **Fichiers créés**

| Fichier | Description |
|---------|-------------|
| `src/components/admin/DocumentTypeOCRConfig.tsx` | ✅ Composant d'interface |
| `src/app/api/admin/document-types/[id]/ocr-config/route.ts` | ✅ API de sauvegarde |
| `src/app/admin/documents/types/DocumentTypeEditModal.tsx` | ✅ Modifié (intégration) |

---

## ⚠️ **Important**

L'interface apparaît **SEULEMENT en mode édition** (pas en mode création).

**Pourquoi ?** Car il faut que le type existe en base de données avant de pouvoir le configurer.

**Workflow recommandé** :
1. Créer le type de document (nom, code, mots-clés)
2. Sauvegarder
3. Ré-ouvrir le type en édition
4. Configurer OCR → Transaction
5. Sauvegarder à nouveau

---

## 🎯 **Exemple concret**

### 1. Créer un type "Facture EDF"

```
Admin → Types de documents → Nouveau
Code: FACTURE_EDF
Label: Facture EDF
[Sauvegarder]
```

### 2. Configurer l'extraction

```
Cliquer sur "Facture EDF" dans la liste
Scroller jusqu'à "Extraction automatique OCR"
Cliquer sur "🧾 Facture" (template)
[Sauvegarder]
```

### 3. Tester

```
Documents → Uploader une facture EDF
✅ Type détecté automatiquement
✅ Modale de transaction s'ouvre
✅ Champs pré-remplis
```

---

## 📸 **Capture d'écran de l'emplacement**

```
Page Admin Types de Documents
├── Liste des types (gauche)
│   ├── QUITTANCE
│   ├── RELEVE_COMPTE_PROP  ← Cliquer ici
│   └── ...
│
└── Modale "Modifier le type"
    ├── Informations de base
    ├── Configuration avancée (JSON)
    ├── 🤖 NOUVEAU : Extraction automatique OCR ← ICI !
    └── Aperçu en temps réel
```

---

## ✅ **C'est prêt !**

L'interface est **déjà intégrée** dans votre admin.

**Pour la voir** :
1. Aller sur `/admin/documents/types`
2. Cliquer sur "RELEVE_COMPTE_PROP" (ou n'importe quel type)
3. Scroller vers le bas
4. **Vous verrez la nouvelle section avec l'icône 🤖**

---

**Version** : 1.0  
**Fichier source** : `src/components/admin/DocumentTypeOCRConfig.tsx`  
**Intégration** : `src/app/admin/documents/types/DocumentTypeEditModal.tsx`


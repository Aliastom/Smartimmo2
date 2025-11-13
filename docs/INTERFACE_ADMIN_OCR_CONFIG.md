# Interface Admin de Configuration OCR

## 🎯 Vue d'ensemble

L'interface admin permet de configurer visuellement les types de documents pour l'extraction automatique OCR → Transaction, **sans avoir à éditer de fichiers SQL ou rejouer des scripts**.

---

## 📦 Composants

### DocumentTypeOCRConfig

Composant React pour configurer un type de document.

**Props** :
```typescript
interface DocumentTypeOCRConfigProps {
  documentType: any;      // Type de document à configurer
  onUpdate?: () => void;  // Callback après sauvegarde
}
```

**Utilisation** :
```tsx
import { DocumentTypeOCRConfig } from '@/components/admin/DocumentTypeOCRConfig';

<DocumentTypeOCRConfig 
  documentType={documentType}
  onUpdate={refetch}
/>
```

---

## 🚀 Intégration

### Étape 1 : Ajouter dans votre page admin

Fichier : `src/app/admin/documents/types/[id]/page.tsx`

```tsx
import { DocumentTypeOCRConfig } from '@/components/admin/DocumentTypeOCRConfig';

export default function DocumentTypeDetailPage({ params }: { params: { id: string } }) {
  const { data: documentType, refetch } = useQuery(...);

  return (
    <div className="space-y-6">
      {/* Informations générales */}
      <Card>...</Card>

      {/* Configuration OCR */}
      <DocumentTypeOCRConfig 
        documentType={documentType}
        onUpdate={refetch}
      />

      {/* Mots-clés */}
      <Card>...</Card>
    </div>
  );
}
```

### Étape 2 : API déjà créée

Les endpoints suivants sont déjà en place :

- **PUT** `/api/admin/document-types/[id]/ocr-config` : Sauvegarder la config
- **GET** `/api/admin/document-types/[id]/ocr-config` : Récupérer la config

---

## 🎨 Fonctionnalités

### 1. État non configuré

Quand un type n'a pas de configuration OCR :

```
┌─────────────────────────────────────┐
│ Configuration OCR → Transaction     │
├─────────────────────────────────────┤
│ ⚠️ Pas encore configuré             │
│                                     │
│ Templates :                         │
│ [📄 Relevé]  [🧾 Facture]  [📋 Quittance] │
│                                     │
│ [⚙️ Configurer manuellement]       │
└─────────────────────────────────────┘
```

### 2. Templates prédéfinis

Cliquer sur un template pré-remplit :
- Les regex d'extraction
- Le template de libellé
- Le mapping nature → catégorie

**Exemple : Relevé de compte**
```javascript
Regex :
- periode: (janvier|février|...) ?(20\d{2})
- montant: ([0-9]+[\.,][0-9]{2}) ?€?
- bien: (Appartement|Maison|Studio) ?([A-Z0-9]+)?

Template :
- "Loyer {periode} - {bien}"

Mapping :
- RECETTE_LOYER → "Loyer + Charges"
```

### 3. Configuration manuelle

**Onglet Regex** :
- Ajouter/supprimer des champs
- Entrer les patterns regex
- Définir le template de libellé

**Onglet Mapping** :
- Associer natures et catégories
- Ajouter/supprimer des mappings

**Onglet Avancé** :
- Seuil de confiance (0-1)

### 4. État configuré

Quand un type est configuré :

```
┌─────────────────────────────────────┐
│ Configuration OCR → Transaction ✅  │
├─────────────────────────────────────┤
│ Champs extraits :                   │
│ [periode] [montant] [bien]         │
│                                     │
│ Template :                          │
│ "Loyer {periode} - {bien}"         │
│                                     │
│ Seuil : 0.6                        │
│                                     │
│ [⚙️ Modifier la configuration]     │
└─────────────────────────────────────┘
```

---

## 📖 Guide d'utilisation

### Cas 1 : Nouveau type de document

1. Créer le type via l'interface admin
2. Ajouter les mots-clés de reconnaissance
3. **Cliquer sur un template OU configurer manuellement**
4. Sauvegarder
5. ✅ Tester avec un document

### Cas 2 : Type existant à configurer

1. Ouvrir le type dans l'admin
2. Scroller jusqu'à "Configuration OCR"
3. Cliquer sur "Configurer manuellement"
4. Remplir les champs
5. Sauvegarder
6. ✅ Tester

### Cas 3 : Modifier une configuration

1. Ouvrir le type configuré
2. Cliquer sur "Modifier la configuration"
3. Ajuster les regex/mappings
4. Sauvegarder
5. ✅ Re-tester

---

## 🔧 Exemples de regex

### Montant

```regex
Pattern : ([0-9]+[\.,][0-9]{2}) ?€?
Texte   : "Montant : 850,00 €"
Extrait : "850,00"
```

### Période (texte)

```regex
Pattern : (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) ?(20\d{2})
Texte   : "Période : Janvier 2024"
Extrait : "Janvier 2024"
```

### Période (numérique)

```regex
Pattern : ([0-9]{2}/[0-9]{4})
Texte   : "Période : 01/2024"
Extrait : "01/2024"
```

### Date

```regex
Pattern : ([0-9]{1,2}[/\-][0-9]{1,2}[/\-][0-9]{4})
Texte   : "Date : 15/01/2024"
Extrait : "15/01/2024"
```

### Référence

```regex
Pattern : Réf[érence\.:]*\s?([A-Z0-9\-]+)
Texte   : "Réf: ABC-2024-001"
Extrait : "ABC-2024-001"
```

### Bien immobilier

```regex
Pattern : (Appartement|Maison|Studio|T[0-9]|F[0-9]|Lot)\s?([A-Z0-9\-]+)?
Texte   : "Appartement T3 - Lot A12"
Extrait : "Appartement T3"
```

---

## ⚙️ API Reference

### PUT /api/admin/document-types/[id]/ocr-config

**Body** :
```json
{
  "suggestionsConfig": "{\"regex\":{...},\"libelleTemplate\":\"...\"}",
  "defaultContexts": "{\"natureCategorieMap\":{...}}",
  "metaSchema": "{\"confidenceThreshold\":0.6,...}"
}
```

**Response** :
```json
{
  "success": true,
  "data": {
    "id": "...",
    "code": "...",
    "suggestionsConfig": "..."
  }
}
```

### GET /api/admin/document-types/[id]/ocr-config

**Response** :
```json
{
  "success": true,
  "data": {
    "id": "...",
    "code": "...",
    "suggestionsConfig": "...",
    "defaultContexts": "...",
    "metaSchema": "..."
  }
}
```

---

## 🎯 Avantages

| Fonctionnalité | Bénéfice |
|----------------|----------|
| Interface visuelle | Pas besoin de connaître JSON/SQL |
| Templates prédéfinis | Configuration en 1 clic |
| Sauvegarde instantanée | Pas de script à rejouer |
| Validation | Moins d'erreurs |
| Tests en direct | Tester immédiatement après config |

---

## 📝 Notes

### Validation

Le composant valide :
- Que les noms de champs sont uniques
- Que les patterns regex sont valides
- Que le seuil est entre 0 et 1

### Sécurité

- L'API vérifie l'existence du type
- Les regex sont stockées en tant que strings
- Aucune exécution de code arbitraire

### Performance

- Sauvegarde asynchrone
- Pas de rechargement de page
- Mise à jour en temps réel

---

## 🚀 Prochaines améliorations

- [ ] Test de regex en temps réel sur texte exemple
- [ ] Prévisualisation de l'extraction
- [ ] Import/export de configurations
- [ ] Historique des modifications
- [ ] Duplication de configurations

---

**Version** : 1.0  
**Date** : Novembre 2024


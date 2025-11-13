# Fix : Prédictions cliquables malgré le type de document verrouillé

## 🐛 Problème

Lors de l'upload d'un **bail signé**, le type de document est censé être **verrouillé** et **non modifiable** (affiché avec "Non modifiable" et un champ grisé).

Cependant, même si le champ select était désactivé, l'utilisateur pouvait **quand même changer le type de document** en cliquant sur les badges de **prédictions** (par exemple : "Facture de travaux: 16%", "Facture: 9%", etc.).

### Scénario du bug

1. Utilisateur dans l'onglet "Baux" → Upload d'un bail signé
2. Modal "Revue de l'upload" s'ouvre
3. Type de document affiché : **"Bail signé"** avec mention **"Non modifiable"**
4. Le champ select est **grisé et désactivé** ✅
5. MAIS : L'utilisateur clique sur le badge **"Facture de travaux: 16%"** dans la section "Prédictions"
6. ❌ **Le type change vers "Facture de travaux"** malgré le verrouillage

## 🔍 Cause racine

Les badges de prédictions avaient un `onClick` actif qui appelait `setSelectedType(pred.typeCode)` **sans vérifier** si le type était verrouillé.

```typescript
// ❌ Code buggé (AVANT)
<Badge
  className="cursor-pointer hover:bg-blue-600"
  onClick={() => setSelectedType(pred.typeCode)}  // Toujours actif !
>
  {pred.label}: {Math.round((pred.score || 0) * 100)}%
</Badge>
```

## ✅ Solution

### 1. Vérifier si le type est verrouillé

Ajout d'une variable `isTypeLocked` pour déterminer si le type de document est verrouillé :

```typescript
const isTypeLocked = autoLinkingDocumentType && !documentTypeEditable;
```

**Conditions du verrouillage** :
- `autoLinkingDocumentType` est défini (ex: `'BAIL_SIGNE'`)
- **ET** `documentTypeEditable` est `false`

### 2. Désactiver le onClick conditionnellement

```typescript
// ✅ Code corrigé (APRÈS)
<Badge
  className={
    isTypeLocked 
      ? 'opacity-50 cursor-not-allowed'  // Badge grisé et non cliquable
      : 'cursor-pointer hover:bg-blue-600'  // Badge normal
  }
  onClick={() => {
    if (!isTypeLocked) {  // Vérification avant action
      setSelectedType(pred.typeCode);
    }
  }}
>
  {pred.label}: {Math.round((pred.score || 0) * 100)}%
</Badge>
```

### 3. Ajouter un message explicatif

Pour améliorer l'UX, ajout d'un message sous le titre "Prédictions" quand le type est verrouillé :

```typescript
{isTypeLocked && (
  <p className="text-xs text-gray-500 mt-1">
    Les prédictions sont désactivées car le type de document est verrouillé
  </p>
)}
```

## 📁 Fichiers modifiés

### `src/components/documents/UploadReviewModal.tsx`

Deux sections de prédictions ont été corrigées :

#### Section 1 : Prédictions avec `currentPreview.predictions` (ligne ~1590)

**Avant** :
```typescript
{predictions.map((pred, idx) => (
  <Badge
    className="cursor-pointer hover:bg-blue-600"
    onClick={() => setSelectedType(pred.typeCode)}
  >
    {pred.label}: {Math.round((pred.score || 0) * 100)}%
  </Badge>
))}
```

**Après** :
```typescript
const isTypeLocked = autoLinkingDocumentType && !documentTypeEditable;

{predictions.map((pred, idx) => (
  <Badge
    className={
      isTypeLocked 
        ? 'opacity-50 cursor-not-allowed' 
        : 'cursor-pointer hover:bg-blue-600'
    }
    onClick={() => {
      if (!isTypeLocked) {
        setSelectedType(pred.typeCode);
      }
    }}
  >
    {pred.label}: {Math.round((pred.score || 0) * 100)}%
  </Badge>
))}
```

#### Section 2 : Prédictions avec `draftData.predictions` (ligne ~1319)

Même correction appliquée, avec en bonus l'ajout du badge "Type pré-rempli" et "Non modifiable" qui n'étaient pas affichés dans cette section.

**Avant** :
```typescript
<select
  value={selectedType}
  onChange={(e) => setSelectedType(e.target.value)}
  className="w-full px-3 py-2 border..."
>
  {/* options */}
</select>
```

**Après** :
```typescript
<select
  value={selectedType}
  onChange={(e) => setSelectedType(e.target.value)}
  className={`w-full px-3 py-2 border... ${
    autoLinkingDocumentType && !documentTypeEditable 
      ? 'bg-gray-100 text-gray-600 cursor-not-allowed' 
      : ''
  }`}
  disabled={autoLinkingDocumentType && !documentTypeEditable}
>
  {/* options */}
</select>
{autoLinkingDocumentType && !documentTypeEditable && (
  <div className="flex items-center gap-2">
    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
      <FileText className="h-4 w-4 mr-1" />
      Type pré-rempli: {documentTypes.find(t => t.code === autoLinkingDocumentType)?.label}
    </Badge>
    <span className="text-sm text-gray-500">Non modifiable</span>
  </div>
)}
```

## 🎨 Changements visuels

### Avant (buggé)

**Badge de prédiction** :
- ✅ Couleur normale (vert/gris)
- ✅ Curseur pointeur (`cursor-pointer`)
- ✅ Effet hover bleu
- ❌ **Cliquable et change le type malgré le verrouillage**

### Après (corrigé)

**Badge de prédiction quand verrouillé** :
- 🔒 Opacité réduite (`opacity-50`)
- 🔒 Curseur "interdit" (`cursor-not-allowed`)
- 🔒 Pas d'effet hover
- 🔒 **onClick ne fait rien**
- ℹ️ Message explicatif : "Les prédictions sont désactivées car le type de document est verrouillé"

**Badge de prédiction quand non verrouillé** :
- ✅ Comportement normal inchangé

## 🔐 Logique de verrouillage

### Quand le type de document est-il verrouillé ?

| Contexte | `autoLinkingDocumentType` | `documentTypeEditable` | Verrouillé ? |
|----------|---------------------------|------------------------|--------------|
| Upload bail signé | `'BAIL_SIGNE'` | `false` | ✅ OUI |
| Upload depuis page bien | `'FACTURE'` | `false` | ✅ OUI |
| Upload libre | `undefined` | `true` | ❌ NON |
| Upload avec suggestion | `'QUITTANCE'` | `true` | ❌ NON |

### Éléments affectés par le verrouillage

1. **Champ select** (Type de document) :
   - `disabled={true}`
   - Style grisé
   - ✅ Déjà fonctionnel avant le fix

2. **Badges de prédiction** :
   - `onClick` désactivé
   - Style grisé
   - Message explicatif
   - ✅ **Nouvellement corrigé**

3. **Badge "Type pré-rempli"** :
   - Affiché uniquement si verrouillé
   - ✅ Déjà fonctionnel (section 1), ajouté dans section 2

## 📋 Tests effectués

### Cas de test 1 : Upload bail signé depuis onglet "Baux"

1. ✅ Type pré-rempli à "Bail signé"
2. ✅ Champ select désactivé et grisé
3. ✅ Badge "Type pré-rempli: Bail signé" affiché
4. ✅ Message "Non modifiable" affiché
5. ✅ **Badges de prédiction grisés**
6. ✅ **Clic sur badge de prédiction : aucun effet**
7. ✅ Message "Les prédictions sont désactivées car le type de document est verrouillé"

### Cas de test 2 : Upload libre depuis page "Documents"

1. ✅ Pas de type pré-rempli
2. ✅ Champ select actif
3. ✅ Pas de badge "Type pré-rempli"
4. ✅ **Badges de prédiction cliquables**
5. ✅ **Clic sur badge de prédiction : change le type correctement**

### Cas de test 3 : Upload depuis page "Bien" avec contexte

1. ✅ Type pré-rempli selon le contexte
2. ✅ Champ select désactivé
3. ✅ **Badges de prédiction grisés**
4. ✅ **Clic sur badge de prédiction : aucun effet**

## 🔄 Comportement attendu

### Scénario utilisateur corrigé

1. Utilisateur upload un bail signé depuis l'onglet "Baux"
2. Modal "Revue de l'upload" s'ouvre
3. Type de document : **"Bail signé"** avec "Non modifiable"
4. Champ select : **grisé et désactivé** ✅
5. Badges de prédiction : **grisés avec opacité 50%** ✅
6. Message : "Les prédictions sont désactivées car le type de document est verrouillé" ✅
7. Utilisateur clique sur "Facture de travaux: 16%"
8. ✅ **Aucun changement, le type reste "Bail signé"**
9. Utilisateur clique sur "Enregistrer"
10. ✅ **Le document est enregistré avec le type "Bail signé"**

## 💡 Améliorations apportées

1. **Sécurité** : Le type de document verrouillé ne peut plus être modifié par aucun moyen (ni select, ni prédictions)
2. **Cohérence** : Le verrouillage est maintenant complet (select + prédictions)
3. **UX** : Message explicatif clair pour l'utilisateur
4. **Visuel** : Badges grisés avec curseur "interdit" pour indiquer clairement qu'ils ne sont pas cliquables
5. **Uniformité** : Les deux sections de prédictions ont le même comportement

## 🎓 Apprentissage

### Bonne pratique : Désactivation complète d'une fonctionnalité

Quand une fonctionnalité doit être désactivée (ici : changement de type), il faut :

1. **Désactiver visuellement** : `opacity-50`, `cursor-not-allowed`
2. **Désactiver fonctionnellement** : Vérifier dans le `onClick` avant toute action
3. **Informer l'utilisateur** : Message explicatif clair
4. **Être exhaustif** : Vérifier tous les points d'entrée (select, badges, raccourcis clavier, etc.)

### Anti-pattern évité

```typescript
// ❌ MAL : Désactiver visuellement mais pas fonctionnellement
<Badge className="opacity-50" onClick={() => doAction()} />

// ✅ BIEN : Désactiver les deux
<Badge 
  className="opacity-50 cursor-not-allowed" 
  onClick={() => { if (!disabled) doAction(); }} 
/>
```

---

**Date de correction** : 27/10/2025  
**Version** : 1.0  
**Statut** : ✅ Corrigé et testé


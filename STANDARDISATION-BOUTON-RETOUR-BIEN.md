# STANDARDISATION DU BOUTON "RETOUR AU BIEN"

**Date:** 26 octobre 2025  
**Objectif:** Uniformiser le style du bouton "Retour au bien" sur toutes les pages

---

## 🎯 PROBLÈME

Les pages de détail d'un bien (Transactions, Documents, Baux, etc.) utilisaient des styles différents pour le bouton "Retour au bien" :

### Avant ❌

**Page Transactions:**
```tsx
<Button variant="ghost" size="sm">
  <ArrowLeft /> Retour au bien
</Button>
```
→ Bouton transparent (ghost), petit (sm)

**Page Documents:**
```tsx
<Button variant="outline" className="flex items-center gap-1.5">
  <ArrowLeft /> <span>Retour au bien</span>
</Button>
```
→ Bouton avec bordure (outline), taille normale

**Résultat:** Incohérence visuelle entre les pages

---

## ✅ SOLUTION

Standardisation via le composant `BackToPropertyButton` avec le style de la page Documents.

**Fichier:** `src/components/shared/BackToPropertyButton.tsx`

### Avant
```tsx
export function BackToPropertyButton({ propertyId, propertyName, className }) {
  return (
    <Link href={`/biens/${propertyId}`}>
      <Button
        variant="ghost"      // ❌ Transparent
        size="sm"            // ❌ Petit
        className={cn('gap-2', className)}
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au bien
      </Button>
    </Link>
  );
}
```

### Après
```tsx
export function BackToPropertyButton({ propertyId, propertyName, className }) {
  return (
    <Link href={`/biens/${propertyId}`}>
      <Button
        variant="outline"    // ✅ Avec bordure
        className={cn('flex items-center gap-1.5 whitespace-nowrap', className)} // ✅ Taille normale
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Retour au bien</span>
      </Button>
    </Link>
  );
}
```

### Changements appliqués
- ✅ `variant="ghost"` → `variant="outline"` : Bouton avec bordure visible
- ✅ `size="sm"` supprimé : Taille normale comme les autres boutons d'action
- ✅ `gap-2` → `gap-1.5` : Espace réduit entre icône et texte
- ✅ Ajout de `whitespace-nowrap` : Empêche le retour à la ligne
- ✅ Texte encapsulé dans `<span>` : Structure sémantique

---

## 📊 IMPACT

Le composant `BackToPropertyButton` est utilisé dans :

### 1. Page Transactions d'un bien
**Route:** `/biens/[id]/transactions`
**Fichier:** `src/app/biens/[id]/transactions/PropertyTransactionsClient.tsx`
```tsx
<BackToPropertyButton 
  propertyId={propertyId} 
  propertyName={propertyName}
/>
```
✅ Mis à jour automatiquement

### 2. Page Documents d'un bien
**Route:** `/biens/[id]/documents`
**Fichier:** `src/app/biens/[id]/documents/PropertyDocumentsClient.tsx`
```tsx
<BackToPropertyButton 
  propertyId={propertyId} 
  propertyName={propertyName}
/>
```
✅ Mis à jour automatiquement

### 3. Autres onglets du bien
**Fichier:** `src/app/biens/[id]/PropertyDetailClient.tsx`
**Onglets concernés:**
- Photos
- Rentabilité
- Paramètres
- Baux (si utilise BackToPropertyButton)

✅ Tous mis à jour automatiquement via le composant partagé

---

## 🎨 STYLE FINAL

### Apparence du bouton
```
┌─────────────────────────┐
│ ← Retour au bien        │  ← Bordure grise visible
└─────────────────────────┘
```

**Propriétés visuelles:**
- Variant: `outline` (bordure grise)
- Background: Blanc
- Text: Gris foncé
- Hover: Fond gris clair
- Icône: Flèche gauche (ArrowLeft)
- Gap: 1.5 (6px) entre icône et texte
- No wrap: Le texte ne passe jamais à la ligne

---

## 🔄 COHÉRENCE GLOBALE

### Actions dans le header des pages de bien

**Toutes les pages de détail d'un bien ont maintenant le même pattern:**

```tsx
<SectionTitle
  title={`[Section] - ${propertyName}`}
  description="Description de la section"
  actions={
    <div className="flex items-center gap-2">
      <BackToPropertyButton 
        propertyId={propertyId} 
        propertyName={propertyName}
      />
      <Button onClick={handleAction}>
        <Icon className="h-4 w-4 mr-2" />
        Action principale
      </Button>
    </div>
  }
/>
```

**Exemples:**

| Page | Bouton retour | Bouton action |
|------|--------------|---------------|
| **Transactions** | BackToPropertyButton | "Nouvelle Transaction" (bleu) |
| **Documents** | BackToPropertyButton | "Uploader" (bleu) |
| **Baux** | BackToPropertyButton | "Nouveau Bail" (bleu) |
| **Photos** | BackToPropertyButton | "Ajouter Photos" (bleu) |

---

## ✅ AVANTAGES

### 1. Cohérence visuelle
✅ Même apparence sur toutes les pages de bien  
✅ L'utilisateur reconnaît immédiatement le bouton de retour  
✅ Style professionnel avec bordure visible

### 2. Maintenabilité
✅ Un seul composant à maintenir (`BackToPropertyButton`)  
✅ Modification en un seul endroit = mise à jour partout  
✅ Code DRY (Don't Repeat Yourself)

### 3. Accessibilité
✅ Aria-label descriptif  
✅ Texte encapsulé dans `<span>` (meilleure structure)  
✅ Navigation au clavier fonctionnelle (Link + Button)

### 4. UX
✅ Texte collé à l'icône (pas d'espace excessif)  
✅ Pas de retour à la ligne sur petit écran  
✅ Toujours visible et identifiable

---

## 📁 FICHIERS MODIFIÉS

1. ✅ `src/components/shared/BackToPropertyButton.tsx`
   - Changement de `variant="ghost"` à `variant="outline"`
   - Suppression de `size="sm"`
   - Ajout de `whitespace-nowrap`
   - Réduction du gap (1.5 au lieu de 2)

2. ✅ `src/app/biens/[id]/documents/PropertyDocumentsClient.tsx`
   - Remplacement du bouton inline par `BackToPropertyButton`
   - Suppression de l'import `ArrowLeft` (plus nécessaire)

---

## 🧪 VALIDATION

### Test visuel
- [ ] Ouvrir `/biens/[id]/documents`
- [ ] Le bouton "Retour au bien" a une bordure grise
- [ ] Le texte est collé à l'icône
- [ ] Ouvrir `/biens/[id]/transactions`
- [ ] Le bouton "Retour au bien" est **identique**

### Test de navigation
- [ ] Cliquer sur "Retour au bien" depuis Documents → Retour à la page du bien
- [ ] Cliquer sur "Retour au bien" depuis Transactions → Retour à la page du bien
- [ ] Navigation fonctionnelle sur toutes les pages

### Test responsive
- [ ] Desktop : Bouton normal, texte sur une ligne
- [ ] Mobile : Bouton normal, texte reste sur une ligne (whitespace-nowrap)

---

**FIN DU DOCUMENT** ✅


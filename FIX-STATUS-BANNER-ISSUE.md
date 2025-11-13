# ✅ Correction du Bandeau de Statut Orange

## 🐛 Problème Identifié

**Le bandeau orange "Doublon détecté - En attente de décision" était encore visible** même quand DedupFlow était actif.

**Cause :** Ce message venait du **statut du fichier** (`currentPreview.status === 'duplicate_detected'`), pas du bandeau orange de l'ancienne interface.

---

## 🔍 **Diagnostic**

**2 éléments à masquer quand DedupFlow est actif :**

1. ✅ **Bandeau orange** (déjà corrigé) : `currentPreview.duplicate.isDuplicate && !showDedupFlowModal`
2. ❌ **Statut orange** (manquant) : `currentPreview.status === 'duplicate_detected'`

**Le statut `duplicate_detected` est défini quand DedupFlow est déclenché :**
```typescript
setPreviews(prev => prev.map((p, idx) => idx === i ? {
  ...p,
  status: 'duplicate_detected' as const,  // ← Ce statut cause le bandeau orange
  dedupResult: data.dedup
} : p));
```

---

## 🔧 **Solution Appliquée**

**Avant :**
```typescript
{currentPreview.status === 'duplicate_detected' && (
  <>
    <AlertTriangle className="h-4 w-4 text-orange-600" />
    <span className="text-sm text-orange-600">Doublon détecté - En attente de décision</span>
  </>
)}
```

**Après :**
```typescript
{currentPreview.status === 'duplicate_detected' && !showDedupFlowModal && (
  <>
    <AlertTriangle className="h-4 w-4 text-orange-600" />
    <span className="text-sm text-orange-600">Doublon détecté - En attente de décision</span>
  </>
)}
```

---

## 🎯 **Résultat Attendu**

**Maintenant, quand vous uploadez un doublon :**

1. ✅ **Plus de bandeau orange** "Doublon détecté - En attente de décision"
2. ✅ **Une seule modale** (DedupFlow uniquement)
3. ✅ **Interface propre** sans superposition
4. ✅ **Flux unifié** : Seule la modale DedupFlow s'affiche

---

## ✅ **Statut**

**Problème résolu !**

- ✅ **Bandeau orange** masqué quand DedupFlow est actif
- ✅ **Statut orange** masqué quand DedupFlow est actif
- ✅ **Interface unifiée** : Une seule modale visible
- ✅ **Plus de superposition** de modales

**Testez maintenant - une seule modale devrait s'afficher !** 🚀

# 🔍 Test de l'interface admin OCR

## Vérifications à faire

### 1. Scroller dans la modale

La modale d'édition est **scrollable**. Mon composant se trouve :

```
┌────────────────────────────┐
│ Modifier le type           │
├────────────────────────────┤
│ Informations de base       │  ← Vous êtes ici
│ [Code] [Libellé]...        │
│                            │
│ Configuration avancée      │
│ [Masquer] ✓                │
│ [JSON fields...]           │
│                            │
│ ⬇️ SCROLLER VERS LE BAS ⬇️  │
│                            │
│ 🤖 Extraction automatique  │  ← ICI !
│    OCR → Transaction       │
│ [Templates] [Config]       │
│                            │
│ Aperçu en temps réel       │
│                            │
│ [Annuler] [Sauvegarder]    │
└────────────────────────────┘
```

### 2. Vérifier la console (F12)

Ouvrez la console et cherchez des erreurs liées à :
- `DocumentTypeOCRConfig`
- `Card`
- `Wand2`

### 3. Recharger la page

```bash
# Dans le terminal
Ctrl+C
npm run dev
```

Puis réessayez.

---

## 🔧 Alternative : Debug rapide

Si vous ne voyez toujours rien, ajoutez temporairement ceci en haut de la modale pour vérifier :

```tsx
{/* DEBUG */}
{documentType && (
  <div style={{ background: 'yellow', padding: '20px' }}>
    ✅ documentType existe : {documentType.code}
  </div>
)}
```

---

## ✅ Si ça ne fonctionne toujours pas

Je peux créer une **page admin dédiée** séparée :

```
/admin/documents/types/ocr-config
```

Au lieu de l'intégrer dans la modale existante.

**Dites-moi ce que vous voyez !** 🔍


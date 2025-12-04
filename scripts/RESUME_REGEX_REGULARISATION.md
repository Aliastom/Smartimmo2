# 📝 Résumé : Nouvelle regex `regularisation_charges`

## ✅ Problème identifié

La regex actuelle ne capture **pas** "régularisation entretien chaudière" car elle cherche spécifiquement `(?:charges|provision[s]?\s+charges)`.

**Texte du document :**
```
03/09/2025 régularisation entretien chaudière du 17.10.2023 au 31.08.2025 21,08 21,08
```

## 🔧 Solution proposée

### Nouvelle regex (format JSON échappé) :

```json
"regularisation_charges": "(?:régularisation|regularisation)\\s+(?:provision[s]?\\s+)?(?:charges|entretien\\s+chaudière|entretien\\s+chaudiere).*?(?<!\\d)(\\d{1,3}(?:[\\s,]\\d{3})*,\\d{2})\\s*(\\d{1,3}(?:[\\s,]\\d{3})*,\\d{2})"
```

### Changements :
- ✅ Ajout de `entretien\s+chaudière|entretien\s+chaudiere` dans le groupe optionnel
- ✅ Conserve tous les cas existants (charges, provisions charges)
- ✅ Gère les accents (chaudière/chaudiere)

## 📊 Résultats des tests

### ✅ Cas qui fonctionnent :
1. `régularisation charges` → ✅
2. `régularisation provisions charges` → ✅
3. `régularisation entretien chaudière` (format propre) → ✅
4. `régularisation entretien chaudiere` (sans accent) → ✅

### ⚠️ Cas problématique (OCR collé) :
- `31.08.202521,0821,08` → ❌ Le lookbehind `(?<!\d)` empêche la capture car "21,08" suit "2025"

**Solution pour ce cas :** 
- Option 1 : Améliorer `fixCollidedAmount` pour gérer `202521,08` → `21,08`
- Option 2 : Logique spéciale dans le code pour extraire les deux derniers montants valides
- Option 3 : Accepter que ce cas rare nécessite une correction manuelle

## 🎯 Configuration JSON complète

```json
{
  "regex": {
    "regularisation_charges": "(?:régularisation|regularisation)\\s+(?:provision[s]?\\s+)?(?:charges|entretien\\s+chaudière|entretien\\s+chaudiere).*?(?<!\\d)(\\d{1,3}(?:[\\s,]\\d{3})*,\\d{2})\\s*(\\d{1,3}(?:[\\s,]\\d{3})*,\\d{2})"
  }
}
```

## ✅ Conclusion

La nouvelle regex résout le problème principal (capture "régularisation entretien chaudière") tout en conservant la compatibilité avec tous les cas existants. Le cas OCR collé extrême nécessitera une amélioration de `fixCollidedAmount` ou une logique spéciale, mais c'est un cas rare.



















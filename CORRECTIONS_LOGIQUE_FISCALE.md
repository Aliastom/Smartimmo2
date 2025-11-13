# ✅ Correction Logique Fiscale - Déclaration vs Revenus

**Date** : 2025-11-05  
**Version** : 1.0.3  
**Problème détecté par** : Utilisateur (excellente remarque !)

---

## 🎯 Problème Identifié

### Logique fiscale incorrecte

**Avant** :
- Année fiscale 2025 → Versement PER 2025 ❌
- Reliquats : 2024, 2023, 2022 ❌

**Logique fiscale française correcte** :
- **Déclaration 2025** = Revenus de **2024**
- Versements PER déductibles = ceux de **2024**
- Reliquats disponibles = **2023, 2022, 2021**

---

## ✅ Correction Appliquée

### Fichier : `src/app/impots/simulation/SimulationClient.tsx`

### 1. Variable `anneeRevenus` ajoutée

```typescript
const currentYear = new Date().getFullYear();
const [selectedYear, setSelectedYear] = useState(currentYear);

// Année de revenus = année de déclaration - 1
const anneeRevenus = selectedYear - 1;
```

### 2. Select mis à jour

```typescript
<select value={selectedYear} ...>
  <option value={2024}>Déclaration 2024 (revenus 2023)</option>
  <option value={2025}>Déclaration 2025 (revenus 2024)</option>
  <option value={2026}>Déclaration 2026 (revenus 2025)</option>
</select>

<p className="text-xs text-gray-500 mt-2">
  La déclaration {selectedYear} concerne les revenus de l'année {anneeRevenus}
</p>
```

### 3. Labels PER mis à jour

```typescript
// Versement PER
<Label>Versement total en {anneeRevenus}</Label>
<p className="text-xs">Versements PER effectués pendant l'année {anneeRevenus}</p>

// Reliquats
<Label>Reliquats non utilisés</Label>
<p className="text-xs">
  Plafonds PER non utilisés des 3 années précédentes 
  ({anneeRevenus - 3}, {anneeRevenus - 2}, {anneeRevenus - 1})
</p>

// Champs dynamiques
<Label>Reliquat {anneeRevenus - 1}</Label>
<Label>Reliquat {anneeRevenus - 2}</Label>
<Label>Reliquat {anneeRevenus - 3}</Label>
```

### 4. API appelle avec la bonne année

```typescript
// AVANT
body: JSON.stringify({
  year: selectedYear,  // ❌ Année de déclaration
  ...
})

// APRÈS
body: JSON.stringify({
  year: anneeRevenus,  // ✅ Année de revenus (N-1)
  ...
})
```

---

## 📊 Exemples Concrets

### Exemple 1 : Déclaration 2025

**Sélection** : "Déclaration 2025 (revenus 2024)"

**Formulaire affichera** :
- Versement total en **2024**
- Reliquat **2023**
- Reliquat **2022**
- Reliquat **2021**

**API recevra** : `year: 2024`

**Transactions filtrées** : `accounting_month: { contains: '2024' }`

---

### Exemple 2 : Déclaration 2026

**Sélection** : "Déclaration 2026 (revenus 2025)"

**Formulaire affichera** :
- Versement total en **2025**
- Reliquat **2024**
- Reliquat **2023**
- Reliquat **2022**

**API recevra** : `year: 2025`

**Transactions filtrées** : `accounting_month: { contains: '2025' }`

---

## ✅ Validation

### Cohérence vérifiée

| Déclaration | Revenus | PER | Reliquats | Transactions |
|-------------|---------|-----|-----------|--------------|
| 2024 | 2023 | 2023 | 2022, 2021, 2020 | "2023" |
| 2025 | 2024 | 2024 | 2023, 2022, 2021 | "2024" |
| 2026 | 2025 | 2025 | 2024, 2023, 2022 | "2025" |

### Formule PER

```
Plafond annuel N = max(10% × Revenus pro N, 4 399€)
Reliquats disponibles = Somme(Reliquats N-1, N-2, N-3)
Plafond total = Plafond annuel + Reliquats
Déduction max = min(Versement, Plafond total)
Économie IR = Déduction × TMI
```

---

## 🎯 Impact Utilisateur

### Interface plus claire

**Avant** :
- "Année fiscale : 2025"
- "Versement PER 2025"
- ❌ Ambigu : Déclaration ou revenus ?

**Après** :
- "Année de déclaration : Déclaration 2025 (revenus 2024)"
- "Versement total en 2024"
- ✅ Clair et conforme à la logique fiscale française

### Exactitude fiscale

**Avant** :
- Risque de confusion déclaration/revenus
- PER de la mauvaise année

**Après** :
- ✅ Logique fiscale française respectée
- ✅ PER de l'année de revenus
- ✅ Reliquats des 3 années précédentes aux revenus

---

## 🚀 Testez Maintenant

**Rafraîchissez** : `http://localhost:3000/impots/simulation`

**Exemple de test** :

1. Sélectionnez : **"Déclaration 2025 (revenus 2024)"**
2. Vérifiez que le formulaire PER affiche :
   - "Versement total en **2024**"
   - "Reliquat **2023**"
   - "Reliquat **2022**"
   - "Reliquat **2021**"

3. Vos transactions "Octobre 2025" ne seront **pas** prises en compte (normal, c'est pour la déclaration 2026)

4. Pour voir vos transactions 2025, sélectionnez : **"Déclaration 2026 (revenus 2025)"**

---

## 📝 Note Importante

**Pour tester avec vos transactions actuelles (Octobre 2025)** :

Sélectionnez : **"Déclaration 2026 (revenus 2025)"**

Cela récupérera toutes les transactions avec `accounting_month` contenant "2025" (Octobre 2025, Novembre 2025, etc.)

---

**Version** : 1.0.3  
**Correction** : Logique fiscale déclaration/revenus ✅  
**Impact** : Clarté et exactitude fiscale 🎯


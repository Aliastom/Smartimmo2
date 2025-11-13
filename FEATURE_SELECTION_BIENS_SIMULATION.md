# ✅ Feature : Sélection des biens dans la simulation

## 🎯 **Fonctionnalité demandée**

Permettre à l'utilisateur de **sélectionner/désélectionner** les biens immobiliers depuis l'encart autofill pour **choisir lesquels inclure dans la simulation**.

---

## 🎨 **INTERFACE UTILISATEUR**

### **Encart autofill avec checkboxes** :

```
┌────────────────────────────────────────────────────────┐
│ 🏠 Données récupérées depuis SmartImmo               │
├────────────────────────────────────────────────────────┤
│ 2 bien(s) immobilier(s)    [Tout désélectionner]     │
│                                                        │
│ ┌──────────────────────────────────────────────────┐ │
│ │ ✓ [NU] 42B                           415 €       │ │ ← Sélectionné (vert)
│ └──────────────────────────────────────────────────┘ │
│                                                        │
│ ┌──────────────────────────────────────────────────┐ │
│ │ ☐ [NU] Garage 4                      41,98 €     │ │ ← Désélectionné (gris)
│ └──────────────────────────────────────────────────┘ │
│                                                        │
│ Loyers annuels              Charges annuelles         │
│ 415 €                       27,42 €                   │
│ (1/2 biens sélectionnés)                              │
│                                                        │
│ 💡 Ces données ont été automatiquement récupérées     │
└────────────────────────────────────────────────────────┘
```

---

## 🔧 **MODIFICATIONS TECHNIQUES**

### **1. État de sélection (SimulationClient.tsx)**

```typescript
const [selectedBienIds, setSelectedBienIds] = useState<string[]>([]);

// Initialisation : tout sélectionner par défaut
useEffect(() => {
  if (response.ok) {
    const biens = data.biens || [];
    setAutofillData({ biens, ... });
    setSelectedBienIds(biens.map(b => b.id)); // ✅ Tous sélectionnés
  }
}, []);
```

---

### **2. Fonctions de gestion de sélection**

```typescript
// Toggle un bien individuel
const toggleBienSelection = (bienId: string) => {
  setSelectedBienIds(prev => 
    prev.includes(bienId) 
      ? prev.filter(id => id !== bienId)
      : [...prev, bienId]
  );
};

// Toggle tous les biens
const toggleAllBiens = () => {
  if (selectedBienIds.length === autofillData.biens.length) {
    setSelectedBienIds([]); // Tout désélectionner
  } else {
    setSelectedBienIds(autofillData.biens.map(b => b.id)); // Tout sélectionner
  }
};

// Calculer les totaux des biens sélectionnés
const calculateSelectedTotals = () => {
  const selectedBiens = autofillData.biens.filter(
    b => selectedBienIds.includes(b.id)
  );
  
  return {
    loyers: selectedBiens.reduce((sum, b) => sum + (b.loyers || 0), 0),
    charges: selectedBiens.reduce((sum, b) => sum + (b.charges || 0), 0),
    nombreBiens: selectedBiens.length,
  };
};
```

---

### **3. UI avec checkboxes**

```typescript
{autofillData.biens.map((bien, i) => {
  const isSelected = selectedBienIds.includes(bien.id);
  
  return (
    <div 
      className={`flex items-center gap-2 p-2 rounded border ${
        isSelected 
          ? 'bg-green-100 border-green-300'  // Vert si sélectionné
          : 'bg-gray-50 border-gray-200 opacity-60'  // Gris si désélectionné
      }`}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => toggleBienSelection(bien.id)}
        className="h-4 w-4 text-green-600 border-gray-300 rounded"
      />
      <Badge variant="outline">{bien.type}</Badge>
      <span className={isSelected ? 'font-medium' : 'text-gray-600'}>
        {bien.nom}
      </span>
      <span className={isSelected ? 'text-green-700' : 'text-gray-500'}>
        {bien.loyers.toLocaleString('fr-FR')} €
      </span>
    </div>
  );
})}
```

---

### **4. Bouton "Tout sélectionner/désélectionner"**

```typescript
<button
  onClick={toggleAllBiens}
  className="text-xs text-green-700 hover:text-green-900 underline"
>
  {selectedBienIds.length === autofillData.biens.length 
    ? 'Tout désélectionner' 
    : 'Tout sélectionner'}
</button>
```

---

### **5. Totaux dynamiques**

```typescript
<div>
  <p>Loyers annuels</p>
  <p className="font-semibold">
    {calculateSelectedTotals().loyers.toLocaleString('fr-FR')} €
  </p>
  {selectedBienIds.length < autofillData.biens.length && (
    <p className="text-xs text-green-600">
      ({selectedBienIds.length}/{autofillData.biens.length} biens sélectionnés)
    </p>
  )}
</div>
```

---

### **6. Passage des IDs sélectionnés à l'API**

```typescript
// SimulationClient.tsx - handleSimulate()
const response = await fetch('/api/fiscal/simulate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    year: anneeRevenus,
    foyer,
    per,
    options: { autofill, ... },
    // 🆕 Passer les IDs sélectionnés
    scope: autofill && selectedBienIds.length > 0 ? {
      propertyIds: selectedBienIds,
    } : undefined,
  }),
});
```

---

### **7. Types TypeScript**

```typescript
// src/types/fiscal.ts
export interface FiscalInputs {
  year: TaxYear;
  foyer: HouseholdInfo;
  biens: RentalPropertyInput[];
  per?: PERInput;
  options: { ... };
  
  // 🆕 Scope de l'agrégation
  scope?: {
    propertyIds?: string[];    // Filtrer par IDs de biens spécifiques
    societyIds?: string[];     // Filtrer par IDs de sociétés spécifiques
  };
}
```

---

### **8. API Route (simulate/route.ts)**

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json() as Partial<FiscalInputs>;
  
  const { year, foyer, per, options, scope } = body;
  
  if (options.autofill) {
    const aggregated = await FiscalAggregator.aggregate({
      userId,
      year,
      baseCalcul: options.baseCalcul,
      regimeForce: options.regimeForce,
      scope,  // 🆕 Passer le scope avec propertyIds
    });
    
    inputs = { ...aggregated, foyer, per, options };
  }
  
  // ...
}
```

---

### **9. FiscalAggregator (déjà supporté)**

```typescript
// src/services/tax/FiscalAggregator.ts
interface AggregationOptions {
  userId: string;
  year: TaxYear;
  scope?: {
    propertyIds?: string[];  // ✅ Déjà supporté !
    societyIds?: string[];
  };
  // ...
}

private async getProperties(userId: string, propertyIds?: string[]) {
  const where: any = { isArchived: false };
  
  if (propertyIds && propertyIds.length > 0) {
    where.id = { in: propertyIds };  // ✅ Filtre les biens par IDs
  }
  
  return prisma.property.findMany({ where, ... });
}
```

---

## 🔄 **FLUX COMPLET**

```
1. User ouvre /impots/simulation
   ├─> Toggle autofill ON
   └─> Encart vert apparaît

2. loadAutofillData() récupère 2 biens
   ├─> setAutofillData({ biens: [42B, Garage4], ... })
   └─> setSelectedBienIds(['42B', 'Garage4']) ✅ Tous sélectionnés

3. Encart affiche :
   ├─> ✓ [NU] 42B (415 €) ← Coché, fond vert
   └─> ✓ [NU] Garage 4 (41,98 €) ← Coché, fond vert

4. User déselectionne Garage 4
   ├─> toggleBienSelection('Garage4')
   ├─> setSelectedBienIds(['42B'])
   ├─> calculateSelectedTotals()
   │   └─> { loyers: 415, charges: 27.42, nombreBiens: 1 }
   └─> Encart met à jour :
       ├─> ✓ [NU] 42B (415 €) ← Coché, fond vert
       ├─> ☐ [NU] Garage 4 (41,98 €) ← Décoché, fond gris
       └─> Loyers : 415 € (1/2 biens sélectionnés)

5. User clique "Simuler"
   ├─> POST /api/fiscal/simulate
   │   {
   │     year: 2025,
   │     foyer: { salaire: 45000, parts: 1, ... },
   │     options: { autofill: true, ... },
   │     scope: { propertyIds: ['42B'] }  ← ✅ Seul 42B
   │   }
   │
   ├─> FiscalAggregator.aggregate({ scope: { propertyIds: ['42B'] } })
   │   ├─> getProperties(userId, ['42B'])
   │   │   └─> SELECT * FROM Property WHERE id IN ('42B')
   │   └─> Return { biens: [42B] }  ← ✅ Seul 42B agrégé
   │
   └─> Simulator.simulate()
       └─> Calcul IR/PS pour 42B uniquement ✅
```

---

## 📊 **AVANTAGES**

| Avantage | Description |
|----------|-------------|
| **Flexibilité** | Comparer facilement plusieurs scénarios (avec/sans un bien) |
| **Transparence** | User voit exactement quels biens sont inclus |
| **UX intuitive** | Checkboxes standards + couleurs (vert/gris) |
| **Totaux dynamiques** | Recalcul instantané des loyers/charges |
| **Performance** | Filtre dès l'agrégation (pas de données inutiles) |

---

## 🎯 **CAS D'USAGE**

### **Scénario 1 : Simuler avec/sans un bien**

```
User possède :
- Appartement NU : 8 400 € loyers
- Garage : 500 € loyers

Simulation 1 : Tout sélectionné
→ Loyers : 8 900 €

Simulation 2 : Désélectionner Garage
→ Loyers : 8 400 €

➜ Comparer l'impact fiscal !
```

---

### **Scénario 2 : Filtrer par type**

```
User possède :
- 2 biens NU (15 000 € loyers)
- 1 bien LMNP (6 000 € loyers)

Simulation 1 : Tout sélectionné
→ Fonciers : 15 000 € | BIC : 6 000 €

Simulation 2 : Désélectionner LMNP
→ Fonciers : 15 000 € | BIC : 0 €

➜ Isoler l'impact du LMNP !
```

---

### **Scénario 3 : Projet d'acquisition**

```
User possède 1 bien et envisage d'en acheter 1 autre.

Simulation 1 : Bien actuel seul
→ IR : 1 200 €

Simulation 2 : Ajouter le nouveau bien (manuellement ou via "Ajouter bien")
→ IR : 2 500 €

➜ Anticiper l'impact fiscal avant achat !
```

---

## ✅ **VALIDATION**

### **Test 1 : Sélection/désélection**

1. ✅ Tous les biens sélectionnés par défaut
2. ✅ Décocher un bien → Fond gris + totaux recalculés
3. ✅ Recocher un bien → Fond vert + totaux recalculés

### **Test 2 : Bouton "Tout sélectionner/désélectionner"**

1. ✅ Cliquer "Tout désélectionner" → Tous décochés
2. ✅ Totaux à 0 €
3. ✅ Cliquer "Tout sélectionner" → Tous recochés
4. ✅ Totaux complets

### **Test 3 : Simulation avec filtre**

1. ✅ Déselectionner 1 bien
2. ✅ Cliquer "Simuler"
3. ✅ Résultats ne contiennent que les biens sélectionnés
4. ✅ Logs backend confirment le filtre

---

## 🎉 **RÉSUMÉ**

```
✅ Checkboxes ajoutées à chaque bien
✅ Bouton "Tout sélectionner/désélectionner"
✅ Totaux dynamiques (recalcul instantané)
✅ Feedback visuel (vert = sélectionné, gris = désélectionné)
✅ Passage des IDs sélectionnés à l'API
✅ Filtre appliqué dès l'agrégation (performance)
✅ Types TypeScript mis à jour (scope.propertyIds)
✅ Compatible avec l'architecture existante
```

**FEATURE COMPLÈTE ET OPÉRATIONNELLE !** 🚀

---

**Date** : 08/11/2025  
**Statut** : ✅ **Implémenté et testé**  
**UX** : ✅ **Intuitive et performante**


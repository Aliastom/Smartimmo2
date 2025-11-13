# ✅ Fix : Encart autofill immédiat (sans cliquer Simuler)

## 🎯 **Problème**

L'encart vert avec les données SmartImmo apparaissait **seulement après clic sur "Simuler"**, alors qu'il devrait s'afficher **dès que le toggle autofill est ON**.

---

## ✅ **Solution implémentée**

### **1. Ajout d'une fonction dédiée `loadAutofillData()`**

```typescript
const loadAutofillData = async () => {
  setLoadingAutofill(true);
  try {
    // Appel à l'agrégateur fiscal pour récupérer les données
    const response = await fetch('/api/fiscal/aggregate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'demo-user', // TODO: Récupérer depuis session
        year: anneeRevenus,
        baseCalcul: 'encaisse',
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      setAutofillData({
        biens: data.biens || [],
        revenusFonciers: data.consolidation?.revenusFonciers || 0,
        revenusBIC: data.consolidation?.revenusBIC || 0,
      });
    }
  } catch (error) {
    console.error('Erreur chargement autofill:', error);
    // Pas d'alerte, juste ne pas afficher l'encart
  } finally {
    setLoadingAutofill(false);
  }
};
```

---

### **2. Chargement automatique au montage (si toggle ON)**

```typescript
useEffect(() => {
  if (autofill) {
    loadAutofillData();
  }
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

**Comportement** :
- ✅ Au chargement de `/impots/simulation`, si toggle autofill = ON (défaut)
- ✅ L'encart vert apparaît **immédiatement** avec spinner
- ✅ Dès que les données arrivent, l'encart se remplit

---

### **3. Rechargement quand on active le toggle**

```typescript
<Switch
  id="autofill"
  checked={autofill}
  onCheckedChange={(checked) => {
    setAutofill(checked);
    if (checked) {
      // Charger les données immédiatement quand on active
      loadAutofillData();
    } else {
      // Effacer les données quand on désactive
      setAutofillData(null);
    }
  }}
/>
```

**Comportement** :
- ✅ Toggle OFF → ON : Appel API immédiat + encart vert avec spinner
- ✅ Toggle ON → OFF : Encart disparaît

---

### **4. Affichage conditionnel avec spinner**

```typescript
{autofill && (loadingAutofill || autofillData) && (
  <Card className="border-green-200 bg-green-50">
    <CardHeader>
      <CardTitle>
        <Home className="h-4 w-4" />
        Données récupérées depuis SmartImmo
      </CardTitle>
    </CardHeader>
    <CardContent>
      {loadingAutofill ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-green-600" />
          <span className="ml-2 text-sm text-green-700">
            Chargement des données...
          </span>
        </div>
      ) : autofillData ? (
        <>
          {/* Contenu de l'encart */}
        </>
      ) : null}
    </CardContent>
  </Card>
)}
```

---

## 🔄 **FLUX UTILISATEUR**

### **Scénario 1 : Chargement initial (toggle ON par défaut)**

```
1. User ouvre /impots/simulation
   ├─> Toggle autofill = ON (défaut)
   └─> useEffect() se déclenche
   
2. loadAutofillData() appelé automatiquement
   ├─> Spinner affiché
   ├─> POST /api/fiscal/aggregate
   └─> Response (biens, revenus)
   
3. Encart vert affiché immédiatement ✅
   ├─> 2 bien(s) immobilier(s)
   ├─> [NU] Appartement Paris
   ├─> [LMNP] Studio Lyon
   ├─> Revenus fonciers : 8 400 €
   └─> Revenus BIC : 4 800 €
```

---

### **Scénario 2 : Toggle OFF → ON**

```
1. User désactive autofill
   └─> Encart disparaît

2. User réactive autofill
   ├─> onCheckedChange(true)
   ├─> loadAutofillData() appelé
   └─> Spinner affiché

3. Données chargées
   └─> Encart vert réapparaît ✅
```

---

### **Scénario 3 : Simulation ensuite**

```
1. Encart autofill déjà affiché (toggle ON)
   ├─> 2 biens visibles
   └─> Revenus visibles

2. User clique "Simuler"
   ├─> POST /api/fiscal/simulate { options: { autofill: true } }
   ├─> Simulation calculée
   └─> Résultats affichés (droite)

3. Encart autofill reste affiché (gauche) ✅
   └─> Pas de rechargement inutile
```

---

## 🎨 **AVANT / APRÈS**

### **AVANT ❌**

```
1. Toggle autofill ON
2. Aucun encart affiché
3. User clique "Simuler"
4. Encart vert apparaît ← Trop tard !
```

### **APRÈS ✅**

```
1. Toggle autofill ON (ou page charge avec toggle ON)
2. Encart vert apparaît immédiatement ← Parfait ! 🎉
   ├─> Spinner pendant chargement
   └─> Données dès qu'elles arrivent
3. User peut ajuster salaire/parts
4. Clic "Simuler" → Résultats (encart reste affiché)
```

---

## 📊 **RÉSUMÉ DES CHANGEMENTS**

| Fichier | Changement | Impact |
|---------|------------|--------|
| `SimulationClient.tsx` | ➕ `loadAutofillData()` | Fonction dédiée au chargement |
| `SimulationClient.tsx` | ➕ `useEffect()` (montage) | Chargement auto si ON |
| `SimulationClient.tsx` | 🔄 `Switch.onCheckedChange` | Chargement si toggle ON |
| `SimulationClient.tsx` | 🔄 Encart conditionnel | Spinner + données |
| `SimulationClient.tsx` | ➕ `loadingAutofill` state | Feedback visuel |
| `handleSimulate()` | ➖ Suppression logique autofill | Plus besoin (déjà chargé) |

---

## ✅ **VALIDATION**

### **Test 1 : Chargement initial**

1. Ouvrir `/impots/simulation`
2. ✅ Toggle autofill = ON
3. ✅ Encart vert apparaît (spinner)
4. ✅ Données chargées (2 biens, revenus)

---

### **Test 2 : Toggle OFF → ON**

1. Désactiver toggle
2. ✅ Encart disparaît
3. Réactiver toggle
4. ✅ Encart réapparaît avec spinner
5. ✅ Données chargées

---

### **Test 3 : Simulation après**

1. Encart autofill affiché
2. Cliquer "Simuler"
3. ✅ Résultats affichés
4. ✅ Encart reste visible (pas de rechargement)

---

## 🎯 **AVANTAGES**

| Avantage | Description |
|----------|-------------|
| **UX immédiate** | Données visibles dès le chargement |
| **Transparence** | User voit ce qui sera utilisé avant simulation |
| **Feedback visuel** | Spinner pendant chargement |
| **Validation** | User peut vérifier les données récupérées |
| **Performance** | Pas de rechargement à chaque simulation |

---

## 🎊 **RÉSULTAT FINAL**

```
✅ Encart autofill immédiat (sans clic Simuler)
✅ Spinner pendant chargement
✅ Données visibles dès l'arrivée
✅ Toggle ON/OFF → Chargement dynamique
✅ Simulation n'affecte pas l'encart
```

**UX nettement améliorée !** 🚀

---

**Date** : 08/11/2025  
**Statut** : ✅ **Opérationnel**  
**UX** : ✅ **Optimale**


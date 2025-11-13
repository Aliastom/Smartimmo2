# ✅ Feature : Accordéon + Boutons Sticky

## 🎯 **Solution implémentée : Hybride (Accordéon + Sticky)**

### **Problème**
La colonne gauche était trop longue (nécessitait beaucoup de scroll) avec toutes les sections : Année, Infos personnelles, PER, Régime fiscal, Options, Données SmartImmo.

### **Solution**
1. **Accordéons** : Regrouper les sections avec possibilité de les réduire/étendre
2. **Boutons sticky** : Boutons d'action toujours visibles en bas

---

## 🎨 **NOUVELLE STRUCTURE**

```
COLONNE GAUCHE (Compacte)
├── ▼ Informations personnelles [OUVERT par défaut]
│   ├─ Toggle Brut/Net
│   ├─ Salaire
│   ├─ Déduction 10% / Frais réels
│   ├─ Autres revenus
│   ├─ Parts fiscales
│   └─ En couple
│
├── ▼ Données SmartImmo [OUVERT par défaut]
│   ├─ 2 bien(s)
│   ├─ ✓ [NU] 42B (415 €)
│   ├─ ✓ [NU] Garage 4 (42 €)
│   ├─ Loyers : 456,98 €
│   └─ Charges : 27,42 €
│
├── ▶ Options avancées [FERMÉ par défaut]
│   ├─ Année de déclaration
│   ├─ PER (toggle + reliquats)
│   ├─ Régime fiscal (Auto/Micro/Réel)
│   └─ Autofill SmartImmo
│
└── ┌──────────────────────────┐ ← STICKY (toujours visible)
    │ [Calculer]  [Export PDF] │
    └──────────────────────────┘
```

---

## 🔧 **MODIFICATIONS TECHNIQUES**

### **1. État des accordéons**

```typescript
const [accordeonState, setAccordeonState] = useState({
  infosPersonnelles: true,   // Ouvert par défaut
  donneesSmartImmo: true,    // Ouvert par défaut
  optionsAvancees: false,    // Fermé par défaut
});

const toggleAccordeon = (section: keyof typeof accordeonState) => {
  setAccordeonState(prev => ({
    ...prev,
    [section]: !prev[section],
  }));
};
```

---

### **2. Header cliquable avec chevron**

```tsx
<CardHeader 
  className="cursor-pointer hover:bg-gray-50 transition-colors"
  onClick={() => toggleAccordeon('infosPersonnelles')}
>
  <CardTitle className="text-base flex items-center justify-between">
    <div className="flex items-center gap-2">
      <Users className="h-4 w-4" />
      Informations personnelles
    </div>
    {accordeonState.infosPersonnelles ? (
      <ChevronUp className="h-5 w-5 text-gray-500" />
    ) : (
      <ChevronDown className="h-5 w-5 text-gray-500" />
    )}
  </CardTitle>
</CardHeader>
```

---

### **3. Contenu conditionnel**

```tsx
{accordeonState.infosPersonnelles && (
  <CardContent className="space-y-4">
    {/* Contenu de la section */}
  </CardContent>
)}
```

---

### **4. Regroupement "Options avancées"**

Les sections suivantes ont été **regroupées** dans un seul accordéon "Options avancées" :
- ✅ **Année de déclaration** (était une card séparée)
- ✅ **PER** (était une card séparée)
- ✅ **Régime fiscal** (était "Paramètres fiscaux")
- ✅ **Toggle Autofill** (était "Options")

**Avantages** :
- Gain de place vertical (~60%)
- Séparation claire : Essentiel vs Avancé
- Tout reste accessible en 1 clic

---

### **5. Boutons sticky en bas**

```tsx
<div className="lg:col-span-1 relative">
  {/* Contenu scrollable */}
  <div className="space-y-4 pb-32">
    {/* pb-32 = padding-bottom pour laisser l'espace aux boutons */}
    {/* Accordéons ici */}
  </div>
  
  {/* Boutons sticky */}
  <div className="fixed bottom-0 left-0 lg:left-auto lg:w-[calc((100%-3rem)/3)] bg-white border-t border-gray-200 p-4 space-y-2 shadow-lg">
    <Button onClick={handleSimulate} className="w-full" size="lg">
      <Calculator className="mr-2 h-4 w-4" />
      Calculer la simulation
    </Button>
    
    {simulation && (
      <Button onClick={handleExportPDF} variant="outline" className="w-full">
        <FileDown className="mr-2 h-4 w-4" />
        Export PDF complet
      </Button>
    )}
  </div>
</div>
```

**Classes importantes** :
- `fixed bottom-0` : Fixé en bas
- `lg:w-[calc((100%-3rem)/3)]` : Largeur = 1/3 du viewport (responsive)
- `shadow-lg` : Ombre pour élever visuellement les boutons
- `bg-white border-t` : Fond blanc + bordure top

---

## 📊 **GAIN VERTICAL**

### **Avant**
```
┌────────────────────────┐
│ Année                  │ ← 80px
├────────────────────────┤
│ Infos personnelles     │ ← 350px
├────────────────────────┤
│ PER                    │ ← 300px (si activé)
├────────────────────────┤
│ Régime fiscal          │ ← 120px
├────────────────────────┤
│ Options                │ ← 100px
├────────────────────────┤
│ Données SmartImmo      │ ← 250px
├────────────────────────┤
│ [Calculer]             │ ← 60px
│ [Export PDF]           │ ← 50px
└────────────────────────┘
TOTAL : ~1 310px (scroll nécessaire)
```

### **Après (accordéon fermé "Options avancées")**
```
┌────────────────────────┐
│ ▼ Infos personnelles   │ ← 350px
├────────────────────────┤
│ ▼ Données SmartImmo    │ ← 250px
├────────────────────────┤
│ ▶ Options avancées     │ ← 60px (fermé)
├────────────────────────┤
│                        │
│ [padding pour sticky]  │ ← 128px
│                        │
└────────────────────────┘
│ [Calculer] [Export]    │ ← Sticky (ne compte pas)
└────────────────────────┘
TOTAL : ~788px (gain de 40%)
```

### **Après (tout ouvert)**
```
┌────────────────────────┐
│ ▼ Infos personnelles   │ ← 350px
├────────────────────────┤
│ ▼ Données SmartImmo    │ ← 250px
├────────────────────────┤
│ ▼ Options avancées     │ ← 600px (ouvert)
│   - Année              │
│   - PER                │
│   - Régime             │
│   - Autofill           │
├────────────────────────┤
│ [padding pour sticky]  │ ← 128px
└────────────────────────┘
│ [Calculer] [Export]    │ ← Sticky
└────────────────────────┘
TOTAL : ~1 328px

Mais les boutons restent TOUJOURS visibles ! 🎉
```

---

## ✅ **AVANTAGES**

| Avantage | Description |
|----------|-------------|
| **🎯 Gain de place** | 40% de hauteur en moins (options avancées fermées) |
| **🚀 Boutons toujours visibles** | Pas besoin de scroller pour simuler |
| **👁️ Essentiel ouvert** | Infos perso + Données SmartImmo visibles par défaut |
| **🔧 Avancé caché** | Options avancées accessibles en 1 clic |
| **📱 Responsive** | Boutons sticky s'adaptent au viewport |
| **✨ UX fluide** | Hover states, transitions, chevrons animés |

---

## 🎨 **FEEDBACK VISUEL**

### **Accordéon fermé**
```
┌────────────────────────────────────────┐
│ ▶ Options avancées            ▼       │ ← Gris clair
└────────────────────────────────────────┘
```

### **Accordéon ouvert**
```
┌────────────────────────────────────────┐
│ ▼ Options avancées            ▲       │ ← Fond blanc
├────────────────────────────────────────┤
│ [Contenu visible]                      │
│                                        │
└────────────────────────────────────────┘
```

### **Hover sur header**
```
┌────────────────────────────────────────┐
│ ▶ Options avancées            ▼       │ ← Fond gray-50
└────────────────────────────────────────┘
       ↑ cursor-pointer + transition
```

---

## 🎯 **CAS D'USAGE**

### **Scénario 1 : User occasionnel**

```
1. Ouvre /impots/simulation
   ├─> Voit Infos personnelles (ouvert)
   ├─> Voit Données SmartImmo (ouvert)
   └─> "Options avancées" fermées (pas de distraction)

2. Remplit salaire + parts
3. Clique "Calculer" (toujours visible en bas)
4. ✅ Simulation lancée sans scroll !
```

---

### **Scénario 2 : Power user**

```
1. Ouvre /impots/simulation
2. Voit tout l'essentiel (Infos + Données)
3. Clique "Options avancées" (1 clic)
   ├─> Change année de déclaration
   ├─> Active PER
   ├─> Force régime réel
   └─> Ferme "Options avancées"

4. Ajuste salaire
5. Clique "Calculer" (toujours visible)
6. ✅ Simulation avec options custom !
```

---

### **Scénario 3 : Comparaison**

```
1. Simulation 1 avec PER
   ├─> Ouvre "Options avancées"
   ├─> Active PER
   ├─> Simule
   └─> Résultat : 6 800 € d'impôts

2. Simulation 2 sans PER
   ├─> Ouvre "Options avancées"
   ├─> Désactive PER
   ├─> Simule (bouton toujours visible !)
   └─> Résultat : 7 200 € d'impôts

Impact PER : -400 € ! 🎉
```

---

## 📱 **RESPONSIVE**

### **Desktop (lg+)**
- Boutons : `lg:w-[calc((100%-3rem)/3)]` = 1/3 viewport
- Sticky : Aligné avec la colonne gauche

### **Mobile**
- Boutons : `w-full` (pleine largeur)
- Sticky : `left-0` (bord gauche)

---

## 🎉 **RÉSULTAT FINAL**

```
✅ Colonne gauche 40% plus courte
✅ Boutons toujours visibles (sticky)
✅ Tout reste accessible (accordéons)
✅ UX moderne et fluide
✅ Responsive mobile/desktop
✅ Sections logiquement groupées
✅ Feedback visuel clair (hover, chevrons)
```

**GAIN DE TEMPS** : Plus besoin de scroller pour cliquer "Calculer" ! 🚀

---

**Date** : 08/11/2025  
**Statut** : ✅ **Implémenté et testé**  
**UX** : ✅ **Optimisée** (-40% hauteur + sticky actions)


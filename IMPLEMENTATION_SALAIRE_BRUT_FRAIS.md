# 💡 Implémentation : Salaire Brut + Choix Frais

## 🎯 **Objectif**

Améliorer la simulation fiscale avec :
1. ✅ **Toggle Brut/Net imposable**
2. ✅ **Choix : Abattement 10% forfaitaire OU Frais réels**

---

## 📊 **Chaîne de calcul fiscale complète**

```
SALAIRE BRUT (fiche de paie)
   │ Ex: 50 000 €
   │
   ├─> -22% Cotisations sociales (Sécu, retraite, chômage)
   │
   v
SALAIRE NET (ce qui arrive sur le compte)
   │ Ex: 39 000 €
   │
   ├─> CHOIX 1 : -10% Abattement forfaitaire (défaut)
   │   └─> 39 000 × 0.90 = 35 100 €
   │
   ├─> CHOIX 2 : -Frais réels (transport, repas, etc.)
   │   └─> 39 000 - 5 000 = 34 000 €
   │
   v
REVENU NET IMPOSABLE (base de calcul IR)
   │ Ex: 35 100 € (si forfaitaire)
   │
   ├─> Application barème IR 2025
   │
   v
IMPÔT SUR LE REVENU
```

---

## 🔍 **Abattement 10% : Source**

### **Recherche dans OpenFisca** ❌

```bash
# Pas trouvé dans /parameters
# C'est une CONSTANTE fiscale (stable depuis 1970)
```

### **Source officielle** ✅

**Article 83 du CGI** (Code Général des Impôts)
- Abattement forfaitaire : **10%**
- Minimum : **472 €** (2025)
- Maximum : **13 522 €** (2025)

**Lien** : https://bofip.impots.gouv.fr/bofip/1845-PGP.html (BOI-RSA-BASE-20)

**Évolution** :
- 1970-2024 : **10%** (stable)
- Min/Max : Revalorisés annuellement (inflation)

---

## 🛠️ **IMPLÉMENTATION PROPOSÉE**

### **1. Nouveaux états React**

```typescript
// Dans SimulationClient.tsx

const [salaryMode, setSalaryMode] = useState<'brut' | 'net'>('brut');
const [fraisMode, setFraisMode] = useState<'forfaitaire' | 'reels'>('forfaitaire');
const [salaireBrut, setSalaireBrut] = useState(50000);
const [salaireNet, setSalaireNet] = useState(39500);
const [fraisReels, setFraisReels] = useState(0);

// Constantes fiscales
const TAUX_COTISATIONS_SOCIALES = 0.22; // 22% (approximation)
const ABATTEMENT_FORFAITAIRE = 0.10;     // 10%
const ABATTEMENT_MIN = 472;               // Min 2025
const ABATTEMENT_MAX = 13522;             // Max 2025
```

---

### **2. Fonctions de conversion**

```typescript
/**
 * Convertit salaire brut → net (approximation)
 */
function brutToNet(brut: number): number {
  return Math.round(brut * (1 - TAUX_COTISATIONS_SOCIALES));
}

/**
 * Convertit salaire net → net imposable
 */
function netToNetImposable(net: number, mode: 'forfaitaire' | 'reels', fraisReels: number): number {
  if (mode === 'forfaitaire') {
    const abattement = Math.min(
      Math.max(net * ABATTEMENT_FORFAITAIRE, ABATTEMENT_MIN),
      ABATTEMENT_MAX
    );
    return Math.round(net - abattement);
  } else {
    // Frais réels
    return Math.round(net - fraisReels);
  }
}

/**
 * Convertit salaire brut → net imposable (chaîne complète)
 */
function brutToNetImposable(brut: number, mode: 'forfaitaire' | 'reels', fraisReels: number): number {
  const net = brutToNet(brut);
  return netToNetImposable(net, mode, fraisReels);
}
```

---

### **3. UI proposée**

```jsx
<Card>
  <CardHeader>
    <CardTitle>Informations personnelles</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    
    {/* Toggle Brut/Net */}
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <Label className="text-sm font-medium">Type de salaire</Label>
      <div className="flex items-center gap-2">
        <span className={salaryMode === 'brut' ? 'font-semibold' : 'text-gray-500'}>
          Brut
        </span>
        <Switch 
          checked={salaryMode === 'net'}
          onCheckedChange={(checked) => setSalaryMode(checked ? 'net' : 'brut')}
        />
        <span className={salaryMode === 'net' ? 'font-semibold' : 'text-gray-500'}>
          Net imposable
        </span>
      </div>
    </div>
    
    {/* Champ salaire */}
    <div>
      <Label>
        {salaryMode === 'brut' ? 'Salaire annuel brut' : 'Salaire annuel net imposable'}
      </Label>
      <Input 
        type="number" 
        value={salaryMode === 'brut' ? salaireBrut : salaireNet}
        onChange={(e) => {
          const value = Number(e.target.value);
          
          if (salaryMode === 'brut') {
            setSalaireBrut(value);
            const net = brutToNet(value);
            setSalaireNet(net);
          } else {
            setSalaireNet(value);
          }
        }}
      />
      
      {salaryMode === 'brut' && (
        <p className="text-xs text-gray-500 mt-1">
          ≈ {brutToNet(salaireBrut).toLocaleString('fr-FR')} € net
        </p>
      )}
    </div>
    
    {/* Choix Forfaitaire/Frais réels */}
    <div className="space-y-3 p-3 border rounded-lg">
      <Label className="text-sm font-medium">Déduction fiscale</Label>
      
      {/* Option 1 : Forfaitaire */}
      <div className="flex items-start gap-3">
        <input 
          type="radio" 
          checked={fraisMode === 'forfaitaire'}
          onChange={() => setFraisMode('forfaitaire')}
          className="mt-1"
        />
        <div className="flex-1">
          <Label className="font-normal">
            Abattement forfaitaire de 10%
            <Badge variant="outline" className="ml-2">Par défaut</Badge>
          </Label>
          {fraisMode === 'forfaitaire' && (
            <p className="text-xs text-gray-500 mt-1">
              Déduction : {Math.min(Math.max(salaireNet * 0.10, 472), 13522).toLocaleString('fr-FR')} €
              (min 472 €, max 13 522 €)
            </p>
          )}
        </div>
      </div>
      
      {/* Option 2 : Frais réels */}
      <div className="flex items-start gap-3">
        <input 
          type="radio" 
          checked={fraisMode === 'reels'}
          onChange={() => setFraisMode('reels')}
          className="mt-1"
        />
        <div className="flex-1">
          <Label className="font-normal">Frais réels (transport, repas, etc.)</Label>
          {fraisMode === 'reels' && (
            <Input 
              type="number" 
              value={fraisReels}
              onChange={(e) => setFraisReels(Number(e.target.value))}
              placeholder="Montant annuel des frais réels"
              className="mt-2"
            />
          )}
        </div>
      </div>
    </div>
    
    {/* Résultat final affiché */}
    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <p className="text-sm font-medium text-blue-900">Revenu net imposable</p>
      <p className="text-2xl font-bold text-blue-600">
        {netToNetImposable(salaireNet, fraisMode, fraisReels).toLocaleString('fr-FR')} €
      </p>
      {salaryMode === 'brut' && (
        <p className="text-xs text-gray-600 mt-1">
          Brut {salaireBrut.toLocaleString('fr-FR')} € 
          → Net {salaireNet.toLocaleString('fr-FR')} € 
          → Imposable {netToNetImposable(salaireNet, fraisMode, fraisReels).toLocaleString('fr-FR')} €
        </p>
      )}
    </div>
    
  </CardContent>
</Card>
```

---

## 📋 **Paramètres à ajouter dans FiscalParams**

### **Nouveau dans TaxParams (types/fiscal.ts)** :

```typescript
export interface TaxParams {
  // ... existant ...
  
  // 🆕 NOUVEAU : Abattement forfaitaire salaires
  salaryDeduction: {
    taux: number;        // 0.10 (10%)
    min: number;         // 472 € (2025)
    max: number;         // 13 522 € (2025)
  };
  
  // 🆕 NOUVEAU : Conversion brut → net
  socialContributions: {
    tauxSalarie: number;  // 0.22 (approximation)
  };
}
```

---

### **Dans TaxParamsService.ts (hardcodé pour 2025)** :

```typescript
const TAX_PARAMS_2025: TaxParams = {
  // ... existant ...
  
  // Abattement forfaitaire salaires (Article 83 CGI)
  salaryDeduction: {
    taux: 0.10,      // 10% (stable depuis 1970)
    min: 472,        // Min 2025 (à scraper du BOFIP)
    max: 13522,      // Max 2025 (à scraper du BOFIP)
  },
  
  // Cotisations sociales (approximation)
  socialContributions: {
    tauxSalarie: 0.22,  // 22% (approximation, varie selon statut)
  },
};
```

---

## 🔍 **OpenFisca : Abattement 10%**

**Paramètre cherché** :
```bash
impot_revenu.tspr.abattement_forfaitaire_taux
impot_revenu.tspr.abattement_forfaitaire_min
impot_revenu.tspr.abattement_forfaitaire_max
```

**Résultat recherche** : ❌ Pas trouvé (probablement hardcodé dans le calcul)

**Raison** : L'abattement de **10%** est une **constante** (stable depuis 1970), seuls le min/max changent annuellement.

---

## 🌐 **Source BOFIP pour scraping**

### **URL à ajouter** :

```
https://bofip.impots.gouv.fr/bofip/1845-PGP.html
(BOI-RSA-BASE-20 - Abattement forfaitaire de 10%)
```

**Données à extraire** :
- ✅ Taux : 10% (constant)
- ✅ Minimum : 472 € (2025)
- ✅ Maximum : 13 522 € (2025)

---

## 🎯 **PROPOSITION**

### **Je vais implémenter** :

1. ✅ **Toggle Brut/Net** (Switch)
2. ✅ **Choix Forfaitaire 10% / Frais réels** (Radio buttons)
3. ✅ **Calcul automatique** :
   - Brut → Net (×0.78)
   - Net → Net imposable (×0.90 si forfaitaire)
   - Affichage de la chaîne complète
4. ✅ **Ajout des paramètres** `salaryDeduction` et `socialContributions`
5. ⏳ **TODO** : Scraper BOFIP pour min/max de l'abattement

### **Voulez-vous que je procède ?** 🚀

**Temps estimé** : 15-20 min

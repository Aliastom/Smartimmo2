# 📊 Amélioration du FiscalAggregator - Données complètes

**Date** : 9 novembre 2025  
**Statut** : 📋 Plan proposé

---

## 🎯 **OBJECTIF**

Améliorer le `FiscalAggregator` pour récupérer **TOUTES** les données nécessaires à une simulation fiscale précise :

### **1. PASSÉ (Réalisé - du 1er janvier à aujourd'hui)** ✅ Partiellement fait
- ✅ Recettes (transactions avec `amount > 0`)
- ✅ Charges déductibles (transactions avec `amount < 0` ET `Category.deductible = true`)
- ❌ **Intérêts d'emprunt** (calculés depuis `Loan`)
- ❌ **Assurance emprunt** (calculée depuis `Loan.insurancePct`)

### **2. PROJECTION (Reste de l'année - d'aujourd'hui au 31 décembre)** ❌ À faire
- ❌ **Loyers futurs** (depuis `Lease.amount` × mois restants)
- ❌ **Charges récurrentes futures** (depuis `Payment` avec `periodYear` = année en cours)
- ❌ **Intérêts d'emprunt futurs** (calculés depuis `Loan` × mois restants)

---

## 📋 **ÉTAT ACTUEL DU FISCALAGGREGATOR**

### **Ce qui est fait** ✅

```typescript
// Lignes 200-242 de FiscalAggregator.ts
const transactions = await prisma.transaction.findMany({
  where: {
    propertyId,
    accounting_month: { contains: yearString }, // ✅ Année complète
  },
  include: { Category: true },
});

// Pour chaque transaction
if (transaction.amount > 0) {
  recettesTotales += montant; // ✅ Recettes
} else if (transaction.amount < 0) {
  if (transaction.Category?.deductible === true) {
    chargesDeductibles += montant; // ✅ Charges déductibles
  } else if (transaction.Category?.capitalizable === true) {
    chargesCapitalisables += montant; // ✅ Charges capitalisables
  }
}
```

### **Ce qui manque** ❌

1. **Intérêts d'emprunt** (passé ET futur)
2. **Projection du reste de l'année**

---

## 🏗️ **ARCHITECTURE PROPOSÉE**

### **Nouvelle structure de retour**

```typescript
interface AggregatedPropertyData {
  // Données actuelles (inchangées)
  id: string;
  nom: string;
  type: TypeBien;
  loyers: number;
  charges: number;
  amortissements?: { ... };
  regimeSuggere: RegimeFiscal;
  regimeChoisi?: RegimeFiscal;
  
  // 🆕 Nouvelles données
  breakdown: {
    // Passé (réalisé du 1er janvier à aujourd'hui)
    passe: {
      recettes: number;              // Toutes recettes (transactions)
      chargesDeductibles: number;    // Charges déductibles (transactions)
      interetsEmprunt: number;       // Intérêts calculés depuis Loan
      assuranceEmprunt: number;      // Assurance calculée depuis Loan
      nombreTransactions: number;    // Nombre de transactions
    };
    
    // Projection (reste de l'année)
    projection: {
      loyersFuturs: number;          // Loyers × mois restants
      chargesFutures: number;        // Charges récurrentes × mois restants
      interetsEmpruntFuturs: number; // Intérêts × mois restants
      moisRestants: number;          // Nombre de mois à projeter
    };
    
    // Total (passé + projection)
    total: {
      recettes: number;
      chargesDeductibles: number;
      interetsEmprunt: number;
    };
  };
}
```

---

## 🔧 **IMPLÉMENTATION PROPOSÉE**

### **1. Ajouter le calcul des intérêts d'emprunt (PASSÉ)**

```typescript
/**
 * Calcule les intérêts d'emprunt pour la période passée de l'année
 */
private async calculateLoanInterests(
  propertyId: string, 
  year: number
): Promise<{ passe: number; projection: number }> {
  const loans = await prisma.loan.findMany({
    where: {
      propertyId,
      isActive: true,
      startDate: { lte: new Date(`${year}-12-31`) },
      OR: [
        { endDate: null },
        { endDate: { gte: new Date(`${year}-01-01`) } },
      ],
    },
  });
  
  let interetsPasse = 0;
  let interetsProjection = 0;
  const today = new Date();
  const moisEcoules = today.getMonth() + 1; // 1-12
  const moisRestants = 12 - moisEcoules;
  
  for (const loan of loans) {
    const principal = parseFloat(loan.principal.toString());
    const tauxAnnuel = parseFloat(loan.annualRatePct.toString()) / 100;
    const assurancePct = loan.insurancePct 
      ? parseFloat(loan.insurancePct.toString()) / 100 
      : 0;
    
    // Calcul simplifié (mensualité constante)
    const mensualite = this.calculateMensualite(
      principal, 
      tauxAnnuel, 
      loan.durationMonths
    );
    
    // Calcul des intérêts (simplifié - en prod utiliser un tableau d'amortissement)
    const interetsMensuel = (principal * tauxAnnuel) / 12;
    const assuranceMensuelle = (principal * assurancePct) / 12;
    
    // Intérêts passés (janvier à aujourd'hui)
    interetsPasse += (interetsMensuel + assuranceMensuelle) * moisEcoules;
    
    // Intérêts futurs (aujourd'hui à décembre)
    interetsProjection += (interetsMensuel + assuranceMensuelle) * moisRestants;
  }
  
  return { passe: interetsPasse, projection: interetsProjection };
}

private calculateMensualite(principal: number, tauxAnnuel: number, dureeMois: number): number {
  const tauxMensuel = tauxAnnuel / 12;
  return (principal * tauxMensuel) / (1 - Math.pow(1 + tauxMensuel, -dureeMois));
}
```

---

### **2. Ajouter la projection du reste de l'année**

```typescript
/**
 * Projette les revenus et charges pour le reste de l'année
 */
private async projectRemainingYear(
  propertyId: string,
  year: number
): Promise<{ loyersFuturs: number; chargesFutures: number; moisRestants: number }> {
  const today = new Date();
  const moisRestants = 12 - (today.getMonth() + 1);
  
  if (moisRestants <= 0) {
    return { loyersFuturs: 0, chargesFutures: 0, moisRestants: 0 };
  }
  
  // 1. Récupérer les baux actifs
  const leases = await prisma.lease.findMany({
    where: {
      propertyId,
      status: 'ACTIF',
      startDate: { lte: new Date(`${year}-12-31`) },
      OR: [
        { endDate: null },
        { endDate: { gte: today } },
      ],
    },
  });
  
  // 2. Calculer les loyers futurs
  let loyersFuturs = 0;
  for (const lease of leases) {
    const loyerMensuel = parseFloat(lease.amount?.toString() || '0');
    loyersFuturs += loyerMensuel * moisRestants;
  }
  
  // 3. Récupérer les échéances futures (Payment) pour l'année en cours
  const futurPayments = await prisma.payment.findMany({
    where: {
      propertyId,
      periodYear: year,
      periodMonth: { gt: today.getMonth() + 1 }, // Mois futurs uniquement
    },
    include: { Category: true },
  });
  
  // 4. Calculer les charges futures
  let chargesFutures = 0;
  for (const payment of futurPayments) {
    if (payment.amount < 0 && payment.Category?.deductible === true) {
      chargesFutures += Math.abs(payment.amount);
    }
  }
  
  return { loyersFuturs, chargesFutures, moisRestants };
}
```

---

### **3. Modifier `aggregateProperty` pour tout intégrer**

```typescript
private async aggregateProperty(
  propertyId: string,
  year: TaxYear,
  baseCalcul: 'encaisse' | 'exigible'
): Promise<RentalPropertyInput | null> {
  // ... code actuel pour les transactions (passé) ...
  
  // 🆕 Calculer les intérêts d'emprunt (passé + projection)
  const interets = await this.calculateLoanInterests(propertyId, year);
  
  // 🆕 Projeter le reste de l'année
  const projection = await this.projectRemainingYear(propertyId, year);
  
  // 🆕 Calculer les totaux
  const breakdown = {
    passe: {
      recettes: recettesTotales,
      chargesDeductibles,
      interetsEmprunt: interets.passe,
      assuranceEmprunt: 0, // Inclus dans interets.passe
      nombreTransactions: transactions.length,
    },
    projection: {
      loyersFuturs: projection.loyersFuturs,
      chargesFutures: projection.chargesFutures,
      interetsEmpruntFuturs: interets.projection,
      moisRestants: projection.moisRestants,
    },
    total: {
      recettes: recettesTotales + projection.loyersFuturs,
      chargesDeductibles: chargesDeductibles + projection.chargesFutures,
      interetsEmprunt: interets.passe + interets.projection,
    },
  };
  
  return {
    id: propertyId,
    nom: property.name,
    type: typeBien,
    
    // Utiliser les totaux (passé + projection)
    loyers: breakdown.total.recettes,
    charges: breakdown.total.chargesDeductibles + breakdown.total.interetsEmprunt,
    
    amortissements,
    regimeSuggere,
    regimeChoisi,
    
    // 🆕 Détail du breakdown
    breakdown,
  };
}
```

---

## 📊 **EXEMPLE DE RÉSULTAT**

Avec cette amélioration, vous aurez :

```typescript
{
  id: "bien-123",
  nom: "Appartement Paris 15",
  type: "NU",
  loyers: 14_400,   // 9 000 (passé) + 5 400 (projection 3 mois × 1 800€)
  charges: 5_200,   // 3 500 (passé) + 1 200 (projection) + 500 (intérêts)
  
  breakdown: {
    passe: {
      recettes: 9_000,              // 5 loyers + 1 régul
      chargesDeductibles: 3_500,    // Taxes, travaux, gestion
      interetsEmprunt: 400,         // Intérêts janv-sept
      nombreTransactions: 15,
    },
    projection: {
      loyersFuturs: 5_400,          // 1 800€ × 3 mois
      chargesFutures: 1_200,        // Charges récurrentes
      interetsEmpruntFuturs: 100,   // Intérêts oct-déc
      moisRestants: 3,
    },
    total: {
      recettes: 14_400,
      chargesDeductibles: 4_700,
      interetsEmprunt: 500,
    },
  },
}
```

---

## 🚀 **AVANTAGES**

1. ✅ **Simulation complète sur l'année entière** (pas juste le passé)
2. ✅ **Intérêts d'emprunt** pris en compte (déductibles)
3. ✅ **Transparence** : voir passé vs projection
4. ✅ **Précision** : utilise les baux actifs pour projeter
5. ✅ **Flexibilité** : peut désactiver la projection si besoin

---

## 📋 **TÂCHES À FAIRE**

1. **Backend** :
   - [ ] Créer `calculateLoanInterests(propertyId, year)`
   - [ ] Créer `projectRemainingYear(propertyId, year)`
   - [ ] Modifier `aggregateProperty()` pour intégrer les 2 fonctions
   - [ ] Ajouter `breakdown` au type `RentalPropertyInput`

2. **Frontend** :
   - [ ] Afficher le détail `breakdown` dans l'encart jaune autofill
   - [ ] Montrer "Réalisé / Projeté / Total" pour chaque ligne
   - [ ] Badge "Projection" si mois restants > 0

3. **Tests** :
   - [ ] Vérifier le calcul des intérêts (avec un prêt réel)
   - [ ] Vérifier la projection (avec des baux actifs)
   - [ ] Comparer avec les données réelles de décembre

---

## 🎨 **UI PROPOSÉE (Encart autofill)**

```
┌──────────────────────────────────────────────────────────────┐
│  📊 Données récupérées depuis SmartImmo                      │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Loyers annuels : 14 400 €                              │ │
│  │   ├─ Réalisé (9 mois) : 9 000 €                        │ │
│  │   └─ Projeté (3 mois) : 5 400 €                        │ │
│  │                                                          │ │
│  │ Charges déductibles : 5 200 €                           │ │
│  │   ├─ Réalisé : 3 500 € (taxes, travaux, gestion)       │ │
│  │   ├─ Projeté : 1 200 € (charges récurrentes)           │ │
│  │   └─ Intérêts emprunt : 500 € (400 passé + 100 futur)  │ │
│  │                                                          │ │
│  │ Biens sélectionnés : 2 bien(s)                          │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## ⚙️ **OPTIONS DE CONFIGURATION**

Dans les "Options avancées" de la simulation, ajouter :

```
☑️ Inclure la projection (reste de l'année)
   └─ Utilise les baux actifs + échéances planifiées

☑️ Inclure les intérêts d'emprunt
   └─ Calcule depuis les prêts actifs (déductible fiscalement)
```

---

## 🧪 **EXEMPLE CONCRET**

**Situation** :
- Nous sommes le **9 novembre 2025**
- Bien : Appartement avec bail de **1 800€/mois**
- Prêt : **200 000€** à **2% sur 20 ans**

**Calcul actuel (incomplet)** :
```
Loyers : 9 000 €  (5 paiements enregistrés en transactions)
Charges : 3 500 € (taxes + travaux en transactions)
❌ Manque : 3 mois de loyers (oct-nov-déc) = 5 400 €
❌ Manque : Intérêts emprunt = ~500 €
```

**Calcul proposé (complet)** :
```
Loyers : 14 400 €
  ├─ Passé (janv-sept) : 9 000 €
  └─ Projection (oct-déc) : 5 400 €

Charges : 5 200 €
  ├─ Passé : 3 500 €
  ├─ Projection : 1 200 €
  └─ Intérêts emprunt : 500 € (400 passé + 100 futur)
```

---

## 🤔 **QUESTION POUR VOUS**

**Voulez-vous que je** :

### **Option A : Implémentation complète** 🏗️ (2-3h)
- ✅ Intérêts d'emprunt (passé + projection)
- ✅ Projection loyers/charges (reste de l'année)
- ✅ Breakdown détaillé dans l'UI
- ✅ Options de configuration

### **Option B : Juste les intérêts d'emprunt** ⚡ (30 min)
- ✅ Intérêts d'emprunt (passé + projection)
- ❌ Pas de projection loyers/charges
- ✅ Simple et rapide

### **Option C : On laisse comme ça** 🤷
- ✅ Fonctionnel pour les tests
- ❌ Incomplet pour une vraie simulation

---

## 💡 **MA RECOMMANDATION : Option A**

**Pourquoi ?**
- Une simulation fiscale **doit être précise** pour être utile
- Les intérêts d'emprunt sont **déductibles** → Impact majeur sur l'IR
- La projection permet de **simuler l'année complète** (pas juste 9 mois)
- Vous voulez un outil **professionnel** → Il faut des données complètes

**Mais** :
- ⏱️ Ça prend 2-3h (peut-être sur plusieurs sessions)
- 🧪 Nécessite des tests approfondis

---

**Qu'en pensez-vous ? Je fais l'Option A (complet) ou B (juste intérêts) ?** 🤔


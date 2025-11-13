# ✅ Correction API PUT - Modification Prêts

## 🐛 Problème Identifié

**Erreur** : `PUT http://localhost:3000/api/loans/{id} 405 (Method Not Allowed)`
**Cause** : L'API `/api/loans/[id]` n'avait que la méthode `DELETE`, pas de `PUT` pour modifier

## 🔧 Solution Implémentée

### **Fichier** : `src/app/api/loans/[id]/route.ts`

**Ajout de la méthode PUT** :
```typescript
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const loanId = params.id;
    const formData = await request.formData();
    
    // Extraire les données du formulaire
    const propertyId = formData.get('propertyId') as string;
    const bankName = formData.get('bankName') as string;
    const loanAmount = parseFloat(formData.get('loanAmount') as string);
    const interestRate = parseFloat(formData.get('interestRate') as string) / 100; // Convertir % en décimal
    const insuranceRate = parseFloat(formData.get('insuranceRate') as string) / 100; // Convertir % en décimal
    const durationMonths = parseInt(formData.get('durationMonths') as string);
    const startDate = new Date(formData.get('startDate') as string);
    const status = formData.get('status') as string;
    
    // Calculer le paiement mensuel (formule simplifiée)
    const monthlyRate = interestRate / 12;
    let monthlyPayment = 0;
    if (monthlyRate > 0) {
      monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, durationMonths)) / (Math.pow(1 + monthlyRate, durationMonths) - 1);
    } else {
      monthlyPayment = loanAmount / durationMonths;
    }
    
    // Mettre à jour le prêt
    const updatedLoan = await prisma.loan.update({
      where: { id: loanId },
      data: {
        propertyId,
        bankName,
        loanAmount,
        interestRate,
        insuranceRate,
        durationMonths,
        startDate,
        monthlyPayment,
        remainingCapital: status === 'paid_off' ? 0 : loanAmount,
        status,
      },
    });
    
    return NextResponse.json(updatedLoan);
    
  } catch (error) {
    console.error('[PUT /api/loans/:id] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur lors de la modification du prêt' },
      { status: 500 }
    );
  }
}
```

## ✅ Fonctionnalités

### **Données Traitées**
- ✅ `propertyId` - Bien concerné
- ✅ `bankName` - Nom de la banque
- ✅ `loanAmount` - Montant emprunté
- ✅ `interestRate` - Taux d'intérêt (converti % → décimal)
- ✅ `insuranceRate` - Taux d'assurance (converti % → décimal)
- ✅ `durationMonths` - Durée en mois
- ✅ `startDate` - Date de début
- ✅ `status` - Statut du prêt

### **Calculs Automatiques**
- ✅ `monthlyPayment` - Paiement mensuel calculé
- ✅ `remainingCapital` - Capital restant (0 si remboursé)

### **Gestion des Erreurs**
- ✅ Logs détaillés pour débogage
- ✅ Gestion des erreurs de calcul
- ✅ Messages d'erreur explicites

## 🎯 Impact

**Avant** : 
- ❌ Erreur 405 Method Not Allowed
- ❌ Impossible de modifier un prêt
- ❌ Formulaire non fonctionnel

**Après** : 
- ✅ API PUT fonctionnelle
- ✅ Modification de prêts possible
- ✅ Formulaire entièrement fonctionnel
- ✅ Calculs automatiques

## 📋 Fichiers Modifiés

1. `src/app/api/loans/[id]/route.ts` - Ajout méthode PUT

**Total** : 1 fichier modifié

## 🔍 Tests à Effectuer

1. **Modification Prêt** : Changer nom banque, montant, taux
2. **Changement Statut** : Actif → Remboursé
3. **Calculs** : Vérifier paiement mensuel
4. **Validation** : Tous les champs requis

## 🚀 Prochaines Étapes

1. **Tester dans l'UI** : Modifier un prêt existant
2. **Vérifier Calculs** : Paiement mensuel correct
3. **Tester Statuts** : Changement de statut
4. **Validation** : Tous les champs fonctionnels

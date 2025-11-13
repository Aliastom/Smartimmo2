# 📋 TODOs Restants - Gestion Déléguée

## ✅ Infrastructure complète (9/12)

Tout est prêt côté backend et structure. Il reste **2 modifications UI** + **1 intégration API critique**.

---

## TODO 10: Modifier modale Transaction loyer

### Fichier à modifier:
`src/components/transactions/TransactionModal.tsx`

### 1. Ajouter les champs au formData (ligne ~60)

```typescript
const [formData, setFormData] = useState<TransactionFormData>({
  propertyId: '',
  leaseId: '',
  tenantId: '',
  date: new Date().toISOString().split('T')[0],
  natureId: '',
  categoryId: '',
  label: '',
  amount: 0,
  reference: '',
  paymentDate: '',
  paymentMethod: '',
  notes: '',
  periodStart: '',
  monthsCovered: 1,
  autoDistribution: false,
  // ⬇️ AJOUTER CES LIGNES
  montantLoyer: 0,
  chargesRecup: 0,
  chargesNonRecup: 0
});
```

### 2. Ajouter l'interface TypeScript (ligne ~22)

```typescript
interface TransactionFormData {
  propertyId: string;
  leaseId: string;
  tenantId: string;
  date: string;
  natureId: string;
  categoryId: string;
  label: string;
  amount: number;
  reference: string;
  paymentDate: string;
  paymentMethod: string;
  notes: string;
  periodStart: string;
  monthsCovered: number;
  autoDistribution: boolean;
  // ⬇️ AJOUTER CES LIGNES
  montantLoyer?: number;
  chargesRecup?: number;
  chargesNonRecup?: number;
}
```

### 3. Préremplir depuis le Bail sélectionné

Ajouter un `useEffect` après le chargement des données:

```typescript
// Préremplir depuis le bail sélectionné
useEffect(() => {
  if (!formData.leaseId || !leases.length) return;
  
  const selectedLease = leases.find(l => l.id === formData.leaseId);
  if (!selectedLease) return;
  
  // Si c'est un loyer et qu'on n'a pas encore rempli
  const isRentNature = formData.natureId?.includes('LOYER');
  if (isRentNature && !manuallyEditedFields.has('montantLoyer')) {
    setFormData(prev => ({
      ...prev,
      montantLoyer: selectedLease.rentAmount || 0,
      chargesRecup: selectedLease.chargesRecupMensuelles || 0,
      chargesNonRecup: selectedLease.chargesNonRecupMensuelles || 0,
      amount: (selectedLease.rentAmount || 0) + (selectedLease.chargesRecupMensuelles || 0)
    }));
    setAutoFields(prev => new Set(prev).add('montantLoyer').add('chargesRecup').add('chargesNonRecup').add('amount'));
  }
}, [formData.leaseId, formData.natureId, leases, manuallyEditedFields]);
```

### 4. Ajouter les champs dans le formulaire (après les champs existants)

Chercher la section des champs de montant et ajouter après:

```tsx
{/* Granularité pour loyers (Gestion déléguée) */}
{process.env.NEXT_PUBLIC_ENABLE_GESTION_SOCIETE === 'true' && 
 (formData.natureId?.includes('LOYER') || formData.natureId?.includes('RENT')) && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
    <h4 className="text-sm font-medium text-blue-900">
      Détail du loyer (optionnel)
    </h4>
    
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Loyer hors charges (€)
        </label>
        <input
          type="number"
          step="0.01"
          value={formData.montantLoyer || ''}
          onChange={(e) => handleFieldChange('montantLoyer', parseFloat(e.target.value) || 0)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          placeholder="Ex: 558.26"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Charges récupérables (€)
        </label>
        <input
          type="number"
          step="0.01"
          value={formData.chargesRecup || ''}
          onChange={(e) => handleFieldChange('chargesRecup', parseFloat(e.target.value) || 0)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          placeholder="Ex: 20.00"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Charges non-récup. (€)
        </label>
        <input
          type="number"
          step="0.01"
          value={formData.chargesNonRecup || ''}
          onChange={(e) => handleFieldChange('chargesNonRecup', parseFloat(e.target.value) || 0)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          placeholder="Ex: 35.00"
        />
      </div>
    </div>
    
    {/* Total payé par le locataire */}
    <div className="bg-white rounded p-3 border border-blue-200">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          Total payé par le locataire:
        </span>
        <span className="text-lg font-bold text-blue-900">
          {((formData.montantLoyer || 0) + (formData.chargesRecup || 0)).toFixed(2)} €
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        = Loyer + Charges récupérables
      </p>
    </div>
  </div>
)}
```

### 5. Ajouter l'encart commission estimée

Juste après le bloc de granularité:

```tsx
{/* Encart Commission estimée */}
{process.env.NEXT_PUBLIC_ENABLE_GESTION_SOCIETE === 'true' && 
 formData.propertyId && 
 formData.montantLoyer > 0 && 
 (() => {
   const selectedProperty = properties.find(p => p.id === formData.propertyId);
   if (!selectedProperty?.managementCompany || !selectedProperty.managementCompany.actif) return null;
   
   const company = selectedProperty.managementCompany;
   
   // Calcul de la commission
   const base = company.modeCalcul === 'REVENUS_TOTAUX' 
     ? (formData.montantLoyer || 0) + (formData.chargesRecup || 0)
     : (formData.montantLoyer || 0);
   
   let commission = base * company.taux;
   if (company.fraisMin) {
     commission = Math.max(commission, company.fraisMin);
   }
   
   const commissionTTC = company.tvaApplicable 
     ? commission * (1 + (company.tauxTva || 0) / 100)
     : commission;
   
   return (
     <div className="bg-green-50 border border-green-200 rounded-lg p-4">
       <div className="flex items-center gap-2 mb-3">
         <span className="text-green-700">⚙️</span>
         <h4 className="text-sm font-medium text-green-900">
           Commission de gestion estimée
         </h4>
       </div>
       
       <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
         <span className="text-gray-600">Base de calcul:</span>
         <span className="font-medium text-right">{base.toFixed(2)} €</span>
         
         <span className="text-gray-600">Taux:</span>
         <span className="font-medium text-right">{(company.taux * 100).toFixed(2)}%</span>
         
         {company.fraisMin && (
           <>
             <span className="text-gray-600">Minimum:</span>
             <span className="font-medium text-right">{company.fraisMin.toFixed(2)} €</span>
           </>
         )}
         
         {company.tvaApplicable && (
           <>
             <span className="text-gray-600">TVA ({company.tauxTva}%):</span>
             <span className="font-medium text-right">
               {(commissionTTC - commission).toFixed(2)} €
             </span>
           </>
         )}
         
         <span className="text-gray-700 font-medium">Commission {company.tvaApplicable ? 'TTC' : 'HT'}:</span>
         <span className="font-bold text-green-900 text-right text-lg">
           {commissionTTC.toFixed(2)} €
         </span>
       </div>
       
       <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
         <span>💡</span>
         La commission sera créée automatiquement lors de l'enregistrement
       </p>
     </div>
   );
 })()}
```

### 6. Modifier handleSubmit pour envoyer les nouveaux champs

Dans la fonction `handleSubmit`, ajouter les champs au payload:

```typescript
const payload = {
  ...formData,
  // ... autres champs existants
  montantLoyer: formData.montantLoyer || undefined,
  chargesRecup: formData.chargesRecup || undefined,
  chargesNonRecup: formData.chargesNonRecup || undefined,
};
```

---

## TODO 11: Liste transactions - Affichage commissions indentées

### Fichier à trouver:
Probablement `src/app/transactions/page.tsx` ou composant liste des transactions

### Modifications à faire:

### 1. Détecter les transactions avec parent

Dans le rendu de la liste, grouper les transactions par parent:

```typescript
// Grouper les transactions
const groupedTransactions = useMemo(() => {
  const groups: Map<string, any[]> = new Map();
  const standaloneTransactions: any[] = [];
  
  transactions.forEach(transaction => {
    if (transaction.parentTransactionId) {
      // C'est une transaction enfant (commission)
      const siblings = groups.get(transaction.parentTransactionId) || [];
      groups.set(transaction.parentTransactionId, [...siblings, transaction]);
    } else {
      // Transaction standalone ou parent
      standaloneTransactions.push(transaction);
    }
  });
  
  return { groups, standaloneTransactions };
}, [transactions]);
```

### 2. Affichage indenté

```tsx
{groupedTransactions.standaloneTransactions.map(transaction => (
  <React.Fragment key={transaction.id}>
    {/* Transaction principale */}
    <TransactionRow transaction={transaction} />
    
    {/* Commissions liées (indentées) */}
    {groupedTransactions.groups.get(transaction.id)?.map(childTransaction => (
      <div key={childTransaction.id} className="bg-gray-50">
        <TransactionRow 
          transaction={childTransaction}
          isChild={true}
          className="ml-8 border-l-4 border-blue-200"
        />
      </div>
    ))}
  </React.Fragment>
))}
```

### 3. Badge "Auto (Gestion)"

Dans le composant `TransactionRow`:

```tsx
{transaction.isAuto && transaction.autoSource === 'gestion' && (
  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
    <span className="text-sm">⚙️</span>
    Auto (Gestion)
  </span>
)}
```

### 4. Filtres additionnels (optionnel mais recommandé)

Ajouter deux filtres:

```tsx
<label className="flex items-center gap-2">
  <input 
    type="checkbox" 
    checked={showManagementFees}
    onChange={(e) => setShowManagementFees(e.target.checked)}
  />
  <span className="text-sm">Inclure frais de gestion</span>
</label>

<label className="flex items-center gap-2">
  <input 
    type="checkbox" 
    checked={groupByParent}
    onChange={(e) => setGroupByParent(e.target.checked)}
  />
  <span className="text-sm">Grouper par parent</span>
</label>
```

---

## CRITIQUE: Intégration API transactions

### Fichier: `src/app/api/transactions/route.ts`

### Dans la fonction POST (création)

Après la création de la transaction principale (ligne ~450), ajouter:

```typescript
// Import en haut du fichier
import { 
  createManagementCommission, 
  shouldCreateCommission 
} from '@/lib/services/managementCommissionService';

// Dans la fonction POST, après création de la transaction
for (let i = 0; i < monthsCovered; i++) {
  // ... code existant de création de transaction ...
  
  const transaction = await tx.transaction.create({ /* ... */ });
  transactions.push(transaction);
  
  // ⬇️ AJOUTER CE BLOC
  // Créer la commission si applicable
  if (process.env.ENABLE_GESTION_SOCIETE === 'true') {
    const isRentNature = transaction.nature?.includes('LOYER') || 
                         transaction.nature?.includes('RENT');
    
    if (isRentNature && body.montantLoyer) {
      try {
        await createManagementCommission({
          transactionId: transaction.id,
          propertyId: transaction.propertyId,
          montantLoyer: body.montantLoyer,
          chargesRecup: body.chargesRecup || 0,
          date: transaction.date,
          accountingMonth: transaction.accountingMonth || currentMonth,
          leaseId: transaction.leaseId || undefined,
          bailId: transaction.bailId || undefined,
        }, tx); // Passer la transaction Prisma pour cohérence
        
        console.log(`[Commission] Créée pour transaction ${transaction.id}`);
      } catch (error) {
        console.error('[Commission] Erreur:', error);
        // Ne pas bloquer la création de la transaction
      }
    }
  }
}
```

### Dans la fonction PATCH (édition)

À implémenter si nécessaire (mise à jour de la commission liée).

### Dans la fonction DELETE (suppression)

À implémenter si nécessaire (suppression cascade de la commission).

---

## 🎯 Ordre d'implémentation recommandé

1. ✅ **FAIT** - Configuration `.env.local`
2. **TODO 10** - Modale Transaction loyer (30 min)
3. **Intégration API** - Hook POST transactions (15 min)
4. **TODO 11** - Liste transactions indentées (20 min)
5. **Tests manuels** - Vérifier le flux complet

---

## ⚡ Résumé rapide

**Ce qui manque:**
- Ajouter 3 champs dans la modale transaction: `montantLoyer`, `chargesRecup`, `chargesNonRecup`
- Afficher l'encart "Commission estimée" quand un bien a une société liée
- Affichage indenté des commissions dans la liste
- Hook dans `POST /api/transactions` pour auto-créer la commission

**Temps estimé:** 1h-1h30 de développement pur

**Fichiers principaux:**
1. `src/components/transactions/TransactionModal.tsx`
2. `src/app/api/transactions/route.ts`
3. Liste transactions (à identifier)

---

💡 **Tout le reste est déjà fait et fonctionnel !**


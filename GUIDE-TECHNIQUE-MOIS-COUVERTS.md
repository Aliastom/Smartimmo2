# 🛠️ GUIDE TECHNIQUE - SYSTÈME "MOIS COUVERTS"

## 📐 ARCHITECTURE

### Vue d'ensemble
Le système de transactions multi-mois est implémenté selon le pattern suivant :

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (UI)                        │
│                                                         │
│  TransactionModalV2.tsx                                │
│  ┌────────────────────────────────────────────┐       │
│  │ MODE CRÉATION                              │       │
│  │ - Champ "Nombre de mois couverts" (1-12)  │       │
│  │ - Validation via createTransactionSchema   │       │
│  └────────────────────────────────────────────┘       │
│                                                         │
│  ┌────────────────────────────────────────────┐       │
│  │ MODE ÉDITION                               │       │
│  │ - Badge "Série (N) — i/N" (readonly)      │       │
│  │ - Champ masqué                             │       │
│  │ - Validation via updateTransactionSchema   │       │
│  └────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  BACKEND (API)                          │
│                                                         │
│  POST /api/transactions                                │
│  ┌────────────────────────────────────────────┐       │
│  │ if (monthsCovered > 1) {                  │       │
│  │   for (i = 0; i < N; i++) {              │       │
│  │     createTransaction({                   │       │
│  │       parentTransactionId: tx1.id,       │       │
│  │       moisIndex: i + 1,                  │       │
│  │       moisTotal: N                       │       │
│  │     })                                    │       │
│  │   }                                       │       │
│  │ }                                         │       │
│  └────────────────────────────────────────────┘       │
│                                                         │
│  PUT /api/transactions/:id                             │
│  ┌────────────────────────────────────────────┐       │
│  │ delete body.parentTransactionId            │       │
│  │ delete body.moisIndex                      │       │
│  │ delete body.moisTotal                      │       │
│  │ → Protection des champs série              │       │
│  └────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                 BASE DE DONNÉES                         │
│                                                         │
│  Table: Transaction                                    │
│  ┌────────────────────────────────────────────┐       │
│  │ id                      STRING  PK         │       │
│  │ amount                  FLOAT              │       │
│  │ label                   STRING             │       │
│  │ date                    DATETIME           │       │
│  │ ...                                        │       │
│  │ parentTransactionId     STRING  (nullable) │       │
│  │ moisIndex               INT     (nullable) │       │
│  │ moisTotal               INT     (nullable) │       │
│  └────────────────────────────────────────────┘       │
│                                                         │
│  Index: parentTransactionId_idx                        │
└─────────────────────────────────────────────────────────┘
```

## 🔍 DÉTAILS D'IMPLÉMENTATION

### 1. Schéma Prisma

```prisma
model Transaction {
  // Champs existants
  id              String     @id @default(cuid())
  propertyId      String
  amount          Float
  label           String
  date            DateTime
  monthsCovered   String?    // Stocké comme String pour compatibilité
  
  // NOUVEAUX : Champs de série
  parentTransactionId String?  // NULL si transaction simple, ID tx parent si série
  moisIndex           Int?     // 1..N, position dans la série
  moisTotal           Int?     // N, nombre total de mois
  
  // Relations et autres champs...
  
  @@index([parentTransactionId])  // Index pour requêtes rapides
}
```

**Logique des champs** :
- Transaction simple : `parentTransactionId` = `null`, `moisIndex` = `null`, `moisTotal` = `null`
- Transaction de série :
  - Transaction 1/3 : `parentTransactionId` = `"tx1"` (elle-même), `moisIndex` = `1`, `moisTotal` = `3`
  - Transaction 2/3 : `parentTransactionId` = `"tx1"`, `moisIndex` = `2`, `moisTotal` = `3`
  - Transaction 3/3 : `parentTransactionId` = `"tx1"`, `moisIndex` = `3`, `moisTotal` = `3`

### 2. API POST - Création

**Fichier** : `src/app/api/transactions/route.ts`

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json();
  
  const result = await prisma.$transaction(async (tx) => {
    const monthsCovered = body.monthsCovered ? parseInt(body.monthsCovered) : 1;
    const baseDate = new Date(body.date);
    const transactions = [];
    
    let parentId: string | null = null;

    for (let i = 0; i < monthsCovered; i++) {
      // Calculer la date pour ce mois
      const transactionDate = new Date(
        baseDate.getFullYear(), 
        baseDate.getMonth() + i, 
        1
      );
      
      // Adapter le libellé
      let label = body.label;
      if (monthsCovered > 1) {
        const monthNames = ['janvier', 'février', 'mars', ...];
        const monthName = monthNames[transactionDate.getMonth()];
        const year = transactionDate.getFullYear();
        label = `${body.label} - ${monthName} ${year}`;
      }

      const transaction = await tx.transaction.create({
        data: {
          // ... tous les champs standards ...
          
          // CHAMPS DE SÉRIE
          parentTransactionId: monthsCovered > 1 
            ? (i === 0 ? null : parentId) 
            : null,
          moisIndex: monthsCovered > 1 ? i + 1 : null,
          moisTotal: monthsCovered > 1 ? monthsCovered : null
        }
      });
      
      // Stocker l'ID de la première transaction
      if (i === 0 && monthsCovered > 1) {
        parentId = transaction.id;
        // Mettre à jour la première pour qu'elle se référence elle-même
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { parentTransactionId: transaction.id }
        });
      }
      
      transactions.push(transaction);
    }

    return {
      transaction: transactions[0],
      totalCreated: transactions.length,
      transactions: transactions
    };
  });

  return NextResponse.json(result, { status: 201 });
}
```

**Points clés** :
1. Boucle de 1 à N pour créer toutes les transactions
2. Calcul automatique de la date (mois + i)
3. Adaptation du libellé avec le nom du mois
4. Attribution des champs de série
5. Première transaction se référence elle-même comme parent

### 3. API PUT - Édition

**Fichier** : `src/app/api/transactions/[id]/route.ts`

```typescript
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  
  // PROTECTION : Supprimer les champs de série s'ils sont présents
  delete (body as any).parentTransactionId;
  delete (body as any).moisIndex;
  delete (body as any).moisTotal;
  
  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.update({
      where: { id: params.id },
      data: {
        // Uniquement les champs modifiables
        amount: parseFloat(body.amount),
        label: body.label,
        date: new Date(body.date),
        // ... autres champs ...
        
        // parentTransactionId, moisIndex, moisTotal : IGNORÉS
      }
    });

    return { transaction };
  });

  return NextResponse.json(result);
}
```

**Points clés** :
1. Suppression explicite des champs de série du body
2. Commentaires de sécurité
3. Seule la transaction courante est modifiée

### 4. Frontend - Modal UI

**Fichier** : `src/components/transactions/TransactionModalV2.tsx`

#### A. Chargement en mode édition

```typescript
// Si mode édition, charger les champs de série
if (mode === 'edit' && transactionId) {
  const transactionData = await fetch(`/api/transactions/${transactionId}`);
  
  // Charger tous les champs
  setValue('amount', transactionData.amount);
  setValue('label', transactionData.label);
  // ...
  
  // CHARGER LES CHAMPS DE SÉRIE (readonly)
  if (transactionData.parentTransactionId) {
    setValue('parentTransactionId' as any, transactionData.parentTransactionId);
  }
  if (transactionData.moisIndex) {
    setValue('moisIndex' as any, transactionData.moisIndex);
  }
  if (transactionData.moisTotal) {
    setValue('moisTotal' as any, transactionData.moisTotal);
  }
}
```

#### B. Affichage conditionnel du champ

```tsx
{activeTab === 'periode' && (
  <div className="space-y-6">
    {/* Mois et Année */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <Label>Mois</Label>
        <select {...register('periodMonth')}>
          <option value="01">Janvier</option>
          {/* ... */}
        </select>
      </div>
      <div>
        <Label>Année</Label>
        <Input type="number" {...register('periodYear')} />
      </div>
    </div>
    
    {/* CHAMP CONDITIONNEL : Visible UNIQUEMENT en création */}
    {mode === 'create' && (
      <div>
        <Label htmlFor="monthsCovered">
          Nombre de mois couverts
        </Label>
        <Input
          type="number"
          min="1"
          max="12"
          {...register('monthsCovered')}
          placeholder="1"
        />
        <p className="text-xs text-gray-500 mt-1">
          Si supérieur à 1, plusieurs transactions mensuelles 
          seront créées automatiquement
        </p>
      </div>
    )}
    
    {/* BADGE CONDITIONNEL : Visible UNIQUEMENT en édition si série */}
    {mode === 'edit' && watch('moisTotal' as any) && watch('moisIndex' as any) && (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <p className="text-sm text-blue-900 font-medium flex items-center gap-2">
              Transaction multi-mois
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                Série ({watch('moisTotal' as any)}) — {watch('moisIndex' as any)}/{watch('moisTotal' as any)}
              </Badge>
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Cette transaction fait partie d'une série de {watch('moisTotal' as any)} mois. 
              Le nombre de mois couverts n'est modifiable qu'à la création.
            </p>
          </div>
        </div>
      </div>
    )}
  </div>
)}
```

### 5. Validation Zod

**Fichier** : `src/lib/validations/transaction.ts`

```typescript
// Schéma de base commun
const baseTransactionSchema = {
  propertyId: z.string().min(1, 'Le bien est obligatoire'),
  amount: z.number().min(0.01, 'Le montant doit être supérieur à 0'),
  label: z.string().optional(),
  date: z.string().min(1, 'La date est obligatoire'),
  // ... autres champs ...
};

// CRÉATION : Avec monthsCovered
export const createTransactionSchema = z.object({
  ...baseTransactionSchema,
  monthsCovered: z.number().int().min(1, 'Au moins 1 mois doit être couvert').default(1)
});

// ÉDITION : Sans monthsCovered
export const updateTransactionSchema = z.object({
  ...baseTransactionSchema
  // monthsCovered : ABSENT
  // parentTransactionId, moisIndex, moisTotal : ABSENTS
});

// Types TypeScript
export type CreateTransactionData = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionData = z.infer<typeof updateTransactionSchema>;
```

## 🔐 SÉCURITÉ

### Protection multi-niveaux

1. **Validation Zod** : Les schémas séparés empêchent l'envoi de champs non autorisés
2. **Backend** : Suppression explicite des champs sensibles avant mise à jour
3. **UI** : Champs non affichés en mode édition

### Scénarios de sécurité

#### Tentative de modification des champs série
```typescript
// Requête malveillante
PUT /api/transactions/tx2
{
  amount: 1500,
  parentTransactionId: "HACKED",  // ❌ Sera supprimé
  moisIndex: 999,                 // ❌ Sera supprimé
  moisTotal: 999                  // ❌ Sera supprimé
}

// Traitement backend
delete body.parentTransactionId;  // ✅ Suppression
delete body.moisIndex;            // ✅ Suppression
delete body.moisTotal;            // ✅ Suppression

// Résultat : Seul 'amount' est mis à jour
```

## 📊 REQUÊTES SQL UTILES

### Trouver toutes les transactions d'une série
```sql
SELECT * FROM Transaction 
WHERE parentTransactionId = 'tx1' 
ORDER BY moisIndex;
```

### Compter les transactions de série
```sql
SELECT COUNT(*) FROM Transaction 
WHERE parentTransactionId IS NOT NULL;
```

### Trouver les séries incomplètes
```sql
SELECT parentTransactionId, COUNT(*) as count, MAX(moisTotal) as expected
FROM Transaction
WHERE parentTransactionId IS NOT NULL
GROUP BY parentTransactionId
HAVING count != expected;
```

## 🧪 TESTS UNITAIRES SUGGÉRÉS

### Backend

```typescript
describe('POST /api/transactions', () => {
  it('should create 1 transaction when monthsCovered = 1', async () => {
    const response = await fetch('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({ 
        ...validData, 
        monthsCovered: 1 
      })
    });
    const result = await response.json();
    expect(result.totalCreated).toBe(1);
    expect(result.transaction.parentTransactionId).toBeNull();
  });

  it('should create N transactions when monthsCovered = N', async () => {
    const response = await fetch('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({ 
        ...validData, 
        monthsCovered: 5 
      })
    });
    const result = await response.json();
    expect(result.totalCreated).toBe(5);
    expect(result.transactions).toHaveLength(5);
    
    // Vérifier les champs de série
    result.transactions.forEach((tx, i) => {
      expect(tx.parentTransactionId).toBe(result.transactions[0].id);
      expect(tx.moisIndex).toBe(i + 1);
      expect(tx.moisTotal).toBe(5);
    });
  });
});

describe('PUT /api/transactions/:id', () => {
  it('should not update serie fields', async () => {
    const existingTx = await createTransaction({ 
      ...validData, 
      monthsCovered: 3 
    });
    
    const response = await fetch(`/api/transactions/${existingTx.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        amount: 2000,
        parentTransactionId: 'HACKED',
        moisIndex: 999
      })
    });
    
    const updated = await response.json();
    expect(updated.amount).toBe(2000);
    expect(updated.parentTransactionId).toBe(existingTx.parentTransactionId); // Inchangé
    expect(updated.moisIndex).toBe(existingTx.moisIndex); // Inchangé
  });
});
```

### Frontend

```typescript
describe('TransactionModal', () => {
  it('should show monthsCovered field in create mode', () => {
    render(<TransactionModal mode="create" />);
    expect(screen.getByLabelText('Nombre de mois couverts')).toBeInTheDocument();
  });

  it('should hide monthsCovered field in edit mode', () => {
    render(<TransactionModal mode="edit" transactionId="tx1" />);
    expect(screen.queryByLabelText('Nombre de mois couverts')).not.toBeInTheDocument();
  });

  it('should show serie badge in edit mode for serie transaction', async () => {
    // Mock transaction de série
    mockFetch({ 
      moisIndex: 2, 
      moisTotal: 5 
    });
    
    render(<TransactionModal mode="edit" transactionId="tx2" />);
    
    await waitFor(() => {
      expect(screen.getByText(/Série \(5\) — 2\/5/)).toBeInTheDocument();
    });
  });
});
```

## 📈 PERFORMANCE

### Optimisations

1. **Index sur `parentTransactionId`** : Requêtes rapides pour retrouver une série complète
   ```sql
   CREATE INDEX "Transaction_parentTransactionId_idx" ON "Transaction"("parentTransactionId");
   ```

2. **Création en transaction** : Toutes les insertions dans une seule transaction Prisma
   ```typescript
   await prisma.$transaction(async (tx) => {
     // Créer toutes les transactions
   });
   ```

3. **Lazy loading** : Les champs de série ne sont chargés qu'en mode édition

### Métriques attendues

- Création de 12 transactions : ~500ms
- Requête d'une série complète : ~50ms (avec index)
- Édition d'une transaction : ~100ms

## 🚀 EXTENSIONS FUTURES

### 1. Vue "Série complète"
Afficher toutes les transactions d'une série dans une seule modal :

```typescript
// Nouvelle API
GET /api/transactions/:id/serie
Response: {
  parent: Transaction,
  children: Transaction[]
}

// Nouvelle page
/transactions/serie/:parentId
```

### 2. Modification en masse
Modifier toutes les transactions d'une série en une fois :

```typescript
PUT /api/transactions/serie/:parentId
{
  amount: 1500,  // Appliqué à toutes les transactions
  applyToAll: true
}
```

### 3. Filtres avancés
Ajouter des filtres dans la liste des transactions :

- "Transactions de série uniquement"
- "Transactions simples uniquement"
- "Transactions orphelines" (série incomplète)

### 4. Rapports
Créer des rapports spécifiques :

- Séries actives par propriété
- Séries terminées vs en cours
- Montants totaux par série

## 📝 CHECKLIST DE DÉPLOIEMENT

- [ ] Migration appliquée sur la base de données de production
- [ ] Tests manuels effectués (création, édition)
- [ ] Tests automatisés passés
- [ ] Documentation mise à jour
- [ ] Monitoring en place (logs, métriques)
- [ ] Rollback plan préparé
- [ ] Formation des utilisateurs

## 📞 SUPPORT

En cas de problème :
1. Vérifier les logs backend pour les erreurs de création
2. Vérifier que la migration est bien appliquée
3. Inspecter les requêtes API dans DevTools
4. Consulter `REGLES-MOIS-COUVERTS-RESUME.md` pour les tests


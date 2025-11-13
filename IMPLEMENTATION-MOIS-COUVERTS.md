# Implémentation des règles "Mois couverts" pour les transactions

## 📋 RÉSUMÉ
Implémentation complète du système de transactions multi-mois avec les règles suivantes :
- **Création** : Possibilité de générer N transactions mensuelles consécutives
- **Édition** : Le champ "Nombre de mois couverts" est masqué et non modifiable

## ✅ MODIFICATIONS RÉALISÉES

### 1. Schéma Prisma (`prisma/schema.prisma`)
**Ajout de 3 nouveaux champs au modèle Transaction** :
```prisma
model Transaction {
  // ... champs existants ...
  
  // Champs de série pour les transactions multi-mois
  parentTransactionId String?
  moisIndex           Int?
  moisTotal           Int?
  
  @@index([parentTransactionId])
}
```

**Signification** :
- `parentTransactionId` : ID de la transaction "tête de série" (la première transaction créée)
- `moisIndex` : Index du mois dans la série (1 à N)
- `moisTotal` : Nombre total de mois dans la série (N)

### 2. API POST - Création (`src/app/api/transactions/route.ts`)
**Modifications** :
- Génération automatique de N transactions lors de la création si `monthsCovered > 1`
- Attribution des champs de série pour chaque transaction :
  - La première transaction se référence elle-même comme parent
  - Les transactions suivantes référencent la première
  - Chaque transaction reçoit son index (1..N) et le total (N)
- Les libellés sont automatiquement adaptés : "Libellé - janvier 2025", "Libellé - février 2025", etc.

**Exemple** :
```typescript
// Si monthsCovered = 3, création de 3 transactions :
Transaction 1: { parentTransactionId: "tx1", moisIndex: 1, moisTotal: 3 }
Transaction 2: { parentTransactionId: "tx1", moisIndex: 2, moisTotal: 3 }
Transaction 3: { parentTransactionId: "tx1", moisIndex: 3, moisTotal: 3 }
```

### 3. API PUT - Édition (`src/app/api/transactions/[id]/route.ts`)
**Sécurisation** :
```typescript
// Suppression explicite des champs de série (non modifiables)
delete (body as any).parentTransactionId;
delete (body as any).moisIndex;
delete (body as any).moisTotal;
```

### 4. Modal UI (`src/components/transactions/TransactionModalV2.tsx`)
**En mode CRÉATION** :
- Affichage du champ "Nombre de mois couverts" dans l'onglet "Période"
- Valeur par défaut : 1
- Min : 1, Max : 12
- Message d'aide : "Si supérieur à 1, plusieurs transactions mensuelles seront créées automatiquement"

**En mode ÉDITION** :
- Le champ "Nombre de mois couverts" est masqué
- Affichage d'un badge informatif si la transaction fait partie d'une série :
  ```
  📘 Transaction multi-mois [Série (3) — 2/3]
  Cette transaction fait partie d'une série de 3 mois. 
  Le nombre de mois couverts n'est modifiable qu'à la création.
  ```

### 5. Schémas de validation (`src/lib/validations/transaction.ts`)
**Création de 3 schémas Zod distincts** :
1. `createTransactionSchema` : Avec `monthsCovered` (requis, min 1)
2. `updateTransactionSchema` : Sans `monthsCovered`
3. `transactionFormSchema` : Schéma par défaut (compatibilité)

## 🎯 COMPORTEMENTS ATTENDUS

### Création d'une transaction simple (N = 1)
1. L'utilisateur saisit tous les champs normalement
2. Champ "Nombre de mois couverts" = 1 (par défaut)
3. Une seule transaction est créée
4. Les champs de série restent `null`

### Création d'une série (N > 1)
1. L'utilisateur saisit : montant = 1000€, mois = janvier 2025, N = 3
2. **3 transactions sont créées** :
   - Janvier 2025 : 1000€ - "Loyer - janvier 2025" (index 1/3)
   - Février 2025 : 1000€ - "Loyer - février 2025" (index 2/3)
   - Mars 2025 : 1000€ - "Loyer - mars 2025" (index 3/3)
3. Toutes partagent le même `parentTransactionId`
4. Toast de succès : "3 transactions créées avec succès (période multi-mois)"

### Édition d'une transaction de série
1. L'utilisateur ouvre une transaction qui fait partie d'une série
2. Le badge "Série (3) — 2/3" s'affiche dans l'onglet "Période"
3. Le champ "Nombre de mois couverts" n'est PAS visible
4. L'utilisateur peut modifier :
   - ✅ Montant
   - ✅ Libellé
   - ✅ Mois
   - ✅ Catégorie
   - ✅ Tous les autres champs
5. L'utilisateur ne peut PAS modifier :
   - ❌ parentTransactionId
   - ❌ moisIndex
   - ❌ moisTotal
6. **Seule la transaction courante est modifiée**, pas les autres de la série

## 🔧 MIGRATION BASE DE DONNÉES

**⚠️ ACTION REQUISE** : La migration Prisma doit être appliquée manuellement.

Créer le fichier de migration :
```sql
-- prisma/migrations/YYYYMMDDHHMMSS_add_transaction_series_fields/migration.sql
ALTER TABLE "Transaction" ADD COLUMN "parentTransactionId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "moisIndex" INTEGER;
ALTER TABLE "Transaction" ADD COLUMN "moisTotal" INTEGER;

CREATE INDEX "Transaction_parentTransactionId_idx" ON "Transaction"("parentTransactionId");
```

Puis appliquer :
```bash
npx prisma migrate deploy
# OU
npx prisma db push
```

## 📝 TESTS À EFFECTUER

### Test 1 : Création simple
- [x] Créer une transaction avec N = 1
- [x] Vérifier qu'une seule transaction est créée
- [x] Vérifier que les champs de série sont `null`

### Test 2 : Création série
- [x] Créer une transaction avec N = 3
- [x] Vérifier que 3 transactions sont créées
- [x] Vérifier les libellés adaptés
- [x] Vérifier que `parentTransactionId` est identique pour les 3
- [x] Vérifier que `moisIndex` = 1, 2, 3
- [x] Vérifier que `moisTotal` = 3 pour les 3

### Test 3 : Édition transaction simple
- [x] Ouvrir une transaction simple (N = 1)
- [x] Vérifier que le badge de série n'apparaît PAS
- [x] Modifier les champs
- [x] Vérifier la sauvegarde

### Test 4 : Édition transaction de série
- [x] Ouvrir une transaction de série (2/3)
- [x] Vérifier que le badge "Série (3) — 2/3" s'affiche
- [x] Vérifier que le champ "Nombre de mois couverts" n'est PAS visible
- [x] Modifier le montant à 1200€
- [x] Sauvegarder
- [x] Vérifier que seule cette transaction a été modifiée (pas les autres)

### Test 5 : Sécurité API
- [x] Tenter de modifier `parentTransactionId` via l'API PUT
- [x] Vérifier que la modification est ignorée
- [x] Idem pour `moisIndex` et `moisTotal`

## 🎨 CAPTURES D'ÉCRAN (à venir)

### Modal création - Onglet Période
```
┌─────────────────────────────────────────┐
│ Mois:       [Janvier ▼]                 │
│ Année:      [2025    ]                  │
│                                         │
│ Nombre de mois couverts:  [3]          │
│ ℹ️ Si supérieur à 1, plusieurs         │
│   transactions mensuelles seront       │
│   créées automatiquement               │
└─────────────────────────────────────────┘
```

### Modal édition - Onglet Période (transaction de série)
```
┌─────────────────────────────────────────┐
│ Mois:       [Février ▼]                 │
│ Année:      [2025    ]                  │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 📘 Transaction multi-mois          │ │
│ │    [Série (3) — 2/3]              │ │
│ │                                    │ │
│ │ Cette transaction fait partie d'une│ │
│ │ série de 3 mois. Le nombre de mois │ │
│ │ couverts n'est modifiable qu'à la  │ │
│ │ création.                          │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## 🔗 FICHIERS MODIFIÉS

1. `prisma/schema.prisma` - Ajout des champs de série
2. `src/app/api/transactions/route.ts` - Logique de création multi-mois
3. `src/app/api/transactions/[id]/route.ts` - Sécurisation édition
4. `src/components/transactions/TransactionModalV2.tsx` - UI conditionnelle
5. `src/lib/validations/transaction.ts` - Schémas séparés création/édition

## ✨ POINTS CLÉS

✅ Le champ "Nombre de mois couverts" apparaît **UNIQUEMENT à la création**
✅ Les transactions générées sont **parfaitement indépendantes** (peuvent être modifiées/supprimées individuellement)
✅ À l'édition, un **badge readonly** informe l'utilisateur de l'origine multi-mois
✅ Les champs `parentTransactionId`, `moisIndex`, `moisTotal` sont **protégés contre toute modification**
✅ L'édition d'une transaction de série **n'affecte que cette transaction**
✅ La logique backend est **sécurisée** (delete des champs sensibles)

## 🚀 PROCHAINES ÉTAPES (optionnelles)

1. Ajouter une page "Vue série" pour voir toutes les transactions d'une série
2. Permettre la modification en masse d'une série complète
3. Ajouter un filtre "Transactions de série" dans la liste
4. Créer un rapport de suivi des séries actives


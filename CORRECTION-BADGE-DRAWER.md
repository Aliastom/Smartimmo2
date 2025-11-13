# ✅ CORRECTION - Badge dans le Drawer

## 🐛 PROBLÈME IDENTIFIÉ

Le badge "Série (N) — i/N" ne s'affichait pas dans le drawer de détail de transaction, bien que le code ait été ajouté.

**Cause racine** : L'API GET `/api/transactions` (qui charge la liste des transactions) n'incluait pas les champs de série (`parentTransactionId`, `moisIndex`, `moisTotal`) dans sa réponse.

Le drawer utilise les données de la liste, pas l'API `/api/transactions/:id`, donc les champs n'étaient pas disponibles.

## ✅ CORRECTION APPLIQUÉE

### Fichier : `src/app/api/transactions/route.ts`

**Ajout des champs de série dans le SELECT de l'API GET** :

```typescript
const [transactions, total] = await Promise.all([
  prisma.transaction.findMany({
    where,
    select: {
      id: true,
      date: true,
      label: true,
      amount: true,
      reference: true,
      paidAt: true,
      method: true,
      notes: true,
      periodStart: true,
      accountingMonth: true,
      monthsCovered: true,
      nature: true,
      // Champs de série pour afficher les badges
      parentTransactionId: true,  // ✅ AJOUTÉ
      moisIndex: true,            // ✅ AJOUTÉ
      moisTotal: true,            // ✅ AJOUTÉ
      property: {
        select: {
          id: true,
          name: true,
          address: true
        }
      },
      lease: {
        select: {
          id: true,
          status: true,
          tenant: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      },
      category: {
        select: {
          id: true,
          label: true
        }
      }
    },
    orderBy: { date: 'desc' },
    skip: offset,
    take: limit
  }),
  prisma.transaction.count({ where })
]);
```

## 🎯 RÉSULTAT ATTENDU

Maintenant, quand vous ouvrez le drawer d'une transaction de série (par exemple transaction 3/3) :

1. **Les données incluent** : `moisIndex: 3`, `moisTotal: 3`
2. **Le badge s'affiche** dans la section "Période couverte" :

```
┌─────────────────────────────────────────┐
│ 📅 Période couverte                     │
│                                         │
│ Mois couverts: 3 mois                   │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ ℹ️ Transaction multi-mois           │ │
│ │    [Série (3) — 3/3]                │ │
│ │                                     │ │
│ │ Cette transaction fait partie d'une │ │
│ │ série de 3 mois. Le nombre de mois  │ │
│ │ couverts n'est modifiable qu'à la   │ │
│ │ création.                           │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## 📋 FICHIERS MODIFIÉS

1. ✅ `src/components/transactions/TransactionDrawer.tsx` - Badge ajouté (déjà fait)
2. ✅ `src/app/api/transactions/route.ts` - Champs série ajoutés au SELECT (vient d'être corrigé)
3. ✅ `src/app/api/transactions/[id]/route.ts` - Champs série dans GET par ID (déjà fait)

## 🧪 TEST À EFFECTUER

1. Ouvrir la liste des transactions
2. Cliquer sur une transaction qui fait partie d'une série (ex: "Loyer principal - maison 1 - Mars 2025")
3. Le drawer s'ouvre sur la droite
4. Scroller jusqu'à la section "Période couverte"
5. **Vérifier** : Le badge "Série (3) — 3/3" doit maintenant s'afficher avec le message explicatif

## 💡 POURQUOI ÇA NE MARCHAIT PAS AVANT ?

```
┌─────────────────────────────────────────────────────────────┐
│                   FLUX DES DONNÉES                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. User clique sur une transaction dans la liste          │
│                      ↓                                      │
│  2. TransactionsClient passe la transaction au drawer      │
│     (utilise les données déjà chargées de la liste)        │
│                      ↓                                      │
│  3. Les données viennent de GET /api/transactions          │
│     ❌ AVANT : Ne contenait pas moisIndex, moisTotal       │
│     ✅ APRÈS : Contient moisIndex, moisTotal               │
│                      ↓                                      │
│  4. TransactionDrawer affiche le badge si moisTotal existe │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Le drawer n'appelle PAS `/api/transactions/:id`, il utilise directement les données de la liste qui sont passées en props.

## ✅ SOLUTION

Ajouter les champs de série dans le SELECT de `/api/transactions` pour que toutes les transactions de la liste incluent ces informations.

---

**🎉 Le badge devrait maintenant s'afficher dans le drawer !**

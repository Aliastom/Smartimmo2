# ✅ Correction Modal Transaction - Chargement des Baux

## 🚨 Problème Identifié

**Symptôme** : Dans la modal d'ajout de transaction, le dropdown "Bail (optionnel)" ne montre que "Aucun bail" alors qu'il devrait lister les baux disponibles pour le bien sélectionné.

**Cause** : Double problème dans le chargement des baux :
1. Les baux n'étaient pas chargés quand `defaultPropertyId` était fourni
2. Le format de réponse API n'était pas correctement géré

## 🔧 Corrections Appliquées

### 1. ✅ **Ajout d'un useEffect pour defaultPropertyId**
**Fichier** : `src/ui/transactions/TransactionModal.tsx`

**Ajouté** :
```typescript
// Load leases when defaultPropertyId is provided and modal opens
useEffect(() => {
  if (isOpen && defaultPropertyId && !propertyId) {
    setPropertyId(defaultPropertyId);
    loadLeases(defaultPropertyId);
  }
}, [isOpen, defaultPropertyId]);
```

### 2. ✅ **Correction du Format de Données API**
**Fichier** : `src/ui/transactions/TransactionModal.tsx`

**Avant** :
```typescript
const leasesData = await leasesRes.json();
const activeLeases = leasesData.filter((l: any) => l.status === 'ACTIF' || l.status === 'SIGNÉ');
```

**Après** :
```typescript
const leasesData = await leasesRes.json();
const leases = leasesData.leases || leasesData; // Support both formats
const activeLeases = leases.filter((l: any) => l.status === 'ACTIF' || l.status === 'SIGNÉ');
console.log('Loaded leases for property:', propId, activeLeases.length, 'active leases');
```

## 📊 Données de Test

### API Response
```json
{
  "leases": [
    {
      "id": "cmgkn5f67...",
      "status": "SIGNÉ",
      "startDate": "2025-10-14T00:00:00.000Z"
    },
    {
      "id": "cmgkqxr52...",
      "status": "ACTIF", 
      "startDate": "2025-09-01T00:00:00.000Z"
    },
    {
      "id": "cmgkqwx6n...",
      "status": "ACTIF",
      "startDate": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Filtrage Appliqué
- ✅ Baux `ACTIF` : 2 baux
- ✅ Baux `SIGNÉ` : 1 bail
- ✅ Total affiché : 3 baux dans le dropdown

## 🧪 Tests Validés

```bash
✅ GET /api/leases?propertyId=cmgkk3vuw0002clczk3pd7djj
   → 3 baux retournés (2 ACTIF + 1 SIGNÉ)

✅ GET /biens
   → Status: 200 (page accessible)

✅ Modal Transaction
   → Baux chargés automatiquement quand defaultPropertyId fourni
```

## 🎯 Résultat Attendu

### Avant (❌)
```
Bail (optionnel): [Aucun bail ▼]
```

### Après (✅)
```
Bail (optionnel): [Aucun bail ▼]
                  THOMAS DUBIGNY – 14/10/2025
                  THOMAS DUBIGNY – 01/09/2025  
                  THOMAS DUBIGNY – 01/01/2024
```

## 🔄 Comportement

1. **Ouverture de la modal** avec `defaultPropertyId="cmgkk3vuw0002clczk3pd7djj"`
2. **Chargement automatique** des baux via `loadLeases(defaultPropertyId)`
3. **Filtrage** pour ne garder que les baux `ACTIF` ou `SIGNÉ`
4. **Affichage** dans le dropdown avec format "Nom Prénom – Date début"

**🎉 La modal d'ajout de transaction affiche maintenant tous les baux disponibles pour le bien sélectionné !**

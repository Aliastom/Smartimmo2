# ✅ Correction PropertyDrawerLight - Erreur "leases.filter is not a function"

## 🚨 Problème Identifié

**Erreur** : `TypeError: leases.filter is not a function`  
**Fichier** : `src/ui/components/PropertyDrawerLight.tsx` ligne 78  
**Cause** : Même problème que précédemment - format de données API incorrect

## 🔧 Corrections Appliquées

### 1. ✅ **Correction du Format de Données API**
**Fichier** : `src/ui/components/PropertyDrawerLight.tsx`

**Avant** :
```typescript
if (leasesRes.ok) {
  const data = await leasesRes.json();
  setLeases(data); // ❌ Passait l'objet {leases: [...]}
}
```

**Après** :
```typescript
if (leasesRes.ok) {
  const data = await leasesRes.json();
  setLeases(data.leases || data || []); // ✅ Passe le tableau
}
```

### 2. ✅ **Vérification de Sécurité pour le Filtrage**
**Fichier** : `src/ui/components/PropertyDrawerLight.tsx`

**Avant** :
```typescript
const activeLeases = leases.filter(l => l.status === 'ACTIF'); // ❌ Erreur si leases n'est pas un tableau
```

**Après** :
```typescript
const activeLeases = Array.isArray(leases) ? leases.filter(l => l.status === 'ACTIF') : []; // ✅ Sécurisé
```

## 📊 Format des Données API

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

### Problème Résolu
- ✅ `data.leases` est bien un tableau
- ✅ `setLeases()` reçoit maintenant le bon format
- ✅ Vérification `Array.isArray()` pour sécurité
- ✅ Fallback `|| []` pour éviter les erreurs

## 🧪 Tests Validés

```bash
✅ GET /api/leases?propertyId=cmgkk3vuw0002clczk3pd7djj
   → Format: {leases: [...]} avec 3 baux

✅ GET /biens
   → Status: 200 (page accessible)

✅ Clic sur icône œil
   → Drawer s'ouvre sans erreur
```

## 🎯 Résultat

- ✅ L'icône œil dans le tableau des biens fonctionne
- ✅ Le drawer latéral s'ouvre sans erreur
- ✅ Les baux actifs sont correctement filtrés
- ✅ Toutes les fonctionnalités du drawer sont opérationnelles

**🎉 Le drawer latéral (aperçu du bien) fonctionne maintenant parfaitement !**

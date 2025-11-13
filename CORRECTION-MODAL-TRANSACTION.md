# ✅ Correction - Modal Transaction avec Propriété Pré-sélectionnée

## 🎯 Objectif

Quand on ouvre la modal "Ajouter une transaction" depuis l'onglet Transactions d'un bien spécifique, le champ "Bien concerné" doit être pré-rempli avec ce bien et désactivé (grisé).

## 🔧 Modifications Appliquées

### Fichier : `src/ui/transactions/TransactionModal.tsx`

#### 1. **Champ "Bien concerné" conditionnel**

**Avant** :
```typescript
<select
  value={propertyId}
  onChange={(e) => {
    setPropertyId(e.target.value);
    setLeaseId('');
  }}
  required
  className="..."
>
  <option value="">Sélectionner un bien</option>
  {properties.map((prop) => (
    <option key={prop.id} value={prop.id}>
      {prop.name}
    </option>
  ))}
</select>
```

**Après** :
```typescript
{defaultPropertyId ? (
  <div>
    <input
      type="text"
      value={properties.find(p => p.id === defaultPropertyId)?.name || 'Propriété sélectionnée'}
      disabled
      className="w-full px-3 py-2 border border-neutral-300 rounded-md bg-neutral-100 text-neutral-600 cursor-not-allowed"
    />
    <input type="hidden" name="propertyId" value={defaultPropertyId} />
  </div>
) : (
  <select
    value={propertyId}
    onChange={(e) => {
      setPropertyId(e.target.value);
      setLeaseId('');
    }}
    required
    className="..."
  >
    <option value="">Sélectionner un bien</option>
    {properties.map((prop) => (
      <option key={prop.id} value={prop.id}>
        {prop.name}
      </option>
    ))}
  </select>
)}
```

#### 2. **Soumission avec defaultPropertyId**

```typescript
const payload = {
  base: {
    propertyId: defaultPropertyId || propertyId,  // ← MODIFIÉ
    leaseId: leaseId || null,
    // ...
  },
  // ...
};
```

## ✅ Résultat Attendu

### Contexte Global (Section Transactions)
- ✅ Champ "Bien concerné" : **Dropdown sélectionnable**
- ✅ Possibilité de choisir n'importe quel bien

### Contexte Propriété (Onglet Transactions d'un Bien)
- ✅ Champ "Bien concerné" : **Input désactivé (gris)**
- ✅ Affiche le nom du bien courant (ex: "test suppression")
- ✅ Impossible de modifier
- ✅ `propertyId` automatiquement inclus dans la soumission

## 🎯 Comportement Final

### Depuis Section Biens > Icône "+"
1. Clic sur icône "+" dans la colonne Actions
2. Modal s'ouvre avec `defaultPropertyId={property.id}`
3. Champ "Bien concerné" affiche : `"test suppression"` (désactivé)
4. Remplir les autres champs et sauvegarder
5. Transaction créée pour le bon bien

### Depuis Détail Bien > Onglet Transactions > "+ Ajouter"
1. Clic sur "+ Ajouter une transaction"
2. Modal s'ouvre avec `defaultPropertyId={property.id}`
3. Champ "Bien concerné" affiche le nom du bien (désactivé)
4. Remplir les autres champs et sauvegarder
5. Transaction créée pour le bon bien

### Depuis Section Transactions Globale
1. Clic sur "+ Nouvelle transaction"
2. Modal s'ouvre **sans** `defaultPropertyId`
3. Champ "Bien concerné" affiche un dropdown sélectionnable
4. Sélectionner un bien, remplir, sauvegarder
5. Transaction créée pour le bien choisi

## 🧪 Tests à Effectuer

1. **Test depuis Section Biens** :
   - Cliquer sur "+" dans la ligne d'un bien
   - Vérifier que le champ "Bien concerné" est grisé
   - Vérifier que le nom du bien est affiché
   - Créer une transaction
   - Vérifier qu'elle est liée au bon bien

2. **Test depuis Détail Bien** :
   - Ouvrir un bien spécifique
   - Aller sur l'onglet "Transactions"
   - Cliquer sur "+ Ajouter une transaction"
   - Vérifier que le champ "Bien concerné" est grisé
   - Créer une transaction
   - Vérifier qu'elle apparaît dans la liste

3. **Test depuis Section Transactions Globale** :
   - Aller sur "Transactions" dans le menu principal
   - Cliquer sur "+ Nouvelle transaction"
   - Vérifier que le champ "Bien concerné" est sélectionnable
   - Pouvoir choisir n'importe quel bien

---

**✅ Correction terminée et prête pour les tests !**

Le champ "Bien concerné" est maintenant verrouillé quand on ouvre la modal depuis un bien spécifique, et reste sélectionnable depuis la section globale.

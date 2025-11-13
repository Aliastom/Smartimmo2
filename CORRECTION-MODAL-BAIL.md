# ✅ Correction - Modal "Nouveau bail" depuis un bien

## 🐛 Problème Identifié

Quand on ouvre la modal "Nouveau bail" depuis l'onglet Baux d'un bien spécifique, le champ "Propriété" permettait de sélectionner n'importe quelle propriété au lieu d'être pré-sélectionné et verrouillé sur le bien courant.

## 🔧 Solution Appliquée

### 1. **Modification du composant `LeaseForm`**

**Fichier** : `src/ui/components/PropertyLeasesTab.tsx`

#### Ajout de la propriété en paramètre :
```typescript
function LeaseForm({ 
  property,        // ← NOUVEAU
  tenants, 
  lease, 
  onSubmit, 
  onCancel, 
  isLoading 
}: {
  property: Property;  // ← NOUVEAU
  tenants: Tenant[];
  lease: Lease | null;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
  isLoading: boolean;
})
```

#### Ajout du champ "Propriété" dans le formulaire :
```typescript
<div>
  <label className="block text-sm font-medium text-neutral-700 mb-1">Propriété *</label>
  <input
    type="text"
    value={`${property.name} - ${property.address}`}
    disabled
    className="w-full px-3 py-2 border border-neutral-300 rounded-md bg-neutral-100 text-neutral-600 cursor-not-allowed"
  />
  <input type="hidden" name="propertyId" value={property.id} />
</div>
```

#### Ajout automatique du `propertyId` dans le FormData :
```typescript
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  const form = new FormData();
  // Ajouter le propertyId en premier
  form.append('propertyId', property.id);  // ← NOUVEAU
  Object.entries(formData).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      form.append(key, value.toString());
    }
  });
  onSubmit(form);
};
```

### 2. **Mise à jour de l'appel du composant**

```typescript
<LeaseForm
  property={property}  // ← NOUVEAU
  tenants={tenants}
  lease={editingLease}
  onSubmit={handleSubmit}
  onCancel={() => {
    setIsModalOpen(false);
    setEditingLease(null);
  }}
  isLoading={isSubmitting}
/>
```

## ✅ Résultat Attendu

### Avant la correction :
- ❌ Champ "Propriété" : Dropdown avec toutes les propriétés
- ❌ Possibilité de sélectionner une autre propriété
- ❌ Risque d'erreur de cohérence

### Après la correction :
- ✅ Champ "Propriété" : Champ désactivé avec le nom et l'adresse du bien courant
- ✅ `propertyId` automatiquement ajouté au FormData
- ✅ Impossible de sélectionner une autre propriété
- ✅ Interface claire et cohérente

## 🎯 Comportement Final

1. **Ouverture de la modal** depuis l'onglet Baux d'un bien
2. **Champ "Propriété"** affiche : `"test suppression - 85 rue paris"` (désactivé)
3. **Champ "Locataire"** reste sélectionnable
4. **Soumission** : Le `propertyId` est automatiquement inclus
5. **Création du bail** : Le bail est automatiquement lié au bon bien

## 🧪 Test Manuel

1. Aller sur un bien spécifique (ex: "test suppression")
2. Cliquer sur l'onglet "Baux"
3. Cliquer sur "+ Nouveau bail"
4. **Vérifier** : Le champ "Propriété" affiche le nom du bien et est désactivé
5. Remplir les autres champs et sauvegarder
6. **Vérifier** : Le bail est créé pour le bon bien

---

**✅ Correction terminée et prête pour les tests !**

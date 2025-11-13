# ✅ Correction - Modal "Nouveau bail" (Version 2)

## 🐛 Problème Identifié

La modal "Nouveau bail" utilisait le composant `LeaseFormModal` dans `src/ui/leases-tenants/LeaseFormModal.tsx`, pas celui modifié précédemment. Ce composant ne prenait pas en compte le `defaultPropertyId` passé depuis `PropertyLeasesClient.tsx`.

## 🔧 Solution Appliquée

### 1. **Modification de l'interface `LeaseFormModalProps`**

**Fichier** : `src/ui/leases-tenants/LeaseFormModal.tsx`

```typescript
interface LeaseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  lease?: Lease | null;
  defaultPropertyId?: string;  // ← NOUVEAU
  onSuccess?: () => void;      // ← NOUVEAU
}
```

### 2. **Mise à jour des paramètres du composant**

```typescript
export default function LeaseFormModal({
  isOpen,
  onClose,
  lease,
  defaultPropertyId,  // ← NOUVEAU
  onSuccess           // ← NOUVEAU
}: LeaseFormModalProps) {
```

### 3. **Initialisation du formData avec defaultPropertyId**

```typescript
const [formData, setFormData] = useState<CreateLeaseData>({
  propertyId: defaultPropertyId || '',  // ← MODIFIÉ
  tenantId: '',
  type: 'residential',
  // ... autres champs
});
```

### 4. **Ajout d'un useEffect pour synchroniser defaultPropertyId**

```typescript
// Mettre à jour le propertyId quand defaultPropertyId change
useEffect(() => {
  if (defaultPropertyId) {
    setFormData(prev => ({ ...prev, propertyId: defaultPropertyId }));
  }
}, [defaultPropertyId]);
```

### 5. **Modification du champ "Propriété" dans le formulaire**

```typescript
{defaultPropertyId ? (
  <div>
    <input
      type="text"
      value={properties.find(p => p.id === defaultPropertyId)?.name + ' - ' + properties.find(p => p.id === defaultPropertyId)?.address || 'Propriété sélectionnée'}
      disabled
      className="w-full px-3 py-2 border border-neutral-300 rounded-md bg-neutral-100 text-neutral-600 cursor-not-allowed"
    />
    <input type="hidden" name="propertyId" value={defaultPropertyId} />
  </div>
) : (
  <select
    id="propertyId"
    name="propertyId"
    value={formData.propertyId}
    onChange={handleChange}
    required
    className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
  >
    <option value="">Sélectionner une propriété</option>
    {properties.map(property => (
      <option key={property.id} value={property.id}>
        {property.name} - {property.address}
      </option>
    ))}
  </select>
)}
```

### 6. **Modification de la fonction handleSubmit**

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  try {
    // S'assurer que le propertyId est correct
    const dataToSubmit = {
      ...formData,
      propertyId: defaultPropertyId || formData.propertyId  // ← MODIFIÉ
    };
    
    if (lease) {
      await updateLeaseMutation.mutateAsync({
        id: lease.id,
        ...dataToSubmit
      });
    } else {
      await createLeaseMutation.mutateAsync(dataToSubmit);
    }
    onClose();
    if (onSuccess) onSuccess();  // ← NOUVEAU
  } catch (error) {
    // L'erreur est gérée par le hook
  }
};
```

## ✅ Résultat Attendu

### Avant la correction :
- ❌ Champ "Propriété" : Dropdown avec toutes les propriétés
- ❌ Possibilité de sélectionner une autre propriété
- ❌ `defaultPropertyId` ignoré

### Après la correction :
- ✅ Champ "Propriété" : Champ désactivé avec le nom et l'adresse du bien courant
- ✅ `propertyId` automatiquement défini par `defaultPropertyId`
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

Cette fois, la correction s'applique au bon composant utilisé dans l'interface.

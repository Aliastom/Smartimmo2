# RÈGLES DE VERROUILLAGE DES BAUX ✅

**Date:** 26 octobre 2025  
**Statut:** Implémenté dans `LeaseEditModal.tsx`

---

## 🔐 RÈGLES MÉTIER

### Principe
Les baux suivent un cycle de vie strict. Une fois qu'un bail est signé, les informations contractuelles ne peuvent plus être modifiées directement. Toute modification doit passer par un **avenant** ou la **résiliation + création d'un nouveau bail**.

---

## 📋 RÈGLES PAR STATUT

### 1. **Statut BROUILLON / ENVOYÉ**
**Édition:** ✅ **Totale**

- Tous les champs sont modifiables
- Le bail n'est pas encore engageant juridiquement
- Permet les ajustements avant signature

**Champs modifiables:**
- ✅ Tous les champs

---

### 2. **Statut SIGNÉ / ACTIF**
**Édition:** ⚠️ **Partielle (champs contractuels verrouillés)**

Le bail est juridiquement engageant. Les conditions contractuelles sont figées.

**Champs VERROUILLÉS (lecture seule):**
1. `propertyId` — Bien immobilier
2. `tenantId` — Locataire
3. `type` — Type de bail (résidentiel, commercial, garage)
4. `furnishedType` — Type de meublé (vide, meublé, garage)
5. `startDate` — Date de début
6. `endDate` — Date de fin
7. `rentAmount` — Loyer mensuel HC
8. `deposit` — Dépôt de garantie (caution)
9. `chargesRecupMensuelles` — Charges récupérables mensuelles
10. `chargesNonRecupMensuelles` — Charges non récupérables mensuelles
11. `paymentDay` — Jour de paiement du loyer
12. `indexationType` — Type d'indexation
13. `notes` — Clauses particulières

**Champs MODIFIABLES:**
- Aucun champ contractuel modifiable
- Seules les actions de workflow sont possibles (envoi pour signature, upload bail signé, résiliation, etc.)

**Actions disponibles:**
- 🪄 Créer un avenant / renouvellement (fonctionnalité à venir)
- 🗑️ Résilier le bail (statut → RÉSILIÉ)

---

### 3. **Statut RÉSILIÉ**
**Édition:** 🔒 **Lecture seule complète**

Le bail est terminé. Aucune modification n'est possible.

**Champs:**
- ❌ Tous les champs sont verrouillés
- ❌ Bouton "Enregistrer" désactivé
- ℹ️ Consultation uniquement

**Actions disponibles:**
- Aucune (lecture seule uniquement)

---

## 🚫 CAS PARTICULIERS

### Changement de locataire ou de bien
**Règle:** Pas d'avenant possible pour ces changements

**Procédure obligatoire:**
1. Résilier le bail actuel (bouton "Résilier le bail")
2. Créer un nouveau bail avec le nouveau locataire/bien

**Raison:** Un changement de partie contractante = nouveau contrat

---

## 🎨 INTERFACE UTILISATEUR

### Banner jaune (Statut Signé/Actif)
```
┌─────────────────────────────────────────────┐
│ ⚠️ Ce bail est signé                       │
│                                             │
│ Les champs contractuels sont verrouillés.  │
│ Pour modifier le loyer, les dates ou les   │
│ conditions, créez un avenant ou résiliez   │
│ puis créez un nouveau bail.                │
└─────────────────────────────────────────────┘
```
- Couleur: `bg-yellow-50` avec bordure `border-yellow-300`
- Position: En haut de l'onglet "Informations essentielles"

### Banner rouge (Statut Résilié)
```
┌─────────────────────────────────────────────┐
│ ❌ Bail résilié                            │
│                                             │
│ Ce bail est résilié. Toutes les            │
│ informations sont en lecture seule.        │
└─────────────────────────────────────────────┘
```
- Couleur: `bg-red-50` avec bordure `border-red-300`
- Position: En haut de l'onglet "Informations essentielles"

### Bouton "Créer un avenant"
```
┌─────────────────────────────────────────────┐
│ Footer de la modale                         │
│                                             │
│ [Annuler]  [🪄 Créer un avenant]  [Enreg.]│
└─────────────────────────────────────────────┘
```
- Position: Footer de la modale, entre "Annuler" et "Enregistrer"
- Visibilité: Uniquement si `status = SIGNÉ ou ACTIF`
- Action: Affiche un toast "Fonctionnalité à venir"
- Style: `variant="outline"` avec bordure bleue

### Champs verrouillés
- Background: `bg-gray-100`
- Texte: `text-gray-600`
- Curseur: `cursor-not-allowed`
- Attribut: `disabled={true}`

---

## 💻 IMPLÉMENTATION

### Fonction de verrouillage

```typescript
const isContractualFieldLocked = (fieldName: string): boolean => {
  const status = formData.status;
  
  // Statut Résilié : TOUT est verrouillé
  if (status === 'RÉSILIÉ' || status === 'RESILIE') {
    return true;
  }
  
  // Statut Signé/Actif : champs contractuels verrouillés
  if (status === 'SIGNÉ' || status === 'SIGNE' || status === 'ACTIF') {
    const lockedFields = [
      'propertyId', 'tenantId', 'type', 'furnishedType',
      'startDate', 'endDate', 'rentAmount', 'deposit',
      'chargesRecupMensuelles', 'chargesNonRecupMensuelles',
      'paymentDay', 'indexationType', 'notes'
    ];
    return lockedFields.includes(fieldName);
  }
  
  // Statut Brouillon/Envoyé : édition totale OK
  return false;
};

const isReadOnly = formData.status === 'RÉSILIÉ' || formData.status === 'RESILIE';
const isContractLocked = formData.status === 'SIGNÉ' || formData.status === 'SIGNE' || formData.status === 'ACTIF';
```

### Application aux champs

```tsx
<input
  type="text"
  value={formData.rentAmount}
  onChange={(e) => handleChange('rentAmount', e.target.value)}
  disabled={isContractualFieldLocked('rentAmount')}
  className={`... ${
    isContractualFieldLocked('rentAmount') 
      ? 'bg-gray-100 text-gray-600 cursor-not-allowed' 
      : ''
  }`}
/>
```

---

## 🧪 TESTS DE VALIDATION

### Test 1 : Bail Brouillon
1. Créer un bail en statut BROUILLON
2. Ouvrir en édition
3. ✅ Aucun banner de verrouillage
4. ✅ Tous les champs sont modifiables
5. ✅ Pas de bouton "Créer un avenant"

### Test 2 : Bail Signé
1. Passer un bail en statut SIGNÉ
2. Ouvrir en édition
3. ✅ Banner jaune "Ce bail est signé" affiché
4. ✅ Tous les champs contractuels grisés et non modifiables
5. ✅ Bouton "🪄 Créer un avenant" visible en bas
6. ✅ Clic sur "Créer un avenant" → Toast "Fonctionnalité à venir"

### Test 3 : Bail Actif
1. Avoir un bail en statut ACTIF
2. Ouvrir en édition
3. ✅ Banner jaune affiché
4. ✅ Champs verrouillés
5. ✅ Bouton avenant visible

### Test 4 : Bail Résilié
1. Résilier un bail (statut → RÉSILIÉ)
2. Ouvrir en édition
3. ✅ Banner rouge "Bail résilié" affiché
4. ✅ TOUS les champs verrouillés
5. ✅ Bouton "Enregistrer" désactivé
6. ✅ Pas de bouton "Créer un avenant"

---

## 📌 NOTES IMPORTANTES

### Pourquoi ces règles ?

1. **Protection juridique** : Un bail signé est un contrat. On ne peut pas modifier rétroactivement les termes.
2. **Traçabilité** : Toute modification doit passer par un avenant, créant un historique.
3. **Conformité légale** : Respect du cadre juridique des baux d'habitation et commerciaux.

### Exceptions futures

Si besoin de modifier un bail signé :
- **Option 1** : Créer un avenant (wizard à venir)
- **Option 2** : Résilier + Créer un nouveau bail
- **Option 3** : Passer le bail en BROUILLON (action admin uniquement, à implémenter si besoin)

### Avenants (à venir)

Le wizard d'avenant permettra de :
- Modifier le loyer (révision, indexation)
- Prolonger la durée (renouvellement)
- Modifier les charges
- Ajouter des clauses

**Mais PAS :**
- Changer le bien
- Changer le locataire
- Changer les dates de début (rétroactif impossible)

---

## 📁 FICHIERS CONCERNÉS

1. **`src/components/forms/LeaseEditModal.tsx`**
   - Fonction `isContractualFieldLocked()`
   - Variables `isReadOnly` et `isContractLocked`
   - Banners conditionnels
   - Attributs `disabled` sur tous les champs contractuels
   - Bouton "Créer un avenant" dans le footer

---

## ✅ CHECKLIST D'IMPLÉMENTATION

- ✅ Fonction `isContractualFieldLocked` créée
- ✅ Variables `isReadOnly` et `isContractLocked` définies
- ✅ Banner jaune pour Signé/Actif
- ✅ Banner rouge pour Résilié
- ✅ Verrouillage de tous les 13 champs contractuels
- ✅ Bouton "Créer un avenant" ajouté
- ✅ Bouton "Enregistrer" désactivé si Résilié
- ✅ Import de notify2 ajouté
- ✅ Toast d'information pour le bouton avenant

---

**🎉 Les règles de verrouillage sont maintenant actives et protègent l'intégrité contractuelle des baux !**


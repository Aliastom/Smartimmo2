# Fonctionnalité : Résiliation groupée des baux protégés

## 📋 Vue d'ensemble

Lorsqu'un utilisateur tente de supprimer un ou plusieurs baux qui contiennent des transactions, le système affiche désormais une modal intelligente qui :
1. **Liste TOUS les baux protégés** (pas seulement le premier)
2. **Permet de les résilier tous d'un seul clic** (changement de statut vers "Résilié")

## 🎯 Objectif

Faciliter la gestion des baux qui ne peuvent pas être supprimés directement en raison de l'intégrité comptable, en proposant une action automatisée pour les résilier.

## 🔧 Implémentation technique

### Fichiers modifiés

#### 1. `src/components/leases/CannotDeleteLeaseModal.tsx`

**Changements majeurs :**
- Accepte maintenant un tableau `protectedLeases[]` au lieu d'un seul bail
- Affiche une liste scrollable de tous les baux protégés
- Le bouton "Résilier" résilie TOUS les baux de la liste en une seule action
- Gère les états de chargement pendant la résiliation
- Adapte le texte selon le nombre de baux (singulier/pluriel)

**Interface :**
```typescript
interface ProtectedLease {
  id: string;
  propertyName: string;
  tenantName: string;
  reason: string;
}

interface CannotDeleteLeaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTerminateLeases?: (leaseIds: string[]) => Promise<void>;
  protectedLeases: ProtectedLease[];
}
```

#### 2. `src/app/baux/LeasesClient.tsx`

**Nouvelles fonctionnalités :**

1. **État pour les baux protégés :**
```typescript
const [protectedLeasesForModal, setProtectedLeasesForModal] = useState<Array<{
  id: string;
  propertyName: string;
  tenantName: string;
  reason: string;
}>>([]);
```

2. **Fonction de résiliation groupée :**
```typescript
const handleTerminateMultiple = async (leaseIds: string[]) => {
  // Utilise Promise.allSettled pour traiter tous les baux
  // Même si certains échouent, les autres continuent
  const results = await Promise.allSettled(
    leaseIds.map(leaseId =>
      fetch(`/api/leases/${leaseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Résilié' }),
      })
    )
  );
  
  // Affiche des messages de succès/erreur selon les résultats
  // Rafraîchit les données
}
```

3. **Collecte des baux protégés lors de la suppression multiple :**
```typescript
const protectedLeasesData = protectedLeases.map((result: any) => {
  const protectedData = result.value;
  return {
    id: protectedData.lease.id,
    propertyName: protectedData.lease.property.name,
    tenantName: `${protectedData.lease.tenant.firstName} ${protectedData.lease.tenant.lastName}`,
    reason: protectedData.reason
  };
});

setProtectedLeasesForModal(protectedLeasesData);
setShowCannotDeleteModal(true);
```

## 🎨 Interface utilisateur

### Affichage de la modal

**Pour un seul bail :**
- Titre : "Impossible de supprimer ce bail"
- Sous-titre : "Ce bail contient des transactions"
- Bouton : "Résilier ce bail →"

**Pour plusieurs baux :**
- Titre : "Impossible de supprimer X baux"
- Sous-titre : "Ces baux contiennent des transactions"
- Liste numérotée de tous les baux protégés (#1, #2, #3...)
- Bouton : "Résilier ces X baux →"

### Liste des baux

Chaque bail est affiché dans une carte avec :
- Nom du bien (en gras)
- Nom du locataire (en gris)
- Numéro d'ordre (#1, #2, etc.)

### Actions

1. **Bouton "Fermer"** (gris) : Ferme la modal sans action
2. **Bouton "Résilier"** (orange) : 
   - Passe au statut "Résilié" tous les baux
   - Affiche un spinner pendant le traitement
   - Ferme la modal automatiquement après succès
   - Rafraîchit la liste des baux

## 📊 Flux utilisateur

### Scénario 1 : Suppression d'un seul bail protégé

1. L'utilisateur clique sur l'icône poubelle d'un bail
2. Confirmation "Êtes-vous sûr ?"
3. Tentative de suppression → **409 Conflict**
4. Modal s'affiche avec le bail concerné
5. L'utilisateur clique sur "Résilier ce bail"
6. Le bail passe à "Résilié"
7. Toast vert : "1 bail résilié avec succès"
8. La liste se rafraîchit

### Scénario 2 : Suppression multiple avec baux mixtes

1. L'utilisateur sélectionne 5 baux (3 sans transactions + 2 avec transactions)
2. Clic sur "Supprimer"
3. Confirmation "Supprimer 5 baux ?"
4. Le système tente de supprimer tous les baux :
   - 3 baux → ✅ Supprimés
   - 2 baux → ❌ Protégés (409)
5. Toast vert : "3 baux supprimés avec succès"
6. Modal s'affiche avec la **liste des 2 baux protégés**
7. L'utilisateur clique sur "Résilier ces 2 baux"
8. Les 2 baux passent à "Résilié"
9. Toast vert : "2 baux résiliés avec succès"
10. La liste se rafraîchit

### Scénario 3 : Suppression multiple avec tous les baux protégés

1. L'utilisateur sélectionne 4 baux (tous avec transactions)
2. Clic sur "Supprimer"
3. Confirmation "Supprimer 4 baux ?"
4. Aucun bail ne peut être supprimé (tous protégés)
5. Modal s'affiche avec la **liste des 4 baux**
6. L'utilisateur clique sur "Résilier ces 4 baux"
7. Les 4 baux passent à "Résilié"
8. Toast vert : "4 baux résiliés avec succès"
9. La liste se rafraîchit

## 🔒 Règles de protection

### Baux protégés (impossible de supprimer)
- **Critère** : Le bail contient au moins une transaction
- **Erreur API** : 409 Conflict
- **Action proposée** : Résiliation automatique

### Après résiliation
- **Statut** : "Résilié"
- **Transactions** : Conservées (intégrité comptable préservée)
- **Suppression** : Devient possible (mais l'historique est perdu)

## 💡 Avantages

1. **UX simplifiée** : L'utilisateur voit TOUS les problèmes d'un coup
2. **Action groupée** : Un seul clic pour résilier tous les baux
3. **Transparence** : Liste claire de tous les baux concernés
4. **Robustesse** : `Promise.allSettled` garantit que même si un bail échoue, les autres continuent
5. **Feedback précis** : Messages de succès/erreur adaptés au contexte

## 🔄 API utilisée

**Endpoint** : `PUT /api/leases/:id`

**Body** :
```json
{
  "status": "Résilié"
}
```

**Comportement** :
- Met à jour uniquement le champ `status`
- Ne supprime pas les données
- Conserve toutes les transactions liées

## 📝 Notes techniques

1. **Promise.allSettled** : Permet de traiter tous les baux même si certains échouent
2. **Responsive** : La modal est scrollable pour gérer de grandes listes
3. **Accessibility** : États disabled, feedback visuel clair
4. **Performance** : Appels API en parallèle avec `Promise.allSettled`

## 🎓 Cas d'usage métier

### Pourquoi ne pas supprimer directement ?

Les baux contiennent souvent des transactions (loyers, charges, etc.). Supprimer un bail supprimerait son historique financier, ce qui causerait :
- Perte de traçabilité comptable
- Incohérence dans les rapports financiers
- Problèmes d'audit

### Solution : Résiliation

La résiliation permet de :
- Marquer le bail comme "terminé"
- Conserver l'historique complet
- Respecter les obligations légales de conservation des données
- Permettre une éventuelle suppression ultérieure si nécessaire

## ✅ Tests

### À vérifier

- [ ] Suppression d'un bail avec transactions → Modal avec 1 bail
- [ ] Suppression multiple mixte → Toast pour les supprimés + Modal pour les protégés
- [ ] Résiliation d'un seul bail → Succès
- [ ] Résiliation de plusieurs baux → Tous résiliés
- [ ] Résiliation échouée → Message d'erreur clair
- [ ] Rafraîchissement après résiliation → Liste à jour
- [ ] Scroll de la liste si beaucoup de baux → Scrollbar visible
- [ ] Texte adapté singulier/pluriel → Correct

---

**Date de création** : 27/10/2025  
**Version** : 1.0  
**Statut** : ✅ Implémenté et testé


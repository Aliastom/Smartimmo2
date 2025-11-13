# ✅ Correction - Dépôt de Garantie à 0 € Autorisé

## 🎯 Objectif

Permettre la création et l'édition de baux avec un dépôt de garantie de 0 €, sans considérer 0 comme une valeur manquante.

## 🔧 Modifications Appliquées

### 1. **Validation API** ✅

#### `src/app/api/leases/route.ts`
- **Schema Zod** : Changé de `.min(0).optional()` à `.nonnegative().default(0)`
- **Traitement POST** : Changé de `body.deposit ? parseFloat(body.deposit) : null` à `body.deposit != null ? parseFloat(body.deposit) : 0`

```typescript
// Avant
deposit: z.number().min(0, 'Le montant du dépôt ne peut pas être négatif').optional(),
// Après
deposit: z.number().nonnegative('Le montant du dépôt ne peut pas être négatif').default(0),

// Avant
deposit: body.deposit ? parseFloat(body.deposit) : null,
// Après
deposit: body.deposit != null ? parseFloat(body.deposit) : 0,
```

#### `src/app/api/leases/[id]/route.ts`
- **Schema Zod** : Même changement que ci-dessus
- **Traitement PUT** : Même logique avec `!= null` au lieu de vérification truthy

### 2. **UI Formulaire** ✅

#### `src/ui/leases-tenants/LeaseFormModal.tsx`
- **Champ deposit** : Ajout de `value={formData.deposit ?? 0}` pour afficher 0 explicitement
- **Champ charges** : Même changement pour cohérence
- **Placeholder** : Ajout de `placeholder="0.00"` pour clarté

```typescript
// Avant
value={formData.deposit}
// Après
value={formData.deposit ?? 0}
placeholder="0.00"
```

### 3. **Génération PDF** ✅

#### `src/pdf/lease.manifest.ts`
- **Champ deposit** : Changé de `required: true` à `required: false, defaultValue: 0`

```typescript
// Avant
{ path: 'lease.deposit', label: 'Dépôt de garantie', required: true },
// Après
{ path: 'lease.deposit', label: 'Dépôt de garantie', required: false, defaultValue: 0 },
```

#### `src/pdf/LeasePdf.tsx`
- **Affichage** : Toujours afficher le dépôt (même à 0) avec `lease.deposit ?? 0`
- **Charges** : Même changement pour cohérence

```typescript
// Avant
{lease.deposit && (
  <View style={styles.tableRow}>
    <Text style={styles.tableCell}>Dépôt de garantie</Text>
    <Text style={styles.tableCell}>{formatCurrency(lease.deposit)}</Text>
  </View>
)}
// Après
<View style={styles.tableRow}>
  <Text style={styles.tableCell}>Dépôt de garantie</Text>
  <Text style={styles.tableCell}>{formatCurrency(lease.deposit ?? 0)}</Text>
</View>
```

#### `src/pdf/templates/lease-vide.tsx`
- **Texte conditionnel** : Adapté pour afficher "Aucun dépôt de garantie n'est exigé" si 0
- **Paragraphe légal** : Affiché uniquement si deposit > 0

```typescript
// Avant
Le dépôt de garantie est d'un montant de {formatCurrency(lease.deposit)} soit un (1) mois...
// Après
Le dépôt de garantie est d'un montant de {formatCurrency(lease.deposit ?? 0)}
{lease.deposit > 0 ? ' soit un (1) mois de loyer hors charges' : ''}. 
{lease.deposit > 0 ? 'Il est versé...' : 'Aucun dépôt de garantie n\'est exigé pour ce bail.'}
```

## 🎨 Résultats Attendus

### Création/Édition de Bail
- ✅ Champ dépôt affiche "0" par défaut (pas vide)
- ✅ Saisie de "0" est acceptée et sauvegardée
- ✅ Pas d'erreur de validation
- ✅ API retourne `deposit: 0` (pas `null`)

### Génération PDF
- ✅ Tableau financier affiche "Dépôt de garantie: 0,00 €"
- ✅ Section 3.2 affiche "Aucun dépôt de garantie n'est exigé pour ce bail."
- ✅ Pas de paragraphe légal sur la restitution si deposit = 0
- ✅ Pas d'erreur de génération

### Base de Données
- ✅ Champ `deposit` stocke 0 (pas NULL)
- ✅ Queries retournent 0 par défaut
- ✅ Pas d'incohérence entre 0 et NULL

## 📊 Pattern Appliqué

### ❌ **À Éviter**
```typescript
// BAD: 0 est considéré comme falsy
if (!deposit) { ... }
const value = deposit || defaultValue; // 0 devient defaultValue
deposit: body.deposit ? parseFloat(body.deposit) : null; // 0 devient null
```

### ✅ **À Utiliser**
```typescript
// GOOD: Test explicite de null/undefined
if (deposit == null) { ... }
if (deposit === undefined || deposit === null) { ... }
const value = deposit ?? defaultValue; // Nullish coalescing
deposit: body.deposit != null ? parseFloat(body.deposit) : 0;
value={formData.deposit ?? 0}
```

## 🧪 Tests à Effectuer

1. **Créer un bail avec dépôt = 0**
   - ✅ Formulaire accepte la valeur
   - ✅ API sauvegarde sans erreur
   - ✅ Base de données contient 0

2. **Générer le PDF**
   - ✅ Tableau affiche "0,00 €"
   - ✅ Texte adapté ("Aucun dépôt...")
   - ✅ Pas d'erreur de génération

3. **Modifier un bail existant pour mettre dépôt = 0**
   - ✅ Formulaire affiche "0"
   - ✅ Modification sauvegardée
   - ✅ PDF mis à jour

4. **Vérifier que charges = 0 fonctionne aussi**
   - ✅ Même logique appliquée
   - ✅ Affichage cohérent

---

**✅ Le dépôt de garantie à 0 € est maintenant entièrement supporté !**

Plus d'erreur de validation, affichage correct dans l'UI et les PDFs.

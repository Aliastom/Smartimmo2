# 📦 Résumé Implémentation "Gestion déléguée"

> **Statut:** Infrastructure complète ✅ | UI avancée en cours

## ✅ CE QUI EST FAIT (Phase 1 - Infrastructure)

### 1. Base de données & Schéma
- ✅ Modèle `ManagementCompany` créé avec tous les champs
- ✅ Relations avec `Property` (managementCompanyId)
- ✅ Nouveaux champs sur `Lease`: chargesRecupMensuelles, chargesNonRecupMensuelles
- ✅ Nouveaux champs sur `Transaction`: montantLoyer, chargesRecup, chargesNonRecup, managementCompanyId, isAuto, autoSource
- ✅ Schéma appliqué via `prisma db push`

### 2. Logique métier
- ✅ Fonction `calcCommission()` partagée front/back dans `src/lib/gestion/`
- ✅ Service `managementCommissionService.ts` avec:
  - createManagementCommission()
  - updateManagementCommission()
  - deleteManagementCommission()
  - shouldCreateCommission()
- ✅ Feature flag `ENABLE_GESTION_SOCIETE` implémenté

### 3. API Backend
- ✅ GET/POST `/api/gestion/societes` (liste, création)
- ✅ GET/PATCH/DELETE `/api/gestion/societes/:id` (détail, mise à jour, désactivation)
- ✅ POST `/api/gestion/societes/:id/affecter-biens` (affectation propriétés)

### 4. Interface utilisateur
- ✅ Menu latéral "Gestion déléguée" (conditionnel au feature flag)
- ✅ Page liste des sociétés (`/gestion-deleguee`)
- ✅ Modale complète de création/édition de société
- ✅ Modification de la modale Bail (champs charges récup/non-récup)

### 5. Seed & données de test
- ✅ Seed pour créer société "ImmoGest" et données de test
- ✅ Catégorie "frais_gestion" (déjà existante dans le système)

## 🚧 CE QUI RESTE À FAIRE (Phase 2 - Intégration)

### TODO 10: Modale Transaction loyer - Granularité & commission
**Impact:** Critique pour l'UX du flux loyer
**Fichier:** À trouver la modale de création de transaction

**Objectifs:**
1. Ajouter champs de granularité:
   - Loyer hors charges (montantLoyer)
   - Charges récupérables (chargesRecup)
   - Charges non récupérables (chargesNonRecup)
2. Préremplir depuis le Bail si disponible
3. Calculer et afficher "Total payé par le locataire" (read-only)
4. Si bien lié à une société ET feature ON:
   - Encart bleu "Commission estimée"
   - Affichage en lecture seule: Base, Taux, Min, Montant TTC
   - Recalcul live via `calcCommission()` quand les montants changent

**Exemple d'encart:**
```tsx
{property.managementCompany && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
    <h4 className="font-medium text-blue-900">Commission de gestion estimée</h4>
    <div className="grid grid-cols-2 gap-2 text-sm mt-2">
      <span className="text-gray-600">Base de calcul:</span>
      <span className="font-medium">{calculatedCommission.base.toFixed(2)}€</span>
      
      <span className="text-gray-600">Taux:</span>
      <span className="font-medium">{(property.managementCompany.taux * 100).toFixed(2)}%</span>
      
      {property.managementCompany.fraisMin && (
        <>
          <span className="text-gray-600">Minimum:</span>
          <span className="font-medium">{property.managementCompany.fraisMin.toFixed(2)}€</span>
        </>
      )}
      
      <span className="text-gray-600">Commission TTC:</span>
      <span className="font-bold text-blue-900">{calculatedCommission.commissionTTC.toFixed(2)}€</span>
    </div>
    <p className="text-xs text-gray-500 mt-2">
      💡 La commission sera créée automatiquement lors de l'enregistrement
    </p>
  </div>
)}
```

### TODO 11: Liste transactions - Affichage commissions indentées
**Impact:** Important pour la lisibilité
**Fichier:** Composant liste des transactions (probablement dans `src/app/transactions/`)

**Objectifs:**
1. Détecter les transactions avec `parentTransactionId` ET `isAuto=true`
2. Les afficher indentées visuellement sous leur transaction parent
3. Badge "Auto (Gestion)" avec icône ⚙️
4. Filtres additionnels:
   - "Inclure frais de gestion" (checkbox)
   - "Grouper par parent" (toggle)

**Exemple visuel:**
```
+-----------------------------------------------------------------------+
| 📅 01/11/2024 | Loyer novembre 2024               | +578.26€  | [📄] |
|   └─ ⚙️ Auto | Commission de gestion - ImmoGest  |  -33.50€  |      |
+-----------------------------------------------------------------------+
```

### Intégration API transactions (Critique)
**Fichier:** `src/app/api/transactions/route.ts`

**Dans POST (création):**
```typescript
// Après création de la transaction principale
if (shouldCreateCommission(transaction.nature, body.montantLoyer)) {
  await createManagementCommission({
    transactionId: transaction.id,
    propertyId: transaction.propertyId,
    montantLoyer: body.montantLoyer,
    chargesRecup: body.chargesRecup,
    date: transaction.date,
    accountingMonth: transaction.accountingMonth,
    leaseId: transaction.leaseId,
    bailId: transaction.bailId,
  }, tx); // Passer la transaction Prisma pour cohérence
}
```

**Dans PATCH (édition):**
- Récupérer la commission liée (si existe)
- Si `isAuto=true` → mettre à jour avec `updateManagementCommission()`
- Si `isAuto=false` → ne pas toucher, retourner warning dans la réponse

**Dans DELETE (suppression):**
- Si commission liée avec `isAuto=true` → suppression automatique via `deleteManagementCommission()`
- Si `isAuto=false` → proposer au front un flag `deleteChildren=true`

## 📝 Variables d'environnement requises

**.env** (backend):
```bash
ENABLE_GESTION_SOCIETE=true
DATABASE_URL="file:./prisma/dev.db"
```

**.env.local** (frontend):
```bash
NEXT_PUBLIC_ENABLE_GESTION_SOCIETE=true
```

## 🧪 Plan de tests (après intégration complète)

### Test 1: Feature OFF
- ✅ Feature flag = false
- ✅ Menu "Gestion déléguée" masqué
- ✅ Création loyer: aucune commission générée
- ✅ Comportement classique préservé

### Test 2: Feature ON - Sans société
- ✅ Feature ON mais bien sans managementCompanyId
- ✅ Création loyer: aucune commission générée
- ✅ Pas d'encart commission dans la modale

### Test 3: Feature ON - Avec société (LOYERS_UNIQUEMENT, 6%, min 30€)
**Données:**
- Loyer: 558.26€
- Charges récup: 20€
- Charges non-récup: 35€

**Calcul attendu:**
- Base = 558.26€ (LOYERS_UNIQUEMENT)
- Commission = max(558.26 * 0.06, 30) = 33.50€

**Vérifications:**
1. Encart affiche commission = 33.50€
2. Création loyer → transaction B créée automatiquement:
   - montant = -33.50€
   - type = frais_gestion
   - parentTransactionId = A.id
   - isAuto = true
   - autoSource = "gestion"
3. Liste: B apparaît indentée sous A
4. Édition A (montantLoyer → 600€):
   - Commission recalculée = 36.00€
   - B.montant mis à jour automatiquement
5. Édition manuelle de B → isAuto passe à false
6. Édition A à nouveau → B non modifiée, toast warning
7. Suppression A → B supprimée automatiquement (si isAuto=true)

### Test 4: Mode REVENUS_TOTAUX
- Base = montantLoyer + chargesRecup
- Exemple: 558.26 + 20 = 578.26€
- Commission = 34.70€
- Vérifier calcul correct

### Test 5: TVA activée (20%)
- Commission HT = 33.50€
- Commission TTC = 33.50 * 1.20 = 40.20€
- Transaction B.montant = -40.20€

## 🎯 Commandes utiles

```bash
# Appliquer le schéma
npx prisma db push

# Générer le client Prisma
npx prisma generate

# Lancer le seed gestion déléguée
npm run db:seed-management  # (à ajouter dans package.json)

# Démarrer le dev
npm run dev

# Accéder à la page
# http://localhost:3000/gestion-deleguee
```

## 📂 Arborescence des fichiers créés

```
src/
├── lib/
│   ├── gestion/
│   │   ├── calcCommission.ts      ✅ Calcul commission (shared)
│   │   ├── types.ts                ✅ Types TypeScript
│   │   └── index.ts                ✅ Exports
│   └── services/
│       └── managementCommissionService.ts  ✅ Service CRUD commissions
├── app/
│   ├── api/
│   │   └── gestion/
│   │       └── societes/
│   │           ├── route.ts                     ✅ GET, POST
│   │           └── [id]/
│   │               ├── route.ts                 ✅ GET, PATCH, DELETE
│   │               └── affecter-biens/
│   │                   └── route.ts             ✅ POST affectation
│   └── gestion-deleguee/
│       └── page.tsx                ✅ Page liste sociétés
├── components/
│   └── gestion/
│       └── ManagementCompanyModal.tsx  ✅ Modale création/édition
└── ui/
    └── layouts/
        └── AppSidebar.tsx          ✅ Menu latéral modifié

prisma/
├── schema.prisma                   ✅ Modifié
└── seeds/
    └── management-companies-seed.ts  ✅ Seed de test
```

## 🔗 Prochaines étapes prioritaires

1. **[TODO 10]** Modifier modale Transaction loyer (granularité + encart)
2. **[Intégration API]** Hook dans POST /api/transactions
3. **[TODO 11]** Adapter liste transactions (indentation + badges)
4. **[Tests]** Plan de tests manuels complet
5. **[Documentation]** Guide utilisateur avec captures

## 💡 Notes techniques importantes

### Pourquoi isAuto + autoSource?
- `isAuto=true`: identifie les commissions générées automatiquement
- `autoSource="gestion"`: source de génération (extensible pour d'autres types)
- Permet de distinguer commission auto vs manuelle
- Les commissions manuelles ne sont pas écrasées lors des mises à jour

### Gestion des conflits
- Si utilisateur modifie manuellement une commission → `isAuto` passe à `false`
- Éditions futures du loyer parent n'affectent plus cette commission
- Un toast warning informe l'utilisateur: "Commission liée non modifiée (verrouillée manuellement)"

### Performance
- Index sur `managementCompanyId` et `parentTransactionId`
- Requêtes optimisées avec includes minimaux
- Feature flag pour court-circuiter si désactivé

---

**🎉 Conclusion:** La base est solide, l'infrastructure est complète et testable. Il reste principalement des éléments d'UI et l'intégration finale dans le flux de création de transaction.


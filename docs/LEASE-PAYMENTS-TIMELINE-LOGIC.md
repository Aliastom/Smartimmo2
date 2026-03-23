# Logique de la timeline Paiements du bail (`useLeasePaymentsTimeline`)

## 1. Champs utilisés pour décider qu’un mois est payé

| Champ | Rôle | Détail |
|-------|------|--------|
| **leaseId** | Filtre des transactions | Seules les transactions avec `leaseId` égal au bail sont prises en compte. |
| **accounting_month** / **periodMonth+periodYear** | Mois couvert | Priorité au mois couvert par la transaction, pas à la date d’enregistrement. |
| **date** | Fallback | Si aucun mois couvert n’est renseigné, on utilise la date de la transaction. |
| **nature** | Filtre (optionnel) | On peut filtrer sur `RECETTE_LOYER` pour ne compter que les loyers. |
| **echeanceId** / **EcheanceTransactionLink** | Non utilisé | La timeline ne s’appuie pas sur les liens échéance ↔ transaction. |

### Comportement actuel (avant correction)

- **Filtre** : uniquement les transactions avec `leaseId` égal au bail.
- **Mois réalisé** : déduit de `tx.date` uniquement.
- Problème : une transaction de loyer de janvier avec date d’enregistrement en février est comptée en février, et janvier reste "en retard".

---

## 2. Bouton "Enregistrer un paiement"

Le bouton ouvre `TransactionModal` avec un prefill contenant :

- `leaseId`, `propertyId`, `nature: 'RECETTE_LOYER'`
- `periodMonth`, `periodYear`, `label` (ex. "Loyer janvier 2025")
- `amount` (loyer + charges), `montantLoyer`, `chargesRecup`
- `date`, `paymentDate` (échéance)

La soumission crée une transaction via `createTransactionServiceWithMode('app-shell')` avec notamment :

- `leaseId`
- `accountingMonth` = `YYYY-MM` calculé
- `periodMonth`, `periodYear`
- `nature: 'RECETTE_LOYER'`

Cette transaction est ensuite prise en compte par la timeline via `leaseId` et le mois couvert.

---

## 3. Pourquoi des transactions déjà en Finances ne sont pas reconnues ?

Plusieurs causes possibles :

1. **Absence de `leaseId`**  
   Si la transaction a été créée sans lien explicite au bail, elle n’est jamais incluse (filtre strict sur `leaseId`).

2. **Mauvais mois couvert**  
   La timeline utilisait uniquement `tx.date` pour le mois. Une transaction enregistrée le 15 février pour le loyer de janvier était comptée en février, laissant janvier "en retard".

3. **Source de données**  
   La timeline lit IndexedDB (mode app-shell). Si les données viennent d’une autre source (API/Prisma) et ne sont pas synchronisées, ou si l’utilisateur est en mode normal, les données peuvent diverger.

---

## 4. Améliorations proposées (implémentées)

1. **Utiliser le mois couvert**  
   Priorité : `accounting_month` (format `YYYY-MM`) ou `year`+`month`, sinon `date`.

2. **Filtrer sur la nature**  
   Ne compter que les transactions de type loyer (`nature === 'RECETTE_LOYER'` ou équivalent) pour éviter d’inclure d’autres types (charges, dépôt, etc.).

3. **Reconnaître les transactions sans `leaseId`** (v2)  
   Pour les transactions `RECETTE_LOYER` avec `propertyId` et sans `leaseId`, on peut tenter de les attribuer au bail actif du bien, via `accounting_month` et période du bail. À faire dans une étape ultérieure.

---

## Erreur `EcheanceRecurrente.natureCode does not exist`

Si vous voyez cette erreur au PATCH `/api/echeances/:id`, la colonne `natureCode` n’existe pas encore en base. Appliquez la migration :

```bash
npx prisma migrate deploy
```

Ou en développement :

```bash
npx prisma migrate dev
```

La migration `20260319000000_echeance_nature_category` ajoute les colonnes `natureCode` et `defaultCategoryId` à la table `EcheanceRecurrente`.

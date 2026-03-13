# Règle métier : paidAt obligatoire

## Contexte

L’année fiscale des revenus fonciers est déterminée par la **date d’encaissement** (règle DGFiP).  
Pour fiabiliser le moteur fiscal, **toute transaction représentant un flux réellement payé/encaissé** doit avoir une **date de paiement** (`paidAt`) renseignée à la saisie.

## Règle appliquée

- **Obligatoire** pour toutes les créations et mises à jour de transactions « réelles » (loyers encaissés, charges payées, factures, taxes, frais, assurances, etc.).
- **Pas d’exception** pour les flux déjà comptabilisés : dès qu’on crée ou modifie une transaction, `paidAt` est requis.
- Les transactions **historiques** sans `paidAt` restent **lisibles** ; en revanche, toute **modification** d’une telle transaction impose de renseigner `paidAt` avant sauvegarde.

## Compatibilité

- La colonne Prisma `paidAt` reste **nullable** pour ne pas casser l’historique.
- L’obligation est appliquée **dans l’application** (validation front + back + service), pas par contrainte DB.

## Fichiers modifiés

| Fichier | Modification |
|--------|---------------|
| `src/lib/validations/transaction.ts` | Schémas Zod : `.refine()` pour exiger `paidAt` ou `paymentDate` (création, édition, formulaire). |
| `src/domain/services/TransactionService.ts` | `createTransaction` : erreur si `paidAt` absent. `updateTransaction` : erreur si transaction sans `paidAt` et mise à jour sans `paidAt`. |
| `src/app/api/transactions/route.ts` | POST : validation `paidAt` ou `paymentDate` avant appel au service. |
| `src/app/api/transactions/[id]/route.ts` | PATCH : si la transaction n’a pas de `paidAt`, le body doit en fournir un. |
| `src/components/transactions/TransactionModalV2.tsx` | Champ « Date de paiement » requis (*), défaut = aujourd’hui, message d’erreur + précision fiscale. |
| `src/app/api/transactions/bulk/route.ts` | Schéma : `paidAt` requis dans `base` ; toutes les lignes créées ont `paidAt`. |
| `src/app/actions/transactions.ts` | Schéma + passage de `paidAt` en création. |
| `src/components/documents/UploadReviewModal.tsx` | Commentaire + utilisation de `data.paymentDate` en fallback pour `paidAt`. |
| `src/lib/services/airbnbImportService.ts` | Tous les `transaction.create` et `transaction.update` : `paidAt: transactionDate` (date de la réservation = date d’encaissement pour l’import). |

## Messages UX

- **Validation** : « La date de paiement est obligatoire. »
- **Mise à jour sans paidAt** : « La date de paiement est obligatoire. Veuillez la renseigner pour cette transaction. »
- **UI** : libellé « Date de paiement * » + texte d’aide : « Référence fiscale (encaissement). À distinguer du mois couvert (suivi locatif). »

## Checklist de test

- [ ] Création d’un loyer (recette) sans renseigner la date de paiement → refus (message explicite).
- [ ] Création d’une charge sans date de paiement → refus.
- [ ] Création avec date de paiement renseignée → succès.
- [ ] Édition d’une ancienne transaction sans `paidAt` : sans renseigner la date de paiement → refus ; après renseignement → succès.
- [ ] Création offline (App Shell) sans `paidAt` → refus (même validation côté service).
- [ ] Export fiscal / agrégation : les transactions déjà valides (avec `paidAt`) restent inchangées.
- [ ] Lecture des anciennes transactions sans `paidAt` : toujours possible (liste, détail, exports).
- [ ] Distinction « mois couvert » vs « date de paiement » : visible et expliquée dans la modale.
- [ ] Création en bulk : `paidAt` requis dans le payload ; toutes les lignes créées ont bien `paidAt`.
- [ ] Quittances / reçus (`/api/receipts`) : déjà basés sur une date de paiement → pas de régression.
- [ ] Import Airbnb : les transactions créées ou mises à jour ont bien `paidAt` = date de la réservation.

# Comportement Cascade Delete - Commissions Auto

## Comportement actuel (confirmé)

Lors de la suppression d'une transaction **loyer** (qui génère une commission de gestion automatique), la transaction **commission fille** est **automatiquement supprimée** en cascade.

## Implémentation

Dans `TransactionService.deleteTransaction()` :

```typescript
// ⚙️ GESTION DÉLÉGUÉE: Gérer les enfants (commissions) avant suppression
const children = await this.deps.transactionRepo.findMany({
  parentTransactionId: id,
  organizationId: existingTransaction.organizationId,
});

if (children.length > 0) {
  // Filtrer par autoSource='gestion' pour ne prendre que les commissions
  const gestionChildren = children.filter(c => c.autoSource === 'gestion');
  const autoChildren = gestionChildren.filter(c => c.isAuto);
  
  // Supprimer systématiquement les enfants auto (commissions auto de gestion)
  if (autoChildren.length > 0) {
    for (const child of autoChildren) {
      await this.deps.transactionRepo.delete(child.id);
    }
    childrenInfo.autoDeleted = autoChildren.length;
  }
}
```

## Règles

1. **Commissions auto (`isAuto === true` et `autoSource === 'gestion'`)** : Supprimées **automatiquement** en cascade lors de la suppression du loyer parent
2. **Commissions non-auto** : Ne sont **pas** supprimées automatiquement (nécessite `deleteChildren: true` explicite)

## Comportement attendu

✅ **Oui, c'est le comportement attendu** : Lorsqu'on supprime un loyer, sa commission fille auto est supprimée automatiquement.

## Raison

- Les commissions auto sont générées automatiquement par le système
- Elles n'ont pas de sens métier sans leur transaction parent
- C'est cohérent avec le principe que les commissions auto sont des "enfants" du loyer

# 📄 Règles App-Shell - Gestion des Documents

## Upload et création de transaction avec document

**Flux normal** : Upload document (serveur) → Ajout IndexedDB avec `_remoteReady=true` → Création transaction → Finalisation document + création 4 liens (transaction, property, lease, global).

**PendingOps attendues** : 1 Transaction Create + 1 Document Update (finalisation) + 4 DocumentLink Create = **6 opérations**. Si changement de type avant création : +1 Document Update (reclassification).

## Garde-fous implémentés

1. **`_remoteReady` flag** : Documents uploadés via API ont `_remoteReady=true` dans IndexedDB pour éviter purge involontaire comme brouillon orphelin.
2. **Upload ONLINE-ONLY** : Upload bloqué si offline, aucun placeholder créé. Document existe d'abord côté serveur puis est ajouté dans IndexedDB.
3. **DocumentLink avec transaction** : Résolution just-in-time via `transaction.serverId`. Si `serverId` absent → blocage avec `transaction_not_synced` (retry automatique après sync transaction).

## Validation

✅ **Aucun 404 /links** : Documents présents dans IndexedDB avant création transaction, liens créés localement puis sync.  
✅ **Aucun `transaction_not_synced`** : Résolution `serverId` garantit que tous les DocumentLinks sont poussés avec ID serveur valide.  
✅ **Doc non purgeable** : Flag `_remoteReady=true` protège contre purge comme brouillon orphelin.


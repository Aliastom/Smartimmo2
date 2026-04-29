# Patrimoine (global)

## Rôle

La page **Patrimoine** offre une vue consolidée du patrimoine immobilier (KPI, graphiques, exports) et un **cockpit décisionnel** : synthèse nette, répartition, recommandations indicatives et hypothèses utilisateur (cash, PEA/ETF, objectif, DCA).

## Sources de données

- **Fiscal** : simulations enregistrées dans IndexedDB ; le cockpit peut être en **choix automatique** (dernière simulation au résultat exploitable, tri par date) ou **manuel** (simulation précise via les hypothèses). Si l’id choisie n’existe plus, **fallback** automatique avec avertissement.
- **Marché** : moteur d’investissement / recommandation existant (symbole, cours, drawdown) — optionnel ; le snapshot gère l’absence de données.
- **Paramètres utilisateur** : `localStorage` par organisation (`patrimoineSettings`) : cash disponible, coussin de sécurité, valorisation PEA/ETF, jour de DCA, objectif (croissance / sécurité / équilibre).
- **Patrimoine immobilier** : biens, prêts, transactions, baux, etc. via les repositories / hooks existants pour les agrégats de la page.

## Services principaux (cockpit)

- `usePatrimoineSnapshot` : agrège immo + fiscal + marché + settings → `PatrimoineSnapshotResult`.
- `patrimoineDecisionService` : règles de recommandation (DCA / renfort / attente) et actions priorisées.
- `patrimoineAllocationScore` : score d’équilibre d’allocation ETF.
- `patrimoineProjectionService` : projection indicative cash / patrimoine (tendance sur horizon fixe).
- `patrimoineRecommendationTrace` : libellés explicatifs pour la traçabilité affichée.
- `patrimoineActionsStore` : action **« Appliquer DCA »** — enregistre le montant côté paramètres marché (pas d’ordre bancaire).

## Limite produit

Smartimmo **ne transmet pas d’ordres** sur des comptes réels : toute action est locale (paramètres, rappels) ou informative.

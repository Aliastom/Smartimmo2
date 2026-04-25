# Recette métier — flux LMNP (un bien réel)

À exécuter sur un **bien LMNP** de test ou pré-prod, avec un compte **ADMIN** pour l’administration.

## Préparation

1. [ ] `npm run db:seed:lmnp-default` (ou équivalent) — règles par défaut présentes pour l’org.
2. [ ] Vérifier que les transactions de l’exercice ont un `accounting_month` au format `YYYY-MM` cohérent avec l’exercice choisi.

## Fiche bien — export

3. [ ] Ouvrir la fiche bien → **Exporter LMNP**.
4. [ ] Choisir l’**exercice** → **Analyser (dry run)**.
5. [ ] Noter : couverture, nombre de transactions, liste **bloquants** vs **warnings**, `dryRunPayloadHash`.
6. [ ] Si blocants : depuis l’admin, **règles** et/ou **overrides** ; créer un override si besoin → re-dry run jusqu’à **0 bloquant**.
7. [ ] **Télécharger le ZIP** (final) → fichier reçu, en-tête / UI affiche **runId** si présent.

## Contrôle dossier ZIP

8. [ ] Ouvrir le ZIP : `01_ecritures.csv`, `manifest.json`, `04_anomalies.csv` (si lignes), `02_justificatifs/` selon cas.
9. [ ] `manifest.json` : `coverageRate`, `anomalyCount`, `blockingAnomalyCount`, `mappingVersion`.

## Administration

10. [ ] **Historique runs** (`/admin/lmnp/runs`) : run visible, statut `completed`, couverture / anomalies.
11. [ ] **Détail run** (drawer) : manifeste JSON + liste anomalies cohérente avec le dry run.
12. [ ] **Anomalies** (`/admin/lmnp/anomalies`) : filtre par `runId` → lignes attendues.
13. [ ] Si besoin : **override depuis anomalie** → re-dry run sur la fiche bien → couverture améliorée ou blocants levés.

## Non-régression (hors LMNP)

14. [ ] Importer / consulter un flux **Airbnb** habituel (pas de régression d’import).
15. [ ] **Dashboard** / **cashflow** : chargement et chiffres clés inchangés sur le même bien / période.
16. [ ] Aucune modification involontaire des **natures / catégories** référentielles (écrans admin existants).

## Automatisé (CI local)

```bash
npm run test:lmnp
```

Inclut des garde-fous sur l’absence de `prisma.transaction.update` dans le périmètre LMNP listé.

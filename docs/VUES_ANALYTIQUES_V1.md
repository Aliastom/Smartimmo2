# 📊 VUES ANALYTIQUES SQL V1 - SMARTIMMO

## ✅ Statut : INSTALLÉES

Les vues analytiques SQL Pack V1 sont maintenant intégrées dans Smartimmo.

---

## 📋 6 Vues créées

### 1️⃣ `v_loyers_encaissements_mensuels`

**Utilité :** Suivi des encaissements de loyers par mois, bien et bail.

**Colonnes :**
- `mois` (date) - Mois concerné
- `propertyId` - ID du bien
- `leaseId` - ID du bail
- `loyer_encaisse` - Montant encaissé
- `loyer_total` - Montant total dû
- `nb_baux` - Nombre de baux

**Questions supportées :**
- ✅ "Combien de loyers encaissés ce mois ?"
- ✅ "Loyers du mois dernier ?"
- ✅ "Encaissements par bien ?"

**Exemple SQL :**
```sql
SELECT mois, SUM(loyer_encaisse) as total
FROM v_loyers_encaissements_mensuels
WHERE mois = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY mois;
```

---

### 2️⃣ `v_loyers_a_encaisser_courant`

**Utilité :** Suivi des loyers du mois en cours (dus vs payés).

**Colonnes :**
- `lease_id` - ID du bail
- `property_id` - ID du bien
- `tenant_id` - ID du locataire
- `property_name` - Nom du bien
- `tenant_name` - Nom du locataire
- `tenant_email` - Email du locataire (à masquer)
- `mois` - Mois concerné
- `loyer_du` - Loyer dû
- `deja_paye` - Déjà payé
- `reste_a_payer` - Reste à payer
- `statut` - 'PAYE' | 'PARTIEL' | 'IMPAYE'

**Questions supportées :**
- ✅ "Liste des loyers impayés ?"
- ✅ "Qui est en retard de paiement ?"
- ✅ "J'ai tout encaissé ce mois ?"

**Exemple SQL :**
```sql
SELECT tenant_name, property_name, reste_a_payer, statut
FROM v_loyers_a_encaisser_courant
WHERE statut IN ('IMPAYE', 'PARTIEL')
ORDER BY reste_a_payer DESC
LIMIT 10;
```

---

### 3️⃣ `v_echeances_3_mois`

**Utilité :** Échéances à venir (indexations + prêts) sur 90 jours.

**Colonnes :**
- `type` - 'INDEXATION_BAIL' | 'PRET'
- `property_id` - ID du bien
- `ref_id` - ID référence (bail ou prêt)
- `property_name` - Nom du bien
- `montant_actuel` - Montant concerné
- `due_date` - Date d'échéance
- `meta_code` - Code métier (IRL, MENSUALITE, etc.)
- `description` - Description lisible

**Questions supportées :**
- ✅ "Échéances dans les 3 mois ?"
- ✅ "Quand indexer mes baux ?"
- ✅ "Prochaines mensualités de prêts ?"

**Exemple SQL :**
```sql
SELECT type, property_name, due_date, description
FROM v_echeances_3_mois
ORDER BY due_date
LIMIT 20;
```

---

### 4️⃣ `v_prets_statut`

**Utilité :** Statut détaillé des prêts (CRD, mensualités, échéances).

**Colonnes :**
- `loan_id` - ID du prêt
- `property_id` - ID du bien
- `property_name` - Nom du bien
- `label` - Libellé du prêt
- `capital_initial` - Capital emprunté
- `taux_annuel` - Taux annuel (%)
- `capital_restant_du` - CRD (approximation)
- `mensualite` - Mensualité calculée
- `date_debut` - Date de début
- `date_fin` - Date de fin
- `mois_restants` - Mois restants
- `actif` - Prêt actif (boolean)

**Questions supportées :**
- ✅ "Capital restant sur mes prêts ?"
- ✅ "Mensualités totales ?"
- ✅ "Détail de mes prêts ?"
- ✅ "Quand finissent mes prêts ?"

**Exemple SQL :**
```sql
SELECT SUM(capital_restant_du) as total_crd, 
       SUM(mensualite) as total_mensualites
FROM v_prets_statut
WHERE actif = true;
```

---

### 5️⃣ `v_documents_statut`

**Utilité :** Suivi des documents par type et période.

**Colonnes :**
- `property_id` - ID du bien
- `lease_id` - ID du bail
- `type_code` - Code du type de document
- `type_label` - Libellé du type
- `periode` - Période (YYYY-MM)
- `annee` - Année
- `mois` - Mois
- `ocr_status` - Statut OCR
- `status` - Statut du document
- `nb_documents` - Nombre de documents

**Questions supportées :**
- ✅ "Documents manquants ce mois ?"
- ✅ "J'ai reçu le relevé propriétaire de mars ?"
- ✅ "Documents en attente d'OCR ?"

**Exemple SQL :**
```sql
SELECT type_label, periode, COUNT(*) as nb
FROM v_documents_statut
WHERE periode >= TO_CHAR(CURRENT_DATE - INTERVAL '3 months', 'YYYY-MM')
GROUP BY type_label, periode
ORDER BY periode DESC;
```

---

### 6️⃣ `v_cashflow_global`

**Utilité :** Vue de synthèse du cashflow (entrées vs sorties).

**Colonnes :**
- `mois` - Mois concerné
- `property_id` - ID du bien
- `property_name` - Nom du bien
- `entrees` - Total des entrées
- `sorties` - Total des sorties
- `solde_net` - Solde net (entrées - sorties)

**Questions supportées :**
- ✅ "Cashflow du mois ?"
- ✅ "Entrées vs sorties ?"
- ✅ "Quel bien est rentable ?"

**Exemple SQL :**
```sql
SELECT mois, SUM(entrees) as entrees, 
       SUM(sorties) as sorties, 
       SUM(solde_net) as solde
FROM v_cashflow_global
WHERE mois >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '3 months')
GROUP BY mois
ORDER BY mois DESC;
```

---

## 🚀 Installation

### Méthode automatique (recommandée)

```bash
npm run db:views
```

Cette commande :
1. Lit le fichier `db/views/analytics.sql`
2. Exécute toutes les vues sur PostgreSQL
3. Vérifie que chaque vue fonctionne
4. Affiche un récapitulatif

### Méthode manuelle (alternative)

```bash
psql "postgresql://smartimmo:smartimmo@localhost:5432/smartimmo" -f db/views/analytics.sql
```

---

## ✅ Vérification

Après installation, vérifier :

```bash
npm run db:views
```

Vous devriez voir :
```
✅ Vues analytiques créées avec succès !

📊 Vues disponibles:
   1. v_loyers_encaissements_mensuels - Encaissements par mois
   2. v_loyers_a_encaisser_courant - Loyers dus vs payés
   3. v_echeances_3_mois - Échéances à venir
   4. v_prets_statut - Statut des prêts
   5. v_documents_statut - Statut des documents
   6. v_cashflow_global - Cashflow global

🧪 Vérifications rapides:
   ✓ v_loyers_encaissements_mensuels
   ✓ v_loyers_a_encaisser_courant
   ✓ v_echeances_3_mois
   ✓ v_prets_statut
   ✓ v_documents_statut
   ✓ v_cashflow_global
```

---

## 🤖 Intégration avec l'Agent IA

### Autorisation automatique

Les 6 vues sont **automatiquement autorisées** dans le validateur SQL.

Fichier : `src/lib/ai/sql/validator.ts`

```typescript
const ALLOWED_TABLES = new Set([
  // ... tables existantes
  // Vues analytiques V1 (Pack SQL)
  'v_loyers_encaissements_mensuels',
  'v_loyers_a_encaisser_courant',
  'v_echeances_3_mois',
  'v_prets_statut',
  'v_documents_statut',
  'v_cashflow_global',
]);
```

### Génération SQL intelligente

L'agent **génère automatiquement** les bonnes requêtes selon la question.

Fichier : `src/lib/ai/agent/react.ts` - fonction `generateSqlQuery()`

**Mapping questions → vues :**

| Question | Vue utilisée |
|----------|--------------|
| "Loyers encaissés ce mois ?" | `v_loyers_encaissements_mensuels` |
| "Qui est en retard ?" | `v_loyers_a_encaisser_courant` |
| "Échéances dans 3 mois ?" | `v_echeances_3_mois` |
| "Capital restant sur mes prêts ?" | `v_prets_statut` |
| "Cashflow du mois ?" | `v_cashflow_global` |
| "Documents manquants ?" | `v_documents_statut` |

---

## 🧪 Tests recommandés

Testez l'agent IA avec ces questions :

### Loyers

1. ✅ "Combien de loyers encaissés ce mois ?"
2. ✅ "Loyers du mois dernier ?"
3. ✅ "Liste des locataires en retard"
4. ✅ "Qui n'a pas payé son loyer ?"
5. ✅ "J'ai tout encaissé ce mois ?"

### Échéances

6. ✅ "Échéances dans les 3 prochains mois ?"
7. ✅ "Quand indexer mes baux ?"
8. ✅ "Prochaines mensualités de prêts ?"

### Prêts

9. ✅ "Capital restant sur mes prêts ?"
10. ✅ "Mensualités totales ?"
11. ✅ "Détail de mes prêts ?"
12. ✅ "Jusqu'à quand j'ai des prêts ?"

### Cashflow

13. ✅ "Cashflow du mois ?"
14. ✅ "Entrées vs sorties des 3 derniers mois ?"
15. ✅ "Quel bien est le plus rentable ?"

### Documents

16. ✅ "Documents manquants ce mois ?"
17. ✅ "J'ai reçu le relevé propriétaire de mars ?"

---

## 📝 Notes techniques

### Approximations

⚠️ **Capital Restant Dû (CRD)** : Le calcul est une **approximation linéaire**.

Pour un calcul précis du CRD, vous devriez :
- Stocker un échéancier détaillé
- Ou utiliser une formule d'amortissement complète

**Formule actuelle (approximation) :**
```sql
capital_restant_du = capital_initial * (1 - (mois_ecoulés / durée_totale))
```

**Pour améliorer :**
1. Créer une table `LoanSchedule` avec l'échéancier détaillé
2. Mettre à jour `capital_restant_du` à chaque paiement
3. Ou utiliser la formule d'amortissement complète dans la vue

### Index suggérés

Les index suivants sont **créés automatiquement** :

```sql
idx_transaction_date
idx_transaction_paidat
idx_transaction_lease
idx_transaction_property
idx_lease_status
idx_document_uploaded
idx_loan_active
```

Si vous avez beaucoup de données, créez-les manuellement si absents.

---

## 🔧 Personnalisation

### Adapter les vues

Fichier source : `db/views/analytics.sql`

1. Modifier le SQL selon vos besoins
2. Réappliquer : `npm run db:views`
3. L'agent utilisera automatiquement les nouvelles vues

### Ajouter une nouvelle vue

1. Ajouter le SQL dans `db/views/analytics.sql`
2. Autoriser la vue dans `src/lib/ai/sql/validator.ts`
3. Mettre à jour `generateSqlQuery()` si besoin
4. Réappliquer : `npm run db:views`

---

## 📞 Support

### Vue ne fonctionne pas ?

1. Vérifier que PostgreSQL est accessible
2. Vérifier que les tables existent
3. Réappliquer : `npm run db:views`
4. Consulter les logs

### L'agent ne trouve pas les données ?

1. Vérifier que les vues retournent des données :
   ```sql
   SELECT * FROM v_loyers_encaissements_mensuels LIMIT 5;
   ```
2. Vérifier que les données de test existent : `npm run db:seed:ai`
3. Vérifier les logs de l'agent

### Questions non supportées ?

L'agent génère une requête SQL **heuristique** basée sur des mots-clés.

Pour améliorer :
1. Ajouter des patterns dans `generateSqlQuery()`
2. Ou laisser l'agent générer lui-même le SQL (plus avancé)

---

## 🎉 Résumé

✅ 6 vues analytiques créées
✅ Intégrées avec l'agent IA
✅ Questions métier supportées
✅ SQL sécurisé (read-only, LIMIT, timeout)
✅ Citations automatiques
✅ Documentation complète

**Commandes essentielles :**

```bash
npm run db:views          # Appliquer les vues
npm run ai:setup          # Setup complet (tables AI + vues)
npm run dev               # Démarrer l'app
```

**Tester l'agent :**

Ouvrir http://localhost:3000 → Cliquer sur le Compagnon IA → Poser une question !

---

**Développé avec ❤️ et 📊 pour Smartimmo**


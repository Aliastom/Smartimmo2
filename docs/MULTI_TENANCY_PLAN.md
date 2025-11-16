# 📦 Plan Multi-Tenancy Smartimmo

Objectif : cloisonner toutes les données « métier » par utilisateur (1 utilisateur → 1 organisation → 1 portefeuille isolé) tout en gardant les données admin partagées, accessibles en lecture à tous et modifiables uniquement par les administrateurs.

---

## 1. Cartographie des tables

### 1.1 Tables métier (doivent appartenir à une organisation)

| Domaine | Tables | État actuel | Actions requises |
|---------|--------|-------------|------------------|
| Immo | `Property`, `Photo`, `OccupancyHistory`, `Loan` | champ `organizationId` présent mais `@default("default")` et aucune mise à jour automatique | injecter `organizationId` lors des créations/mises à jour, supprimer défaut hardcodé |
| Locataires & Baux | `Tenant`, `Lease`, `LeaseVersion`, `EcheanceRecurrente`, `Reminder` | idem | idem |
| Transactions & Paiements | `Transaction`, `Payment`, `PaymentAttachment`, `UploadSession`, `UploadStagedItem` | idem | idem |
| Documents | `Document`, `DocumentField`, `DocumentLink`, `DocumentKeyword`, `DocumentExtractionRule`, `DocumentTypeField`, `DocumentTextIndex`, `DocumentType` (à confirmer selon usage) | `DocumentType` est global admin → section 1.2 | vérifier toutes les relations lors de la migration (documents héritent du bien/bail/transaction de l’utilisateur) |
| Fiscalité & simulations | `FiscalSimulation`, `TaxSourceConfig`, `TaxSourceSnapshot` | `organizationId` présent | s’assurer que toutes les APIs filtrent |
| Autres | `UploadSession`, `UploadStagedItem`, `Reminder`, `AppConfig/AppSetting` | `AppConfig/AppSetting` sont globaux → cf. 1.2 | idem |

### 1.2 Tables admin (partagées entre tous)

- Référentiels : `DocumentType`, `DocumentKeyword`, `DocumentExtractionRule`, `TypeSignal`, `Signal`, `NatureDefault`, `nature_category_*`, `TaxConfig`, `TaxSourceConfig`, `ManagementCompany` (si global), etc.
- Paramètres système : `AppConfig`, `AppSetting`, `AdminBackupRecord`, `AdminBackupSchedule`.
- Ces tables restent sans filtrage `organizationId`. Les endpoints GET doivent être ouverts à tous (lecture seule). Les mutations restent derrière `protectAdminRoute`.

### 1.3 Tables utilisateurs

- `User`, `Account`, `Session`, `VerificationToken`, `UserProfile`.  
- `User.organizationId` déjà présent mais toujours `"default"` → sera mis à jour lors de la migration.

---

## 2. Migration initiale

1. **Créer une organisation par utilisateur existant**
   - Script Prisma : pour chaque `User`, créer `Organization { name: user.email || user.name }`.
   - Mettre à jour `User.organizationId` avec l’ID de l’organisation créée.
2. **Recaler toutes les données métier**
   - Pour chaque table listée en 1.1 : `update ... set organizationId = <orgId du propriétaire>`.
   - Règles d’affectation :
     - `Property` → `organizationId` du `User` qui l’a créée (si non traçable, fallback sur un super admin + log).
     - Entités liées (`Lease`, `Tenant`, `Transaction`, `Document`, etc.) suivent le `Property` ou `User` associé.
3. **Nettoyage**
   - Supprimer les `@default("default")` inutiles (on passera par la valeur du user).
   - Ajouter des contraintes Prisma/SQL (`@default("")` → retiré, `@db.VarChar` optionnel).

---

## 3. Propagation à la création/mise à jour

- Créer un helper (`getCurrentOrganization()` ou `withOrganization(data)`) pour centraliser l’injection.
- Vérifier toutes les routes/API/services :
  - `POST /api/properties`, `/api/leases`, `/api/transactions`, `/api/documents`, etc.
  - Server Actions/Route Handlers (Upload, OCR, transactions automatiques).
- Ajouter des tests unitaires / d’intégration pour garantir que l’`organizationId` est toujours présent.

---

## 4. Filtrage systématique des lectures

- Auditer chaque `findMany/findFirst` : si absence de filtre `organizationId`, l’ajouter (via repositories ou middlewares).
- Les pages React qui consomment des API doivent transmettre l’organisation implicitement (pas de changement côté client si l’API filtre déjà avec `getCurrentUser`).

---

## 5. Partage lecture-only des données admin

- Introduire deux helpers :
  - `requireAdmin()` (existant) pour les mutations.
  - `allowAdminRead()` ou suppression du guard pour les GET (selon endpoint) afin que les rôles `USER` puissent récupérer les référentiels.
- UI : masquer/disable les actions (boutons “Sauvegarder”, “Importer”, etc.) pour les rôles non admin, mais laisser l’affichage.

---

## 6. Validation & tests

- Scénarios multi-utilisateurs :
  1. User A crée un bien → invisible pour user B.
  2. User B ajoute un document → visible uniquement dans son espace.
  3. Les deux users voient la même configuration `DocumentType` mais seul l’admin peut la modifier.
- Tests automatisés :
  - Ajouter des tests Prisma/route pour vérifier l’isolation.
  - Ajouter un test e2e (ou playwright) si possible.

---

## 7. Prochaines étapes

1. Implémenter la migration (script + migration Prisma).
2. Injecter `organizationId` dans tous les pipelines de création.
3. Vérifier/ajouter les filtres côté lecture.
4. Adapter les endpoints admin en lecture.
5. QA multi-compte + déploiement.

### Script disponible

- `scripts/migrate-organizations.ts` : purge toutes les données multi-tenant (transactions, documents, biens, baux, etc.) puis crée une organisation par utilisateur existant.
  - Usage : `CONFIRM_MULTI_TENANT_RESET=true npx ts-node scripts/migrate-organizations.ts --force`
  - À exécuter uniquement avec une sauvegarde préalable (efface les données).

---

> Besoin d’info supplémentaire (ex. logique pour déterminer l’organisation d’un enregistrement existant) → me le signaler avant la migration pour éviter des choix arbitraires.


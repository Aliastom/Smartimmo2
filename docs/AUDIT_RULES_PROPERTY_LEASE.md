# Audit des règles métier - Property et Lease

## 📋 Règles métier Property

### 1. Création (POST /api/properties)

**Règles:**
- ✅ Validation Zod : name (min 1), type (enum), address, postalCode, city, surface (>0), rooms (>0), acquisitionDate, acquisitionPrice (>0), notaryFees (≥0), currentValue (≥0)
- ✅ Sanitization : chaînes vides → null pour foreign keys (managementCompanyId, fiscalTypeId, fiscalRegimeId, airbnbListingId)
- ✅ Conversion dates : acquisitionDate string → Date
- ✅ Valeurs par défaut : rentalMode = 'LONG_TERM' si non fourni

**Où vit actuellement:**
- `src/app/api/properties/route.ts` (POST) - lignes 61-98

**Où doit vivre:**
- `src/domain/services/PropertyService.createProperty()`

---

### 2. Mise à jour (PUT /api/properties/[id])

**Règles:**
- ✅ Validation Zod : tous les champs optionnels
- ✅ Sanitization : chaînes vides → null pour foreign keys
- ✅ Conversion dates : acquisitionDate string → Date si fournie
- ✅ Vérification ownership : organizationId doit correspondre

**Où vit actuellement:**
- `src/app/api/properties/[id]/route.ts` (PUT) - lignes 58-105

**Où doit vivre:**
- `src/domain/services/PropertyService.updateProperty()`

---

### 3. Suppression (DELETE /api/properties/[id])

**Règles:**
- ✅ Validation mode : 'archive' | 'reassign' | 'cascade'
- ✅ Validation targetPropertyId : requis si mode='reassign'
- ✅ Récupération stats : leases, transactions, documents, echeances, loans
- ✅ Mode 'archive' : soft delete (isArchived=true, archivedAt=now)
- ✅ Mode 'reassign' : transfert vers targetPropertyId puis suppression
  - Vérifier que targetProperty existe et n'est pas archivé
  - Réassigner : leases, transactions, documents, echeances, loans, payments, photos, occupancyHistory
  - Supprimer le bien source
- ✅ Mode 'cascade' : suppression définitive seulement si aucune donnée liée
  - Vérifier stats avant suppression
  - Lever erreur si hasLinkedData

**Où vit actuellement:**
- `src/app/api/properties/[id]/route.ts` (DELETE) - lignes 107-191
- `src/services/deletePropertySmart.ts` - toute la logique

**Où doit vivre:**
- `src/domain/services/PropertyService.deleteProperty()`

---

## 📋 Règles métier Lease

### 1. Création (POST /api/leases)

**Règles:**
- ✅ Validation Zod :
  - propertyId (requis), tenantId (requis)
  - type (enum: residential/commercial/garage)
  - furnishedType (enum: vide/meuble/garage) - optionnel
  - startDate (requis), endDate (optionnel)
  - rentAmount (>0), deposit (≥0)
  - paymentDay (1-31) - optionnel
  - indexationType (enum: none/insee/manual) - optionnel
  - status (enum) - optionnel
  - chargesRecupMensuelles (≥0) - optionnel
  - chargesNonRecupMensuelles (≥0) - optionnel
- ✅ Validation croisée :
  - endDate > startDate (si endDate fournie)
  - deposit ≤ plafond selon furnishedType (meublé=2x loyer, vide=1x loyer)
- ✅ Vérification chevauchement baux actifs :
  - Récupérer tous les baux actifs pour propertyId
  - Vérifier chevauchement de dates (logique complexe avec null endDate)
  - Lever erreur 400 si chevauchement
- ✅ Calcul automatique endDate :
  - Si status='SIGNÉ' ou 'ACTIF' et endDate non fournie
  - Meublé = 1 an après startDate
  - Vide = 3 ans après startDate
- ✅ Transition statut :
  - Si status='SIGNÉ' et startDate <= now → status='ACTIF'
  - Sinon status='BROUILLON' par défaut
- ✅ Valeurs par défaut :
  - furnishedType = 'vide' si non fourni
  - deposit = 0 si non fourni
  - paymentDay = null si non fourni
  - indexationType = 'none' si non fourni
  - notes = '' si non fourni

**Où vit actuellement:**
- `src/app/api/leases/route.ts` (POST) - lignes 98-206

**Où doit vivre:**
- `src/domain/services/LeaseService.createLease()`

---

### 2. Mise à jour (PUT /api/leases/[id])

**Règles:**
- ✅ Validation Zod : tous les champs optionnels
- ✅ Vérification existence : bail doit exister
- ✅ Conversion dates : startDate/endDate string → Date
- ✅ Gestion endDate : chaîne vide → null
- ✅ Calcul automatique endDate :
  - Si statut passe à SIGNÉ/ACTIF (depuis BROUILLON/ENVOYÉ)
  - Et endDate non fournie
  - Calculer selon furnishedType (meublé=1an, vide=3ans)
- ✅ Transitions de statut autorisées :
  - ENVOYÉ → BROUILLON (annulation)
  - SIGNÉ → ENVOYÉ (retour arrière)
  - Autres transitions nécessitent validation
- ✅ Mise à jour : updatedAt = now

**Où vit actuellement:**
- `src/app/api/leases/[id]/route.ts` (PUT) - lignes 29-147

**Où doit vivre:**
- `src/domain/services/LeaseService.updateLease()`

---

### 3. Suppression (DELETE /api/leases/[id])

**Règles:**
- ✅ Vérification existence : bail doit exister
- ✅ Protection baux actifs :
  - Si status='ACTIF' → erreur 409 (résilier d'abord)
- ✅ Protection transactions :
  - Si transactions liées ET status != 'RÉSILIÉ' → erreur 409
  - Un bail RÉSILIÉ peut être supprimé même avec transactions
- ✅ Suppression : hard delete

**Où vit actuellement:**
- `src/app/api/leases/[id]/route.ts` (DELETE) - lignes 149-204

**Où doit vivre:**
- `src/domain/services/LeaseService.deleteLease()`

---

## 📊 Résumé des dépendances

### PropertyService dépend de:
- IPropertyRepository (CRUD)
- ILeaseRepository (pour vérifier baux liés)
- ITransactionRepository (pour vérifier transactions liées)
- IDocumentRepository (pour vérifier documents liés)
- IEcheanceRepository (pour vérifier échéances liées)
- ILoanRepository (pour vérifier prêts liés)
- IPaymentRepository (pour réassigner payments)
- IPhotoRepository (pour réassigner photos)
- IOccupancyHistoryRepository (pour réassigner historique)

### LeaseService dépend de:
- ILeaseRepository (CRUD + findByPropertyId pour chevauchement)
- ITransactionRepository (pour vérifier transactions liées)
- IPropertyRepository (pour vérifier que property existe)
- ITenantRepository (pour vérifier que tenant existe)

---

## 🔄 Migration plan

1. **Étape 1** : Étendre interfaces repositories (ajouter méthodes manquantes)
2. **Étape 2** : Créer PropertyService avec toute la logique
3. **Étape 3** : Créer LeaseService avec toute la logique
4. **Étape 4** : Créer implémentations in-memory
5. **Étape 5** : Créer adapters Prisma (étendre existants)
6. **Étape 6** : Créer adapters IndexedDB (étendre existants)
7. **Étape 7** : Refactorer routes API
8. **Étape 8** : Refactorer Core Components + modales
9. **Étape 9** : Tests de conformité

---

## ✅ Checklist conformité

- [ ] Toutes les règles métier sont dans les services
- [ ] Aucune logique métier dans les routes API
- [ ] Aucune logique métier dans les Core Components
- [ ] Aucune logique métier dans les modales
- [ ] Tests in-memory passent (normal vs app-shell)
- [ ] Routes API testées (validation, erreurs, success)



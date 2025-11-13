# Migration Plan: French → English Naming Convention

## 📊 Executive Summary

- **Total violations**: 535 French identifiers in 78 files
- **Estimated time**: 6-8 hours
- **Risk level**: HIGH (breaking changes in DB + API + UI)
- **Recommended approach**: Phased migration with testing between each phase

---

## 🎯 Migration Phases

### Phase 1: Infrastructure (1h) ✅ **COMPLETED**
- [x] Created naming glossary (`docs/naming-glossary.md`)
- [x] Configured strict ESLint rules
- [x] Created French identifier detection script
- [x] Set up i18n structure

### Phase 2: Database Schema (2-3h) 🔴 **CRITICAL**
**Priority**: HIGHEST - All other phases depend on this

#### 2.1 Prisma Schema Refactoring
**Files to modify**: `prisma/schema.prisma`

**Actions**:
1. Rename models (if needed)
2. Rename all columns to English snake_case
3. Rename all enums and enum values
4. Update relations

**Example**:
```prisma
// BEFORE
model Lease {
  loyerMensuel  Decimal @map("loyer_mensuel")
  statut        String  // 'BROUILLON', 'SIGNE', 'ACTIF', 'RESILIE'
}

// AFTER  
model Lease {
  monthlyRent  Decimal @map("monthly_rent")
  status       LeaseStatus // DRAFT, SIGNED, ACTIVE, TERMINATED
}

enum LeaseStatus {
  DRAFT
  SIGNED
  ACTIVE
  TERMINATED
}
```

#### 2.2 Generate Migrations
```bash
npx prisma migrate dev --name rename_to_english
```

#### 2.3 Data Migration Script
If renaming columns, create SQL migration with RENAME COLUMN

### Phase 3: Repositories & Domain Services (1-2h)
**Files**: All files in `src/domain/`, `src/infra/repositories/`

**Actions**:
- Update all property/field accesses to use new English names
- Update all Prisma queries
- Update all validation logic

### Phase 4: API Routes & Validation (1h)
**Files**: All files in `src/app/api/`

**Actions**:
- Update Zod schemas with English field names
- Update route handlers
- Update query parameters to English
- Update response JSON keys

### Phase 5: UI Components & i18n (2h)
**Files**: All files in `src/ui/`, `src/components/`

**Actions**:
- Extract all French labels to `locales/fr/*.json`
- Rename all component props/state to English
- Update all hooks and utilities
- Replace hard-coded French strings with `t()` calls

### Phase 6: PDF Templates (30min)
**Files**: All files in `src/pdf/`

**Actions**:
- Keep French text (it's for documents)
- Rename variables/functions to English
- Extract reusable strings to constants

### Phase 7: Testing & Validation (1h)
- Run full test suite
- Manual testing of all features
- Verify database migrations
- Check API responses
- Test UI in all pages

---

## 🔥 Critical Files (Start Here)

### 1. Prisma Schema
`prisma/schema.prisma` - **Most critical**

### 2. Core Repositories
- `src/infra/repositories/propertyRepository.ts`
- `src/infra/repositories/leaseRepository.ts`
- `src/infra/repositories/tenantRepository.ts`
- `src/infra/repositories/paymentRepository.ts`

### 3. Main API Routes
- `src/app/api/properties/`
- `src/app/api/leases/`
- `src/app/api/tenants/`
- `src/app/api/payments/`

---

## 📝 Detailed Migration Checklist

### Database & Prisma

- [ ] Rename `Property` model fields
  - [ ] `valeur_actuelle` → `current_value`
  - [ ] `frais_notaire` → `notary_fees`
  - [ ] `prix_acquisition` → `purchase_price`
  - [ ] `mode_gestion_statut` → `status_mode`
  
- [ ] Rename `Lease` model fields
  - [ ] `loyer_mensuel` → `monthly_rent`
  - [ ] `locataire_id` → `tenant_id`
  - [ ] `bien_id` → `property_id`
  
- [ ] Rename `Payment` model fields
  - [ ] `categorie_id` → `category_id`
  
- [ ] Create enum types
  - [ ] `LeaseStatus` (DRAFT, SIGNED, ACTIVE, TERMINATED)
  - [ ] `PropertyStatus` (RENTED, VACANT, UNDER_WORKS, OWNER_OCCUPIED)
  - [ ] `PropertyOccupation` (RENTAL, VACANT, PRIMARY_RESIDENCE, SECONDARY_RESIDENCE, PROFESSIONAL_USE, OTHER)

### Repositories

- [ ] Update all Prisma queries in repositories
- [ ] Update all field mappings
- [ ] Update all type definitions

### API Routes

- [ ] `/api/properties` - Update validation schemas
- [ ] `/api/leases` - Update validation schemas
- [ ] `/api/tenants` - Update validation schemas
- [ ] `/api/payments` - Update validation schemas
- [ ] `/api/loans` - Update validation schemas

### UI Components

- [ ] Extract labels to i18n files
- [ ] Rename props and state variables
- [ ] Update TypeScript interfaces

---

## 🚨 Breaking Changes

### API Responses (JSON keys will change)

**BEFORE**:
```json
{
  "bien": "Mon appartement",
  "loyer": 1200,
  "locataire": "Jean Dupont"
}
```

**AFTER**:
```json
{
  "property": "Mon appartement",
  "rent": 1200,
  "tenant": "Jean Dupont"
}
```

### Database Columns

All French column names will be renamed to English.

### Enum Values

**BEFORE**: `status: 'ACTIF'`  
**AFTER**: `status: 'ACTIVE'`

---

## 🛠️ Migration Scripts

### Script 1: Database Column Renaming
```sql
-- Example migration
ALTER TABLE properties RENAME COLUMN valeur_actuelle TO current_value;
ALTER TABLE properties RENAME COLUMN frais_notaire TO notary_fees;
-- ... etc
```

### Script 2: Enum Value Migration
```sql
-- Update enum values
UPDATE leases SET status = 'DRAFT' WHERE status = 'BROUILLON';
UPDATE leases SET status = 'SIGNED' WHERE status = 'SIGNE';
UPDATE leases SET status = 'ACTIVE' WHERE status = 'ACTIF';
UPDATE leases SET status = 'TERMINATED' WHERE status = 'RESILIE';
```

---

## 📋 Testing Checklist

After each phase:

- [ ] ESLint passes with no errors
- [ ] TypeScript compiles without errors
- [ ] All API endpoints respond correctly
- [ ] Database queries work
- [ ] UI displays correctly
- [ ] No console errors
- [ ] Run `npm run check-naming` (script to add)

---

## 🔄 Rollback Plan

1. Keep backup of database before migrations
2. Keep git branch for each phase
3. Tag each completed phase
4. Document any manual data changes

---

## 💡 Quick Wins (Do These First)

1. ✅ Set up linting rules (DONE)
2. ✅ Create glossary (DONE)
3. Rename most common utilities
4. Extract UI strings to i18n
5. Update API validation schemas

---

## 📚 Resources

- **Glossary**: `docs/naming-glossary.md`
- **ESLint Config**: `.eslintrc.cjs`
- **Checker Script**: `scripts/check-french-identifiers.ts`
- **i18n Files**: `locales/fr/`

---

## ⚠️ Important Notes

1. **DO NOT** rename French text in PDFs (it's for documents)
2. **DO** rename all code identifiers (variables, functions, types)
3. **ALWAYS** test after each phase
4. **COMMIT** frequently
5. **DOCUMENT** any deviations from this plan

---

## 🎯 Success Criteria

- ✅ Zero French identifiers detected by linter
- ✅ All tests pass
- ✅ All API endpoints work
- ✅ UI displays in French (via i18n)
- ✅ Database uses English column names
- ✅ TypeScript compiles without errors
- ✅ ESLint shows no warnings

---

**STATUS**: Ready to execute Phase 2 (Database Schema)

**NEXT STEP**: Backup database, then start Prisma schema refactoring



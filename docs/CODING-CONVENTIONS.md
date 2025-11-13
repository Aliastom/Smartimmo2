# 📐 Conventions de Code - SmartImmo

## 🌍 Langues

### Code & Identifiants
- **✅ ANGLAIS UNIQUEMENT**
- Variables, fonctions, types, interfaces, enums, classes
- Noms de fichiers, dossiers
- Commentaires de code (pour la logique métier)
- Noms de colonnes DB, tables, indexes

### Interface Utilisateur
- **✅ FRANÇAIS** (via i18n)
- Labels, boutons, messages
- Textes d'aide, tooltips
- Messages d'erreur utilisateur
- Emails, notifications

### Documentation
- **✅ FRANÇAIS** (docs utilisateur)
- **✅ ANGLAIS** (docs technique, README, ADR)

---

## 🔤 Naming Conventions

### JavaScript / TypeScript

#### Variables & Fonctions : `camelCase`

```typescript
// ✅ BON
const propertyCount = 10;
const currentUser = getCurrentUser();
function calculateMonthlyRent() { }

// ❌ MAUVAIS
const PropertyCount = 10;        // PascalCase
const current_user = getUser();  // snake_case
const NombreDeBiens = 10;        // Français
```

#### Types, Interfaces, Classes : `PascalCase`

```typescript
// ✅ BON
interface Property { }
type LeaseStatus = 'ACTIVE' | 'TERMINATED';
class PropertyService { }

// ❌ MAUVAIS
interface property { }           // camelCase
type lease_status = string;      // snake_case
class propertyService { }        // camelCase
```

#### Enums : `PascalCase` (nom) + `UPPER_SNAKE_CASE` (valeurs)

```typescript
// ✅ BON
enum PropertyStatus {
  RENTED = 'RENTED',
  VACANT = 'VACANT',
  WORKS = 'WORKS',
}

// ❌ MAUVAIS
enum propertyStatus { }          // camelCase
enum PropertyStatus {
  Rented = 'RENTED',             // PascalCase (devrait être UPPER)
}
```

#### Constantes : `UPPER_SNAKE_CASE`

```typescript
// ✅ BON
const MAX_PROPERTIES = 100;
const API_BASE_URL = 'https://api.example.com';
const DEFAULT_CURRENCY = 'EUR';

// ❌ MAUVAIS
const maxProperties = 100;       // camelCase
const ApiBaseUrl = '...';        // PascalCase
```

#### Constantes d'Objets/Arrays : `UPPER_SNAKE_CASE` ou `camelCase`

```typescript
// ✅ BON (si vraiment constant)
const PROPERTY_TYPES = ['APARTMENT', 'HOUSE', 'GARAGE'] as const;

// ✅ BON (si peut changer)
const propertyTypes = ['APARTMENT', 'HOUSE', 'GARAGE'];

// ❌ MAUVAIS
const Property_Types = [...];    // Mixed case
```

#### Fichiers & Dossiers

```
// ✅ BON
src/
  domain/
    entities/
      Property.ts              // PascalCase pour classes/types
      Lease.ts
    services/
      propertyService.ts       // camelCase pour services
      leaseActivationService.ts
  ui/
    components/
      PropertyCard.tsx         // PascalCase pour composants React
      LeaseForm.tsx
    hooks/
      useProperties.ts         // camelCase pour hooks
      useLeases.ts

// ❌ MAUVAIS
src/
  Domain/                      // PascalCase pour dossiers
  property-service.ts          // kebab-case
  PropertyService.ts           // PascalCase pour services
  use_properties.ts            // snake_case
```

---

## 🗄️ Database (Prisma)

### Models : `PascalCase`

```prisma
// ✅ BON
model Property {
  id String @id @default(uuid())
}

model Lease {
  id String @id @default(uuid())
}

// ❌ MAUVAIS
model property { }               // camelCase
model lease { }
```

### Colonnes : `snake_case` (ANGLAIS)

```prisma
// ✅ BON
model Property {
  id              String   @id @default(uuid())
  current_value   Decimal?
  purchase_price  Decimal?
  notary_fees     Decimal?
  status          PropertyStatus?
  created_at      DateTime @default(now())
}

// ❌ MAUVAIS
model Property {
  currentValue    Decimal?         // camelCase
  valeur_actuelle Decimal?         // Français
  PurchasePrice   Decimal?         // PascalCase
}
```

### Enums : `PascalCase` (nom) + `UPPER_SNAKE_CASE` (valeurs)

```prisma
// ✅ BON
enum PropertyStatus {
  RENTED
  VACANT
  WORKS
  OWNER_OCCUPIED
}

enum OccupationType {
  PRIMARY_RESIDENCE
  SECONDARY_RESIDENCE
  RENTAL
  VACANT
  PROFESSIONAL_USE
  OTHER
}

// ❌ MAUVAIS
enum propertyStatus { }          // camelCase
enum PropertyStatus {
  Rented                         // PascalCase
  loue                           // Français
}
```

### Relations

```prisma
// ✅ BON
model Property {
  id     String  @id
  leases Lease[] // Pluriel pour relations 1-N
  loans  Loan[]
}

model Lease {
  id         String   @id
  property   Property @relation(fields: [property_id], references: [id])
  property_id String
}

// ❌ MAUVAIS
model Property {
  lease Lease[]                  // Singulier pour relation 1-N
  baux  Lease[]                  // Français
}
```

---

## 🌐 API Routes

### Endpoints : `kebab-case` (ANGLAIS)

```
// ✅ BON
GET    /api/properties
POST   /api/properties
GET    /api/properties/:id
PUT    /api/properties/:id
DELETE /api/properties/:id
GET    /api/properties/:id/metrics
GET    /api/portfolio/summary

// ❌ MAUVAIS
GET /api/Biens                   // PascalCase + Français
GET /api/property_list           // snake_case
GET /api/getProperties           // verbe dans l'URL
```

### Query Parameters : `camelCase`

```typescript
// ✅ BON
GET /api/properties?status=RENTED&minValue=100000

// ❌ MAUVAIS
GET /api/properties?Status=RENTED  // PascalCase
GET /api/properties?min_value=100  // snake_case
GET /api/properties?statut=LOUE    // Français
```

### JSON Keys : `camelCase`

```json
// ✅ BON
{
  "properties": [
    {
      "id": "123",
      "currentValue": 250000,
      "purchasePrice": 200000,
      "status": "RENTED"
    }
  ]
}

// ❌ MAUVAIS
{
  "Properties": [...],           // PascalCase
  "current_value": 250000,       // snake_case
  "valeur_actuelle": 250000      // Français
}
```

---

## 🎨 React / Next.js

### Composants : `PascalCase`

```typescript
// ✅ BON
export function PropertyCard() { }
export function LeaseForm() { }
export default function PropertiesPage() { }

// ❌ MAUVAIS
export function propertyCard() { }    // camelCase
export function Property_Card() { }   // snake_case
export function BienCard() { }        // Français
```

### Props : `camelCase`

```typescript
// ✅ BON
interface PropertyCardProps {
  property: Property;
  onEdit: (id: string) => void;
  showActions?: boolean;
}

// ❌ MAUVAIS
interface PropertyCardProps {
  Property: Property;              // PascalCase
  on_edit: () => void;             // snake_case
  bien: Property;                  // Français
}
```

### Hooks : `camelCase` (préfixe `use`)

```typescript
// ✅ BON
export function useProperties() { }
export function usePropertyStats() { }
export function useInvalidateQueries() { }

// ❌ MAUVAIS
export function UseProperties() { }    // PascalCase
export function use_properties() { }   // snake_case
export function useBiens() { }         // Français
```

### Event Handlers : `handle` + `PascalCase`

```typescript
// ✅ BON
function handleSubmit() { }
function handlePropertyDelete(id: string) { }
function handleFormChange(e: ChangeEvent) { }

// ❌ MAUVAIS
function onSubmit() { }            // Préfixe 'on' réservé aux props
function submit() { }              // Pas de préfixe
function handleSuppression() { }   // Français
```

---

## 🔒 Règles ESLint

### Configuration Actuelle

```javascript
// .eslintrc.cjs
rules: {
  '@typescript-eslint/naming-convention': [
    'error',
    { selector: 'variable', format: ['camelCase', 'UPPER_CASE'] },
    { selector: 'function', format: ['camelCase'] },
    { selector: 'parameter', format: ['camelCase'] },
    { selector: 'typeLike', format: ['PascalCase'] },
    { selector: 'enum', format: ['PascalCase'] },
    { selector: 'enumMember', format: ['UPPER_CASE'] },
  ],
}
```

### Commandes

```bash
# Linter
npm run lint

# Linter avec fix automatique
npm run lint -- --fix

# Vérifier les identifiants français
npm run lint:guard

# Scanner les identifiants français
npm run scan:fr
```

---

## 🌍 Internationalisation (i18n)

### Structure des Fichiers

```
locales/
  fr/
    common.json
    properties.json
    leases.json
    tenants.json
    transactions.json
  en/
    common.json
    properties.json
    ...
```

### Fichiers i18n : `camelCase` (clés)

```json
// ✅ BON - locales/fr/properties.json
{
  "title": "Mes Biens",
  "addProperty": "Ajouter un bien",
  "status": {
    "rented": "Loué",
    "vacant": "Vacant",
    "works": "Travaux"
  },
  "form": {
    "currentValue": "Valeur actuelle",
    "purchasePrice": "Prix d'acquisition"
  }
}

// ❌ MAUVAIS
{
  "Title": "...",                // PascalCase
  "add_property": "...",         // snake_case
  "AjouterBien": "..."           // Français dans la clé
}
```

### Utilisation dans React

```typescript
// ✅ BON
import { useTranslation } from 'next-i18next';

export function PropertyList() {
  const { t } = useTranslation('properties');
  
  return (
    <>
      <h1>{t('title')}</h1>
      <Button>{t('addProperty')}</Button>
      <Badge>{t(`status.${property.status.toLowerCase()}`)}</Badge>
    </>
  );
}

// ❌ MAUVAIS
<h1>Mes Biens</h1>               // Texte en dur
<Button>Ajouter un bien</Button>
```

---

## 🧪 Tests

### Fichiers de Test : `*.test.ts` ou `*.spec.ts`

```
// ✅ BON
src/
  domain/
    services/
      propertyService.ts
      propertyService.test.ts
  ui/
    components/
      PropertyCard.tsx
      PropertyCard.test.tsx

// ❌ MAUVAIS
propertyService.tests.ts         // Pluriel
PropertyService.Test.ts          // PascalCase
```

### Noms de Tests : Descriptions en anglais

```typescript
// ✅ BON
describe('PropertyService', () => {
  it('should calculate monthly rent correctly', () => {
    // ...
  });
  
  it('should throw error when property not found', () => {
    // ...
  });
});

// ❌ MAUVAIS
describe('PropertyService', () => {
  it('devrait calculer le loyer mensuel', () => {  // Français
    // ...
  });
});
```

---

## 📦 Imports

### Ordre des Imports

```typescript
// 1. Librairies externes
import React from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. Imports internes (alias @/)
import { Property } from '@/domain/entities/Property';
import { propertyService } from '@/domain/services/propertyService';

// 3. Imports relatifs
import { PropertyCard } from './PropertyCard';
import { useProperties } from '../hooks/useProperties';

// 4. Styles
import styles from './PropertyList.module.css';
```

---

## 🚫 Anti-Patterns

### ❌ Mélanger Français et Anglais

```typescript
// ❌ MAUVAIS
interface Property {
  id: string;
  valeur: number;        // Français
  status: string;        // Anglais
}
```

### ❌ Abréviations Obscures

```typescript
// ❌ MAUVAIS
const propCnt = 10;
const usrLst = [];

// ✅ BON
const propertyCount = 10;
const userList = [];
```

### ❌ Noms Trop Génériques

```typescript
// ❌ MAUVAIS
function getData() { }
const data = [];
const temp = 123;

// ✅ BON
function getProperties() { }
const properties = [];
const monthlyRent = 123;
```

---

## ✅ Checklist Avant Commit

- [ ] Tous les identifiants sont en anglais
- [ ] Les textes UI sont dans les fichiers i18n
- [ ] Les conventions de nommage sont respectées
- [ ] `npm run typecheck` ✅
- [ ] `npm run lint` ✅
- [ ] `npm run lint:guard` ✅
- [ ] `npm test` ✅

---

## 📚 Ressources

- [Glossaire FR→EN](../tools/naming-glossary.json)
- [Guide de Migration](./MIGRATION-FR-EN-GUIDE.md)
- [Quick Start Migration](./QUICK-START-MIGRATION.md)

---

**Ces conventions sont en vigueur depuis le 10/10/2025. Tout nouveau code doit les respecter.**


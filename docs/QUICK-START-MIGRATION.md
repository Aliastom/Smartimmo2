# 🚀 Démarrage Rapide - Migration FR→EN

## En 5 minutes

### 1️⃣ État des lieux

```bash
npm run scan:fr
```

**Résultat actuel** : 603 identifiants français dans 64 fichiers

---

### 2️⃣ Première migration (exemple : Domain Entities)

#### Option A : Manuel (RECOMMANDÉ)

1. Ouvrir `src/domain/entities/Lease.ts`
2. Renommer `signedPdfUrl` → `signedPdfUrl` (déjà OK, exemple)
3. Commit : `git commit -m "refactor(domain): rename Lease entity to English"`

#### Option B : Codemod (EXPÉRIMENTAL)

```bash
# Voir ce qui serait changé
npm run codemod:dry

# Appliquer (ATTENTION : vérifiez après !)
git add .
git commit -m "checkpoint before codemod"
npm run codemod:write

# Vérifier
npm run typecheck
npm test
```

---

### 3️⃣ Vérification

```bash
# Identifiants français restants
npm run scan:fr

# TypeScript OK ?
npm run typecheck

# Tests OK ?
npm test

# Garde-fou CI
npm run lint:guard
```

---

### 4️⃣ Ordre recommandé

1. **Database** (`prisma/schema.prisma`) ← **COMMENCEZ ICI**
2. **Domain** (`src/domain/`)
3. **Infra** (`src/infra/`)
4. **API** (`src/app/api/`)
5. **UI** (`src/ui/`, `src/app/`)
6. **i18n** (externaliser les textes)

---

## 🎯 Exemple Complet : Migrer "Property"

### Étape 1 : Prisma

```prisma
// prisma/schema.prisma
model Property {
  id            String   @id @default(uuid())
  status        String?  @map("statut")          // ← @map pour rétrocompatibilité
  current_value Decimal? @map("valeur_actuelle") // ← @map
  // ...
}
```

```bash
npx prisma migrate dev --name rename_property_columns
npx prisma generate
```

### Étape 2 : Types TypeScript

```typescript
// src/domain/entities/Property.ts
export interface Property {
  id: string;
  status?: PropertyStatus;
  currentValue?: number;
  // ...
}

export enum PropertyStatus {
  RENTED = 'RENTED',
  VACANT = 'VACANT',
  WORKS = 'WORKS',
}
```

### Étape 3 : Repository

```typescript
// src/infra/repositories/propertyRepository.ts
export const propertyRepository = {
  async findById(id: string): Promise<Property | null> {
    const property = await prisma.property.findUnique({
      where: { id },
    });
    return property;
  },
  // ...
};
```

### Étape 4 : API

```typescript
// src/app/api/properties/route.ts
export async function GET(req: Request) {
  const properties = await propertyRepository.findAll();
  return Response.json({ properties });
}
```

### Étape 5 : UI

```typescript
// src/ui/components/PropertyList.tsx
import { useProperties } from '@/ui/hooks/useProperties';

export function PropertyList() {
  const { properties, loading } = useProperties();
  
  return (
    <div>
      {properties.map(property => (
        <PropertyCard key={property.id} property={property} />
      ))}
    </div>
  );
}
```

### Étape 6 : i18n

```json
// locales/fr/properties.json
{
  "title": "Mes Biens",
  "status": {
    "rented": "Loué",
    "vacant": "Vacant",
    "works": "Travaux"
  }
}
```

```typescript
// Dans le composant
const { t } = useTranslation('properties');
<Badge>{t(`status.${property.status.toLowerCase()}`)}</Badge>
```

### Étape 7 : Vérification

```bash
npm run scan:fr     # Devrait montrer moins d'identifiants
npm run typecheck   # Pas d'erreurs
npm test            # Tous verts
npm run dev         # Tester manuellement
```

---

## 🔥 Commandes Essentielles

```bash
# Voir l'état actuel
npm run scan:fr

# Dry-run du codemod
npm run codemod:dry

# Appliquer le codemod (ATTENTION)
npm run codemod:write

# Garde-fou (doit passer en CI)
npm run lint:guard

# Vérifications
npm run typecheck
npm test
npm run lint
```

---

## 📋 Checklist Rapide

Avant chaque commit :

- [ ] `npm run typecheck` ✅
- [ ] `npm test` ✅
- [ ] `npm run lint:guard` ✅
- [ ] Test manuel dans le navigateur ✅

---

## 🆘 Problèmes Courants

### "Property 'bien' does not exist on type 'Property'"

→ Vous avez oublié de renommer une propriété dans le type TypeScript.

**Solution** : Cherchez `bien` dans le fichier et remplacez par `property`.

### "Column 'statut' not found"

→ Vous avez renommé dans Prisma mais pas fait la migration.

**Solution** :

```bash
npx prisma migrate dev --name fix_column_names
```

### "French identifiers detected"

→ Le garde-fou a trouvé des identifiants français.

**Solution** :

```bash
npm run scan:fr  # Voir lesquels
# Renommez-les manuellement
```

---

## 🎓 Ressources

- [Guide Complet](./MIGRATION-FR-EN-GUIDE.md)
- [Glossaire FR→EN](../tools/naming-glossary.json)
- [Conventions de Code](./CODING-CONVENTIONS.md) (à créer)

---

**Prêt ? Lancez `npm run scan:fr` et commencez par le Prisma schema ! 🚀**


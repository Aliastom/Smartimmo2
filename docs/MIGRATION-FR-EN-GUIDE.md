# 🌍 Guide de Migration FR → EN

## Vue d'ensemble

Ce guide explique comment migrer **progressivement et en toute sécurité** votre codebase SmartImmo du français vers l'anglais.

## 📋 État actuel

- **603 identifiants français** détectés dans **64 fichiers**
- Domaines concernés : code TypeScript, schéma Prisma, API routes, composants React

## 🎯 Objectif

- **Code/DB/API** : 100% anglais
- **UI** : textes français externalisés via i18n
- **Conventions** : camelCase (variables), PascalCase (types), UPPER_SNAKE_CASE (constantes)

---

## 🚀 Plan d'Action (Phase par Phase)

### ✅ Phase 0 : Préparation (FAIT)

- [x] Installation des outils (ts-morph, glob, etc.)
- [x] Scanner d'identifiants français
- [x] Glossaire de traduction FR→EN
- [x] Scripts npm prêts

### 📦 Phase 1 : Database & Prisma (PRIORITÉ)

> ⚠️ **CRITIQUE** : Commencez ici car la DB est la source de vérité.

#### 1.1 Renommer les colonnes Prisma

**Fichier** : `prisma/schema.prisma`

**Méthode** :
1. Identifier toutes les colonnes françaises dans le schéma
2. Les renommer en `snake_case` anglais
3. Utiliser `@map("ancien_nom")` pour la rétrocompatibilité pendant la transition

**Exemple** :

```prisma
// AVANT
model Property {
  id              String   @id @default(uuid())
  statut          String?  // ❌ français
  valeur_actuelle Decimal? // ❌ français
}

// APRÈS
model Property {
  id            String   @id @default(uuid())
  status        String?  @map("statut")
  current_value Decimal? @map("valeur_actuelle")
}
```

#### 1.2 Migrations Prisma

```bash
# Générer la migration
npx prisma migrate dev --name rename_columns_to_english

# Vérifier le SQL généré dans prisma/migrations/
# Appliquer en production plus tard
npx prisma migrate deploy
```

#### 1.3 Renommer les Enums Prisma

```prisma
// AVANT
enum StatutBien {
  LOUE
  VACANT
  TRAVAUX
}

// APRÈS
enum PropertyStatus {
  RENTED
  VACANT
  WORKS
}
```

> 💡 **Astuce** : Faites les enums en dernier car ils nécessitent souvent des migrations de données.

### 🔧 Phase 2 : Backend (API & Services)

#### 2.1 Renommer les fichiers et routes

```bash
# AVANT
src/app/biens/page.tsx
src/app/locataires/page.tsx
src/app/patrimoine/page.tsx

# APRÈS
src/app/properties/page.tsx
src/app/tenants/page.tsx
src/app/portfolio/page.tsx
```

#### 2.2 API Endpoints

**Méthode** : Renommer progressivement, en gardant les anciens endpoints en alias temporaires.

```typescript
// src/app/api/properties/route.ts
export async function GET(req: Request) {
  // Nouveau code avec noms anglais
  const { status, occupation } = await req.json();
  // ...
}
```

#### 2.3 Services & Use Cases

**Ordre recommandé** :
1. `src/domain/entities/` (modèles de domaine)
2. `src/domain/services/` (logique métier)
3. `src/domain/use-cases/` (cas d'usage)
4. `src/infra/repositories/` (accès données)

**Approche** : Fichier par fichier, avec tests après chaque renommage.

### 🎨 Phase 3 : Frontend (Composants & Hooks)

#### 3.1 Composants React

**Ordre** :
1. Composants "feuilles" (sans dépendances)
2. Composants "containers"
3. Pages

**Exemple** :

```typescript
// AVANT
interface BienFormProps {
  bien?: Bien;
  onSave: (bien: Bien) => void;
}

// APRÈS
interface PropertyFormProps {
  property?: Property;
  onSave: (property: Property) => void;
}
```

#### 3.2 Hooks personnalisés

```typescript
// AVANT
export const useBiens = () => { ... }

// APRÈS
export const useProperties = () => { ... }
```

#### 3.3 Externaliser les textes UI en i18n

**Créer** : `locales/fr/common.json`, `locales/fr/properties.json`, etc.

```json
{
  "properties": {
    "title": "Mes Biens",
    "add": "Ajouter un bien",
    "status": {
      "rented": "Loué",
      "vacant": "Vacant",
      "works": "Travaux"
    }
  }
}
```

**Dans les composants** :

```typescript
import { useTranslation } from 'next-i18next';

export function PropertyList() {
  const { t } = useTranslation('properties');
  
  return (
    <h1>{t('title')}</h1>
    <Button>{t('add')}</Button>
  );
}
```

### ✅ Phase 4 : Validation & Tests

#### 4.1 Lancer les outils de vérification

```bash
# Scanner les identifiants français restants
npm run scan:fr

# Garde-fou CI (doit passer à 0)
npm run lint:guard

# TypeScript
npm run typecheck

# Tests unitaires
npm test

# ESLint
npm run lint
```

#### 4.2 Tests E2E

Vérifier que :
- ✅ Les KPI cards affichent les bonnes valeurs
- ✅ Les formulaires soumettent correctement
- ✅ Les API retournent les bonnes données
- ✅ Pas d'erreur 404/500

### 🔐 Phase 5 : CI/CD & Documentation

#### 5.1 Activer le garde-fou en CI

**`.github/workflows/ci.yml`** (ou équivalent) :

```yaml
- name: Check French identifiers
  run: npm run lint:guard

- name: Lint with max warnings 0
  run: npm run lint -- --max-warnings=0
```

#### 5.2 Documenter les conventions

**Créer** : `docs/CODING-CONVENTIONS.md`

```markdown
# Conventions de Code

## Langages
- **Code** : Anglais uniquement
- **UI** : Français (via i18n)
- **Commentaires** : Anglais pour le code métier

## Naming
- Variables/fonctions : `camelCase`
- Types/interfaces : `PascalCase`
- Constantes : `UPPER_SNAKE_CASE`
- Colonnes DB : `snake_case` (anglais)
```

---

## 🛠️ Outils Disponibles

### 1. Scanner

```bash
npm run scan:fr
```

**Utilité** : Voir combien d'identifiants français restent et où.

### 2. Codemod (Automatique - EXPÉRIMENTAL)

```bash
# Dry-run (aperçu)
npm run codemod:dry

# Application réelle (FAITES UN COMMIT AVANT !)
npm run codemod:write
```

⚠️ **Attention** : Le codemod automatique peut faire des erreurs (ex: `categories` → `categorys`). Utilisez-le comme **assistant**, pas comme solution complète.

**Recommandation** : Utilisez le codemod sur des **sous-dossiers isolés** et vérifiez chaque fichier modifié.

### 3. Garde-fou CI

```bash
npm run lint:guard
```

**Utilité** : Empêche les nouveaux identifiants français d'être committé.

---

## 📊 Suivi de Progression

### Commandes rapides

```bash
# Voir l'état actuel
npm run scan:fr

# Après une session de refactoring
git add .
git commit -m "refactor: rename properties domain to English"
npm run scan:fr
```

### Checklist

- [ ] Phase 1 : Database & Prisma
  - [ ] Colonnes renommées avec @map
  - [ ] Enums renommés
  - [ ] Migrations générées et testées
- [ ] Phase 2 : Backend
  - [ ] Entities renommées
  - [ ] Services renommés
  - [ ] Use cases renommés
  - [ ] Repositories renommés
  - [ ] API routes renommées
- [ ] Phase 3 : Frontend
  - [ ] Composants renommés
  - [ ] Hooks renommés
  - [ ] Pages renommées
  - [ ] Textes UI externalisés (i18n)
- [ ] Phase 4 : Validation
  - [ ] `npm run scan:fr` = 0 identifiants
  - [ ] `npm run lint:guard` = ✅
  - [ ] `npm run typecheck` = ✅
  - [ ] `npm test` = ✅
  - [ ] Tests E2E = ✅
- [ ] Phase 5 : CI & Docs
  - [ ] CI configuré
  - [ ] Documentation mise à jour
  - [ ] Guide i18n créé

---

## 🚨 Points d'Attention

### ❌ À ÉVITER

1. **Tout renommer d'un coup** → Risque de casse massive
2. **Oublier les @map dans Prisma** → Perte de données
3. **Ne pas tester après chaque phase** → Bugs cumulés
4. **Ignorer TypeScript errors** → Incohérences cachées

### ✅ BONNES PRATIQUES

1. **Commit fréquents** : Un commit par fichier/module
2. **Tests après chaque phase** : `npm run typecheck` + `npm test`
3. **Revue de code** : Ne mergez pas sans relecture
4. **Rollback plan** : Gardez `@map()` pendant 2-3 sprints

---

## 📞 Support

Si vous rencontrez un problème :

1. Vérifiez les erreurs TypeScript : `npm run typecheck`
2. Consultez le glossaire : `tools/naming-glossary.json`
3. Lancez le scanner : `npm run scan:fr`
4. Consultez les migrations Prisma générées

---

## 🎓 Ressources

- [Glossaire FR→EN](../tools/naming-glossary.json)
- [Scanner d'identifiants](../tools/scan-french-identifiers.ts)
- [Codemod](../tools/codemod-identifiers.ts)
- [Garde-fou CI](../tools/guard-french-identifiers.js)

---

**Bon courage pour la migration ! 🚀**


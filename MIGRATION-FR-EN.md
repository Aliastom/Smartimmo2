# 🌍 Migration FR→EN - SmartImmo

## 🎯 Objectif

Migrer l'intégralité du codebase SmartImmo du **français vers l'anglais** :
- ✅ Code, DB, API : **100% anglais**
- ✅ Interface utilisateur : **français** (via i18n)
- ✅ Conventions : `camelCase`, `PascalCase`, `UPPER_SNAKE_CASE`

---

## 📊 État Actuel

```bash
npm run scan:fr
```

**Résultat** :
- **603 identifiants français** dans **64 fichiers**
- Domaines : Domain, UI, API, Hooks, Pages, PDF

---

## 🚀 Démarrage Rapide

### 1️⃣ Lire la Documentation

| Document | Description | Temps |
|----------|-------------|-------|
| [📋 Récapitulatif](./docs/MIGRATION-FR-EN-SUMMARY.md) | Vue d'ensemble complète | 10 min |
| [⚡ Quick Start](./docs/QUICK-START-MIGRATION.md) | Démarrage rapide avec exemple | 5 min |
| [📖 Guide Complet](./docs/MIGRATION-FR-EN-GUIDE.md) | Phase par phase détaillé | 20 min |
| [📐 Conventions](./docs/CODING-CONVENTIONS.md) | Règles de nommage | 15 min |
| [🛠️ Outils](./tools/README.md) | Documentation des scripts | 10 min |

### 2️⃣ Installer les Dépendances

```bash
npm install
```

### 3️⃣ Tester les Outils

```bash
# Scanner : voir les identifiants français
npm run scan:fr

# Codemod : aperçu des renommages
npm run codemod:dry

# Garde-fou : vérifier l'absence d'identifiants français
npm run lint:guard
```

### 4️⃣ Commencer la Migration

**Ordre recommandé** :

1. **Database** (`prisma/schema.prisma`) ← **COMMENCEZ ICI**
2. **Domain** (`src/domain/`)
3. **Infrastructure** (`src/infra/`)
4. **API** (`src/app/api/`)
5. **UI** (`src/ui/`, `src/app/`)
6. **i18n** (externaliser les textes)

---

## 🛠️ Outils Disponibles

### 1. Scanner

```bash
npm run scan:fr
```

**Utilité** : Voir combien d'identifiants français restent et où.

**Exemple de sortie** :

```
📊 French-like identifiers found: 603
📁 Files affected: 64

📄 src/domain/services/propertyMetricsService.ts
   statut, fraisSortie, valeurMarche, patrimoineBrut, ...
```

---

### 2. Codemod (Automatique - EXPÉRIMENTAL)

```bash
# Dry-run (aperçu)
npm run codemod:dry

# Application réelle (FAITES UN COMMIT AVANT !)
npm run codemod:write
```

⚠️ **Attention** : Le codemod peut faire des erreurs. Utilisez-le comme **assistant**, pas comme solution complète.

---

### 3. Garde-fou CI

```bash
npm run lint:guard
```

**Utilité** : Empêche les nouveaux identifiants français d'être committé.

---

## 📋 Plan d'Action (Résumé)

| Phase | Durée | Statut |
|-------|-------|--------|
| 1. Database (Prisma) | 2-3h | ⬜ |
| 2. Domain Layer | 3-4h | ⬜ |
| 3. Infrastructure | 2h | ⬜ |
| 4. API Routes | 3-4h | ⬜ |
| 5. UI (Composants & Hooks) | 5-6h | ⬜ |
| 6. i18n (Externalisation) | 2-3h | ⬜ |
| 7. Validation & Tests | 2h | ⬜ |
| 8. CI & Documentation | 1h | ⬜ |
| **TOTAL** | **~20-25h** | **⬜** |

---

## ✅ Critères de Succès

- [ ] `npm run scan:fr` → **0 identifiants**
- [ ] `npm run lint:guard` → **✅ Pass**
- [ ] `npm run typecheck` → **✅ No errors**
- [ ] `npm test` → **✅ All pass**
- [ ] Tests E2E → **✅ All features working**
- [ ] CI/CD → **✅ Garde-fou activé**
- [ ] Documentation → **✅ Mise à jour**

---

## 📚 Documentation Complète

### Guides

- [📋 Récapitulatif Complet](./docs/MIGRATION-FR-EN-SUMMARY.md)
- [⚡ Quick Start avec Exemple](./docs/QUICK-START-MIGRATION.md)
- [📖 Guide Phase par Phase](./docs/MIGRATION-FR-EN-GUIDE.md)
- [📐 Conventions de Code](./docs/CODING-CONVENTIONS.md)

### Outils

- [🛠️ Documentation des Scripts](./tools/README.md)
- [📖 Glossaire FR→EN](./tools/naming-glossary.json)

---

## 🎓 Exemple Rapide

### Avant

```typescript
// src/domain/entities/Bien.ts
interface Bien {
  id: string;
  statut: string;
  valeur_actuelle: number;
  loyer: number;
}

// src/ui/components/BienCard.tsx
export function BienCard({ bien }: { bien: Bien }) {
  return <div>{bien.statut}</div>;
}
```

### Après

```typescript
// src/domain/entities/Property.ts
interface Property {
  id: string;
  status: PropertyStatus;
  currentValue: number;
  rent: number;
}

// src/ui/components/PropertyCard.tsx
export function PropertyCard({ property }: { property: Property }) {
  const { t } = useTranslation('properties');
  return <div>{t(`status.${property.status}`)}</div>;
}

// locales/fr/properties.json
{
  "status": {
    "RENTED": "Loué",
    "VACANT": "Vacant"
  }
}
```

---

## 🚨 Points d'Attention

### ❌ À ÉVITER

1. Tout renommer d'un coup → Risque de casse massive
2. Oublier les `@map()` dans Prisma → Perte de données
3. Ne pas tester après chaque phase → Bugs cumulés
4. Ignorer les erreurs TypeScript → Incohérences cachées

### ✅ BONNES PRATIQUES

1. Commits fréquents (un par fichier/module)
2. Tests après chaque phase (`npm run typecheck` + `npm test`)
3. Revue de code (ne mergez pas sans relecture)
4. Rollback plan (gardez `@map()` pendant 2-3 sprints)

---

## 🔄 Workflow Recommandé

```bash
# 1. État des lieux
npm run scan:fr

# 2. Refactoring (fichier par fichier)
# ... éditer les fichiers ...

# 3. Vérification
npm run typecheck
npm test

# 4. Commit
git add .
git commit -m "refactor(domain): rename Property entity to English"

# 5. Progression
npm run scan:fr  # Voir la différence

# 6. Avant de push
npm run lint:guard
```

---

## 📞 Support

### Commandes Essentielles

```bash
# Diagnostic
npm run scan:fr

# Refactoring
npm run codemod:dry    # Aperçu
npm run codemod:write  # Application

# Validation
npm run lint:guard
npm run typecheck
npm run lint
npm run test

# Développement
npm run dev
```

### Ressources

- [Glossaire FR→EN](./tools/naming-glossary.json) : 111 entrées
- [Scanner](./tools/scan-french-identifiers.ts) : Détection
- [Codemod](./tools/codemod-identifiers.ts) : Renommage auto
- [Garde-fou](./tools/guard-french-identifiers.js) : Protection CI

---

## 🎯 Prochaines Étapes

1. **Lire** : [`docs/QUICK-START-MIGRATION.md`](./docs/QUICK-START-MIGRATION.md) (5 min)
2. **Lancer** : `npm run scan:fr` (voir l'état actuel)
3. **Commencer** : Phase 1 - Database (`prisma/schema.prisma`)
4. **Commit** : Fréquemment
5. **Tester** : Après chaque phase
6. **Documenter** : Vos choix de traduction

---

**Bon courage pour la migration ! 🚀**

_Dernière mise à jour : 10/10/2025_

---

## 📦 Fichiers Créés

```
📁 SmartImmo/
├── 📄 MIGRATION-FR-EN.md (ce fichier)
├── 📁 docs/
│   ├── 📄 MIGRATION-FR-EN-SUMMARY.md
│   ├── 📄 QUICK-START-MIGRATION.md
│   ├── 📄 MIGRATION-FR-EN-GUIDE.md
│   └── 📄 CODING-CONVENTIONS.md
├── 📁 tools/
│   ├── 📄 README.md
│   ├── 📄 naming-glossary.json
│   ├── 📄 scan-french-identifiers.ts
│   ├── 📄 codemod-identifiers.ts
│   └── 📄 guard-french-identifiers.js
└── 📄 package.json (scripts ajoutés)
```


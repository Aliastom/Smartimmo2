# 📋 Récapitulatif - Migration FR→EN

## ✅ Ce qui a été fait

### 1. Infrastructure & Outils

#### Scripts npm installés

```json
{
  "scripts": {
    "scan:fr": "tsx tools/scan-french-identifiers.ts",
    "codemod:dry": "tsx tools/codemod-identifiers.ts --dry",
    "codemod:write": "tsx tools/codemod-identifiers.ts --write",
    "lint:guard": "node tools/guard-french-identifiers.js"
  }
}
```

#### Dépendances ajoutées

- `ts-morph` : AST TypeScript pour codemods
- `glob` : Recherche de fichiers
- `ts-node` / `tsx` : Exécution TypeScript

#### Fichiers créés

1. **`tools/naming-glossary.json`**
   - Dictionnaire FR→EN (111 entrées)
   - Source de vérité pour les traductions
   - Éditable pour ajouter vos termes

2. **`tools/scan-french-identifiers.ts`**
   - Scanner d'identifiants français
   - Rapport détaillé par fichier
   - Commande : `npm run scan:fr`

3. **`tools/codemod-identifiers.ts`**
   - Renommage automatique (expérimental)
   - Basé sur le glossaire
   - Dry-run : `npm run codemod:dry`
   - Apply : `npm run codemod:write`

4. **`tools/guard-french-identifiers.js`**
   - Garde-fou CI
   - Bloque les commits avec identifiants français
   - Commande : `npm run lint:guard`

5. **Documentation**
   - `docs/MIGRATION-FR-EN-GUIDE.md` : Guide complet phase par phase
   - `docs/QUICK-START-MIGRATION.md` : Démarrage rapide
   - `docs/CODING-CONVENTIONS.md` : Conventions de code
   - `docs/MIGRATION-FR-EN-SUMMARY.md` : Ce fichier

---

## 📊 État Actuel

### Scan Initial

```bash
npm run scan:fr
```

**Résultat** :
- **603 identifiants français** détectés
- **64 fichiers** concernés

### Répartition par Domaine

| Domaine | Fichiers | Exemples |
|---------|----------|----------|
| Domain Services | ~10 | `propertyMetricsService.ts`, `leaseActivationService.ts` |
| UI Components | ~20 | `PropertyForm.tsx`, `TransactionFilters.tsx` |
| API Routes | ~15 | `/api/properties/route.ts`, `/api/categories/route.ts` |
| Hooks | ~8 | `useAccountingCategories.ts`, `useDocumentStats.ts` |
| PDF Templates | ~3 | `bail-vide.tsx`, `bail-meuble.tsx` |
| Pages | ~8 | `biens/page.tsx`, `locataires/page.tsx`, `patrimoine/page.tsx` |

---

## 🎯 Plan d'Action Recommandé

### Phase 1 : Database (PRIORITÉ) ⏱️ 2-3h

**Pourquoi commencer ici ?**
- La DB est la source de vérité
- Évite les incohérences code ↔ DB
- Utilise `@map()` pour la rétrocompatibilité

**Actions** :
1. Ouvrir `prisma/schema.prisma`
2. Renommer les colonnes : `statut` → `status @map("statut")`
3. Renommer les enums : `StatutBien` → `PropertyStatus`
4. Générer la migration : `npx prisma migrate dev --name rename_to_english`
5. Tester : `npx prisma studio`

**Fichiers à modifier** :
- `prisma/schema.prisma`

---

### Phase 2 : Domain Layer ⏱️ 3-4h

**Ordre** :
1. Entities (`src/domain/entities/`)
2. Services (`src/domain/services/`)
3. Use Cases (`src/domain/use-cases/`)

**Exemple** : `Property.ts`

```typescript
// AVANT
interface Bien {
  statut: string;
  valeur_actuelle: number;
}

// APRÈS
interface Property {
  status: PropertyStatus;
  currentValue: number;
}
```

**Commandes** :
```bash
# Après chaque fichier
npm run typecheck
npm run scan:fr
git commit -m "refactor(domain): rename Property entity to English"
```

---

### Phase 3 : Infrastructure ⏱️ 2h

**Fichiers** :
- `src/infra/repositories/*.ts`
- `src/infra/db/client.ts`

**Actions** :
- Renommer les méthodes
- Adapter aux nouveaux types du Domain

---

### Phase 4 : API Routes ⏱️ 3-4h

**Fichiers** :
- `src/app/api/properties/route.ts`
- `src/app/api/leases/route.ts`
- `src/app/api/transactions/route.ts`
- etc.

**Actions** :
1. Renommer les routes : `/api/biens` → `/api/properties`
2. Renommer les query params : `?statut=` → `?status=`
3. Renommer les JSON keys : `{ bien: ... }` → `{ property: ... }`

**Astuce** : Gardez les anciens endpoints en alias temporaires si besoin.

---

### Phase 5 : UI (Composants & Hooks) ⏱️ 5-6h

**Ordre** :
1. Hooks (`src/ui/hooks/`)
2. Composants "feuilles" (`src/ui/components/`)
3. Composants "containers"
4. Pages (`src/app/*/page.tsx`)

**Actions** :
- Renommer les fichiers : `BienCard.tsx` → `PropertyCard.tsx`
- Renommer les props : `bien` → `property`
- Renommer les hooks : `useBiens()` → `useProperties()`

---

### Phase 6 : i18n (Externalisation) ⏱️ 2-3h

**Créer** :
```
locales/
  fr/
    common.json
    properties.json
    leases.json
    tenants.json
    transactions.json
```

**Exemple** : `locales/fr/properties.json`

```json
{
  "title": "Mes Biens",
  "addProperty": "Ajouter un bien",
  "status": {
    "rented": "Loué",
    "vacant": "Vacant",
    "works": "Travaux"
  }
}
```

**Dans les composants** :

```typescript
import { useTranslation } from 'next-i18next';

export function PropertyList() {
  const { t } = useTranslation('properties');
  return <h1>{t('title')}</h1>;
}
```

---

### Phase 7 : Validation & Tests ⏱️ 2h

**Checklist** :
- [ ] `npm run scan:fr` → 0 identifiants
- [ ] `npm run lint:guard` → ✅
- [ ] `npm run typecheck` → ✅
- [ ] `npm run lint` → ✅
- [ ] `npm test` → ✅
- [ ] Tests E2E manuels → ✅

---

### Phase 8 : CI & Documentation ⏱️ 1h

**CI** : Ajouter dans `.github/workflows/ci.yml`

```yaml
- name: Check French identifiers
  run: npm run lint:guard

- name: Lint with zero warnings
  run: npm run lint -- --max-warnings=0
```

**Documentation** :
- Mettre à jour le README
- Créer un guide i18n pour les contributeurs

---

## 🛠️ Utilisation des Outils

### 1. Scanner

```bash
npm run scan:fr
```

**Utilité** :
- Voir combien d'identifiants français restent
- Identifier les fichiers à traiter en priorité

**Exemple de sortie** :

```
📊 French-like identifiers found: 603
📁 Files affected: 64

📄 src/domain/services/propertyMetricsService.ts
   statut, fraisSortie, valeurMarche, patrimoineBrut, ...

📄 src/ui/components/PropertyForm.tsx
   PROPERTY_OCCUPATION, occupation
```

---

### 2. Codemod (EXPÉRIMENTAL)

```bash
# Voir ce qui serait changé (sans modifier)
npm run codemod:dry

# Appliquer les changements (ATTENTION)
npm run codemod:write
```

**⚠️ Attention** :
- Le codemod peut faire des erreurs (ex: `categories` → `categorys`)
- **Toujours faire un commit avant** : `git add . && git commit -m "checkpoint"`
- **Vérifier après** : `npm run typecheck`

**Recommandation** : Utilisez-le comme **assistant**, pas comme solution complète. Préférez le renommage manuel pour plus de contrôle.

---

### 3. Garde-fou CI

```bash
npm run lint:guard
```

**Utilité** :
- Empêche les nouveaux identifiants français
- À intégrer dans votre CI/CD

**Sortie si OK** :

```
✅ No French identifiers found in code identifiers.
```

**Sortie si KO** :

```
❌ French identifiers detected in:
 - src/ui/components/BienCard.tsx
 - src/app/api/biens/route.ts
```

---

## 📈 Suivi de Progression

### Commandes Rapides

```bash
# État actuel
npm run scan:fr

# Après une session de refactoring
git add .
git commit -m "refactor: migrate properties domain to English"
npm run scan:fr  # Voir la différence

# Avant de push
npm run lint:guard
npm run typecheck
npm test
```

### Tableau de Bord

| Phase | Statut | Identifiants restants |
|-------|--------|----------------------|
| Initial | ⏸️ | 603 |
| Phase 1 (DB) | ⬜ | - |
| Phase 2 (Domain) | ⬜ | - |
| Phase 3 (Infra) | ⬜ | - |
| Phase 4 (API) | ⬜ | - |
| Phase 5 (UI) | ⬜ | - |
| Phase 6 (i18n) | ⬜ | - |
| Phase 7 (Tests) | ⬜ | - |
| Phase 8 (CI) | ⬜ | 0 ✅ |

---

## 🚨 Points d'Attention

### ❌ À ÉVITER

1. **Tout renommer d'un coup**
   - Risque de casse massive
   - Difficile à déboguer
   - **Solution** : Phase par phase, commit par commit

2. **Oublier les `@map()` dans Prisma**
   - Perte de données en production
   - **Solution** : Toujours utiliser `@map("ancien_nom")`

3. **Ne pas tester après chaque phase**
   - Bugs cumulés
   - **Solution** : `npm run typecheck` + `npm test` après chaque fichier

4. **Ignorer les erreurs TypeScript**
   - Incohérences cachées
   - **Solution** : Corrigez immédiatement

### ✅ BONNES PRATIQUES

1. **Commits fréquents**
   - Un commit par fichier/module
   - Messages clairs : `refactor(domain): rename Property entity`

2. **Tests après chaque phase**
   - TypeScript : `npm run typecheck`
   - Tests unitaires : `npm test`
   - Tests E2E : Navigateur

3. **Revue de code**
   - Ne mergez pas sans relecture
   - Utilisez les PR pour tracer les changements

4. **Rollback plan**
   - Gardez `@map()` pendant 2-3 sprints
   - Documentez les changements majeurs

---

## 📞 Support & Ressources

### Documentation

- [Guide Complet](./MIGRATION-FR-EN-GUIDE.md) : Phase par phase détaillé
- [Quick Start](./QUICK-START-MIGRATION.md) : Démarrage rapide avec exemple
- [Conventions](./CODING-CONVENTIONS.md) : Règles de nommage

### Outils

- [Glossaire](../tools/naming-glossary.json) : Dictionnaire FR→EN
- [Scanner](../tools/scan-french-identifiers.ts) : Détection d'identifiants français
- [Codemod](../tools/codemod-identifiers.ts) : Renommage automatique
- [Garde-fou](../tools/guard-french-identifiers.js) : Protection CI

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
npm test

# Développement
npm run dev
```

---

## 🎯 Objectif Final

### Critères de Succès

- [ ] `npm run scan:fr` → **0 identifiants français**
- [ ] `npm run lint:guard` → **✅ Pass**
- [ ] `npm run typecheck` → **✅ No errors**
- [ ] `npm test` → **✅ All pass**
- [ ] Tests E2E → **✅ All features working**
- [ ] CI/CD → **✅ Garde-fou activé**
- [ ] Documentation → **✅ Mise à jour**

### Temps Estimé Total

- **Phase 1 (DB)** : 2-3h
- **Phase 2 (Domain)** : 3-4h
- **Phase 3 (Infra)** : 2h
- **Phase 4 (API)** : 3-4h
- **Phase 5 (UI)** : 5-6h
- **Phase 6 (i18n)** : 2-3h
- **Phase 7 (Tests)** : 2h
- **Phase 8 (CI)** : 1h

**Total** : ~20-25h (sur 3-4 jours)

---

## 🚀 Prochaines Étapes

1. **Lire** : `docs/QUICK-START-MIGRATION.md`
2. **Lancer** : `npm run scan:fr`
3. **Commencer** : Phase 1 (Prisma schema)
4. **Commit** : Fréquemment
5. **Tester** : Après chaque phase
6. **Documenter** : Vos choix de traduction

---

**Bon courage pour la migration ! 🎉**

_Dernière mise à jour : 10/10/2025_


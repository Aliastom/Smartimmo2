# ✅ Installation Complète - Outils de Migration FR→EN

## 🎉 Ce qui a été installé

### 📦 Dépendances npm

```json
{
  "devDependencies": {
    "ts-morph": "^22.0.0",
    "glob": "^11.0.3",
    "ts-node": "^10.9.2",
    "tsx": "latest"
  },
  "scripts": {
    "scan:fr": "tsx tools/scan-french-identifiers.ts",
    "codemod:dry": "tsx tools/codemod-identifiers.ts --dry",
    "codemod:write": "tsx tools/codemod-identifiers.ts --write",
    "lint:guard": "node tools/guard-french-identifiers.js"
  }
}
```

### 🛠️ Outils Créés

| Fichier | Description | Commande |
|---------|-------------|----------|
| `tools/naming-glossary.json` | Dictionnaire FR→EN (111 entrées) | - |
| `tools/scan-french-identifiers.ts` | Scanner d'identifiants français | `npm run scan:fr` |
| `tools/codemod-identifiers.ts` | Renommage automatique (expérimental) | `npm run codemod:dry` |
| `tools/guard-french-identifiers.js` | Garde-fou CI | `npm run lint:guard` |
| `tools/README.md` | Documentation des outils | - |

### 📚 Documentation Créée

| Fichier | Description | Temps de lecture |
|---------|-------------|------------------|
| `MIGRATION-FR-EN.md` | Point d'entrée principal | 5 min |
| `docs/MIGRATION-FR-EN-SUMMARY.md` | Récapitulatif complet | 10 min |
| `docs/QUICK-START-MIGRATION.md` | Démarrage rapide | 5 min |
| `docs/MIGRATION-FR-EN-GUIDE.md` | Guide phase par phase | 20 min |
| `docs/CODING-CONVENTIONS.md` | Conventions de code | 15 min |

---

## 🚀 Test de l'Installation

### 1. Vérifier les dépendances

```bash
npm list ts-morph glob ts-node
```

**Attendu** : Versions installées affichées sans erreur.

---

### 2. Tester le scanner

```bash
npm run scan:fr
```

**Attendu** :

```
📊 French-like identifiers found: 603
📁 Files affected: 64

📄 src/domain/services/propertyMetricsService.ts
   statut, fraisSortie, valeurMarche, ...
```

---

### 3. Tester le codemod (dry-run)

```bash
npm run codemod:dry
```

**Attendu** :

```
🧪 DRY RUN — Aucun fichier modifié. Aperçu des changements :

📄 src/domain/services/propertyMetricsService.ts
   L4: statut → status
   L7: fraisSortie → exitFees
   ...

📊 Total: 36 renommages dans 19 fichiers
```

---

### 4. Tester le garde-fou

```bash
npm run lint:guard
```

**Attendu** :

```
❌ French identifiers detected in:
 - src/domain/services/propertyMetricsService.ts
 - src/ui/components/PropertyForm.tsx
 ...
```

(C'est normal, la migration n'a pas encore été faite)

---

## 📖 Par Où Commencer ?

### Option 1 : Démarrage Rapide (5 min)

```bash
# 1. Lire le Quick Start
cat docs/QUICK-START-MIGRATION.md

# 2. Voir l'état actuel
npm run scan:fr

# 3. Commencer par le Prisma schema
code prisma/schema.prisma
```

### Option 2 : Lecture Complète (30 min)

1. **Lire** : `MIGRATION-FR-EN.md` (point d'entrée)
2. **Lire** : `docs/MIGRATION-FR-EN-SUMMARY.md` (vue d'ensemble)
3. **Lire** : `docs/MIGRATION-FR-EN-GUIDE.md` (guide détaillé)
4. **Lire** : `docs/CODING-CONVENTIONS.md` (conventions)
5. **Commencer** : Phase 1 (Database)

---

## 🎯 Ordre Recommandé de Migration

```
1. Database (Prisma)       ← COMMENCEZ ICI
   └── prisma/schema.prisma

2. Domain Layer
   ├── src/domain/entities/
   ├── src/domain/services/
   └── src/domain/use-cases/

3. Infrastructure
   └── src/infra/repositories/

4. API Routes
   └── src/app/api/

5. UI (Composants & Hooks)
   ├── src/ui/hooks/
   ├── src/ui/components/
   └── src/app/*/page.tsx

6. i18n (Externalisation)
   └── locales/fr/*.json

7. Validation & Tests
   └── npm run typecheck, npm test

8. CI & Documentation
   └── .github/workflows/ci.yml
```

---

## 📊 Métriques

### État Initial

```bash
npm run scan:fr
```

```
📊 French-like identifiers found: 603
📁 Files affected: 64
```

### Objectif Final

```bash
npm run scan:fr
```

```
📊 French-like identifiers found: 0
📁 Files affected: 0
```

```bash
npm run lint:guard
```

```
✅ No French identifiers found in code identifiers.
```

---

## 🔧 Commandes Essentielles

```bash
# Diagnostic
npm run scan:fr          # Voir les identifiants français

# Refactoring
npm run codemod:dry      # Aperçu des renommages
npm run codemod:write    # Appliquer (ATTENTION)

# Validation
npm run lint:guard       # Garde-fou CI
npm run typecheck        # Vérifier TypeScript
npm run lint             # Linter
npm run test             # Tests unitaires

# Développement
npm run dev              # Serveur de dev
```

---

## 🆘 Problèmes Courants

### "Cannot find module 'ts-morph'"

**Solution** :

```bash
npm install
```

### "tsx: command not found"

**Solution** :

```bash
npm install tsx --save-dev
```

### Le codemod fait des erreurs

**C'est normal**, il est expérimental. Utilisez-le comme **assistant** :

1. Faites un commit avant : `git add . && git commit -m "checkpoint"`
2. Lancez le codemod : `npm run codemod:write`
3. Vérifiez : `npm run typecheck`
4. Corrigez manuellement les erreurs
5. Testez : `npm test`

### Le scanner détecte trop de faux positifs

**Solution** : Ajustez la regex dans `tools/scan-french-identifiers.ts` :

```typescript
const FRENCH_RE = /[àâäéèêëîïôöùûüç]|(loyer|bail|locataire|bien|...)/i;
```

---

## 📞 Support

### Documentation

- [Point d'Entrée](./MIGRATION-FR-EN.md)
- [Récapitulatif](./docs/MIGRATION-FR-EN-SUMMARY.md)
- [Quick Start](./docs/QUICK-START-MIGRATION.md)
- [Guide Complet](./docs/MIGRATION-FR-EN-GUIDE.md)
- [Conventions](./docs/CODING-CONVENTIONS.md)
- [Outils](./tools/README.md)

### Ressources

- [Glossaire FR→EN](./tools/naming-glossary.json)
- [Scanner](./tools/scan-french-identifiers.ts)
- [Codemod](./tools/codemod-identifiers.ts)
- [Garde-fou](./tools/guard-french-identifiers.js)

---

## ✅ Checklist de Vérification

Avant de commencer la migration :

- [ ] `npm install` terminé sans erreur
- [ ] `npm run scan:fr` fonctionne
- [ ] `npm run codemod:dry` fonctionne
- [ ] `npm run lint:guard` fonctionne
- [ ] Documentation lue (au moins le Quick Start)
- [ ] Git initialisé (recommandé) : `git init`
- [ ] Branche créée : `git checkout -b feat/fr-to-en-migration`

---

## 🎯 Prochaines Étapes

1. ✅ **Installation** : Terminée !
2. 📖 **Lecture** : `docs/QUICK-START-MIGRATION.md` (5 min)
3. 🔍 **Diagnostic** : `npm run scan:fr` (voir l'état actuel)
4. 🗄️ **Migration** : Commencer par `prisma/schema.prisma`
5. ✅ **Validation** : `npm run typecheck` après chaque phase
6. 🔄 **Itération** : Répéter jusqu'à `npm run scan:fr` = 0

---

**Tout est prêt ! Lancez `npm run scan:fr` pour commencer. 🚀**

_Installation effectuée le : 10/10/2025_


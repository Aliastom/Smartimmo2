# 🛠️ Outils de Migration FR→EN

Ce dossier contient les outils pour migrer le codebase de SmartImmo du français vers l'anglais.

---

## 📁 Fichiers

### 1. `naming-glossary.json`

**Dictionnaire FR→EN** (111 entrées)

Source de vérité pour les traductions d'identifiants.

**Format** :

```json
{
  "loyer": "rent",
  "bail": "lease",
  "locataire": "tenant",
  "bien": "property",
  ...
}
```

**Éditable** : Ajoutez vos propres termes au fur et à mesure.

---

### 2. `scan-french-identifiers.ts`

**Scanner d'identifiants français**

Parcourt le code et détecte tous les identifiants (variables, fonctions, types, etc.) contenant :
- Des caractères accentués : `àâäéèêëîïôöùûüç`
- Des mots français courants : `loyer`, `bail`, `bien`, `statut`, etc.

**Utilisation** :

```bash
npm run scan:fr
```

**Sortie** :

```
📊 French-like identifiers found: 603
📁 Files affected: 64

📄 src/domain/services/propertyMetricsService.ts
   statut, fraisSortie, valeurMarche, patrimoineBrut, ...

📄 src/ui/components/PropertyForm.tsx
   PROPERTY_OCCUPATION, occupation
```

**Personnalisation** :

Éditez la regex `FRENCH_RE` dans le fichier pour ajouter/retirer des patterns :

```typescript
const FRENCH_RE = /[àâäéèêëîïôöùûüç]|(loyer|bail|locataire|...)/i;
```

---

### 3. `codemod-identifiers.ts`

**Codemod de renommage automatique** (EXPÉRIMENTAL)

Utilise `ts-morph` (AST TypeScript) pour renommer symboliquement les identifiants français en anglais.

**Utilisation** :

```bash
# Dry-run (aperçu sans modification)
npm run codemod:dry

# Application réelle (ATTENTION : faites un commit avant !)
npm run codemod:write
```

**Fonctionnement** :

1. Lit le glossaire `naming-glossary.json`
2. Parcourt tous les fichiers TS/TSX dans `src/`
3. Détecte les identifiants français
4. Les renomme selon le glossaire
5. Utilise `id.rename()` pour un renommage symbolique (tous les usages)

**Limitations** :

- Peut faire des erreurs de pluriel : `categories` → `categorys`
- Ne gère pas les cas complexes (ex: noms composés)
- Ignore les UPPER_SNAKE_CASE (constantes d'environnement)

**Recommandation** :

Utilisez-le comme **assistant**, pas comme solution complète. Vérifiez toujours avec `npm run typecheck` après.

**Personnalisation** :

- **Skip liste** : Ajoutez des identifiants à ne jamais toucher

```typescript
const SKIP_LIST = new Set([
  'NODE_ENV', 'DATABASE_URL', '_count', '_avg', ...
]);
```

- **Glossaire** : Éditez `naming-glossary.json`

---

### 4. `guard-french-identifiers.js`

**Garde-fou CI**

Script Node.js simple qui échoue (exit code 1) si des identifiants français sont détectés.

**Utilisation** :

```bash
npm run lint:guard
```

**Sortie si OK** :

```
✅ No French identifiers found in code identifiers.
```

**Sortie si KO** :

```
❌ French identifiers detected in:
 - src/ui/components/BienCard.tsx
 - src/app/api/biens/route.ts
 (exit code 1)
```

**Intégration CI** :

Ajoutez dans `.github/workflows/ci.yml` :

```yaml
- name: Check French identifiers
  run: npm run lint:guard
```

**Fonctionnement** :

1. Utilise `glob` pour trouver tous les fichiers TS/TSX/JS/JSX
2. Lit chaque fichier
3. Retire les string literals (pour ignorer le texte UI)
4. Teste la regex française sur le code restant
5. Échoue si au moins un match

**Personnalisation** :

Éditez la regex `re` pour ajouter/retirer des patterns :

```javascript
const re = /[àâäéèêëîïôöùûüç]|(loyer|bail|locataire|...)\b/i;
```

---

## 🚀 Workflow Recommandé

### 1. État des lieux

```bash
npm run scan:fr
```

→ Voir combien d'identifiants français restent et où.

---

### 2. Refactoring (manuel ou assisté)

#### Option A : Manuel (RECOMMANDÉ)

1. Ouvrir un fichier
2. Renommer les identifiants (avec l'IDE pour renommage symbolique)
3. Commit : `git commit -m "refactor: rename X to English"`
4. Vérifier : `npm run typecheck`

#### Option B : Codemod (EXPÉRIMENTAL)

```bash
# Aperçu
npm run codemod:dry

# Checkpoint
git add . && git commit -m "checkpoint before codemod"

# Application
npm run codemod:write

# Vérification
npm run typecheck
npm test
```

---

### 3. Validation

```bash
# Identifiants français restants
npm run scan:fr

# Garde-fou CI
npm run lint:guard

# TypeScript
npm run typecheck

# Tests
npm test
```

---

### 4. CI/CD

Activez le garde-fou en CI pour empêcher les régressions :

```yaml
# .github/workflows/ci.yml
- name: Check French identifiers
  run: npm run lint:guard
```

---

## 📊 Métriques

### État Initial (10/10/2025)

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

## 🔧 Maintenance

### Ajouter un Terme au Glossaire

Éditez `naming-glossary.json` :

```json
{
  "nouveauTerme": "newTerm",
  "autreTerme": "otherTerm"
}
```

### Ajuster les Patterns de Détection

Éditez la regex dans `scan-french-identifiers.ts` et `guard-french-identifiers.js` :

```typescript
const FRENCH_RE = /[àâäéèêëîïôöùûüç]|(loyer|bail|nouveauTerme|autreTerme)/i;
```

### Exclure un Identifiant

Ajoutez-le à la skip liste dans `codemod-identifiers.ts` :

```typescript
const SKIP_LIST = new Set([
  'NODE_ENV',
  'DATABASE_URL',
  'monIdentifiantSpecial',
]);
```

---

## 📚 Documentation

- [Guide Complet](../docs/MIGRATION-FR-EN-GUIDE.md)
- [Quick Start](../docs/QUICK-START-MIGRATION.md)
- [Conventions](../docs/CODING-CONVENTIONS.md)
- [Récapitulatif](../docs/MIGRATION-FR-EN-SUMMARY.md)

---

## 🆘 Problèmes Courants

### "Cannot find module 'ts-morph'"

```bash
npm install
```

### "Permission denied" sur Linux/Mac

```bash
chmod +x tools/*.ts
chmod +x tools/*.js
```

### Le codemod fait des erreurs

→ C'est normal, il est **expérimental**. Utilisez-le comme assistant et vérifiez toujours :

```bash
npm run typecheck
npm test
```

### Le scanner détecte trop de faux positifs

→ Ajoutez-les à la skip liste ou ajustez la regex.

---

**Bon courage pour la migration ! 🚀**


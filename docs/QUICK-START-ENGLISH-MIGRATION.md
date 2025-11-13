# Quick Start: English Migration

## ✅ Ce qui est fait

1. ✅ Glossaire FR→EN créé (`docs/naming-glossary.md`)
2. ✅ ESLint configuré avec règles strictes
3. ✅ Script de détection (`scripts/check-french-identifiers.ts`)
4. ✅ Structure i18n de base (`locales/fr/`)
5. ✅ Plan de migration détaillé (`docs/MIGRATION-PLAN-EN.md`)

## 🚀 Pour exécuter la migration complète

### Étape 1: Vérification actuelle
```bash
# Voir tous les identifiants français
npx tsx scripts/check-french-identifiers.ts
```

**Résultat actuel**: 535 violations dans 78 fichiers

### Étape 2: Backup
```bash
# Copier la base de données
cp prisma/dev.db prisma/dev.db.backup

# Créer une branche
git checkout -b feature/english-naming-convention
git add .
git commit -m "feat: Phase 1 - Infrastructure for English naming"
```

### Étape 3: Exécution automatique (À VENIR)

Vous avez trois options:

#### Option A: Migration Automatique (RECOMMANDÉ)
```bash
# Script à créer qui fera tout automatiquement
npm run migrate:to-english
```
⏱️ **Durée**: 10-15 minutes  
⚠️ **Risque**: Moyen (automatisé mais breaking)

#### Option B: Migration Phase par Phase (PRUDENT)
```bash
# Phase 2: Base de données
npm run migrate:db-to-english
npm test

# Phase 3: Repositories
npm run migrate:repos-to-english
npm test

# Phase 4: APIs
npm run migrate:apis-to-english  
npm test

# Phase 5: UI
npm run migrate:ui-to-english
npm test
```
⏱️ **Durée**: 2-3 heures  
⚠️ **Risque**: Faible (testé à chaque étape)

#### Option C: Migration Manuelle (MAXIMUM CONTRÔLE)
Suivre le plan détaillé dans `docs/MIGRATION-PLAN-EN.md`

⏱️ **Durée**: 6-8 heures  
⚠️ **Risque**: Très faible (contrôle total)

---

## 📊 État Actuel

### Fichiers les plus impactés:
1. `src/pdf/*` - 150+ violations (mais OK, c'est du contenu PDF)
2. `src/ui/components/*` - 100+ violations
3. `src/ui/leases-tenants/*` - 80+ violations
4. `src/domain/services/*` - 40+ violations
5. `src/app/api/*` - 30+ violations

### Mots les plus fréquents:
- `bien` / `biens` - 60+ occurrences
- `bail` / `baux` - 50+ occurrences  
- `locataire` / `locataires` - 45+ occurrences
- `loyer` - 40+ occurrences
- `catégorie` / `categories` - 35+ occurrences

---

## 🎯 Décision Recommandée

Vu l'ampleur (**535 violations**), je recommande:

### ✅ **Option recommandée**: Migration Semi-Automatique

1. **Maintenant**: Créer les scripts de migration automatique
2. **Ensuite**: Exécuter phase par phase avec tests
3. **Durée totale**: 1-2 heures + tests

### 📝 Actions Immédiates

Dites-moi si vous voulez que je:

**A)** Crée les scripts de migration automatique pour exécuter tout en une fois  
**B)** Commence la Phase 2 (Database) manuellement maintenant  
**C)** Prépare juste les scripts et vous les laissez exécuter quand vous voulez  

---

## 🔧 Commandes Utiles

```bash
# Vérifier les violations
npx tsx scripts/check-french-identifiers.ts

# Lancer ESLint
npm run lint

# Compiler TypeScript
npx tsc --noEmit

# Régénérer Prisma Client après modification du schema
npx prisma generate

# Créer une migration
npx prisma migrate dev --name your-migration-name

# Voir l'état de la DB
npx prisma studio
```

---

## 📚 Documentation

- **Plan complet**: `docs/MIGRATION-PLAN-EN.md`
- **Glossaire**: `docs/naming-glossary.md`
- **Conventions**: `.eslintrc.cjs`

---

## ⚠️ IMPORTANT

Cette migration est **BREAKING** :
- ✅ L'UI restera en français (via i18n)
- ❌ Les noms de colonnes DB changeront
- ❌ Les clés JSON des APIs changeront
- ❌ Les noms de variables/fonctions changeront

**⏰ Moment idéal**: Quand vous avez 2-3h disponibles et que vous pouvez tester après.

---

**Question**: Voulez-vous que je continue et crée les scripts automatiques ?



# Scripts de gestion des données de base

Ce dossier contient des scripts pour gérer les données de base de l'application SmartImmo.

## Scripts disponibles

### 🌱 `seed-all.ts`
**Script principal** - Restaure toutes les données de base nécessaires au fonctionnement de l'application.

```bash
npx tsx scripts/seed-all.ts
```

**Ce script crée :**
- ✅ Catégories comptables (Loyer, Charges, etc.)
- ✅ Entités de nature (LOYER, CHARGES, etc.)
- ✅ Règles de mapping nature ↔ catégorie
- ✅ Catégories par défaut pour chaque nature
- ✅ Propriétaire par défaut

### 🏷️ `seed-nature-mapping.ts`
Script spécialisé pour restaurer uniquement les données de mapping nature ↔ catégorie.

```bash
npx tsx scripts/seed-nature-mapping.ts
```

### 📊 `seed-accounting-categories.ts`
Script spécialisé pour restaurer uniquement les catégories comptables.

```bash
npx tsx scripts/seed-accounting-categories.ts
```

### 💾 `backup-nature-mapping.ts`
Crée une sauvegarde des données de mapping au format JSON.

```bash
npx tsx scripts/backup-nature-mapping.ts
```

La sauvegarde est créée dans le dossier `backups/` avec la date du jour.

## Quand utiliser ces scripts ?

### 🔄 Après une réinitialisation de base de données
Si vous avez exécuté `npx prisma migrate reset` ou `npx prisma db push`, les données de base ont été supprimées. Utilisez :

```bash
npx tsx scripts/seed-all.ts
```

### 🛠️ En cas de problème avec le mapping nature ↔ catégorie
Si la page `/admin/nature-mapping` est vide ou ne fonctionne pas :

```bash
npx tsx scripts/seed-nature-mapping.ts
```

### 📋 Pour ajouter de nouvelles catégories comptables
Modifiez le script `seed-accounting-categories.ts` et relancez-le.

## Structure des données restaurées

### Entités de nature
- `LOYER` → Loyer
- `CHARGES` → Charges locatives
- `DEPOT_GARANTIE_RECU` → Dépôt de garantie reçu
- `DEPOT_GARANTIE_RENDU` → Dépôt de garantie rendu
- `AVOIR_REGULARISATION` → Avoir / Régularisation
- `PENALITE_RETENUE` → Pénalité / Retenue
- `AUTRE` → Autre

### Règles de mapping
- **LOYER** → Peut être `REVENU` ou `NON_DEFINI`
- **CHARGES** → Peut être `DEPENSE` ou `NON_DEFINI`
- **DEPOT_GARANTIE_RECU** → Peut être `REVENU` ou `NON_DEFINI`
- **DEPOT_GARANTIE_RENDU** → Peut être `DEPENSE` ou `NON_DEFINI`
- **AVOIR_REGULARISATION** → Peut être `REVENU`, `DEPENSE` ou `NON_DEFINI`
- **PENALITE_RETENUE** → Peut être `DEPENSE` ou `NON_DEFINI`
- **AUTRE** → Peut être `REVENU`, `DEPENSE` ou `NON_DEFINI`

### Catégories par défaut
- **LOYER** → Catégorie "Loyer" (REVENU)
- **CHARGES** → Catégorie "Charges locatives" (DEPENSE)
- **DEPOT_GARANTIE_RECU** → Catégorie "Dépôt de garantie" (REVENU)

## Sauvegarde et restauration

### Créer une sauvegarde
```bash
npx tsx scripts/backup-nature-mapping.ts
```

### Restaurer depuis une sauvegarde
Les fichiers de sauvegarde sont au format JSON dans le dossier `backups/`. Vous pouvez les utiliser pour restaurer manuellement les données si nécessaire.

## Dépannage

### Erreur "Table doesn't exist"
Assurez-vous que la base de données est synchronisée :
```bash
npx prisma db push
```

### Erreur "Invalid value provided"
Vérifiez que le schéma Prisma est à jour :
```bash
npx prisma generate
```

### Données corrompues
Supprimez les données existantes et restaurez :
```bash
npx prisma migrate reset --force
npx tsx scripts/seed-all.ts
```

# Implémentation "Gestion déléguée" (Sociétés de gestion) — Smartimmo

> Date: 24 octobre 2024
> Status: ✅ Implémentation de base complète

## 📋 Vue d'ensemble

Cette fonctionnalité permet de gérer les sociétés de gestion et d'automatiser le calcul et la création des commissions de gestion lors des transactions de loyer.

## ✅ Ce qui a été implémenté

### 1. Schéma Prisma et Base de données

#### Nouveau modèle: `ManagementCompany`
```prisma
model ManagementCompany {
  id                   String     @id @default(cuid())
  nom                  String
  contact              String?
  email                String?
  telephone            String?
  modeCalcul           String     @default("LOYERS_UNIQUEMENT")
  taux                 Float
  fraisMin             Float?
  baseSurEncaissement  Boolean    @default(true)
  tvaApplicable        Boolean    @default(false)
  tauxTva              Float?
  actif                Boolean    @default(true)
  properties           Property[] @relation("PropertyManagementCompany")
  createdAt            DateTime   @default(now())
  updatedAt            DateTime   @updatedAt
}
```

#### Ajouts sur `Property`:
- `managementCompanyId` (String?, nullable)
- `managementCompany` (relation)

#### Ajouts sur `Lease`:
- `chargesRecupMensuelles` (Float?, nullable)
- `chargesNonRecupMensuelles` (Float?, nullable)

#### Ajouts sur `Transaction`:
- `montantLoyer` (Float?, nullable)
- `chargesRecup` (Float?, nullable)
- `chargesNonRecup` (Float?, nullable)
- `managementCompanyId` (String?, nullable)
- `isAuto` (Boolean, default: false)
- `autoSource` (String?, nullable)

**Note:** SQLite ne supporte pas les enums natifs, donc `modeCalcul` est un String avec validation applicative.

### 2. Fonction de calcul de commission

**Fichier:** `src/lib/gestion/calcCommission.ts`

Fonction partagée front/back qui calcule les commissions selon les règles:
- Base = loyer (LOYERS_UNIQUEMENT) ou loyer + charges récup (REVENUS_TOTAUX)
- Commission = max(base × taux, fraisMin)
- CommissionTTC = CommissionHT × (1 + tauxTVA/100) si TVA applicable

### 3. API Backend

#### Endpoints créés:
- `GET /api/gestion/societes` - Liste toutes les sociétés
- `POST /api/gestion/societes` - Crée une société
- `GET /api/gestion/societes/:id` - Récupère une société
- `PATCH /api/gestion/societes/:id` - Met à jour une société
- `DELETE /api/gestion/societes/:id` - Désactive une société (soft delete)
- `POST /api/gestion/societes/:id/affecter-biens` - Affecte des biens à une société

#### Service de gestion des commissions:
**Fichier:** `src/lib/services/managementCommissionService.ts`

Fonctions:
- `createManagementCommission()` - Crée automatiquement une commission
- `updateManagementCommission()` - Met à jour une commission existante
- `deleteManagementCommission()` - Supprime une commission
- `shouldCreateCommission()` - Vérifie si une transaction doit générer une commission

### 4. Interface utilisateur

#### Menu latéral:
- Nouvelle section "Gestion" avec l'entrée "Gestion déléguée"
- Visible uniquement si `NEXT_PUBLIC_ENABLE_GESTION_SOCIETE=true`
- **Fichier:** `src/ui/layouts/AppSidebar.tsx`

#### Page de gestion:
- **Fichier:** `src/app/gestion-deleguee/page.tsx`
- Liste des sociétés de gestion avec:
  - Nom, contact, taux, mode de calcul
  - Nombre de biens liés
  - Statut actif/inactif
  - Actions: Modifier, Activer/Désactiver

### 5. Seed et données de test

**Fichier:** `prisma/seeds/management-companies-seed.ts`

Crée:
- Catégorie "frais_gestion" (si elle n'existe pas)
- Société de test "ImmoGest" (6%, min 30€, loyers uniquement)
- Lie 1-2 biens à cette société
- Met à jour un bail avec des charges détaillées

**Commande:** (à ajouter dans package.json)
```bash
npm run db:seed-management
```

## 🚧 Ce qui reste à faire

### TODO 8: Modale création/édition société
Créer une modale complète avec:
- Formulaire pour tous les champs
- Validation côté client
- Section pour assigner des biens (listbox multi-sélection)
- Intégration avec React Hook Form et Zod

### TODO 9: Modifier modale Bail
Ajouter les champs:
- "Charges récupérables (mensuelles)"
- "Charges non récupérables (mensuelles)"
- Info-bulles explicatives

### TODO 10: Modifier modale Transaction loyer
Ajouter:
- Champs de granularité (montantLoyer, chargesRecup, chargesNonRecup)
- Préremplissage depuis le Bail
- Encart "Commission estimée" en lecture seule (calcul live)
- Affichage du total payé par le locataire

### TODO 11: Adapter liste transactions
Implémenter:
- Affichage indentée de la commission sous le loyer parent
- Badge "Auto (Gestion)" avec icône ⚙️
- Filtres: "Inclure frais de gestion", "Grouper par parent"

### Intégration dans l'API transactions
**Fichier à modifier:** `src/app/api/transactions/route.ts`

Dans la fonction `POST`:
1. Après création de la transaction de loyer (type=RECETTE_LOYER)
2. Si bien.managementCompanyId existe ET feature ON
3. Appeler `createManagementCommission()` dans la même transaction Prisma

Dans les fonctions `PATCH` et `DELETE`:
- Gérer la mise à jour/suppression des commissions liées

## 🔧 Configuration

### Variables d'environnement

**.env:**
```bash
# Backend (pour les APIs)
ENABLE_GESTION_SOCIETE=true
```

**.env.local:**
```bash
# Frontend (pour l'UI)
NEXT_PUBLIC_ENABLE_GESTION_SOCIETE=true
```

### Installation

1. Appliquer le schéma Prisma:
```bash
npx prisma db push
npx prisma generate
```

2. Lancer le seed (optionnel):
```bash
npm run db:seed-management
```

3. Redémarrer le serveur de développement:
```bash
npm run dev
```

## 📊 Cas d'usage exemple

### Création d'une société
```typescript
POST /api/gestion/societes
{
  "nom": "ImmoGest",
  "contact": "Jean Dupont",
  "email": "contact@immogest.fr",
  "modeCalcul": "LOYERS_UNIQUEMENT",
  "taux": 0.06,
  "fraisMin": 30,
  "baseSurEncaissement": true,
  "tvaApplicable": false
}
```

### Affectation de biens
```typescript
POST /api/gestion/societes/clxxx/affecter-biens
{
  "propertyIds": ["prop1", "prop2"]
}
```

### Calcul de commission
```typescript
import { calcCommission } from '@/lib/gestion';

const result = calcCommission({
  montantLoyer: 558.26,
  chargesRecup: 20,
  modeCalcul: 'LOYERS_UNIQUEMENT',
  taux: 0.06,
  fraisMin: 30,
  tvaApplicable: false
});

// result = { base: 558.26, commissionHT: 33.50, commissionTTC: 33.50 }
```

## 🔒 Sécurité et contraintes

### Non-régression
- ✅ Tous les champs ajoutés sont **nullable**
- ✅ Aucun champ existant n'est renommé ou supprimé
- ✅ Feature flag obligatoire pour activer la fonctionnalité
- ✅ Si feature OFF ou pas de société liée → comportement actuel inchangé

### Validation
- Taux: entre 0 et 1
- FraisMin: >= 0
- TauxTVA: >= 0
- ModeCalcul: "LOYERS_UNIQUEMENT" | "REVENUS_TOTAUX"

### Index
- `managementCompanyId` indexé sur `Transaction` et `Property`
- `parentTransactionId` déjà indexé

## 📝 Notes techniques

### Pourquoi pas d'enum en SQLite?
SQLite ne supporte pas les enums natifs. On utilise donc un String avec validation applicative via la fonction `isValidModeCalcul()`.

### Gestion des commissions auto vs manuelles
- Commission créée automatiquement: `isAuto = true`, `autoSource = "gestion"`
- Si l'utilisateur modifie manuellement une commission: `isAuto = false`
- Les commissions manuelles ne sont pas automatiquement mises à jour lors de la modification du loyer parent

### Calcul basé sur l'encaissement réel
Le champ `baseSurEncaissement` détermine si:
- `true`: utiliser les montants SAISIS dans la transaction (réalité de l'encaissement)
- `false`: fallback possible sur les valeurs du Bail (à implémenter si besoin)

## 🎯 Prochaines étapes recommandées

1. **Compléter les TODOs UI** (8-11)
2. **Intégrer le hook dans l'API transactions** pour l'auto-création
3. **Ajouter la nature DEPENSE_GESTION** dans le système de natures
4. **Tests manuels** selon le plan dans la spec
5. **Tests automatisés** (unit tests pour calcCommission, integration tests pour l'API)
6. **Documentation utilisateur** avec captures d'écran

## 📚 Fichiers créés/modifiés

### Nouveaux fichiers:
- `src/lib/gestion/calcCommission.ts`
- `src/lib/gestion/types.ts`
- `src/lib/gestion/index.ts`
- `src/lib/services/managementCommissionService.ts`
- `src/app/api/gestion/societes/route.ts`
- `src/app/api/gestion/societes/[id]/route.ts`
- `src/app/api/gestion/societes/[id]/affecter-biens/route.ts`
- `src/app/gestion-deleguee/page.tsx`
- `prisma/seeds/management-companies-seed.ts`

### Fichiers modifiés:
- `prisma/schema.prisma` (nouveau modèle + champs)
- `src/ui/layouts/AppSidebar.tsx` (nouveau menu)

## 🙏 Conclusion

L'infrastructure de base pour la gestion déléguée est maintenant en place. La fonctionnalité est **activable via feature flag** et ne casse rien du comportement existant. Les TODOs restants concernent principalement l'UI pour une expérience utilisateur complète.

---

**Pour toute question ou assistance:** Voir la spec complète dans la requête initiale de l'utilisateur.


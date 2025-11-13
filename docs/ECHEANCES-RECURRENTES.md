# 📅 Échéances Récurrentes - Documentation

## Vue d'ensemble

Interface complète de gestion des échéances récurrentes (charges et revenus périodiques) pour SmartImmo, avec intégration au dashboard patrimoine.

## 🎯 Fonctionnalités

### ✅ CRUD Complet
- **Création** : Formulaire complet avec validation Zod
- **Édition** : Modification des échéances existantes
- **Duplication** : Copie rapide d'une échéance
- **Suppression** : 
  - Soft delete (archivage) par défaut
  - Hard delete (suppression définitive) pour ADMIN uniquement
- **Activation/Désactivation** : Toggle rapide depuis le tableau

### 🔍 Filtres Avancés
- Recherche textuelle dans les libellés
- Filtrage par **type** (LOYER, COPRO, IMPOT, etc.)
- Filtrage par **sens** (DEBIT/CREDIT)
- Filtrage par **périodicité** (mensuel, trimestriel, annuel, ponctuel)
- Filtrage par **bien immobilier**
- Filtrage par **état** (actif/inactif)
- Filtrage par **période** (chevauchement d'activité)

### 📊 Tableau Interactif
- Vue d'ensemble complète des échéances
- Badge coloré par type d'échéance
- Liens vers les biens associés
- Toggle actif/inactif en ligne
- Menu d'actions (éditer, dupliquer, archiver, supprimer)
- Pagination (20 items par page)

### 🔄 Intégration Dashboard
- **Invalidation automatique** du cache React Query après chaque mutation
- Les modifications se reflètent immédiatement dans le dashboard patrimoine
- Mise à jour des séries de données (loyers, charges, cashflow)
- Rafraîchissement de l'agenda global

## 📁 Structure des Fichiers

### API (Backend)
```
src/app/api/echeances/
├── route.ts              # GET (expansion) + POST (création)
├── list/
│   └── route.ts         # GET (liste paginée pour CRUD)
└── [id]/
    └── route.ts         # PATCH (mise à jour) + DELETE
```

### Pages (Frontend)
```
src/app/echeances/
└── page.tsx             # Page principale avec DataTable et filtres
```

### Composants
```
src/components/echeances/
└── EcheanceFormDrawer.tsx  # Drawer de formulaire (création/édition)
```

### Types & Validations
```
src/types/
└── echeance.ts          # Types TypeScript + labels + couleurs

src/lib/validations/
└── echeance.ts          # Schéma Zod pour validation formulaire
```

## 🔌 Endpoints API

### GET `/api/echeances/list`
Liste paginée des échéances pour le CRUD.

**Query params:**
- `search`: Recherche dans le libellé
- `type`: Filtrer par type (CSV)
- `sens`: DEBIT ou CREDIT
- `periodicite`: Filtrer par périodicité (CSV)
- `propertyId`: Filtrer par bien
- `leaseId`: Filtrer par bail
- `active`: "0", "1" ou vide (tous)
- `from` / `to`: Période YYYY-MM (chevauchement)
- `page`: Numéro de page (défaut 1)
- `pageSize`: Taille de page (défaut 20, max 100)

**Réponse:**
```json
{
  "items": [...],
  "total": 42,
  "page": 1,
  "pageSize": 20,
  "totalPages": 3
}
```

### POST `/api/echeances`
Créer une nouvelle échéance.

**Body:**
```json
{
  "label": "Loyer mensuel",
  "type": "LOYER_ATTENDU",
  "periodicite": "MONTHLY",
  "montant": 850.00,
  "sens": "CREDIT",
  "recuperable": false,
  "propertyId": "clxxx...",
  "leaseId": null,
  "startAt": "2025-01-01T00:00:00Z",
  "endAt": null,
  "isActive": true
}
```

### PATCH `/api/echeances/:id`
Mettre à jour une échéance (mise à jour partielle).

**Body:** Même structure que POST, mais tous les champs sont optionnels.

### DELETE `/api/echeances/:id`
Supprimer ou archiver une échéance.

**Query params:**
- `hard=1` : Suppression définitive (hard delete)
- Défaut : Suppression logique (soft delete)

**Soft delete:**
- `isActive` → `false`
- `endAt` → `now()` si était `null`

## 🎨 Types d'Échéances

| Type | Label | Badge Color | Usage |
|------|-------|-------------|-------|
| `PRET` | Prêt | Purple | Mensualités de prêt |
| `COPRO` | Copropriété | Blue | Charges de copropriété |
| `PNO` | Assurance PNO | Indigo | Assurance propriétaire non occupant |
| `ASSURANCE` | Assurance | Cyan | Autres assurances |
| `IMPOT` | Impôts | Orange | Taxe foncière, etc. |
| `CFE` | CFE | Amber | Cotisation foncière des entreprises |
| `ENTRETIEN` | Entretien | Teal | Entretien régulier |
| `AUTRE` | Autre | Gray | Charges diverses |
| `LOYER_ATTENDU` | Loyer attendu | Green | Revenus locatifs |
| `CHARGE_RECUP` | Charges récup. | Lime | Charges récupérables |

## 🔄 Périodicités

- **MONTHLY** : Mensuel
- **QUARTERLY** : Trimestriel (tous les 3 mois)
- **YEARLY** : Annuel
- **ONCE** : Ponctuel (une seule fois)

## 💰 Sens

- **DEBIT** : Charge (montant sortant)
- **CREDIT** : Revenu (montant entrant)

## 🔐 Sécurité & RBAC

### Rôles
- **ADMIN** : Accès complet (CRUD)
- **USER** : Lecture seule (à implémenter dans les guards)

### TODO
Les endpoints ont des commentaires `// TODO: Ajouter protection authentification RBAC` pour rappeler l'ajout de la couche de sécurité.

## 🧪 Tests

### Test Manuel
1. Naviguer vers `http://localhost:3000/echeances`
2. Créer une échéance test
3. Tester les filtres
4. Éditer l'échéance
5. Dupliquer l'échéance
6. Archiver puis supprimer
7. Vérifier que le dashboard patrimoine se met à jour

### Points de Validation
- ✅ Validation Zod côté client (formulaire)
- ✅ Validation Zod côté serveur (API)
- ✅ Constraint `endAt >= startAt`
- ✅ Montant positif requis
- ✅ Conversion Decimal ↔ number pour JSON
- ✅ Invalidation du cache React Query
- ✅ Toasts de succès/erreur (notify2)

## 🔗 Intégration Dashboard Patrimoine

L'interface invalide automatiquement les queries suivantes après chaque mutation :

```typescript
queryClient.invalidateQueries({ queryKey: ['echeances-list'] });
queryClient.invalidateQueries({ queryKey: ['dashboard-patrimoine'] });
queryClient.invalidateQueries({ queryKey: ['patrimoine'] });
```

Cela garantit que :
- Les graphiques de trésorerie se mettent à jour
- L'agenda des échéances se rafraîchit
- Les KPIs (rendement, cashflow) sont recalculés

## 📱 Responsive

L'interface est entièrement responsive :
- Grille de filtres adaptative (1 col mobile → 4 cols desktop)
- Tableau horizontal scrollable sur mobile
- Drawer pleine largeur sur mobile, taille fixe sur desktop
- Pagination simplifiée sur mobile

## 🎯 Best Practices Appliquées

✅ **Shadcn/ui uniquement** : Aucune nouvelle dépendance UI  
✅ **React Hook Form + Zod** : Validation robuste  
✅ **React Query** : Gestion du cache et des mutations  
✅ **Soft delete par défaut** : Données préservées  
✅ **Toasts unifiés** : Système notify2 (Sonner)  
✅ **Accessibilité** : Labels, aria, focus trap  
✅ **TypeScript strict** : Typage complet  
✅ **Code réutilisable** : Composants modulaires

## 🚀 Améliorations Futures

### Court terme
- [ ] Ajouter les guards RBAC (authentification + autorisation)
- [ ] Ajouter un tri sur les colonnes du tableau
- [ ] Export CSV des échéances
- [ ] Import CSV en masse

### Long terme
- [ ] Graphique de visualisation des échéances dans le temps
- [ ] Alertes avant échéance (email/notif)
- [ ] Templates d'échéances prédéfinies
- [ ] Calcul automatique du montant (ex: loyer indexé)
- [ ] Historique des modifications (audit trail)

## 📞 Support

Pour toute question ou bug, référez-vous à la documentation technique dans :
- `src/lib/echeances/expandEcheances.ts` : Logique d'expansion
- `src/types/dashboard.ts` : Types du dashboard patrimoine
- `prisma/schema.prisma` : Modèle de données

---

**Date de création** : 1er novembre 2025  
**Version** : 1.0.0  
**Auteur** : SmartImmo Team


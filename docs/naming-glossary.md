# Glossaire de Nommage FR → EN

## Convention de Nommage

### Règles générales
- **Code & DB**: ANGLAIS uniquement
- **UI/Labels**: Français via i18n
- **Variables/Functions**: camelCase
- **Types/Interfaces**: PascalCase
- **Enums**: PascalCase avec membres UPPER_CASE ou PascalCase
- **Constants**: UPPER_SNAKE_CASE
- **DB Columns**: snake_case (anglais)

---

## Glossaire Principal

### Domaine Immobilier
| Français | English | Type | Notes |
|----------|---------|------|-------|
| bien | property | noun | Bien immobilier |
| biens | properties | noun | Pluriel |
| loyer | rent | noun | Montant du loyer |
| bail | lease | noun | Contrat de location |
| locataire | tenant | noun | Personne qui loue |
| propriétaire | landlord/owner | noun | Selon contexte |
| charges | charges/fees | noun | Charges locatives |
| dépôt de garantie | security deposit | noun | Caution |

### Transactions & Comptabilité
| Français | English | Type | Notes |
|----------|---------|------|-------|
| transaction | transaction | noun | ✓ Déjà en anglais |
| paiement | payment | noun | |
| catégorie | category | noun | |
| nature | nature | noun | ✓ Déjà en anglais |
| revenus | income | noun | |
| dépenses | expenses | noun | |
| solde | balance | noun | |
| encaissé | received | adj | |
| décaissé | paid | adj | |
| pénalité | penalty | noun | |
| régularisation | adjustment | noun | |
| avoir | credit | noun | |

### Prêts
| Français | English | Type | Notes |
|----------|---------|------|-------|
| prêt | loan | noun | |
| emprunt | loan/borrowing | noun | |
| mensualité | monthly payment | noun | |
| capital restant | remaining capital | noun | |
| taux d'intérêt | interest rate | noun | |
| taux d'assurance | insurance rate | noun | |
| durée | duration | noun | |
| échéance | due date/maturity | noun | |

### Propriétés & Attributs
| Français | English | Type | Notes |
|----------|---------|------|-------|
| valeur actuelle | current value | noun | |
| valeur d'acquisition | purchase price | noun | |
| prix d'achat | purchase price | noun | |
| frais de notaire | notary fees | noun | |
| frais de sortie | exit fees | noun | |
| surface | area/surface | noun | |
| pièces | rooms | noun | |
| adresse | address | noun | ✓ Déjà en anglais |

### Statuts & États
| Français | English | Type | Notes |
|----------|---------|------|-------|
| statut | status | noun | ✓ Déjà en anglais |
| actif | active | adj | |
| inactif | inactive | adj | |
| signé | signed | adj | |
| résilié | terminated | adj | |
| brouillon | draft | adj | |
| loué | rented | adj | |
| vacant | vacant | adj | ✓ Déjà en anglais |
| occupé | occupied | adj | |
| en travaux | under works | adj | |

### Gestion & Administration
| Français | English | Type | Notes |
|----------|---------|------|-------|
| occupation | occupation | noun | ✓ Déjà en anglais |
| mode de gestion | management mode / status mode | noun | |
| résidence principale | primary residence | noun | |
| résidence secondaire | secondary residence | noun | |
| usage professionnel | professional use | noun | |
| locatif | rental | adj | |

### Documents
| Français | English | Type | Notes |
|----------|---------|------|-------|
| document | document | noun | ✓ Déjà en anglais |
| photo | photo | noun | ✓ Déjà en anglais |
| pièce jointe | attachment | noun | |
| quittance | receipt | noun | |
| contrat | contract | noun | |

### Dates & Périodes
| Français | English | Type | Notes |
|----------|---------|------|-------|
| date de début | start date | noun | |
| date de fin | end date | noun | |
| date d'acquisition | acquisition date | noun | |
| date de création | creation date / created at | noun | |
| date de mise à jour | update date / updated at | noun | |
| période | period | noun | ✓ Déjà en anglais |
| mois | month | noun | |
| année | year | noun | |

### Calculs & Métriques
| Français | English | Type | Notes |
|----------|---------|------|-------|
| rendement | yield/return | noun | |
| rentabilité | profitability | noun | |
| taux d'occupation | occupancy rate | noun | |
| cashflow | cashflow | noun | ✓ Déjà en anglais |
| patrimoine | portfolio/equity | noun | Selon contexte |
| dette | debt | noun | |
| capital | capital/equity | noun | ✓ Déjà en anglais |

---

## Exemples de Conversion

### Variables (camelCase)
```typescript
// ❌ Avant (FR)
const valeurActuelle = 250000;
const fraisNotaire = 15000;
const loyerMensuel = 1200;
const bailActif = true;

// ✅ Après (EN)
const currentValue = 250000;
const notaryFees = 15000;
const monthlyRent = 1200;
const activeLease = true;
```

### Types & Interfaces (PascalCase)
```typescript
// ❌ Avant (FR)
interface InfosBien {
  valeurActuelle: number;
  prixAcquisition: number;
}

// ✅ Après (EN)
interface PropertyInfo {
  currentValue: number;
  purchasePrice: number;
}
```

### Enums
```typescript
// ❌ Avant (FR)
enum StatutBail {
  BROUILLON = 'BROUILLON',
  SIGNE = 'SIGNE',
  ACTIF = 'ACTIF',
  RESILIE = 'RESILIE'
}

// ✅ Après (EN)
enum LeaseStatus {
  DRAFT = 'DRAFT',
  SIGNED = 'SIGNED',
  ACTIVE = 'ACTIVE',
  TERMINATED = 'TERMINATED'
}
```

### Colonnes DB (snake_case)
```sql
-- ❌ Avant (FR)
CREATE TABLE biens (
  valeur_actuelle DECIMAL,
  frais_notaire DECIMAL,
  prix_acquisition DECIMAL
);

-- ✅ Après (EN)
CREATE TABLE properties (
  current_value DECIMAL,
  notary_fees DECIMAL,
  purchase_price DECIMAL
);
```

### Routes API (kebab-case ou camelCase pour params)
```typescript
// ❌ Avant (FR)
GET /api/biens/:id/metriques?typeBien=maison

// ✅ Après (EN)
GET /api/properties/:id/metrics?propertyType=house
```

---

## Mots INTERDITS dans les Identifiants

Ces mots NE DOIVENT JAMAIS apparaître comme identifiants dans le code :

- loyer, loyerHC, loyerCC
- bail, baux, bailActif
- locataire, locataires
- bien, biens
- categorie, catégorie
- penalite, pénalité
- revenus, revenu
- depense, dépense, dépenses
- valeurActuelle, valeur_actuelle
- fraisNotaire, frais_notaire
- prixAcquisition, prix_acquisition
- statut (utiliser 'status')
- occupation (OK car identique)
- résidence, residence

---

## Usage i18n pour l'UI

```typescript
// ❌ Avant (texte FR en dur)
<button>Ajouter un bien</button>
<label>Loyer mensuel</label>

// ✅ Après (i18n)
<button>{t('properties.actions.add')}</button>
<label>{t('properties.fields.monthlyRent')}</label>
```

Fichier `locales/fr/properties.json`:
```json
{
  "actions": {
    "add": "Ajouter un bien"
  },
  "fields": {
    "monthlyRent": "Loyer mensuel"
  }
}
```

---

## Outils de Validation

### ESLint
Voir `.eslintrc.js` pour les règles de nommage

### Tests
- `scripts/check-french-identifiers.ts` - Scanne l'AST pour identifiants FR
- CI bloque si identifiants FR détectés

### Pre-commit Hook
```bash
npm run lint:naming  # Vérifie les conventions
```

---

## Migration Checklist

- [ ] Prisma schema renommé
- [ ] Migrations DB générées et testées
- [ ] Repositories mis à jour
- [ ] APIs refactorées
- [ ] Services refactorés
- [ ] Composants UI refactorés
- [ ] Fichiers i18n créés
- [ ] Tests passent
- [ ] ESLint sans warnings
- [ ] Documentation mise à jour



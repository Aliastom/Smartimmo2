# 📋 **Expression de Besoin - Modèle de Domaine et Données**

## 🎯 **Résumé Exécutif**

Ce document présente le modèle de domaine complet de l'application SmartImmo avec les entités principales, leurs relations et les règles d'intégrité. Le modèle est conçu selon les principes du Domain-Driven Design (DDD) pour garantir la cohérence métier et la maintenabilité.

---

## 🏗️ **Modèle de Domaine - Diagramme Conceptuel**

```
┌─────────────────────────────────────────────────────────────────┐
│                         SMARTIMMO DOMAIN MODEL                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │   USER      │◄──►│   PROPERTY  │◄──►│    TENANT   │          │
│  │             │    │             │    │             │          │
│  │ - id        │    │ - id        │    │ - id        │          │
│  │ - email     │    │ - address   │    │ - name      │          │
│  │ - profile   │    │ - type      │    │ - contact   │          │
│  │ - settings  │    │ - surface   │    │ - documents │          │
│  └─────────────┘    │ - value     │    └─────────────┘          │
│                     │ - documents │                            │
│                     └─────────────┘                            │
│                               │                                │
│                               ▼                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │    LEASE    │◄──►│   RENTAL    │◄──►│   EXPENSE   │          │
│  │             │    │  PAYMENT    │    │             │          │
│  │ - id        │    │             │    │ - id        │          │
│  │ - type      │    │ - id        │    │ - amount    │          │
│  │ - tenant    │    │ - amount    │    │ - category  │          │
│  │ - property  │    │ - due_date  │    │ - date      │          │
│  │ - rent      │    │ - status    │    │ - recurring │          │
│  │ - charges   │    │ - property  │    │ - property  │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │    LOAN     │◄──►│ FISCAL_YEAR │◄──►│  TAX_SIMUL  │          │
│  │             │    │             │    │             │          │
│  │ - id        │    │ - id        │    │ - id        │          │
│  │ - bank      │    │ - year      │    │ - user      │          │
│  │ - amount    │    │ - income    │    │ - scenario  │          │
│  │ - rate      │    │ - expenses  │    │ - results   │          │
│  │ - duration  │    │ - tax_regime│    │ - timestamp │          │
│  │ - property  │    └─────────────┘    └─────────────┘          │
│  └─────────────┘                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 **Entités Principales et Attributs**

### **1. User (Utilisateur)**
**Table : users**
```sql
- id: UUID (PK)
- email: VARCHAR(255) UNIQUE
- password_hash: VARCHAR(255)
- first_name: VARCHAR(100)
- last_name: VARCHAR(100)
- phone: VARCHAR(20)
- profile_type: ENUM('individual', 'sci', 'company')
- tax_situation: JSON  -- TMI, parts fiscales, etc.
- settings: JSON       -- Préférences utilisateur
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
- deleted_at: TIMESTAMP (soft delete)
```

### **2. Property (Bien Immobilier)**
**Table : properties**
```sql
- id: UUID (PK)
- user_id: UUID (FK → users.id)
- name: VARCHAR(255)
- type: ENUM('house', 'apartment', 'garage', 'commercial', 'land')
- address: TEXT
- postal_code: VARCHAR(10)
- city: VARCHAR(100)
- surface: DECIMAL(8,2)  -- m²
- rooms: INTEGER
- acquisition_date: DATE
- acquisition_price: DECIMAL(12,2)
- notary_fees: DECIMAL(10,2)
- current_value: DECIMAL(12,2)  -- Valeur estimée actuelle
- dpe_rating: ENUM('A', 'B', 'C', 'D', 'E', 'F', 'G')
- status: ENUM('rented', 'vacant', 'under_works')
- notes: TEXT
- documents: JSON  -- Liste des documents associés
- coordinates: JSON  -- Lat/Lng pour cartes [À VALIDER]
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### **3. Tenant (Locataire)**
**Table : tenants**
```sql
- id: UUID (PK)
- user_id: UUID (FK → users.id)
- first_name: VARCHAR(100)
- last_name: VARCHAR(100)
- email: VARCHAR(255)
- phone: VARCHAR(20)
- birth_date: DATE
- nationality: VARCHAR(50)
- documents: JSON  -- Pièces d'identité, etc.
- notes: TEXT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### **4. Lease (Bail)**
**Table : leases**
```sql
- id: UUID (PK)
- property_id: UUID (FK → properties.id)
- tenant_id: UUID (FK → tenants.id)
- lease_type: ENUM('empty', 'furnished', 'lmnp', 'commercial', 'garage')
- start_date: DATE
- end_date: DATE
- rent_amount: DECIMAL(10,2)     -- Loyer HC mensuel
- charges_amount: DECIMAL(8,2)   -- Charges mensuelles
- deposit_amount: DECIMAL(10,2)  -- Dépôt de garantie
- indexation_type: ENUM('irl', 'none', 'custom')
- indexation_date: DATE
- payment_day: INTEGER  -- Jour du mois pour le paiement
- special_clauses: TEXT
- status: ENUM('active', 'terminated', 'renewed')
- termination_date: DATE
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### **5. RentalPayment (Loyer)**
**Table : rental_payments**
```sql
- id: UUID (PK)
- lease_id: UUID (FK → leases.id)
- amount: DECIMAL(10,2)
- due_date: DATE
- payment_date: DATE
- status: ENUM('pending', 'paid', 'late', 'partial')
- payment_method: ENUM('bank_transfer', 'check', 'cash')
- notes: TEXT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### **6. Expense (Charge/Dépense)**
**Table : expenses**
```sql
- id: UUID (PK)
- property_id: UUID (FK → properties.id)
- lease_id: UUID (FK → leases.id)  -- NULL si charge propriétaire
- amount: DECIMAL(10,2)
- expense_date: DATE
- category: ENUM('tax', 'insurance', 'maintenance', 'works', 'management', 'interest', 'other')
- subcategory: VARCHAR(100)
- is_recurring: BOOLEAN
- recurrence_type: ENUM('monthly', 'quarterly', 'yearly')  -- Si récurrente
- description: TEXT
- is_recoverable: BOOLEAN  -- Récupérable sur locataire
- recovery_percentage: DECIMAL(5,2)  -- % récupéré sur locataire
- supplier: VARCHAR(255)   -- Fournisseur/prestataire
- invoice_number: VARCHAR(100)
- documents: JSON  -- Justificatifs
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### **7. Loan (Prêt Immobilier)**
**Table : loans**
```sql
- id: UUID (PK)
- property_id: UUID (FK → properties.id)
- bank_name: VARCHAR(255)
- loan_amount: DECIMAL(12,2)
- interest_rate: DECIMAL(5,4)  -- Taux d'intérêt (ex: 1.35%)
- insurance_rate: DECIMAL(5,4) -- Taux assurance
- duration_months: INTEGER     -- Durée en mois
- start_date: DATE
- monthly_payment: DECIMAL(10,2)
- remaining_capital: DECIMAL(12,2)  -- Calculé dynamiquement
- status: ENUM('active', 'paid_off', 'refinanced')
- documents: JSON
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### **8. FiscalYear (Année Fiscale)**
**Table : fiscal_years**
```sql
- id: UUID (PK)
- user_id: UUID (FK → users.id)
- year: INTEGER  -- Année fiscale (ex: 2025)
- total_income: DECIMAL(12,2)    -- Revenus totaux
- total_expenses: DECIMAL(12,2)  -- Charges totales
- taxable_income: DECIMAL(12,2)  -- Revenu imposable
- tax_regime: ENUM('micro_foncier', 'regime_reel', 'lmnp_micro', 'lmnp_reel')
- deficit_amount: DECIMAL(10,2)  -- Déficit reportable
- tax_paid: DECIMAL(10,2)       -- IR effectivement payé
- ps_paid: DECIMAL(8,2)         -- Prélèvements sociaux
- status: ENUM('draft', 'finalized', 'filed')
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### **9. TaxSimulation (Simulation Fiscale)**
**Table : tax_simulations**
```sql
- id: UUID (PK)
- user_id: UUID (FK → users.id)
- fiscal_year_id: UUID (FK → fiscal_years.id)
- scenario_name: VARCHAR(255)
- parameters: JSON  -- Tous les paramètres de simulation
- results: JSON     -- Résultats détaillés des calculs
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

---

## 🔗 **Relations et Contraintes d'Intégrité**

### **Clés Étrangères**
- `properties.user_id` → `users.id`
- `tenants.user_id` → `users.id`
- `leases.property_id` → `properties.id`
- `leases.tenant_id` → `tenants.id`
- `rental_payments.lease_id` → `leases.id`
- `expenses.property_id` → `properties.id`
- `expenses.lease_id` → `leases.id` (optionnel)
- `loans.property_id` → `properties.id`
- `fiscal_years.user_id` → `users.id`
- `tax_simulations.user_id` → `users.id`
- `tax_simulations.fiscal_year_id` → `fiscal_years.id`

### **Contraintes de Domaine**
1. **Unicité des baux actifs** : Un bien ne peut avoir qu'un seul bail actif à la fois
2. **Cohérence des dates** : Date de fin bail > date de début
3. **Loyers positifs** : Tous les montants de loyer > 0
4. **Année fiscale valide** : Année entre 2020 et année courante + 1
5. **Valeur résiduelle** : Ne peut être négative pour les prêts
6. **Charges cohérentes** : Les charges d'un bien loué doivent être associées à un bail

### **Indexes de Performance**
```sql
-- Recherche par utilisateur
CREATE INDEX idx_properties_user_id ON properties(user_id);
CREATE INDEX idx_tenants_user_id ON tenants(user_id);
CREATE INDEX idx_leases_property_id ON leases(property_id);
CREATE INDEX idx_leases_tenant_id ON leases(tenant_id);

-- Recherche temporelle
CREATE INDEX idx_rental_payments_due_date ON rental_payments(due_date);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_fiscal_years_year ON fiscal_years(year);

-- Recherche par statut
CREATE INDEX idx_properties_status ON properties(status);
CREATE INDEX idx_leases_status ON leases(status);
CREATE INDEX idx_loans_status ON loans(status);
```

---

## 💾 **Règles de Persistance**

### **Stratégie de Stockage**
- **Base de données** : PostgreSQL 15+ recommandé
- **ORM** : Prisma ORM avec schéma typé
- **Migrations** : Versionnées et rollbackables
- **Sauvegardes** : Automatiques, chiffrées, géo-répliquées

### **Gestion des Documents**
- **Stockage fichiers** : Supabase Storage / AWS S3
- **Métadonnées** : Stockées en JSON dans les tables principales
- **Sécurisation** : Accès contrôlé par utilisateur propriétaire
- **Types supportés** : PDF, images (JPG/PNG), documents (DOC/DOCX)

### **Audit et Traçabilité**
- **Historique des modifications** : Table `audit_logs` pour toutes les entités importantes
- **Utilisateur responsable** : Tracké pour chaque modification
- **Horodatage précis** : Timestamp avec timezone
- **Rétention** : 7 ans pour les données fiscales

---

## 🔄 **Règles Métier d'Intégrité**

### **1. Cohérence Bien-Bail-Locataire**
- Un bail ne peut exister sans propriété et locataire valides
- Un bien ne peut avoir qu'un seul bail actif à un moment donné
- La fin d'un bail rend le bien vacant automatiquement

### **2. Gestion des Loyers**
- Les loyers sont générés automatiquement selon l'échéancier du bail
- Un retard de paiement > 15 jours déclenche une alerte automatique
- Les régularisations de charges annuelles créent des écritures spéciales

### **3. Calculs Fiscaux**
- Les simulations fiscales utilisent les paramètres légaux de l'année concernée
- Les déficits fonciers sont reportés automatiquement sur les années suivantes
- Le régime fiscal optimal est suggéré automatiquement

### **4. Sécurité des Données**
- Seuls les utilisateurs propriétaires peuvent accéder à leurs données
- Les données sensibles (coordonnées locataires) sont chiffrées
- Les exports respectent les règles RGPD (pas de données personnelles non nécessaires)

---

## 📈 **Évolution du Modèle**

### **Extensions Futures**
- **Multi-devises** : Support pour investissements à l'étranger [À VALIDER]
- **Multi-utilisateurs** : Gestion des SCI avec plusieurs associés
- **Intégrations bancaires** : Connexions API aux comptes bancaires
- **Analyse prédictive** : Modèles ML pour prévisions de marché

### **Versionnement des Données**
- **Numéro de version** : Incrémenté à chaque changement de schéma
- **Migrations backward compatibles** : Support des anciennes versions pendant transition
- **Tests de migration** : Validation automatique des changements de schéma


# 📋 **Expression de Besoin - Opérations et Sécurité**

## 🎯 **Résumé Exécutif**

Ce document définit la stratégie opérationnelle et les mesures de sécurité pour l'application SmartImmo. Il couvre le déploiement, la surveillance, la sécurité des données et la conformité RGPD, garantissant une exploitation fiable, sécurisée et conforme aux réglementations.

---

## 🔧 **Configuration Environnementale**

### **1. Variables d'Environnement**

#### **.env.example (Développement)**
```bash
# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME="SmartImmo"

# Authentification
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# Base de données
DATABASE_URL=postgresql://user:password@localhost:5432/smartimmo_dev

# Stockage fichiers
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Services externes
RESEND_API_KEY=re_your_resend_api_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_key

# Monitoring
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Développement
NODE_ENV=development
NEXT_PUBLIC_DEBUG=true
```

#### **Variables de Production (Vercel)**
```bash
# Production (géré automatiquement par Vercel)
# NEXTAUTH_SECRET (généré automatiquement)
# DATABASE_URL (injecté depuis Supabase)
# SUPABASE_* (injecté depuis dashboard Supabase)

# Variables personnalisées
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
SENTRY_ORG=your-sentry-org
SENTRY_PROJECT=your-sentry-project
```

### **2. Scripts NPM**

#### **Development**
```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:e2e": "playwright test"
  }
}
```

#### **Maintenance**
```json
{
  "db:generate": "prisma generate",
  "db:push": "prisma db push",
  "db:seed": "tsx prisma/seed.ts",
  "db:migrate": "prisma migrate dev",
  "db:studio": "prisma studio"
}
```

---

## 🚀 **Déploiement et Infrastructure**

### **1. Stratégie de Déploiement**

#### **Environnement de Développement**
```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: smartimmo_dev
      POSTGRES_USER: smartimmo_user
      POSTGRES_PASSWORD: smartimmo_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```
```bash
# Démarrage développement
docker-compose up -d
npm run dev
```

#### **Production (Vercel)**
```yaml
# vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "src/app/api/**/*.ts": {
      "runtime": "@vercel/node"
    }
  }
}
```

### **2. Pipeline CI/CD**

#### **GitHub Actions**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run type check
        run: npm run type-check

      - name: Run tests
        run: npm run test

      - name: Build application
        run: npm run build

      - name: Deploy to Vercel
        if: github.ref == 'refs/heads/main'
        run: vercel --prod --token ${{ secrets.VERCEL_TOKEN }}
```

---

## 🔒 **Sécurité**

### **1. Authentification et Autorisation**

#### **Configuration NextAuth.js**
```typescript
// src/config/auth.ts
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' }
      },
      async authorize(credentials) {
        // Validation personnalisée
        const user = await validateUserCredentials(credentials);
        return user || null;
      }
    })
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 jours
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.propertyIds = user.propertyIds;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.sub!;
      session.user.role = token.role;
      return session;
    }
  },

  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error'
  }
}
```

#### **Gestion des Rôles**
```typescript
// Types des rôles
type UserRole = 'admin' | 'user' | 'readonly';

// Permissions par rôle
const ROLE_PERMISSIONS = {
  admin: [
    'user:read', 'user:write', 'user:delete',
    'property:read', 'property:write', 'property:delete',
    'system:admin'
  ],
  user: [
    'property:read', 'property:write',
    'tenant:read', 'tenant:write',
    'document:read', 'document:write'
  ],
  readonly: [
    'property:read',
    'report:read'
  ]
} as const;
```

### **2. Chiffrement des Données**

#### **Chiffrement au Repos**
```typescript
// Configuration Prisma
const prismaConfig = {
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  generator: {
    client: {
      binaryTargets: ['native', 'debian-openssl-3.0.x'],
    },
  },
}

// Extension Prisma pour chiffrement
const prisma = new PrismaClient().$extends({
  name: 'encryption',
  query: {
    $allModels: {
      async $allOperations({ operation, args, query }) {
        // Chiffrement automatique des champs sensibles
        if (operation === 'create' || operation === 'update') {
          if (args.data.email) {
            args.data.email = encryptField(args.data.email);
          }
        }

        const result = await query(args);

        // Déchiffrement automatique en lecture
        if (operation === 'findMany' || operation === 'findFirst') {
          if (result.email) {
            result.email = decryptField(result.email);
          }
        }

        return result;
      },
    },
  },
});
```

#### **Chiffrement en Transit**
```typescript
// Configuration HTTPS obligatoire
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          }
        ]
      }
    ]
  }
}
```

### **3. Gestion des Secrets**

#### **Stockage Sécurisé**
```typescript
// Variables d'environnement chiffrées
const SECRETS_CONFIG = {
  'NEXTAUTH_SECRET': {
    'description': 'Clé de signature JWT',
    'generated': true,
    'rotation': '90 jours'
  },
  'DATABASE_URL': {
    'description': 'URL de connexion base de données',
    'encrypted': true,
    'source': 'external'
  },
  'SUPABASE_SERVICE_ROLE_KEY': {
    'description': 'Clé service Supabase',
    'encrypted': true,
    'source': 'external'
  }
}
```

---

## 📊 **Monitoring et Observabilité**

### **1. Métriques d'Application**

#### **Métriques Core Business**
```typescript
// Métriques fonctionnelles
CORE_METRICS = [
  'properties.created',           // Création propriétés
  'properties.updated',           // Modification propriétés
  'leases.created',              // Création baux
  'rental_payments.processed',   // Paiements traités
  'tax_calculations.completed',  // Simulations fiscales
  'reports.generated',           // Rapports générés
  'users.registered',            // Inscriptions utilisateurs
  'users.active_monthly'         // Utilisateurs actifs mensuels
]
```

#### **Métriques Techniques**
```typescript
// Performance et disponibilité
TECH_METRICS = [
  'response_time_p95',           // Temps de réponse 95e percentile
  'error_rate',                  // Taux d'erreur global
  'database_query_time',         // Temps requêtes DB
  'cache_hit_rate',              // Taux de succès cache
  'memory_usage',                // Utilisation mémoire
  'disk_usage',                  // Utilisation disque
  'uptime_percentage'            // Disponibilité
]
```

### **2. Alertes et Notifications**

#### **Configuration Sentry**
```typescript
// sentry.client.config.js
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Capture des erreurs React
  integrations: [
    new Sentry.Replay(),
    new Sentry.BrowserTracing({
      tracePropagationTargets: ['localhost', 'smartimmo.fr'],
    }),
  ],

  // Filtres des erreurs
  beforeSend(event) {
    // Ne pas envoyer les erreurs de développement
    if (process.env.NODE_ENV === 'development') {
      return null;
    }

    // Filtrer les erreurs non critiques
    if (event.exception?.values?.[0]?.value?.includes('Network Error')) {
      return null;
    }

    return event;
  },
});
```

#### **Alertes Critiques**
```typescript
// Configuration des alertes
CRITICAL_ALERTS = {
  'database_down': {
    'channels': ['slack', 'email', 'sms'],
    'threshold': '5 minutes',
    'escalation': '15 minutes'
  },
  'high_error_rate': {
    'channels': ['slack'],
    'threshold': '5%',
    'duration': '10 minutes'
  },
  'security_breach': {
    'channels': ['email', 'sms', 'phone'],
    'threshold': 'immediate',
    'escalation': 'immediate'
  }
}
```

### **3. Logs Structurés**

#### **Configuration Winston**
```typescript
// src/lib/logger.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),

  defaultMeta: { service: 'smartimmo-api' },

  transports: [
    // Fichier local (développement)
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    }),

    // Console (développement uniquement)
    ...(process.env.NODE_ENV !== 'production'
      ? [new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })]
      : []
    )
  ],
});
```

---

## 📋 **Conformité RGPD**

### **1. Registre des Traitements**

#### **Traitements Principaux**
```typescript
// Registre RGPD
GDPR_REGISTER = [
  {
    'purpose': 'Gestion du compte utilisateur',
    'lawful_basis': 'consent',
    'data_categories': ['email', 'nom', 'prénom', 'téléphone'],
    'retention_period': 'durée du compte + 3 ans',
    'recipients': ['hébergeur', 'support technique']
  },
  {
    'purpose': 'Gestion des biens immobiliers',
    'lawful_basis': 'contract',
    'data_categories': ['adresse', 'surface', 'valeur', 'documents'],
    'retention_period': 'durée propriété + 10 ans',
    'recipients': ['notaire', 'expert-comptable']
  },
  {
    'purpose': 'Gestion des locataires',
    'lawful_basis': 'contract',
    'data_categories': ['nom', 'coordonnées', 'pièce identité', 'revenus'],
    'retention_period': 'durée bail + 5 ans',
    'recipients': ['assureur', 'agence immobilière']
  }
]
```

### **2. Droits des Personnes**

#### **Interface Utilisateur RGPD**
```typescript
// Section paramètres utilisateur
<GDPRSettings>
  <DataExportButton />        {/* Téléchargement données personnelles */}
  <DataDeletionButton />      {/* Suppression compte et données */}
  <ConsentManagement />       {/* Gestion des consentements */}
  <DataRetentionInfo />       {/* Informations rétention données */}
  <ContactDPODialog />       {/* Contact DPO */}
</GDPRSettings>
```

#### **Gestion des Consentements**
```typescript
// Types de consentement
CONSENT_TYPES = [
  'newsletter_marketing',      // Newsletter marketing
  'product_improvement',       // Amélioration produit
  'third_party_sharing',       // Partage tiers anonymisé
  'cookies_analytics',         // Cookies analytics
  'cookies_marketing'          // Cookies marketing
]

// Interface de gestion
const ConsentManager = () => {
  const { consents, updateConsent } = useGDPR();

  return (
    <div className="space-y-4">
      {CONSENT_TYPES.map(type => (
        <ConsentToggle
          key={type}
          type={type}
          currentValue={consents[type]}
          onChange={updateConsent}
        />
      ))}
    </div>
  );
}
```

### **3. Sécurité des Données Locataires**

#### **Chiffrement Spécialisé**
```typescript
// Données particulièrement sensibles
SENSITIVE_DATA_FIELDS = [
  'tenant_identity_documents',    // Pièces d'identité
  'tenant_bank_details',          // Coordonnées bancaires
  'tenant_income_proofs',         // Justificatifs de revenus
  'tenant_personal_info'          // Informations personnelles
]

// Chiffrement renforcé
const encryptSensitiveData = (data: any) => {
  return AES256.encrypt(JSON.stringify(data), process.env.ENCRYPTION_KEY);
}

const decryptSensitiveData = (encryptedData: string) => {
  return JSON.parse(AES256.decrypt(encryptedData, process.env.ENCRYPTION_KEY));
}
```

---

## 🔄 **Sauvegardes et Continuité**

### **1. Stratégie de Sauvegarde**

#### **Base de Données**
```yaml
# Configuration PostgreSQL
backup:
  frequency: 'daily'
  retention: '30 days'
  encryption: true
  compression: true
  destination: 'multiple-regions'

# Script de sauvegarde automatique
backup-script.sh:
  #!/bin/bash
  pg_dump smartimmo_production \
    --encrypt \
    --compress \
    | gpg --encrypt --recipient backup@smartimmo.fr \
    | aws s3 cp - s3://smartimmo-backups/$(date +%Y%m%d).sql.gpg
```

#### **Fichiers (Supabase Storage)**
```typescript
// Sauvegarde automatique fichiers
const backupStorage = async () => {
  const files = await supabase.storage.from('documents').list();

  for (const file of files) {
    const { data } = await supabase.storage
      .from('documents')
      .download(file.name);

    await backupS3.upload(`documents/${file.name}`, data);
  }
}
```

### **2. Plan de Reprise d'Activité (PRA)**

#### **Scénarios de Crise**
```typescript
DISASTER_RECOVERY = {
  'database_failure': {
    'detection': 'monitoring automatique',
    'failover': 'base de secours en lecture',
    'recovery': 'restauration dernière sauvegarde',
    'rto': '4 heures',           // Recovery Time Objective
    'rpo': '1 heure'             // Recovery Point Objective
  },
  'application_failure': {
    'detection': 'monitoring santé applicatif',
    'failover': 'déploiement version précédente',
    'recovery': 'correction bug + redéploiement',
    'rto': '1 heure',
    'rpo': '5 minutes'
  }
}
```

---

## 🛠️ **Maintenance et Support**

### **1. Scripts de Maintenance**

#### **Nettoyage Automatique**
```typescript
// Script nettoyage quotidien
const cleanupScript = async () => {
  // Suppression anciens logs
  await deleteLogsOlderThan('30 days');

  // Archivage anciens backups
  await archiveBackupsOlderThan('90 days');

  // Nettoyage fichiers temporaires
  await cleanupTempFiles();

  // Optimisation base de données
  await optimizeDatabaseIndexes();
}
```

#### **Mises à Jour de Sécurité**
```bash
# Script mise à jour sécurité
update-security.sh:
  #!/bin/bash

  # Mise à jour dépendances
  npm audit fix --audit-level high

  # Mise à jour système
  sudo apt update && sudo apt upgrade -y

  # Rotation certificats SSL
  certbot renew

  # Test sécurité rapide
  npm run security-test
```

### **2. Support et Documentation**

#### **Documentation Technique**
```markdown
docs/
├── technical/
│   ├── api-reference.md        # Documentation API
│   ├── database-schema.md      # Schéma base de données
│   ├── deployment-guide.md     # Guide déploiement
│   └── troubleshooting.md      # Guide dépannage
├── user/
│   ├── user-guide.md           # Guide utilisateur
│   ├── faq.md                  # FAQ
│   └── video-tutorials/        # Tutoriels vidéo
└── developer/
    ├── contribution-guide.md   # Guide contribution
    ├── coding-standards.md    # Standards code
    └── api-examples.md         # Exemples API
```

---

## 📞 **Support et Communication**

### **1. Centre de Support**
```typescript
// Intégration Intercom/Zendesk
SUPPORT_CONFIG = {
  'intercom': {
    'app_id': 'your-intercom-app-id',
    'enabled': process.env.NODE_ENV === 'production'
  },
  'zendesk': {
    'subdomain': 'smartimmo',
    'enabled': true
  }
}
```

### **2. Communications Utilisateurs**

#### **Emails Transactionnels (Resend)**
```typescript
// Templates email
EMAIL_TEMPLATES = [
  'welcome',              // Email bienvenue
  'password_reset',       // Réinitialisation mot de passe
  'payment_reminder',     // Rappel paiement
  'lease_expiry',         // Échéance bail
  'tax_report_ready',     // Rapport fiscal prêt
  'maintenance_reminder'  // Rappel maintenance
]

// Configuration Resend
const resendConfig = {
  apiKey: process.env.RESEND_API_KEY,
  from: 'SmartImmo <noreply@smartimmo.fr>',
  templates: EMAIL_TEMPLATES
}
```

Cette configuration opérationnelle garantit une exploitation fiable, sécurisée et conforme pour l'application SmartImmo.


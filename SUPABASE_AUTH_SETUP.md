# Configuration Supabase Auth

## Variables d'environnement requises

Ajoutez ces variables dans votre fichier `.env` (local) et sur Vercel (production) :

```bash
# Supabase - URL de votre projet
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co

# Supabase - Clé publique (anon key)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase - Clé service role (JAMAIS exposer côté client)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# URL de l'application (pour les redirections)
NEXT_PUBLIC_APP_URL=http://localhost:3000  # en local
# NEXT_PUBLIC_APP_URL=https://smartimmo2.vercel.app  # en production
```

## Configuration sur Vercel

1. Aller dans votre projet Vercel > Settings > Environment Variables
2. Ajouter les variables ci-dessus pour tous les environnements (Production, Preview, Development)

## Configuration Supabase Dashboard

1. Aller dans votre projet Supabase > Authentication > URL Configuration
2. Ajouter les URLs de redirection autorisées :
   - `http://localhost:3000/auth/callback` (développement)
   - `https://smartimmo2.vercel.app/auth/callback` (production)

3. Configurer l'email provider (Authentication > Providers) :
   - Activer Email provider
   - Choisir "Magic Link" comme méthode

## Test local

1. Assurez-vous que PostgreSQL local tourne
2. Appliquez la migration : `npx prisma migrate deploy`
3. Démarrez l'app : `npm run dev`
4. Allez sur : http://localhost:3000/login
5. Entrez votre email et cliquez sur "Envoyer le lien"
6. Vérifiez votre boîte mail et cliquez sur le lien
7. Vous devriez être redirigé vers `/dashboard`

## Structure des fichiers créés

```
src/
├── lib/
│   ├── env.ts                    # Variables d'environnement
│   ├── supabase.ts               # Clients Supabase (browser + server)
│   └── auth/
│       └── getCurrentUser.ts     # Helper d'authentification
├── app/
│   ├── login/
│   │   ├── page.tsx              # Page de connexion
│   │   └── LoginForm.tsx         # Formulaire de login
│   └── auth/
│       ├── callback/
│       │   └── route.ts          # Callback après magic link
│       └── logout/
│           └── route.ts          # Route de déconnexion
├── components/
│   └── auth/
│       └── LogoutButton.tsx      # Bouton de déconnexion réutilisable
└── middleware.ts                 # Protection des routes
```

## Utilisation dans l'app

### Dans un composant client

```tsx
'use client';

import { LogoutButton } from '@/components/auth/LogoutButton';

export function Header() {
  return (
    <header>
      <LogoutButton />
    </header>
  );
}
```

### Dans un Server Component

```tsx
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { redirect } from 'next/navigation';

export default async function ProtectedPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }
  
  return (
    <div>
      <h1>Bienvenue {user.name}</h1>
      <p>Email: {user.email}</p>
      <p>Rôle: {user.role}</p>
    </div>
  );
}
```

### Dans une API Route

```tsx
import { requireAuth, requireAdmin } from '@/lib/auth/getCurrentUser';

export async function GET() {
  const user = await requireAuth(); // Throw si non authentifié
  
  // ... votre logique
}

export async function POST() {
  const user = await requireAdmin(); // Throw si pas admin
  
  // ... votre logique admin
}
```

## Sécurité

- ✅ Le middleware protège automatiquement toutes les routes sauf `/login` et `/auth/callback`
- ✅ La clé service role n'est jamais exposée côté client
- ✅ Les cookies de session sont gérés de manière sécurisée par Supabase SSR
- ✅ Les utilisateurs sont synchronisés avec Prisma pour conserver le système de rôles

## Migration de la base de données

La migration suivante a été créée et appliquée :

```sql
-- AlterTable
ALTER TABLE "User" ADD COLUMN "supabaseId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseId_key" ON "User"("supabaseId");
```

Cette migration est compatible avec les données existantes (colonne nullable).


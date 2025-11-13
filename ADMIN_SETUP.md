# Configuration des Administrateurs

## 🔐 Promouvoir un utilisateur en ADMIN

### Méthode 1 : Via Prisma Studio (Recommandée)

```bash
# Lancer Prisma Studio
npm run db:studio
```

Puis :
1. Ouvrir le modèle `User`
2. Trouver l'utilisateur par email
3. Changer le champ `role` de `USER` à `ADMIN`
4. Sauvegarder

### Méthode 2 : Via SQL direct

Connectez-vous à votre base Supabase et exécutez :

```sql
-- Promouvoir un utilisateur par email
UPDATE "User" 
SET role = 'ADMIN' 
WHERE email = 'votre-email@exemple.com';
```

### Méthode 3 : Via un script de seed

Créez un fichier `prisma/seed-admin.ts` :

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'votre-email@exemple.com'; // ⚠️ CHANGEZ CETTE VALEUR
  
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN' },
    create: {
      email: adminEmail,
      name: 'Admin',
      role: 'ADMIN',
    },
  });
  
  console.log('✅ Admin créé/mis à jour:', admin);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Puis exécutez :

```bash
npx tsx prisma/seed-admin.ts
```

## 🛡️ Protection des routes d'administration

### Routes API Admin

Toutes les routes sous `/api/admin/*` doivent être protégées avec `protectAdminRoute()` :

```typescript
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';

export async function GET() {
  // Vérifier que l'utilisateur est ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;
  
  // Logique admin ici
}
```

### Pages Admin

Les pages admin peuvent vérifier le rôle dans le Server Component :

```typescript
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { redirect } from 'next/navigation';

export default async function AdminPage() {
  const user = await getCurrentUser();
  
  if (!user || user.role !== 'ADMIN') {
    redirect('/dashboard');
  }
  
  // Rendu de la page admin
}
```

## 📋 Vérification de la configuration

### 1. Vérifier qu'un admin existe

```sql
SELECT id, email, name, role, "supabaseId", "createdAt" 
FROM "User" 
WHERE role = 'ADMIN';
```

### 2. Lister tous les utilisateurs

```sql
SELECT id, email, name, role, "emailVerified", "supabaseId" 
FROM "User" 
ORDER BY "createdAt" DESC;
```

### 3. Promouvoir le premier utilisateur en admin

Si aucun admin n'existe encore :

```sql
UPDATE "User" 
SET role = 'ADMIN' 
WHERE id = (
  SELECT id FROM "User" 
  ORDER BY "createdAt" ASC 
  LIMIT 1
);
```

## ⚠️ Important

- **Ne jamais supprimer le dernier ADMIN** : Gardez toujours au moins 1 admin actif
- **Email vérifié** : Seuls les utilisateurs qui se sont connectés via Supabase Auth peuvent être promus admin
- **Supabase ID** : Si un utilisateur a un `supabaseId`, il pourra se connecter via magic link. Si non, il devra d'abord se connecter pour que le champ soit rempli.

## 🔧 Auto-promotion (Optionnel - À utiliser avec précaution)

Pour auto-promouvoir votre email lors de la création, éditez `src/app/auth/callback/route.ts` :

```typescript
// Nouvel utilisateur : créer l'enregistrement
const ADMIN_EMAILS = ['thomas@exemple.com']; // ⚠️ CHANGEZ CETTE VALEUR

prismaUser = await prisma.user.create({
  data: {
    supabaseId: user.id,
    email: user.email,
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'Utilisateur',
    emailVerified: new Date(),
    // Auto-promouvoir en ADMIN si l'email correspond
    role: ADMIN_EMAILS.includes(user.email) ? 'ADMIN' : 'USER',
  },
});
```

⚠️ **À faire uniquement en développement ou pour votre premier compte**


# ✅ Checklist de Tests - Authentification Supabase

## 🏠 Tests en LOCAL (http://localhost:3000)

### Pré-requis
- [ ] Base de données PostgreSQL locale en cours d'exécution
- [ ] Migration appliquée : `npx prisma migrate deploy`
- [ ] Variables d'environnement configurées dans `.env` :
  ```bash
  NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
  SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
  DATABASE_URL=postgresql://...
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  ```
- [ ] Serveur démarré : `npm run dev`

### Test 1 : Connexion avec Magic Link
- [ ] Aller sur http://localhost:3000/login
- [ ] Entrer votre email
- [ ] Cliquer sur "Envoyer le lien de connexion"
- [ ] ✅ Message de succès affiché
- [ ] Vérifier votre boîte email
- [ ] Cliquer sur le lien magique reçu
- [ ] ✅ Redirection vers `/dashboard` (ou page principale)
- [ ] ✅ Vous êtes connecté

### Test 2 : Protection des routes
- [ ] **Sans être connecté**, essayer d'accéder à :
  - [ ] http://localhost:3000/dashboard → ✅ Redirigé vers `/login`
  - [ ] http://localhost:3000/biens → ✅ Redirigé vers `/login`
  - [ ] http://localhost:3000/transactions → ✅ Redirigé vers `/login`
- [ ] **Connecté**, accéder à :
  - [ ] http://localhost:3000/dashboard → ✅ Page accessible
  - [ ] http://localhost:3000/biens → ✅ Page accessible

### Test 3 : Synchronisation Supabase ↔ Prisma
- [ ] Ouvrir Prisma Studio : `npm run db:studio`
- [ ] Aller dans le modèle `User`
- [ ] Trouver votre utilisateur par email
- [ ] ✅ Vérifier que le champ `supabaseId` est rempli (commence par `00000000-...`)
- [ ] ✅ Vérifier que `role` = `USER` (par défaut)
- [ ] ✅ Vérifier que `emailVerified` est rempli

### Test 4 : Déconnexion
- [ ] Ajouter le `LogoutButton` dans votre header/navbar
- [ ] Cliquer sur "Déconnexion"
- [ ] ✅ Redirection vers `/login`
- [ ] Essayer d'accéder à une page protégée → ✅ Redirigé vers `/login`

### Test 5 : Rôle ADMIN
- [ ] Via Prisma Studio, promouvoir votre user en ADMIN
- [ ] Se déconnecter puis se reconnecter
- [ ] Accéder à une route admin : http://localhost:3000/api/admin/users
- [ ] ✅ Données retournées (pas d'erreur 403)
- [ ] Promouvoir un autre user en USER (via Prisma Studio)
- [ ] Se connecter avec ce user
- [ ] Essayer d'accéder à `/api/admin/users` → ✅ Erreur 403 (Accès réservé aux administrateurs)

### Test 6 : Nouveaux utilisateurs
- [ ] Se déconnecter
- [ ] Se connecter avec un nouvel email (jamais utilisé)
- [ ] ✅ Compte créé automatiquement dans Prisma
- [ ] Vérifier dans Prisma Studio que :
  - [ ] ✅ `supabaseId` est rempli
  - [ ] ✅ `role` = `USER`
  - [ ] ✅ `email` et `emailVerified` sont corrects

---

## ☁️ Tests en PRODUCTION (Vercel)

### Pré-requis
- [ ] Variables d'environnement configurées sur Vercel :
  ```
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  DATABASE_URL (Supabase Postgres)
  NEXT_PUBLIC_APP_URL=https://smartimmo2.vercel.app
  ```
- [ ] URLs de redirection configurées dans Supabase Dashboard :
  - [ ] `https://smartimmo2.vercel.app/auth/callback`
- [ ] Déploiement Vercel réussi
- [ ] Migration Prisma appliquée sur la base Supabase : 
  ```bash
  npx prisma migrate deploy --preview-feature
  ```
  OU via Supabase SQL Editor

### Test 1 : Connexion en production
- [ ] Aller sur https://smartimmo2.vercel.app/login
- [ ] Entrer votre email
- [ ] Cliquer sur "Envoyer le lien de connexion"
- [ ] ✅ Message de succès affiché
- [ ] Vérifier votre email
- [ ] Cliquer sur le lien magique
- [ ] ✅ Redirection vers le dashboard
- [ ] ✅ Vous êtes connecté

### Test 2 : Protection des routes en prod
- [ ] **Sans être connecté** :
  - [ ] https://smartimmo2.vercel.app/dashboard → ✅ Redirigé vers `/login`
  - [ ] https://smartimmo2.vercel.app/biens → ✅ Redirigé vers `/login`
- [ ] **Connecté** :
  - [ ] Pages accessibles normalement ✅

### Test 3 : Vérification en base Supabase
- [ ] Ouvrir Supabase Dashboard → Table Editor → Table `User`
- [ ] Vérifier que votre utilisateur a :
  - [ ] ✅ `supabaseId` rempli
  - [ ] ✅ `role` = `USER` ou `ADMIN`
  - [ ] ✅ `email` correct
  - [ ] ✅ `emailVerified` rempli

### Test 4 : Déconnexion en prod
- [ ] Cliquer sur le bouton de déconnexion
- [ ] ✅ Redirection vers `/login`
- [ ] ✅ Session terminée

### Test 5 : Routes ADMIN en prod
- [ ] Promouvoir votre user en ADMIN (via Supabase SQL Editor)
- [ ] Se déconnecter puis se reconnecter
- [ ] Accéder à `/admin/users` (ou autre page admin)
- [ ] ✅ Page accessible
- [ ] Avec un compte USER, essayer d'accéder → ✅ Bloqué

---

## 🐛 Tests de Sécurité

### Vérifications importantes

- [ ] **Secrets non exposés** :
  - [ ] Inspecter le code source dans le navigateur
  - [ ] ✅ `SUPABASE_SERVICE_ROLE_KEY` n'apparaît JAMAIS
  - [ ] ✅ `DATABASE_URL` n'apparaît JAMAIS
  - [ ] ✅ Seuls `NEXT_PUBLIC_*` sont visibles

- [ ] **Routes API protégées** :
  - [ ] Sans auth, appeler `/api/admin/users` → ✅ Erreur 401
  - [ ] Avec auth USER, appeler `/api/admin/users` → ✅ Erreur 403
  - [ ] Avec auth ADMIN, appeler `/api/admin/users` → ✅ Données retournées

- [ ] **Middleware actif** :
  - [ ] Ouvrir DevTools > Network
  - [ ] Accéder à une page protégée sans auth
  - [ ] ✅ Redirection 307 vers `/login`

---

## 🔧 Commandes utiles

### Vérifier les utilisateurs en base

```sql
-- Lister tous les users
SELECT id, email, name, role, "supabaseId", "emailVerified", "createdAt" 
FROM "User" 
ORDER BY "createdAt" DESC;

-- Compter les admins
SELECT COUNT(*) as admin_count 
FROM "User" 
WHERE role = 'ADMIN';

-- Promouvoir en ADMIN
UPDATE "User" 
SET role = 'ADMIN' 
WHERE email = 'votre-email@exemple.com';
```

### Réinitialiser un compte (développement uniquement)

```sql
-- Supprimer un user de test
DELETE FROM "User" WHERE email = 'test@exemple.com';
```

---

## 📊 Résumé des Rôles

| Rôle | Accès | Permissions |
|------|-------|-------------|
| **USER** | Pages standard | Biens, Baux, Transactions, Documents, Dashboard |
| **ADMIN** | Tout + Admin | USER + Gestion utilisateurs, Paramètres fiscaux, Configuration système |

---

## ⚠️ Troubleshooting

### "Non authentifié" même après connexion
- Vérifier que les cookies Supabase sont bien définis
- Vider le cache du navigateur
- Vérifier que `NEXT_PUBLIC_APP_URL` correspond à l'URL actuelle

### "Accès réservé aux administrateurs"
- Vérifier votre rôle en base : `SELECT role FROM "User" WHERE email = 'votre-email@exemple.com'`
- Promouvoir en ADMIN si nécessaire

### Magic link ne fonctionne pas
- Vérifier que l'URL de redirection est configurée dans Supabase Dashboard
- Vérifier que `NEXT_PUBLIC_APP_URL` est correctement défini
- Vérifier les logs Supabase pour voir les emails envoyés

### Build Vercel échoue
- Vérifier que toutes les variables d'environnement sont définies
- Vérifier que la migration est appliquée sur la base Supabase
- Consulter les logs de build pour les erreurs spécifiques


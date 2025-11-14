# ✅ Checklist de Tests - Authentification Supabase

## 🧪 Tests Locaux (Développement)

### 1. Configuration Initiale
- [ ] Vérifier que `.env.local` contient toutes les variables Supabase :
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (optionnel, pour admin)
  - `DATABASE_URL` (avec Session Pooler)
  - `DIRECT_URL` (avec Direct Connection)

- [ ] Vérifier que la base de données locale est à jour :
  ```bash
  npx prisma migrate dev
  npx prisma db push
  ```

### 2. Test de Connexion / Déconnexion

#### 2.1 Première Connexion (Premier Utilisateur = ADMIN)
- [ ] Ouvrir `http://localhost:3000`
- [ ] Vérifier la redirection automatique vers `/login`
- [ ] Entrer une adresse email valide
- [ ] Cliquer sur "Envoyer le lien magique"
- [ ] Vérifier le message de succès : "Un lien de connexion t'a été envoyé par email !"
- [ ] Ouvrir l'email et cliquer sur le lien magique
- [ ] Vérifier la redirection vers `/dashboard`
- [ ] **Vérifier que le premier utilisateur est automatiquement ADMIN** :
  - Vérifier l'icône bouclier (Shield) sur l'avatar dans la Sidebar
  - Accéder à `/admin` (doit fonctionner)
  - Consulter la base de données : `SELECT * FROM "User" WHERE role = 'ADMIN';`

#### 2.2 Connexion Utilisateur Classique (USER)
- [ ] Se déconnecter
- [ ] Se connecter avec un autre email
- [ ] Vérifier que ce deuxième utilisateur a le rôle `USER`
- [ ] Vérifier qu'il ne peut PAS accéder à `/admin` (redirection vers `/dashboard`)

#### 2.3 Déconnexion
- [ ] Vérifier la présence du bouton "Déconnexion" dans la Topbar (en haut à droite)
- [ ] Cliquer sur le bouton de déconnexion
- [ ] Vérifier la redirection vers `/login`
- [ ] Vérifier qu'on ne peut plus accéder à `/dashboard` (redirection vers `/login`)

#### 2.4 Connexion Google
- [ ] Sur `/login`, cliquer sur "Continuer avec Google"
- [ ] Choisir un compte Google autorisé
- [ ] Vérifier la redirection automatique vers `/dashboard`
- [ ] Confirmer que le compte est synchronisé dans la table `User` (supabaseId rempli)
- [ ] Vérifier la déconnexion après connexion Google

### 3. Protection des Routes

#### 3.1 Routes Publiques (sans authentification)
- [ ] `/login` - accessible sans connexion
- [ ] `/auth/callback` - accessible sans connexion (callback après magic link)

#### 3.2 Routes Protégées (authentification requise)
- [ ] `/dashboard` - accessible uniquement si connecté
- [ ] `/biens` - accessible uniquement si connecté
- [ ] `/locataires` - accessible uniquement si connecté
- [ ] `/transactions` - accessible uniquement si connecté
- [ ] `/documents` - accessible uniquement si connecté
- [ ] Toutes les routes doivent rediriger vers `/login` si non authentifié

#### 3.3 Routes ADMIN (authentification + rôle ADMIN requis)
- [ ] `/admin` - accessible uniquement pour les ADMIN
- [ ] `/admin/users` - accessible uniquement pour les ADMIN
- [ ] `/admin/categories` - accessible uniquement pour les ADMIN
- [ ] `/admin/documents/types` - accessible uniquement pour les ADMIN
- [ ] `/admin/impots/parametres` - accessible uniquement pour les ADMIN
- [ ] `/admin/nature-mapping` - accessible uniquement pour les ADMIN
- [ ] `/admin/natures-categories` - accessible uniquement pour les ADMIN
- [ ] `/admin/signals` - accessible uniquement pour les ADMIN
- [ ] Les utilisateurs USER doivent être redirigés vers `/dashboard`

### 4. API Routes

#### 4.1 API Publiques (sans authentification)
- [ ] `/api/ocr` - accessible sans authentification (si configuré)

#### 4.2 API Protégées (authentification requise)
- [ ] `/api/auth/me` - retourne les infos de l'utilisateur connecté
- [ ] `/api/auth/logout` - déconnecte l'utilisateur
- [ ] Toutes les autres API sous `/api/*` (sauf `/api/auth/` et `/api/ocr`)

#### 4.3 API ADMIN (authentification + rôle ADMIN requis)
- [ ] `GET /api/admin/users` - retourne la liste des utilisateurs
- [ ] `POST /api/admin/users` - crée un utilisateur
- [ ] Vérifier le code de réponse `403` pour les utilisateurs USER

### 5. Affichage Utilisateur

#### 5.1 Sidebar
- [ ] Vérifier l'affichage de l'avatar en bas de la Sidebar
- [ ] Vérifier l'affichage du nom de l'utilisateur
- [ ] Vérifier l'affichage de l'email
- [ ] Vérifier le badge "Shield" pour les ADMIN
- [ ] Vérifier le comportement en mode Sidebar réduite (emoji 👤)

#### 5.2 Topbar
- [ ] Vérifier la présence du bouton "Déconnexion" avec icône
- [ ] Vérifier que le bouton fonctionne correctement

### 6. Middleware

#### 6.1 Protection Globale
- [ ] Vérifier que toutes les routes (sauf `/login`, `/auth/callback`, `/auth/logout`, `/_next/*`, `/favicon.ico`) nécessitent une authentification
- [ ] Tester l'accès direct à une route protégée sans être connecté
- [ ] Vérifier la redirection vers `/login?redirect=<route_demandée>`
- [ ] Après connexion, vérifier la redirection vers la route initialement demandée

#### 6.2 API Routes
- [ ] Vérifier que les API routes sont protégées par le middleware
- [ ] Tester `/api/accounting-categories` sans authentification (doit retourner 401 ou rediriger)

---

## 🌍 Tests Production (Vercel)

### 1. Configuration Vercel

#### 1.1 Variables d'Environnement
- [ ] Vérifier que toutes les variables sont configurées dans Vercel :
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `DATABASE_URL` - **Utiliser Session Pooler** :
    ```
    postgresql://postgres.lvythpofldjkoupgflce:L%40utho02171217@aws-1-eu-west-1.pooler.supabase.com:5432/postgres
    ```
  - `DIRECT_URL` - **Utiliser Direct Connection** :
    ```
    postgresql://postgres.lvythpofldjkoupgflce:L%40utho02171217@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
    ```
  - `NEXT_PUBLIC_APP_URL` - URL de production (ex: `https://smartimmo2.vercel.app`)

#### 1.2 Base de Données Supabase
- [ ] Vérifier que toutes les tables sont créées (exécuter `setup-supabase-complete.sql` dans le SQL Editor)
- [ ] Vérifier la présence du champ `supabaseId` dans la table `User`
- [ ] Vérifier que le mot de passe dans `DATABASE_URL` est URL-encodé (caractères spéciaux comme `@` → `%40`)

### 2. Tests de Connexion en Production

#### 2.1 Premier Utilisateur (ADMIN)
- [ ] Ouvrir `https://smartimmo2.vercel.app`
- [ ] Se connecter avec un email
- [ ] Vérifier la réception de l'email Supabase Auth
- [ ] Cliquer sur le lien magique
- [ ] Vérifier la redirection vers `/dashboard`
- [ ] Vérifier que l'utilisateur est ADMIN (accès à `/admin`)
- [ ] Vérifier les logs Vercel pour toute erreur :
  ```
  [Auth Callback] Utilisateur Supabase: {...}
  [Auth Callback] Premier utilisateur créé en tant qu'ADMIN: ...
  ```

#### 2.2 Utilisateurs Suivants (USER)
- [ ] Se connecter avec un autre email
- [ ] Vérifier que le rôle est `USER`
- [ ] Vérifier qu'on ne peut PAS accéder à `/admin`

#### 2.3 Déconnexion
- [ ] Cliquer sur "Déconnexion" dans la Topbar
- [ ] Vérifier la redirection vers `/login`

#### 2.4 Connexion Google
- [ ] Cliquer sur "Continuer avec Google" sur `https://smartimmo2.vercel.app/login`
- [ ] Confirmer que la fenêtre OAuth s'ouvre sans erreur
- [ ] Vérifier l'arrivée sur `/dashboard` après validation
- [ ] Vérifier la création/maj de l'utilisateur Prisma correspondant

### 3. Protection des Routes en Production

#### 3.1 Routes Protégées
- [ ] Tester l'accès direct à `/dashboard` sans être connecté → doit rediriger vers `/login`
- [ ] Tester l'accès direct à `/biens` sans être connecté → doit rediriger vers `/login`
- [ ] Tester l'accès direct à `/admin` sans être connecté → doit rediriger vers `/login`
- [ ] Tester l'accès à `/admin` en tant que USER → doit rediriger vers `/dashboard`

#### 3.2 API Routes en Production
- [ ] Tester `GET /api/auth/me` sans authentification → doit retourner 401
- [ ] Tester `GET /api/admin/users` sans authentification → doit retourner 401
- [ ] Tester `GET /api/admin/users` en tant que USER → doit retourner 403

### 4. Debugging des Erreurs

#### 4.1 Erreur "callback_error"
- [ ] Vérifier les logs Vercel pour identifier la cause :
  - `Can't reach database server` → Vérifier `DATABASE_URL` (utiliser Session Pooler)
  - `Authentication failed` → Vérifier le mot de passe (URL encoding)
  - `Invalid prisma.user.findFirst()` → Vérifier que les tables existent

#### 4.2 Erreur "No session"
- [ ] Vérifier que `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` sont configurées
- [ ] Vérifier que les cookies Supabase sont bien créés (inspecter dans DevTools → Application → Cookies)

#### 4.3 Erreur "Max serverless function size"
- [ ] Vérifier que `.vercelignore` contient :
  ```
  qdrant_storage/
  uploads/
  public/uploads/
  storage/
  .git/
  backups/
  scripts/openfisca-openapi.json
  .next/cache/
  ```
- [ ] Vérifier que `next.config.mjs` contient `config.cache = false` pour Vercel
- [ ] Faire un "Redeploy" avec "Clear Build Cache" sur Vercel

### 5. Logs à Surveiller

#### 5.1 Logs Positifs (Succès)
```
[Auth Callback] Utilisateur Supabase: { id: '...', email: '...' }
[Auth Callback] Création d'un nouvel utilisateur
[Auth Callback] Utilisateur créé: ...
🎉 [Auth Callback] Premier utilisateur créé en tant qu'ADMIN: ...
```

#### 5.2 Logs d'Erreur (à Résoudre)
```
[Auth Callback] Code manquant
[Auth Callback] Erreur session: ...
[Auth Callback] Email manquant
[Auth Callback] Erreur complète: ...
```

---

## 🔥 Checklist Rapide (TL;DR)

### Local
- [ ] Variables `.env.local` configurées
- [ ] Base de données migrée (`prisma migrate dev`)
- [ ] Connexion avec email → Vérifier magic link
- [ ] Premier utilisateur = ADMIN automatiquement
- [ ] Déconnexion fonctionne
- [ ] Routes protégées redirigent vers `/login`
- [ ] Routes `/admin` accessibles uniquement pour ADMIN

### Production (Vercel)
- [ ] Variables Vercel configurées (surtout `DATABASE_URL` avec Session Pooler et `%40` pour `@`)
- [ ] Tables créées sur Supabase (`setup-supabase-complete.sql`)
- [ ] Connexion en production fonctionne
- [ ] Premier utilisateur = ADMIN
- [ ] Routes protégées fonctionnent
- [ ] Logs Vercel sans erreur
- [ ] Bouton "Déconnexion" visible et fonctionnel

---

## 📝 Notes Importantes

### Caractères Spéciaux dans le Mot de Passe
Si le mot de passe contient des caractères spéciaux, ils doivent être **URL-encodés** dans `DATABASE_URL` :
- `@` → `%40`
- `!` → `%21`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`
- `^` → `%5E`
- `&` → `%26`
- `*` → `%2A`
- `(` → `%28`
- `)` → `%29`

**Exemple** : `L@utho02171217` devient `L%40utho02171217`

### Supabase Direct Connection vs Session Pooler
- **Session Pooler** (port 5432) : Recommandé pour Vercel (compatible IPv4/IPv6)
  ```
  postgresql://user:password@aws-1-eu-west-1.pooler.supabase.com:5432/postgres
  ```
- **Direct Connection** (port 6543 avec `?pgbouncer=true`) : Pour Prisma Migrate uniquement
  ```
  postgresql://user:password@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
  ```

### Prisma Studio
Pour activer Prisma Studio en local :
```bash
# .env.local
ENABLE_PRISMA_STUDIO=true
```

Puis accéder à `http://localhost:3000/admin` et cliquer sur "Ouvrir Prisma Studio".

---

## ✨ Fonctionnalités Implémentées

- ✅ Authentification Supabase avec Magic Link (email)
- ✅ Protection des routes (Middleware Next.js)
- ✅ Gestion des rôles (USER, ADMIN)
- ✅ Premier utilisateur automatiquement ADMIN
- ✅ API `/api/auth/me` pour récupérer l'utilisateur connecté
- ✅ API `/api/auth/logout` pour déconnexion
- ✅ Protection des pages `/admin/*` via `layout.tsx`
- ✅ Protection des API `/api/admin/*` via `protectAdminRoute()`
- ✅ Bouton "Déconnexion" dans la Topbar
- ✅ Affichage utilisateur dans la Sidebar (avatar, nom, email, badge ADMIN)
- ✅ Intégration Prisma avec Supabase Auth (`supabaseId` dans `User`)

---

**Bon courage pour les tests ! 🚀**


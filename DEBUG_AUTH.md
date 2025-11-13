# 🔍 Guide de débogage - Authentification Supabase

## 📧 Étapes de connexion normales

1. ✅ Aller sur http://localhost:3000/login
2. ✅ Entrer votre email (tom.dub02@gmail.com)
3. ✅ Cliquer sur "Envoyer le lien de connexion"
4. ✅ Recevoir l'email de Supabase
5. **👉 CLIQUER SUR LE LIEN dans l'email**
6. ✅ Être redirigé automatiquement vers `/dashboard`

## ⚠️ Problèmes courants

### Le lien dans l'email ne fonctionne pas

**Vérifications** :

1. **Le lien pointe-t-il vers localhost ?**
   - Le lien devrait ressembler à : `http://localhost:3000/auth/callback?code=xxxxx-xxxxx-xxxxx`
   - Si le lien pointe vers autre chose (ex: `https://xxxxx.supabase.co`), c'est un problème de configuration

2. **Vérifier les variables d'environnement**

Ouvrez votre fichier `.env` ou `.env.local` et vérifiez :

```bash
# Ces 3 variables DOIVENT être présentes
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

⚠️ **Important** : Après avoir modifié `.env`, vous DEVEZ redémarrer le serveur :
```bash
# Arrêter (Ctrl+C)
# Redémarrer
npm run dev
```

3. **Vérifier la configuration Supabase Dashboard**

   - Aller sur https://supabase.com/dashboard
   - Votre projet → Authentication → URL Configuration
   - **Redirect URLs** doit contenir : `http://localhost:3000/auth/callback`

---

### J'ai cliqué sur le lien mais rien ne se passe

**Symptômes possibles** :

#### A) Page blanche ou erreur 404
- La route `/auth/callback` n'est pas trouvée
- **Solution** : Vérifier que le fichier `src/app/auth/callback/route.ts` existe
- Redémarrer le serveur : `npm run dev`

#### B) Redirection vers `/login?error=...`

Ouvrez la console du navigateur (F12) et les logs du serveur (terminal) pour voir l'erreur exacte.

**Erreurs possibles** :

| Erreur | Cause | Solution |
|--------|-------|----------|
| `missing_code` | Le code n'est pas dans l'URL | Vérifier le lien dans l'email |
| `session_failed` | Code invalide ou expiré | Redemander un nouveau lien |
| `no_email` | Session sans email | Problème Supabase, contacter le support |
| `callback_error` | Erreur serveur | Voir les logs du terminal |

#### C) Erreur de connexion à la base de données

Si vous voyez dans les logs :
```
Can't reach database server at localhost:5432
```

**Solution** : Démarrer PostgreSQL local
```bash
npm run services:start
# ou
docker-compose up -d postgres
```

---

### Je ne reçois pas l'email

**Vérifications** :

1. **Vérifier les spams** - L'email de Supabase peut être filtré

2. **Vérifier Supabase Email Settings**
   - Dashboard → Authentication → Email Templates
   - Vérifier que les emails sont activés

3. **Utiliser l'email de vérification Supabase**
   - Dans le dashboard Supabase → Authentication → Users
   - Vous pouvez voir les tentatives de connexion
   - Un lien de vérification apparaît dans les logs

4. **Alternative : Copier le lien depuis les logs Supabase**
   - Dashboard → Logs → Auth Logs
   - Chercher votre email
   - Copier le lien de confirmation

---

## 🧪 Script de diagnostic

Créez un fichier `test-supabase-config.ts` :

```typescript
import { createBrowserClient } from '@/lib/supabase';

async function testConfig() {
  console.log('🔍 Variables d\'environnement:');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Défini' : '❌ Manquant');
  console.log('NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL || 'Non défini (utilisera window.location.origin)');
  
  try {
    const supabase = createBrowserClient();
    console.log('✅ Client Supabase créé avec succès');
  } catch (error) {
    console.error('❌ Erreur lors de la création du client:', error);
  }
}

testConfig();
```

Exécutez avec : `npx tsx test-supabase-config.ts`

---

## 🔧 Solution rapide : Forcer la redirection

Si le lien ne fonctionne vraiment pas, vous pouvez aussi :

1. **Copier le code depuis l'URL de l'email**
   - L'URL ressemble à : `http://localhost:3000/auth/callback?code=abc123def456...`
   - Copier tout le code après `code=`

2. **Aller manuellement sur** :
   ```
   http://localhost:3000/auth/callback?code=VOTRE_CODE_ICI
   ```

---

## 📞 Besoin d'aide immédiate ?

**Vérifiez les logs du serveur** (terminal où tourne `npm run dev`) :

```
[Auth Callback] Utilisateur Supabase: { id: '...', email: '...' }
[Auth Callback] Création d'un nouvel utilisateur
🎉 [Auth Callback] Premier utilisateur créé en tant qu'ADMIN: ...
```

Si vous voyez ces logs, c'est que ça fonctionne !

**Vérifiez les logs du navigateur** (Console DevTools - F12) :

Toute erreur JavaScript apparaîtra ici.

---

## ✅ Checklist rapide

- [ ] Le serveur dev tourne : `npm run dev`
- [ ] PostgreSQL local tourne : `docker-compose up -d`
- [ ] Variables dans `.env` ou `.env.local` :
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- [ ] URL de redirection dans Supabase : `http://localhost:3000/auth/callback`
- [ ] J'ai cliqué sur le lien dans l'email
- [ ] Je vois des logs dans le terminal

Si tout est OK, vous devriez être redirigé vers `/dashboard` après avoir cliqué sur le lien !


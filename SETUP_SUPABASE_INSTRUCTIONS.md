# 🗄️ Setup de la base de données Supabase - Instructions

## Situation actuelle

Votre base de données Supabase est **vide** (aucune table créée).

## ✅ Solution : Importer le schéma complet

### Méthode recommandée : Supabase SQL Editor

1. **Ouvrez Supabase Dashboard**
   - https://supabase.com/dashboard/project/lvythpofldjkoupgflce/sql/new

2. **Ouvrez le fichier SQL**
   - Dans VSCode/Cursor : Ouvrez `setup-supabase-complete.sql`
   - Ce fichier contient TOUTES les tables de votre application

3. **Copiez tout le contenu**
   - Ctrl+A pour tout sélectionner
   - Ctrl+C pour copier

4. **Collez dans Supabase SQL Editor**
   - Ctrl+V dans l'éditeur

5. **Exécutez le script**
   - Cliquez sur "RUN" (bouton en bas à droite)
   - OU appuyez sur Ctrl+Enter

6. **Attendez l'exécution**
   - Cela prendra 5-10 secondes
   - Vous verrez "Success" quand c'est terminé

7. **Vérifiez les tables créées**
   - Allez dans Table Editor (menu de gauche)
   - Vous devriez voir toutes vos tables :
     - User (avec la colonne supabaseId ✅)
     - Property
     - Lease
     - Transaction
     - Document
     - etc.

## ⚠️ Si vous avez l'erreur "relation already exists"

Si certaines tables existent déjà, vous pouvez soit :

**Option A** : Supprimer toutes les tables existantes d'abord

```sql
-- ⚠️ ATTENTION : Ceci supprime TOUTES les données !
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

Puis exécutez `setup-supabase-complete.sql`.

**Option B** : Appliquer seulement les migrations manquantes

Si vous avez quelques tables mais pas toutes, contactez-moi pour générer un script différentiel.

## 🎯 Après l'import

Une fois les tables créées :

1. **Retestez la connexion sur Vercel**
   - https://smartimmo2.vercel.app/login
   - Entrez votre email
   - Cliquez sur le lien dans l'email
   - ✅ Devrait fonctionner !

2. **Vous serez le premier ADMIN**
   - Le premier utilisateur à se connecter sera automatiquement ADMIN
   - C'est donc votre chance de devenir admin ! 🎉

3. **Vérifiez dans Table Editor**
   - Table "User"
   - Vous devriez voir votre utilisateur avec :
     - supabaseId rempli
     - role = 'ADMIN'
     - emailVerified rempli

## 🔧 Commandes de vérification

Après l'import, vérifiez que tout est OK :

```sql
-- Compter les tables créées
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
-- Devrait retourner ~40 tables

-- Vérifier la structure de User
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'User';
-- Vous devez voir supabaseId dans la liste

-- Lister les utilisateurs (sera vide au début)
SELECT * FROM "User";
```

## ⏭️ Prochaines étapes

1. ✅ Importer le schéma SQL sur Supabase
2. ✅ Vérifier que les tables sont créées
3. ✅ Tester la connexion sur https://smartimmo2.vercel.app/login
4. ✅ Devenir le premier ADMIN
5. ✅ Profiter de votre application sécurisée ! 🎉


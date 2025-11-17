# Configuration du Stockage de Documents

Ce document explique comment configurer le système de stockage des documents pour SmartImmo2.

## Architecture

Le système de stockage utilise un pattern de providers qui permet de basculer entre :
- **LocalStorageProvider** : Stockage local sur le système de fichiers (développement)
- **SupabaseStorageProvider** : Stockage cloud via Supabase Storage (production)

Le provider utilisé est déterminé par la variable d'environnement `STORAGE_TYPE`.

## Variables d'environnement

### Développement (Local)

Dans votre fichier `.env.local` :

```bash
# Stockage local (par défaut)
STORAGE_TYPE=local
```

Les fichiers seront stockés dans `./storage/documents/` (relatif à la racine du projet).

### Production (Supabase)

Sur Vercel, configurez les variables suivantes dans **Settings > Environment Variables** :

```bash
# Type de stockage
STORAGE_TYPE=supabase

# Configuration Supabase (déjà configurée pour la base de données)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Nom du bucket Supabase (optionnel, par défaut: "documents")
SUPABASE_STORAGE_BUCKET=documents
```

**Important** : 
- Le bucket `documents` doit déjà exister dans votre projet Supabase
- Utilisez la **Service Role Key** (pas l'anon key) pour avoir les permissions complètes
- La Service Role Key ne doit JAMAIS être exposée côté client

## Format des clés de stockage (bucketKey)

Le format unifié est : `documents/{documentId}/{filename}`

Exemples :
- `documents/cmi1y2uab001nn8rku1xik7zd/document.pdf`
- `documents/abc123/contrat_bail.pdf`

### Rétrocompatibilité

Le système gère automatiquement les anciens formats :
- `storage/documents/{filename}` → normalisé vers `documents/{documentId}/{filename}`
- `uploads/{year}/{month}/{filename}` → normalisé vers `documents/{documentId}/{filename}`

## Migration depuis le stockage local

Si vous avez des documents existants avec des `bucketKey` au format ancien, ils seront automatiquement normalisés lors de la lecture. Aucune migration manuelle n'est nécessaire.

## Vérification

### En développement

1. Uploader un document via l'interface
2. Vérifier qu'il apparaît dans `./storage/documents/{documentId}/`
3. Ouvrir le document → doit fonctionner

### En production

1. Configurer `STORAGE_TYPE=supabase` et les variables Supabase
2. Uploader un document via l'interface
3. Vérifier dans Supabase Dashboard > Storage > Buckets > documents que le fichier apparaît
4. Ouvrir le document → doit fonctionner même après un redeploiement

## Dépannage

### Erreur "Variables Supabase manquantes"

Vérifiez que toutes les variables d'environnement sont configurées :
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STORAGE_TYPE=supabase`

### Erreur "Fichier non trouvé dans le stockage"

1. Vérifiez que le `bucketKey` dans la base de données est correct
2. Vérifiez que le fichier existe dans Supabase Storage (Dashboard)
3. Vérifiez les logs serveur pour plus de détails

### Fallback automatique

Si `SupabaseStorageProvider` ne peut pas être initialisé (variables manquantes), le système bascule automatiquement vers `LocalStorageProvider` avec un avertissement dans les logs.

## Routes API concernées

Toutes les routes suivantes utilisent maintenant le service de stockage :

- `POST /api/documents/upload` - Upload de documents
- `POST /api/documents/finalize` - Finalisation d'upload
- `POST /api/documents/confirm` - Confirmation d'upload
- `GET /api/documents/[id]/file` - Lecture d'un document
- `GET /api/documents/[id]/download` - Téléchargement d'un document

Aucune route n'utilise plus directement `fs` pour les documents (sauf pour les fichiers temporaires).


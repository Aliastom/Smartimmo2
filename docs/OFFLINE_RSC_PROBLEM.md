# Problème des requêtes RSC en mode offline

## Problème identifié

Lorsqu'on navigue vers une page (ex: `/biens`) en mode offline dans la PWA, le navigateur affiche "Vous êtes hors connexion" au lieu de charger la page depuis le cache.

### Cause principale

Next.js App Router fait des **requêtes RSC (React Server Components)** avec `?_rsc=...` pour charger les Server Components. Ces requêtes:
1. Ne sont pas interceptées par le service worker (elles ne sont pas des navigations)
2. Échouent en mode offline (`net::ERR_INTERNET_DISCONNECTED`)
3. Empêchent Next.js de charger la page, même si le HTML est en cache

### Flux du problème

1. L'utilisateur clique sur `/biens`
2. Le service worker sert le HTML depuis le cache (si disponible)
3. Next.js charge le HTML et tente le rendu serveur
4. Next.js fait une requête RSC (`biens?_rsc=1099k`) pour charger les Server Components
5. Cette requête échoue en mode offline
6. Next.js affiche la page d'erreur "Vous êtes hors connexion"
7. Le composant client ne peut jamais se charger pour utiliser IndexedDB

## Solutions appliquées

### 1. ✅ Interception des requêtes RSC dans le service worker

Ajout d'une règle dans `next.config.mjs` pour intercepter les requêtes RSC (`?_rsc=`) et:
- Les mettre en cache avec `CacheFirst`
- Retourner une réponse vide si la requête échoue et qu'elle n'est pas en cache
- Permettre à Next.js de continuer même si les RSC échouent

### 2. ✅ Chargement agressif depuis IndexedDB

Modification de `BiensClient.tsx` pour charger **immédiatement** depuis IndexedDB en mode offline, sans attendre que les données initiales soient vides.

### 3. ✅ Gestion des erreurs dans Server Components

Les pages Server Components (comme `src/app/biens/page.tsx`) gèrent déjà les erreurs d'authentification et retournent des données vides.

## Limitations

Le problème persiste car Next.js App Router **nécessite** les Server Components pour fonctionner. Même si on intercepte les requêtes RSC, Next.js peut toujours échouer si les RSC ne sont pas disponibles.

## Solutions possibles (non implémentées)

### Option 1: Pages client-only pour le mode offline
Créer des pages complètement client-only qui se chargent en priorité en mode offline, sans passer par les Server Components.

### Option 2: Service worker personnalisé
Créer un service worker personnalisé qui intercepte toutes les requêtes RSC et retourne des réponses qui permettent à Next.js de fonctionner en mode offline.

### Option 3: Rendu statique pour les pages critiques
Générer des pages statiques pour les pages critiques qui peuvent être servies directement depuis le cache sans Server Components.

## Test à effectuer

1. **Rebuild la PWA** avec les nouvelles modifications
2. **Synchroniser complètement** pour précharger les pages HTML et les RSC
3. **Mettre en mode offline**
4. **Naviguer vers `/biens`**
5. Vérifier si la page se charge maintenant ou si le problème persiste

## Notes

- Le problème est fondamental à Next.js App Router avec les Server Components
- Les solutions actuelles peuvent améliorer la situation mais ne garantissent pas un fonctionnement parfait
- Il peut être nécessaire de créer des pages client-only pour les pages critiques en mode offline



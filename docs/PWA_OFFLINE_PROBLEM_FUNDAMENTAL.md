# ⚠️ Problème fondamental : Next.js App Router et mode offline

## Le problème

Next.js App Router **ne peut pas vraiment fonctionner offline** avec des Server Components car :

1. Même si le service worker sert le HTML depuis le cache
2. Next.js charge le HTML et **tente toujours le rendu serveur**
3. Les requêtes RSC (`?_rsc=...`) échouent en mode offline
4. Next.js affiche "Vous êtes hors connexion" avant que le composant client ne puisse charger

## Solutions tentées

1. ❌ Transformation en client-only → Erreur "Cannot access 'eb' before initialization"
2. ❌ Server Component avec gestion d'erreur → Next.js échoue avant d'arriver au catch
3. ❌ Interception des requêtes RSC dans le service worker → Ne suffit pas
4. ❌ Modification de la stratégie de cache → Ne résout pas le problème fondamental

## Solution possible

Le problème est que **Next.js App Router nécessite les Server Components** pour fonctionner. En mode offline, ces Server Components ne peuvent pas s'exécuter.

### Option 1 : Accepter la limitation

- Les pages avec Server Components ne fonctionnent pas complètement offline
- Le composant client peut charger depuis IndexedDB, mais seulement si la page se charge d'abord
- En mode offline, il faut visiter la page **avant** de passer offline pour qu'elle soit en cache

### Option 2 : Pages statiques pré-générées

- Utiliser `generateStaticParams` pour pré-générer les pages HTML
- Ces pages statiques peuvent être servies depuis le cache offline
- Limitation : données statiques au moment du build

### Option 3 : App Shell complètement client-only

- Créer une page complètement client-only qui se charge même si le serveur échoue
- Nécessite de contourner complètement le système de routing de Next.js
- Complexe et peut casser d'autres fonctionnalités

## Recommandation

Le problème est **fondamental à Next.js App Router**. Les solutions de contournement sont complexes et fragiles.

**Pour l'instant**, le mieux est d'accepter que :
- Les pages doivent être **visitées au moins une fois en ligne** pour être mises en cache
- Une fois en cache, elles peuvent être servies depuis le cache
- Mais si Next.js tente le rendu serveur et échoue, la page ne se charge pas

**Alternative** : Utiliser des pages statiques (`generateStaticParams`) pour les pages critiques qui doivent fonctionner offline.



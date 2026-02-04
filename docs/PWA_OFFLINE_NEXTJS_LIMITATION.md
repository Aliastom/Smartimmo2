# ⚠️ Limitation Next.js App Router pour le mode offline

## Problème identifié

**Next.js App Router ne peut pas vraiment fonctionner offline** avec des Server Components, même avec un service worker et du cache.

### Pourquoi ?

1. Le service worker peut servir le HTML depuis le cache ✅
2. Mais Next.js charge le HTML et **tente toujours le rendu serveur** ❌
3. Les requêtes RSC (`?_rsc=...`) échouent en mode offline ❌
4. Next.js affiche "Vous êtes hors connexion" avant que le composant client ne puisse charger ❌

## Solutions tentées (toutes échouées)

1. ❌ Transformation en client-only → Erreur JavaScript
2. ❌ Server Component avec gestion d'erreur → Next.js échoue avant le catch
3. ❌ Interception des requêtes RSC → Ne suffit pas
4. ❌ Modification stratégie de cache → Ne résout pas le problème fondamental

## Options possibles

### Option 1 : Accepter la limitation (recommandé pour l'instant)

- Les pages doivent être **visitées au moins une fois en ligne** pour être mises en cache
- Une fois en cache, elles peuvent être servies depuis le cache
- Mais si Next.js tente le rendu serveur et échoue, la page ne se charge pas

### Option 2 : Pages statiques pré-générées

- Utiliser `generateStaticParams` pour pré-générer les pages HTML
- Ces pages statiques peuvent être servies depuis le cache offline
- Limitation : données statiques au moment du build

### Option 3 : Service worker personnalisé avancé

- Intercepter toutes les requêtes RSC et retourner des réponses qui permettent à Next.js de continuer
- Très complexe et fragile

## Conclusion

Le mode offline complet avec Next.js App Router et Server Components est **techniquement très difficile** voire impossible sans solutions très complexes.

**Recommandation** : Accepter que certaines pages nécessitent une connexion, ou utiliser des pages statiques pour les pages critiques.



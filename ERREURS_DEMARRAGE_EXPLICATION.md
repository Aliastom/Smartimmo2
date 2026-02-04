# ⚠️ Erreurs au démarrage - C'est normal !

## Pourquoi ces erreurs apparaissent ?

Quand vous lancez `npm run start`, Next.js essaie de précharger (SSR) certaines pages au démarrage :
- `/biens` (liste des biens)
- `/dashboard` 
- `/api/properties`
- etc.

Ces pages appellent des routes API qui utilisent `requireAuth()`, mais **personne n'est encore connecté** → Erreur "Non authentifié".

**C'est attendu et non bloquant !** Dès qu'un utilisateur se connecte, ces erreurs disparaissent.

## Quelle commande utiliser ?

### Pour tester la PWA et le mode offline :
```bash
npm run build
npm run start
```
✅ **Production avec PWA activée** - C'est ce qu'il faut pour tester le mode offline-first

### Pour le développement :
```bash
npm run dev
```
⚠️ La PWA peut être désactivée en dev selon `next.config.mjs`

## Comment savoir si tout fonctionne ?

1. **Démarrez l'app** : `npm run start`
2. **Connectez-vous** dans le navigateur
3. **Vérifiez** : Les erreurs "Non authentifié" disparaissent des logs
4. **Testez le mode offline** :
   - Activez le mode offline (DevTools → Network → Offline)
   - Créez/modifiez un bien
   - Vérifiez l'indicateur de sync (en haut à droite)
   - Réactivez le réseau → La sync doit se faire automatiquement

## Réduire le bruit dans les logs ?

Ces erreurs sont déjà filtrées au maximum. Si vous voulez les réduire encore plus, vous pouvez :

1. **Ne pas précharger les pages** : Modifier les pages pour qu'elles soient client-side uniquement
2. **Accepter que c'est normal** : Ces erreurs n'affectent pas le fonctionnement

## En résumé

✅ **Erreurs "Non authentifié" au démarrage = Normal**  
✅ **Utiliser `npm run start` pour tester la PWA**  
✅ **Une fois connecté, tout fonctionne**





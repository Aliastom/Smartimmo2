# 📱 App Shell Offline - Implémentation

## Objectif

Créer une route `/app` qui fonctionne **100% offline** comme une SPA client-side, sans dépendre des Server Components de Next.js.

## Structure

```
/app (route principale)
  ├── page.tsx (App Shell 100% client)
  └── views/ (vues internes)
      ├── BiensView.tsx
      ├── DashboardView.tsx
      ├── LocatairesView.tsx
      ├── BauxView.tsx
      ├── TransactionsView.tsx
      ├── DocumentsView.tsx
      ├── EcheancesView.tsx
      └── LoansView.tsx
```

## Fonctionnement

1. **App Shell** (`/app/page.tsx`) :
   - Composant 100% client (`'use client'`)
   - Contient header, sidebar, navigation interne
   - Navigation par état React (pas de routing Next.js)
   - Charge les données depuis IndexedDB uniquement

2. **Vues internes** (`/app/views/*.tsx`) :
   - Réutilisent les composants clients existants (`BiensClient`, etc.)
   - Chargent depuis IndexedDB via les repositories offline-first
   - Pas de fetch réseau

3. **Middleware** :
   - Laisse passer en cas d'erreur réseau (offline)

4. **Service Worker** :
   - Sert le HTML de `/app` depuis le cache en offline

## Prochaines étapes

1. ✅ Créer `/app/page.tsx` (App Shell)
2. ⏳ Créer les vues dans `/app/views/`
3. ⏳ Adapter la Sidebar pour navigation interne
4. ⏳ Vérifier middleware
5. ⏳ Vérifier config PWA



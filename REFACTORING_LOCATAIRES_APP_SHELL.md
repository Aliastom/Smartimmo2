# 🔄 Refactorisation Page Locataires - App Shell Offline-First

## 📋 Résumé des changements

Refactorisation complète de la page `/app?view=locataires` pour qu'elle soit :
- ✅ **AppShell compatible** (aucun hard refresh, navigation fluide)
- ✅ **LocalDB-first** (lecture/écriture d'abord en IndexedDB, sync ensuite)
- ✅ **Mobile-first** (UI impeccable sur mobile; aucun scroll horizontal)
- ✅ **Conforme au thème** (alignement avec les autres pages et modales)
- ✅ **Fonctionnelle** (drawer de détail sur clic ligne, modales ergonomiques)

---

## 🎯 Modifications effectuées

### 1. **Création du TenantDrawer** (`src/components/tenants/TenantDrawer.tsx`)

**Nouveau composant** : Drawer latéral pour afficher les détails d'un locataire.

- **Desktop** : Drawer latéral à droite (comme les autres drawers du projet)
- **Mobile** : Bottom sheet (via Sheet component de shadcn)
- **Contenu** :
  - Informations personnelles (nom, email, téléphone, date de naissance, nationalité)
  - Adresse complète
  - Informations professionnelles (profession, employeur, revenus)
  - Contact d'urgence
  - Liste des baux associés avec détails
  - Notes
- **Actions** : Modifier, Voir les baux, Supprimer (désactivé si baux actifs)

**Pattern utilisé** : Identique à `LeaseDrawerNew`, `LoanDrawer`, etc.

---

### 2. **Refactorisation TenantsPageCore** (`src/features/tenants/TenantsPageCore.tsx`)

#### A. Header amélioré
- ✅ Bouton "+ Nouveau Locataire" déplacé dans le header (via `SectionTitle.actions`)
- ✅ Responsive : Texte complet sur desktop, "Nouveau" sur mobile
- ✅ Positionné à droite du titre (cohérent avec les autres pages)

#### B. Table responsive
- ✅ **Desktop** : Tableau complet (TableV2 ou Table classique selon `useUI2`)
- ✅ **Mobile** : Vue en cards (une card par locataire)
  - Informations clés visibles : Nom, email/tel, statut, bien/bail actif
  - Clic sur la card → ouvre le drawer
  - Aucune perte d'information

#### C. Remplacement Modal → Drawer
- ✅ Ancienne `Modal` de visualisation remplacée par `TenantDrawer`
- ✅ Navigation fluide sans hard refresh
- ✅ Actions intégrées dans le drawer (Modifier, Voir baux, Supprimer)

---

### 3. **Correction TenantEditModalV2** (`src/components/forms/TenantEditModalV2.tsx`)

#### Problème résolu : Scroll horizontal sur mobile
- ❌ **Avant** : Les tabs débordaient et créaient une scrollbar horizontale
- ✅ **Après** : 
  - Tabs scrollables horizontalement **sans scrollbar visible** (classe `scrollbar-hide`)
  - Structure flex-col avec overflow contrôlé
  - Contenu scrollable verticalement correctement
  - Footer sticky pour les CTA (via `Modal.footer`)

#### Améliorations structurelles
- ✅ Utilisation de la structure native du `Modal` (header, body scrollable, footer sticky)
- ✅ Tabs dans le header (hors du scroll)
- ✅ Contenu des onglets dans le body scrollable
- ✅ Boutons d'action dans le footer sticky
- ✅ Aucun overflow-x global

---

## 🔄 Gestion Offline-First

### Architecture existante (déjà en place)

La page utilise déjà le système offline-first via :

1. **Hook `useTenantsData`** :
   - Mode `app-shell` : Lit **uniquement** depuis IndexedDB
   - Mode `normal` : Utilise `initialData` (serveur) avec fallback IndexedDB si offline

2. **Repository `TenantRepositoryOffline`** :
   - Hérite de `BaseOfflineRepository`
   - Méthodes `upsert()` et `delete()` créent automatiquement des `pendingOps`
   - Écriture optimiste : données sauvegardées immédiatement en IndexedDB

3. **Synchronisation** :
   - `handleTenantSubmit` et `handleDeleteTenant` appellent `syncAllPendingToRemote()` si online
   - Les `pendingOps` sont poussées vers Supabase dès que possible
   - En offline : les opérations restent en attente et sont synchronisées à la reconnexion

### Flux de données

```
┌─────────────────────────────────────────────────────────┐
│  Action utilisateur (create/update/delete)              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  1. Écriture optimiste en IndexedDB                     │
│     (via TenantRepositoryOffline.upsert/delete)          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  2. Création pendingOp (automatique)                    │
│     - entity: 'tenant'                                   │
│     - operation: 'create' | 'update' | 'delete'         │
│     - status: 'pending'                                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  3. Sync immédiate si online                            │
│     (via syncAllPendingToRemote)                         │
│     Sinon : en attente jusqu'à reconnexion              │
└─────────────────────────────────────────────────────────┘
```

### États gérés

- ✅ **Loading local** : Affiché pendant le chargement depuis IndexedDB
- ✅ **Empty state** : Message clair si aucun locataire
- ✅ **Offline state** : Les données sont disponibles même offline (depuis IndexedDB)
- ✅ **Sync pending state** : Les opérations sont visibles immédiatement, sync en arrière-plan

---

## 📱 Responsive & Mobile-First

### Corrections apportées

1. **Tabs dans TenantEditModalV2** :
   ```css
   /* Classe scrollbar-hide (déjà dans globals.css) */
   .scrollbar-hide {
     -ms-overflow-style: none;  /* IE and Edge */
     scrollbar-width: none;     /* Firefox */
   }
   .scrollbar-hide::-webkit-scrollbar {
     display: none;             /* Chrome, Safari, Opera */
   }
   ```

2. **Table → Cards sur mobile** :
   - Breakpoint : `lg:hidden` pour cards, `hidden lg:block` pour table
   - Cards affichent toutes les infos clés sans scroll horizontal

3. **Header responsive** :
   - Bouton "+ Nouveau Locataire" : Texte complet sur desktop, "Nouveau" sur mobile
   - Layout flex-col sur mobile, flex-row sur desktop

4. **Drawer responsive** :
   - Desktop : Drawer latéral (`side="right"`)
   - Mobile : Bottom sheet (via Sheet component)

---

## 📂 Fichiers modifiés

1. **Nouveau** : `src/components/tenants/TenantDrawer.tsx`
   - Drawer pour afficher les détails d'un locataire

2. **Modifié** : `src/features/tenants/TenantsPageCore.tsx`
   - Header avec bouton dans `SectionTitle.actions`
   - Vue mobile en cards
   - Remplacement Modal → Drawer

3. **Modifié** : `src/components/forms/TenantEditModalV2.tsx`
   - Correction scroll horizontal (tabs scrollables)
   - Structure améliorée avec footer sticky

---

## ✅ Checklist technique (complétée)

- [x] Vérifier que la page est bien branchée sur les repos/services offline-first
- [x] Vérifier les états (loading, empty, offline, sync pending)
- [x] Vérifier qu'aucun composant ne déclenche de "refresh" ou navigation hors AppShell
- [x] Fixer définitivement les débordements horizontaux en mobile (tabs, grids, inputs)
- [x] Tests manuels rapides (scénarios offline/online/mobile)

---

## 🧪 Scénarios de test

### ✅ Offline
1. Créer un locataire → Visible immédiatement dans la liste
2. Vérifier qu'une `pendingOp` est créée (via DevTools → IndexedDB)
3. Modifier un locataire → Modifications visibles immédiatement
4. Supprimer un locataire (sans baux actifs) → Suppression visible immédiatement

### ✅ Online
1. Créer/modifier/supprimer → Sync immédiate vers Supabase
2. Vérifier que les `pendingOps` sont consommées après sync

### ✅ Mobile
1. Ouvrir la modale "Nouveau Locataire"
2. Accéder à tous les onglets (scroll horizontal sans scrollbar visible)
3. Scroller jusqu'en bas du formulaire
4. CTA "Enregistrer" accessible (footer sticky)
5. Cliquer sur une ligne de locataire → Drawer s'ouvre (bottom sheet sur mobile)
6. Toutes les informations sont visibles sans scroll horizontal

---

## 🎨 Conformité au thème

- ✅ Cards arrondies (border-radius cohérent)
- ✅ Couleurs pastel (badges, backgrounds)
- ✅ CTA orange (boutons principaux)
- ✅ Typography cohérente (tailles, weights)
- ✅ Espacements alignés avec les autres pages (Documents, Prêts)

---

## 📝 Notes importantes

1. **Drawer** : Utilise le composant `Sheet` de shadcn (déjà présent dans le projet)
2. **Offline-first** : Le système était déjà en place, aucune modification nécessaire
3. **Mobile** : Les corrections CSS utilisent des classes existantes (`scrollbar-hide`)
4. **Navigation** : Aucun hard refresh, tout reste dans AppShell

---

## 🚀 Prochaines étapes (optionnel)

- [ ] Ajouter des animations de transition pour le drawer
- [ ] Implémenter la recherche avancée (filtres multiples)
- [ ] Ajouter l'export CSV des locataires
- [ ] Implémenter la pagination côté serveur pour les grandes listes


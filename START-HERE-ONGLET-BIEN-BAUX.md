# 🚀 START HERE — Onglet Bien / Baux

**Version:** 1.0  
**Date:** 27 octobre 2025

---

## ⚡ DÉMARRAGE RAPIDE (30 secondes)

### 1. Lancer le serveur
```bash
npm run dev
```

### 2. Accéder à un bien
```
http://localhost:3000/biens/[ID_DUNE_PROPRIETE]
```

### 3. Cliquer sur l'onglet "Baux"
Ou accéder directement via :
```
http://localhost:3000/biens/[ID_DUNE_PROPRIETE]/leases
```

### 4. Tester les fonctionnalités
- ✅ Vérifier que seuls les baux du bien s'affichent
- ✅ Créer un nouveau bail (le bien est automatiquement pré-rempli)
- ✅ Cliquer sur une ligne pour ouvrir le drawer
- ✅ Tester les filtres et le tri

---

## 📂 STRUCTURE DES FICHIERS

```
src/app/biens/[id]/leases/
├─ page.tsx                    ← Page serveur Next.js
└─ PropertyLeasesClient.tsx    ← Composant client React
```

**C'est tout !** Tous les autres composants sont réutilisés depuis la page globale `/baux`.

---

## 🎯 CE QUI A ÉTÉ FAIT

### Copie stricte de la page Baux globale
L'onglet **Bien / Baux** est une **réplique exacte** de `/baux/LeasesClient.tsx`, avec ces adaptations :

| Aspect | Page globale | Onglet bien |
|--------|-------------|-------------|
| **Filtrage** | Tous les baux | Baux du bien uniquement |
| **Filtre "Bien"** | Visible | Masqué (`hidePropertyFilter={true}`) |
| **Création bail** | Bien à sélectionner | Bien pré-rempli et verrouillé |
| **KPI** | Global | Scopé par bien |
| **Graphiques** | Global | Scopé par bien |
| **Header** | "Baux" | "Baux" + bouton retour |

---

## 🔧 COMMENT ÇA MARCHE

### 1. Filtrage automatique
Le `propertyId` est **toujours** passé dans les requêtes API :

```typescript
// Dans PropertyLeasesClient.tsx
const loadData = useCallback(async () => {
  const params = new URLSearchParams();
  params.append('propertyId', propertyId); // ← TOUJOURS présent
  // + autres filtres utilisateur
  
  const response = await fetch(`/api/leases?${params.toString()}`);
  // ...
}, [propertyId, filters]);
```

### 2. KPI scopés
Les hooks chargent automatiquement les KPI du bien :

```typescript
const { kpis } = useLeasesKpis({
  refreshKey,
  propertyId, // ← Filtre par bien
});
```

### 3. Bien verrouillé en création
```typescript
<LeaseFormComplete
  defaultPropertyId={propertyId} // ← Pré-rempli & verrouillé
  onSubmit={handleModalSubmit}
/>
```

---

## ✅ TESTS RAPIDES

### Test 1 : Navigation
```
1. Ouvrir http://localhost:3000/biens/xxx
2. Cliquer sur l'onglet "Baux"
3. ✓ L'URL devient /biens/xxx/leases
4. ✓ La page affiche les baux du bien
```

### Test 2 : Création
```
1. Cliquer sur "Nouveau bail"
2. ✓ Le bien est pré-rempli et désactivé
3. Remplir le formulaire
4. ✓ Le bail est créé et apparaît dans la liste
```

### Test 3 : Filtrage
```
1. Noter les baux affichés
2. Aller sur /baux (page globale)
3. ✓ Plus de baux sont affichés (tous les biens)
4. Retourner sur /biens/xxx/leases
5. ✓ Seuls les baux du bien xxx sont affichés
```

### Test 4 : KPI
```
1. Noter les chiffres des cartes KPI
2. ✓ Les chiffres correspondent aux baux affichés
3. Cliquer sur "Baux actifs"
4. ✓ La liste se filtre sur les baux actifs du bien
```

---

## 🐛 TROUBLESHOOTING

### Problème : Tous les baux s'affichent (pas de filtrage)
**Solution :** Vérifier que l'API `/api/leases` supporte le paramètre `?propertyId=xxx`

### Problème : KPI incorrects
**Solution :** Vérifier que l'API `/api/leases/kpis` supporte `?propertyId=xxx`

### Problème : Graphiques vides
**Solution :** Vérifier que l'API `/api/leases/charts` supporte `?propertyId=xxx`

### Problème : Bien non verrouillé en création
**Solution :** Vérifier que `LeaseFormComplete` reçoit bien `defaultPropertyId`

### Problème : Filtre "Bien" visible
**Solution :** Vérifier que `LeasesFilters` reçoit bien `hidePropertyFilter={true}`

---

## 📚 DOCUMENTATION COMPLÈTE

Pour plus de détails, consulter :
- **`IMPLEMENTATION-ONGLET-BIEN-BAUX.md`** : Documentation technique complète
- **`ONGLET-BIEN-BAUX-RECAP.md`** : Récapitulatif de l'implémentation

---

## 🎉 RÉSULTAT ATTENDU

Après démarrage et navigation vers `/biens/xxx/leases`, vous devriez voir :

```
┌─────────────────────────────────────────────────────────┐
│ Baux                                                    │
│ Baux du bien [Nom du bien]                             │
│                          [← Retour au bien] [Nouveau]  │
├─────────────────────────────────────────────────────────┤
│ [Graphique évolution] [Donut meublé] [Cautions/Loyers] │
├─────────────────────────────────────────────────────────┤
│ [Total: X] [Actifs: Y] [Expirant: Z] [Indexations: W]  │
├─────────────────────────────────────────────────────────┤
│ Filtres avancés (Recherche, Locataire, Type...)        │
├─────────────────────────────────────────────────────────┤
│ Tableau des baux avec tri et multi-sélection           │
└─────────────────────────────────────────────────────────┘
```

**Toutes les fonctionnalités de la page globale, scopées au bien !** ✅

---

## 🔜 NEXT STEPS

1. ✅ Tester les 4 tests rapides ci-dessus
2. ✅ Tester les workflows (création, édition, suppression, drawer)
3. ✅ Tester la génération de quittance
4. ✅ Tester le workflow complet (Brouillon → Actif)
5. ✅ Valider avec l'équipe
6. 🚀 **Déployer en production !**

---

**Prêt à tester !** 🎯


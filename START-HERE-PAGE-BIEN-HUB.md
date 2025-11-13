# 🚀 Démarrage rapide - Page Bien HUB

## ✨ Ce qui a été créé

Vous avez maintenant une **page HUB élégante** pour chaque bien immobilier qui remplace l'ancienne vue à onglets.

## 🎯 Accéder à la nouvelle page

1. Démarrez votre serveur de développement :
```bash
npm run dev
```

2. Naviguez vers un bien :
```
http://localhost:3000/biens/[ID_DU_BIEN]
```

3. Vous verrez la nouvelle page HUB avec :
   - 📊 **Header riche** avec toutes les infos du bien
   - 💰 **5 KPIs** avec tendances
   - 📈 **Mini-graphiques** (évolution, répartition, recettes/dépenses)
   - ⚠️  **Alertes** (retards, indexations, docs à classer...)
   - 🎯 **6 grosses tuiles animées** vers les sous-pages

## 🧭 Navigation

### Depuis le HUB
Cliquez sur une tuile pour accéder à :
- **Transactions** : Suivi des revenus/dépenses
- **Documents** : Gestion documentaire
- **Photos** : Galerie photos du bien
- **Baux** : Gestion des baux et locataires
- **Rentabilité** : Analyses financières
- **Paramètres** : Configuration du bien

### Retour au HUB
Chaque sous-page a un bouton **"Retour au bien"** en haut à gauche.

## 📂 Structure des fichiers

```
src/
├── components/
│   ├── bien/               # Composants spécifiques page bien
│   │   ├── BienHeader.tsx
│   │   ├── BienKpis.tsx
│   │   ├── BienMiniCharts.tsx
│   │   ├── BienAlerts.tsx
│   │   ├── BienHubGrid.tsx
│   │   └── index.ts
│   │
│   └── shared/             # Composants réutilisables
│       ├── HubTile.tsx
│       ├── InlineChips.tsx
│       ├── BackToPropertyButton.tsx
│       └── index.ts
│
└── app/
    └── biens/[id]/
        ├── page.tsx                    # Page HUB principale ⭐
        ├── BienOverviewClient.tsx      # Composant client
        │
        ├── transactions/               # Sous-pages
        │   ├── page.tsx
        │   └── PropertyTransactionsClient.tsx
        │
        ├── documents/
        │   ├── page.tsx
        │   └── PropertyDocumentsPageClient.tsx
        │
        ├── baux/
        │   ├── page.tsx
        │   └── PropertyBauxPageClient.tsx
        │
        ├── photos/
        │   ├── page.tsx
        │   └── PropertyPhotosPageClient.tsx
        │
        ├── profitability/
        │   ├── page.tsx
        │   └── PropertyProfitabilityPageClient.tsx
        │
        └── settings/
            ├── page.tsx
            └── PropertySettingsPageClient.tsx
```

## 🎨 Personnalisation

### Modifier les KPIs affichés
Éditer `src/app/biens/[id]/page.tsx` ligne 97-131 :
```typescript
const kpis = [
  {
    title: 'Votre KPI',
    value: 'Valeur',
    iconName: 'DollarSign', // Icône lucide-react
    trend: { value: 5, label: 'vs période' },
    color: 'success'
  },
  // ...
];
```

### Ajouter une tuile dans la grille
Éditer `src/components/bien/BienHubGrid.tsx` ligne 22-70 :
```typescript
const tiles = [
  {
    id: 'nouvelle-tuile',
    title: 'Nouveau module',
    href: (id: string) => `/biens/${id}/nouveau`,
    icon: <IconName className="h-7 w-7" />,
    accent: 'bg-pink-50',
    subtitle: (counts?: any) => 'Description'
  },
  // ...
];
```

### Modifier les alertes
Éditer `src/components/bien/BienAlerts.tsx` ligne 22-75.

### Changer les couleurs du thème
Modifier les classes Tailwind dans chaque composant.
Palette actuelle : primary (bleu), success (vert), warning (jaune), danger (rouge).

## 🔧 Fonctionnalités à implémenter

### Priorité haute 🔴
- [ ] Calcul des retards de paiement (ligne 135 dans page.tsx)
- [ ] Calcul des indexations à venir (ligne 136)
- [ ] Calcul des baux finissant < 60j (ligne 137)
- [ ] Gestion des photos (API + Upload)

### Priorité moyenne 🟡
- [ ] Deep-links avec filtres (ex: ?filter=retards)
- [ ] Recherche locale dans le bien
- [ ] Cache des KPIs

### Priorité basse 🟢
- [ ] Photo de couverture dans le header
- [ ] Bouton "Copier l'adresse"
- [ ] Collapse/expand sections (localStorage)

## 📚 Documentation

- **Architecture complète** : `ARCHITECTURE-PAGE-BIEN-HUB.md`
- **Implémentation détaillée** : `IMPLEMENTATION-PAGE-BIEN-HUB.md`
- **Ce guide** : `START-HERE-PAGE-BIEN-HUB.md`

## 🐛 Débogage

### La page ne s'affiche pas
1. Vérifiez que le bien existe dans la DB
2. Vérifiez les erreurs dans la console navigateur
3. Vérifiez les erreurs dans la console serveur

### Les KPIs affichent 0
1. Vérifiez que le bien a des transactions
2. Vérifiez que les transactions ont un `accountingMonth` ou `date`
3. Vérifiez les filtres de date (mois actuel)

### Les graphiques ne s'affichent pas
1. Vérifiez que recharts est installé : `npm install recharts`
2. Vérifiez la console pour des erreurs
3. Vérifiez que les données sont bien passées au composant

### Le bouton "Retour au bien" ne fonctionne pas
1. Vérifiez que `propertyId` est bien passé au composant
2. Vérifiez la route dans le navigateur
3. Vérifiez les erreurs dans la console

## 🎯 Tests rapides

### Test 1 : Navigation HUB
1. Accédez à `/biens/[id]`
2. Cliquez sur "Transactions"
3. Vérifiez le bouton "Retour au bien"
4. Cliquez dessus, vous devez revenir au HUB

### Test 2 : KPIs
1. Créez des transactions pour un bien
2. Actualisez la page HUB
3. Vérifiez que les KPIs sont calculés correctement

### Test 3 : Responsive
1. Ouvrez le DevTools (F12)
2. Passez en mode mobile
3. Vérifiez que la grille passe à 1 colonne
4. Testez la navigation

### Test 4 : Accessibilité
1. Naviguez avec Tab
2. Vérifiez les focus rings visibles
3. Testez les chips avec ArrowLeft/Right

## 💡 Conseils

1. **Performance** : Si vous avez beaucoup de transactions, pensez à optimiser la requête (pagination, limit)
2. **Cache** : Envisagez de cacher les KPIs pour améliorer les performances
3. **Monitoring** : Surveillez les temps de chargement de la page HUB
4. **Mobile** : Testez régulièrement sur mobile, c'est mobile-first
5. **Accessibilité** : Utilisez toujours les aria-labels

## 🚀 Prochaine étape

Consultez `IMPLEMENTATION-PAGE-BIEN-HUB.md` section "Prochaines étapes" pour voir ce qui reste à faire.

---

**Besoin d'aide ?** Consultez la documentation technique ou ouvrez une issue.

**Tout fonctionne ?** Génial ! Testez maintenant avec des données réelles et amusez-vous ! 🎉


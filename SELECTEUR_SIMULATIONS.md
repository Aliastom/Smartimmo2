# 🔽 Sélecteur de Simulations dans l'Optimizer

**Date** : 9 novembre 2025  
**Statut** : ✅ Implémenté

---

## 🎯 **OBJECTIF**

Permettre aux utilisateurs de **choisir quelle simulation utiliser** dans l'optimiseur fiscal, au lieu de toujours charger automatiquement la dernière.

---

## ✅ **CE QUI A ÉTÉ FAIT**

### **1. Ajout de logs pour déboguer** 📊
`src/app/api/fiscal/optimize/route.ts` :
```typescript
console.log(`✅ Simulation chargée: ${simulation.id} - ${simulation.name} (créée le ${simulation.createdAt})`);
console.log('⚠️ Aucune simulation trouvée → Génération de données par défaut');
```

**Permet de voir dans le terminal** :
- Si une simulation est effectivement chargée
- Ou si les données par défaut sont utilisées (50 000€, 2 parts, en couple)

---

### **2. Sélecteur de simulation dans l'UI** 🔽

**Emplacement** : En haut de la page `/impots/optimizer`, juste après la bannière version fiscale

**Design** :
```
┌────────────────────────────────────────────────────────────────────┐
│  📊  Simulation utilisée pour l'optimisation                      │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Simulation 2026 (revenus 2025) • 09/11/2025 14:30       │ ▼ │
│  │ Simulation 2026 - Scénario A • 08/11/2025 10:15         │   │
│  │ Simulation 2026 - Scénario B • 08/11/2025 10:20         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                    │
│                            [ ➜ Nouvelle simulation ]               │
└────────────────────────────────────────────────────────────────────┘
```

**Fonctionnalités** :
- ✅ Liste les 20 dernières simulations sauvegardées
- ✅ Tri par date de création (plus récente en premier)
- ✅ Format de date lisible : `09/11/2025 14:30`
- ✅ Sélection rapide dans un dropdown
- ✅ Bouton "Nouvelle simulation" pour revenir à `/impots/simulation`
- ✅ Design violet/bleu pour se démarquer

---

### **3. Logique de chargement** 🔄

**Au montage de la page** :
1. Charge la **liste des simulations** via `/api/fiscal/simulations?limit=20`
2. Charge la **dernière simulation** via `/api/fiscal/optimize`
3. Pré-sélectionne la dernière dans le dropdown

**Quand l'utilisateur change de simulation** :
1. Met à jour `selectedSimulationId`
2. Charge l'optimisation pour cette simulation : `/api/fiscal/optimize?simulationId=xxx`
3. Affiche les nouvelles stratégies PER / Travaux

---

## 🔧 **FICHIERS MODIFIÉS**

### **Backend**
- `src/app/api/fiscal/optimize/route.ts` :
  - Ajout de logs
  - Correction : recharge `taxParams` depuis `TaxParamsService` au lieu du JSON (évite perte de fonctions)

- `src/app/api/fiscal/simulations/route.ts` :
  - Ajout de `updatedAt` dans la sélection

### **Frontend**
- `src/app/impots/optimizer/OptimizerClient.tsx` :
  - **Nouveaux states** :
    - `simulations` : liste des simulations disponibles
    - `selectedSimulationId` : simulation actuellement sélectionnée
  - **Nouvelles fonctions** :
    - `loadSimulationsList()` : charge la liste
    - `handleSimulationChange()` : gère le changement de sélection
  - **Nouvelle UI** : sélecteur avec dropdown et bouton "Nouvelle simulation"

---

## 🧪 **TESTS**

### **Scénario 1 : Première utilisation (aucune simulation)**
```
1. Aller sur /impots/optimizer
2. ✅ Message "Créer une nouvelle simulation" affiché
3. ✅ Bouton pour aller sur /impots/simulation
4. ✅ Logs : "⚠️ Aucune simulation trouvée → Génération de données par défaut"
```

### **Scénario 2 : Avec simulations sauvegardées**
```
1. Aller sur /impots/simulation
2. Remplir le formulaire + Calculer + Sauvegarder (× 2 fois avec des données différentes)
3. Aller sur /impots/optimizer
4. ✅ Sélecteur affiché avec les 2 simulations
5. ✅ Dernière simulation chargée par défaut
6. ✅ Changer de simulation → Optimisation recalculée
7. ✅ Logs : "✅ Simulation chargée: xxx - Simulation 2026 (revenus 2025) (créée le...)"
```

### **Scénario 3 : Vérifier les données chargées**
```
1. Créer une simulation avec salaire = 30 000€, 1 part
2. Sauvegarder
3. Aller sur /impots/optimizer
4. ✅ Vérifier que l'optimisation utilise bien 30 000€ et 1 part (pas 50 000€ et 2 parts)
5. ✅ Logs : "✅ Simulation chargée: xxx"
```

---

## 📊 **DÉTECTION DES DONNÉES PAR DÉFAUT**

Si vous voyez dans les logs :
```
⚠️ Aucune simulation trouvée → Génération de données par défaut
```

**Ça signifie** :
- Aucune simulation n'a été sauvegardée
- L'optimizer utilise des données "fictives" : 50 000€, 2 parts, en couple

**Solution** :
1. Aller sur `/impots/simulation`
2. Remplir le formulaire avec VOS données réelles
3. Cliquer "Calculer"
4. Cliquer "Sauvegarder"
5. Retourner sur `/impots/optimizer` → Vos données sont chargées

---

## 🎨 **DESIGN DU SÉLECTEUR**

**Couleurs** :
- Fond : Dégradé violet → bleu (`from-purple-50 to-blue-50`)
- Bordure : Violet (`border-purple-200`)
- Icône : Violet (`text-purple-600`)
- Focus : Ring violet (`focus:ring-purple-500`)

**Spacing** :
- Padding intérieur : `p-4`
- Gap entre éléments : `gap-4`
- Dropdown full-width : `w-full`

---

## 🚀 **PROCHAINES AMÉLIORATIONS (OPTIONNELLES)**

### **1. Badge "Simulation source"** 🏷️
Afficher un petit badge à côté des résultats pour indiquer quelle simulation est utilisée :
```
┌────────────────────────────────────────────────────────┐
│  💰 Cash-flow brut : 12 500 €                          │
│  Source : Simulation 2026 - Scénario A                │
└────────────────────────────────────────────────────────┘
```

### **2. Bouton "Dupliquer"** 📋
Permettre de dupliquer une simulation existante pour créer un nouveau scénario :
```
[ 🔍 Voir ] [ 📋 Dupliquer ] [ 🗑️ Supprimer ]
```

### **3. Filtres avancés** 🔍
- Filtrer par année
- Filtrer par foyer (célibataire / couple / parts)
- Rechercher par nom

### **4. Comparaison de simulations** ⚖️
Sélectionner 2 simulations et voir un tableau comparatif :
```
┌──────────────────────────────────────────────────────┐
│                 Scénario A    vs    Scénario B       │
│  Salaire         50 000 €          60 000 €          │
│  IR              5 000 €           6 500 €           │
│  Économie PER    2 000 €           2 500 €           │
└──────────────────────────────────────────────────────┘
```

---

## ✅ **RÉSUMÉ**

✅ **Sélecteur de simulations** ajouté dans l'optimizer  
✅ **Logs** pour déboguer (simulation chargée vs données par défaut)  
✅ **20 dernières simulations** affichées dans le dropdown  
✅ **Design cohérent** (violet/bleu)  
✅ **Bug corrigé** : `taxParams.irDecote.formula is not a function`  

**Le système est maintenant pleinement opérationnel !** 🎉


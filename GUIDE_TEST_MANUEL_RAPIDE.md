# 🧪 Guide de Test Manuel Rapide - Module Fiscal

**Durée estimée** : 15 minutes  
**Objectif** : Vérifier que l'interface utilisateur fonctionne correctement

---

## ✅ Pré-requis

1. Serveur de développement lancé :
   ```bash
   npm run dev
   ```

2. Navigateur ouvert sur `http://localhost:3000`

---

## 🎯 Test 1 : Simulateur Fiscal (5 min)

### URL : `http://localhost:3000/impots/simulation`

### Étapes :

1. ✅ **Vérifier le chargement**
   - [ ] Page se charge sans erreur
   - [ ] Header "Simulation fiscale immobilière" visible
   - [ ] Formulaire visible à gauche

2. ✅ **Remplir le formulaire**
   - [ ] Année fiscale : 2025
   - [ ] Salaire annuel : 50 000€
   - [ ] Autres revenus : 0€
   - [ ] Nombre de parts : 2
   - [ ] En couple : ✓ (activé)
   - [ ] Autofill : ✓ (activé)

3. ✅ **Calculer**
   - [ ] Cliquer "Calculer la simulation"
   - [ ] Loader visible pendant calcul
   - [ ] Cartes s'affichent à droite :
     - [ ] "Salaire imposable" (50 000€)
     - [ ] "Impôt foncier"
     - [ ] "Impacts fiscaux" (IR + PS + TMI)
     - [ ] "Résumé" (Total impôts + Bénéfice net)
     - [ ] "Optimisation fiscale" (alerte)

4. ✅ **Détails**
   - [ ] Cliquer "Voir le détail complet des calculs"
   - [ ] Drawer s'ouvre à droite
   - [ ] Sections visibles :
     - [ ] Revenus par bien
     - [ ] Consolidation
     - [ ] Calcul IR avec tranches
     - [ ] Prélèvements sociaux
     - [ ] Résumé
     - [ ] Métadonnées (Barèmes 2025.1)
   - [ ] Fermer le drawer (bouton X)

5. ✅ **Export** (optionnel)
   - [ ] Cliquer "Export PDF complet"
   - [ ] Fichier téléchargé

**✅ Résultat** : □ Simulateur fonctionnel

---

## 🎯 Test 2 : Optimiseur (5 min)

### URL : `http://localhost:3000/impots/optimizer`

### Étapes :

1. ✅ **Chargement**
   - [ ] Page se charge
   - [ ] Header "Optimisation fiscale" visible
   - [ ] Bouton "Charger la dernière simulation" présent

2. ✅ **Charger simulation**
   - [ ] Cliquer "Charger la dernière simulation"
   - [ ] Loader visible
   - [ ] KPIs s'affichent :
     - [ ] Cash-flow brut
     - [ ] Cash-flow net
     - [ ] Économie fiscale potentielle

3. ✅ **Stratégie Travaux**
   - [ ] Carte "Stratégie d'optimisation par les travaux" visible
   - [ ] **Phase 1** affichée :
     - [ ] Objectif : "Ramener revenus à 0€"
     - [ ] Montant de travaux calculé
     - [ ] Économie IR affichée
     - [ ] Économie PS affichée
     - [ ] Ratio affiché
     - [ ] Barre de progression visible
   - [ ] **Phase 2** affichée :
     - [ ] Objectif : "Créer déficit reportable"
     - [ ] Montant = 10 700€
     - [ ] ⚠️ Avertissement "PS non impactés" visible

4. ✅ **Comparaison PER vs Travaux**
   - [ ] Carte "Comparaison des stratégies" visible
   - [ ] 3 stratégies affichées :
     - [ ] PER (badge si recommandé)
     - [ ] Travaux (badge si recommandé)
     - [ ] Combiné (badge si recommandé)
   - [ ] Ratios visibles pour chaque stratégie
   - [ ] Barres de progression affichées
   - [ ] Recommandation en bas (zone bleue)

5. ✅ **Suggestions**
   - [ ] Carte "Suggestions supplémentaires" visible
   - [ ] Au moins 1 suggestion affichée
   - [ ] Badges complexité visibles
   - [ ] Économies estimées affichées

**✅ Résultat** : □ Optimiseur fonctionnel

---

## 🎯 Test 3 : Admin Paramètres (3 min)

### URL : `http://localhost:3000/admin/impots/parametres`

### Étapes :

1. ✅ **Chargement**
   - [ ] Page se charge
   - [ ] Header "Paramètres fiscaux" visible
   - [ ] Bouton "Mettre à jour les barèmes" présent

2. ✅ **Liste des versions**
   - [ ] Tableau affiché
   - [ ] Au moins 2 versions visibles :
     - [ ] 2024.1
     - [ ] 2025.1
   - [ ] Colonnes visibles : Version, Année, Source, MAJ, Validé par, Statut

3. ✅ **Sélection version**
   - [ ] Cliquer sur une ligne (ex: 2025.1)
   - [ ] Détails affichés en bas
   - [ ] Cartes visibles :
     - [ ] Impôt sur le Revenu (5 tranches)
     - [ ] PS & Régimes (micro-foncier, micro-BIC)
     - [ ] PER (plafond 10%, plancher 4 399€)
     - [ ] SCI IS (taux 15%/25%)

4. ✅ **Mise à jour**
   - [ ] Cliquer "Mettre à jour les barèmes"
   - [ ] Message de succès affiché

**✅ Résultat** : □ Admin paramètres fonctionnel

---

## 🎨 Test 4 : Responsive (2 min)

### Mobile (< 768px)

1. Redimensionner le navigateur (< 768px)
2. Vérifier `/impots/simulation` :
   - [ ] Formulaire et résultats en 1 colonne
   - [ ] Pas de scroll horizontal
   - [ ] Boutons accessibles
   - [ ] Cartes lisibles

### Tablette (768-1024px)

1. Redimensionner (800px)
2. Vérifier :
   - [ ] Layout adapté
   - [ ] 2 colonnes max
   - [ ] Navigation fluide

### Desktop (> 1024px)

1. Plein écran
2. Vérifier :
   - [ ] 2-3 colonnes selon la page
   - [ ] Espacement correct
   - [ ] Pas de débordement

**✅ Résultat** : □ Responsive OK

---

## ♿ Test 5 : Accessibilité (3 min)

### Navigation clavier

1. Sur `/impots/simulation`
2. Tests :
   - [ ] Tab : Parcourt tous les champs dans l'ordre
   - [ ] Enter : Soumet le formulaire
   - [ ] Escape : Ferme le drawer
   - [ ] Focus visible (ring bleu autour éléments)

### Contraste

1. Vérifier :
   - [ ] Textes lisibles (contraste suffisant)
   - [ ] Badges distincts
   - [ ] Boutons visibles

**✅ Résultat** : □ Accessibilité OK

---

## 📊 Grille de Validation Finale

| Test | Durée | Statut | Notes |
|------|-------|--------|-------|
| Simulateur | 5 min | □ | |
| Optimiseur | 5 min | □ | |
| Admin | 3 min | □ | |
| Responsive | 2 min | □ | |
| Accessibilité | 3 min | □ | |
| **TOTAL** | **18 min** | **□** | |

---

## 🚨 Si Problèmes Détectés

### Erreur de calcul

1. Ouvrir la console navigateur (F12)
2. Vérifier les logs
3. Noter l'erreur exacte
4. Comparer avec les tests automatisés

### Problème d'affichage

1. Vérifier la console (F12)
2. Chercher des erreurs React
3. Vérifier les imports de composants

### API en erreur

1. Ouvrir l'onglet Network (F12)
2. Vérifier les requêtes en échec
3. Consulter les logs serveur

---

## ✅ Validation Finale

**Après avoir complété tous les tests** :

□ **Tous les tests manuels passent**  
□ **Aucun bug bloquant détecté**  
□ **UI/UX satisfaisante**  
□ **Performance acceptable**

**Si toutes les cases cochées** → **MODULE VALIDÉ POUR PRODUCTION** ✅

---

## 📝 Rapport à Remplir

**Testeur** : ________________  
**Date** : ________________  
**Durée totale** : _______ min

**Bugs détectés** :
1. ________________________________
2. ________________________________

**Améliorations suggérées** :
1. ________________________________
2. ________________________________

**Recommandation** :
- □ Valider pour production
- □ Corrections mineures nécessaires
- □ Corrections majeures nécessaires

---

**🎊 Bon courage pour les tests !**


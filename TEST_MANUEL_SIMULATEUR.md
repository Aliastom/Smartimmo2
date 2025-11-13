# 🧪 Test Manuel du Simulateur - Instructions Pas à Pas

**Date** : 2025-11-05  
**Durée** : 5 minutes

---

## Étapes de Test

### 1. Ouvrir la page

**URL** : `http://localhost:3000/impots/simulation`

**✅ À vérifier** :
- [ ] Page se charge sans erreur
- [ ] Header "Simulation fiscale immobilière" visible
- [ ] Formulaire visible à gauche
- [ ] Zone résultats vide à droite avec message "Aucune simulation"

---

### 2. Remplir le formulaire

**Dans le formulaire de gauche** :

| Champ | Valeur |
|-------|--------|
| Année fiscale | 2025 |
| Salaire annuel | 50000 |
| Autres revenus | 0 |
| Nombre de parts | 2 |
| En couple | ✓ (activé) |
| Autofill | ✓ (activé) |

---

### 3. Cliquer "Calculer la simulation"

**✅ À vérifier** :
- [ ] Bouton affiche "Calcul en cours..." avec spinner
- [ ] Après 1-2 secondes, cartes apparaissent

---

### 4. Vérifier les résultats

**Cartes attendues** :

#### Carte 1 : Salaire imposable
- [ ] Valeur : 50 000€
- [ ] Subtitle : "2 part(s)"
- [ ] Icône : Euro (bleu)

#### Carte 2 : Impôt foncier
- [ ] Valeur affichée
- [ ] Subtitle : "X bien(s) nu(s)"
- [ ] Icône : Home (vert)

#### Carte 3 : Impacts fiscaux
- [ ] IR affiché (violet)
- [ ] PS affiché (orange)
- [ ] Taux effectif affiché
- [ ] TMI affichée

#### Carte 4 : Résumé
- [ ] Total impôts (IR + PS) en rouge
- [ ] Bénéfice net immobilier en vert

#### Carte 5 : Optimisation fiscale
- [ ] Alerte visible
- [ ] Bouton "Voir les optimisations"

---

### 5. Ouvrir le drawer de détails

**Cliquer** : "Voir le détail complet des calculs"

**✅ À vérifier** :
- [ ] Drawer s'ouvre à droite
- [ ] Titre : "Détails du calcul fiscal 2025"
- [ ] Sections visibles :
  - [ ] Revenus par bien
  - [ ] Consolidation des revenus
  - [ ] Calcul de l'IR (avec tranches détaillées)
  - [ ] Prélèvements sociaux
  - [ ] Résumé
  - [ ] Métadonnées (version 2025.1, source, date)
- [ ] Bouton X pour fermer
- [ ] Fermer avec X fonctionne

---

## 📊 Résultats Attendus

Si vous avez **au moins 1 bien** dans SmartImmo avec des transactions :

### Revenus fonciers
- Si loyers > 0 : Valeur affichée
- Si loyers = 0 : 0€ affiché

### IR (exemple pour 50k€ salaire, 2 parts, 0€ immo)
- Revenu par part : 25 000€
- TMI : 11% (tranche 11 294€ - 28 797€)
- IR net : ~1 800€ (approximatif)
- Taux effectif : ~3.6%

### PS
- Si revenus immo = 0 : PS = 0€
- Si revenus immo > 0 : PS = revenus × 17.2%

---

## 🐛 Si Erreurs

### Erreur 500 au clic "Calculer"

**Console navigateur (F12)** :
- Vérifier les erreurs réseau
- Chercher le message d'erreur

**Console serveur** :
- Vérifier les logs
- Chercher "Error fiscal"

**Solution** :
- Vérifier que les tables Prisma existent
- Vérifier que `npm run dev` tourne sans erreur

### Cartes ne s'affichent pas

**Vérifier** :
- Console navigateur (F12) : Erreurs React ?
- Réseau (F12 > Network) : Requête API OK ?
- État : Loading bloqué ?

### Drawer ne s'ouvre pas

**Vérifier** :
- Console : Erreurs sur Sheet component ?
- Cliquer plusieurs fois ?

---

## ✅ Validation

**Cocher si OK** :
- [ ] Page se charge sans erreur
- [ ] Formulaire fonctionnel
- [ ] Bouton "Calculer" fonctionne
- [ ] Cartes s'affichent
- [ ] Drawer s'ouvre et affiche les détails
- [ ] Pas d'erreur console

**Si toutes les cases cochées** → ✅ **SIMULATEUR VALIDÉ**

---

## 📝 Notes

_Notez ici les problèmes détectés :_

1. ________________________________
2. ________________________________
3. ________________________________

---

**Temps de test** : ______ min  
**Testeur** : ______________  
**Date** : ______________


# 🧪 Test de création de transaction fille (commission de gestion)

## ✅ Prérequis pour que la commission se créé automatiquement

1. **Gestion déléguée activée** : ✅ (vérifié, `gestion.enable = true`)
2. **Nature** : `RECETTE_LOYER`
3. **Catégorie (slug)** : `loyer-charges`
4. **Champs breakdown remplis** : `montantLoyer` (obligatoire)

---

## 🎯 Étapes de test

### 1. Créer une transaction avec les bons paramètres

1. Va sur `/transactions`
2. Clique sur **"+ Nouvelle Transaction"**
3. Remplis le formulaire :
   - **Bien** : Choisis un bien
   - **Bail** : Choisis un bail (optionnel)
   - **Date** : Aujourd'hui
   - **Nature** : `RECETTE_LOYER` (Loyer perçu)
   - **Catégorie** : **"Loyer + charges"** (slug: `loyer-charges`)
   - **Montant** : 800€
   
4. **Les champs de breakdown doivent apparaître** dans un encadré bleu :
   - ✅ "Loyer hors charges (€)"
   - ✅ "Charges récupérables (€)"
   - ✅ "Charges non récupérables (€)"
   - ✅ Toggle "Calcul auto du montant"
   
5. **Remplis le breakdown** :
   - **Loyer hors charges** : 680€
   - **Charges récupérables** : 120€
   - **Charges non récupérables** : 0€
   
6. **Clique sur "Créer"**

---

## ✅ Résultat attendu

**2 transactions créées** :
1. **Transaction mère** (Loyer) : +800€
2. **Transaction fille** (Commission de gestion) : -40,80€ (6% sur 680€ de loyer hors charges)

---

## 🐛 Si ça ne marche pas

### Cas 1 : Les champs de breakdown ne s'affichent PAS

**Problème** : La catégorie `"loyer-charges"` n'existe pas ou son slug est différent.

**Solution** : Vérifie les catégories disponibles en allant dans `/parametres` ou en exécutant :

```bash
curl "http://localhost:3000/api/categories"
```

Cherche une catégorie avec `slug: "loyer-charges"`. Si elle n'existe pas, crée-la :
- Slug : `loyer-charges`
- Label : `Loyer + charges`
- Type : `LOYER`

### Cas 2 : Les champs s'affichent mais la commission ne se crée pas

**Debug** : Regarde les logs dans le terminal Next.js. Tu devrais voir :

```
[Commission] Créée automatiquement pour transaction cmh...
```

Si tu vois une erreur, copie-la et envoie-la moi.

### Cas 3 : La commission se crée mais avec `accounting_month = NULL`

**Déjà corrigé** ! La dernière modification garantit que `accounting_month` est copié.

---

## 🔍 Vérification rapide

**Compte les transactions après création** :

```bash
curl "http://localhost:3000/api/debug/transactions-accounting-month"
```

Tu devrais voir :
- `"total": 2`
- Une transaction avec `amount: 800`
- Une transaction avec `amount: -40.80` (ou -48 selon le taux de commission)

---

## 📝 Notes importantes

- Le taux de commission par défaut est de **6%** sur le loyer hors charges uniquement
- Si le bien n'a pas de société de gestion assignée, la commission utilisera les valeurs par défaut
- La transaction fille hérite de tous les champs de la transaction mère (`accounting_month`, `paidAt`, `method`, etc.)


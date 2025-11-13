# ⚠️ Charges récupérables/non récupérables - Explication

## ❓ Problème signalé

Vous avez perdu les champs de charges récupérables et non récupérables dans le formulaire de création/édition de baux après la migration PostgreSQL.

## ✅ Bonne nouvelle : Rien n'a été perdu !

Les champs existent toujours dans le code et dans le schéma de base de données. Ce n'est PAS un problème de migration PostgreSQL.

## 🔍 Explication

### 1. Les champs existent toujours

Dans le schéma Prisma (`prisma/schema.prisma` lignes 117-118) :
```prisma
model Lease {
  // ...
  chargesRecupMensuelles    Float?  // Ligne 117
  chargesNonRecupMensuelles Float?  // Ligne 118
  // ...
}
```

Dans le formulaire (`LeaseFormComplete.tsx` lignes 415-458) :
```tsx
{process.env.NEXT_PUBLIC_ENABLE_GESTION_SOCIETE === 'true' && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
    <h4>Granularité des charges (optionnel)</h4>
    <div>
      <label>Charges récupérables mensuelles (€)</label>
      <input type="number" value={formData.chargesRecupMensuelles} />
    </div>
    <div>
      <label>Charges non récupérables mensuelles (€)</label>
      <input type="number" value={formData.chargesNonRecupMensuelles} />
    </div>
  </div>
)}
```

### 2. Le problème : Variable d'environnement manquante

Ces champs sont **conditionnés** par une feature flag : `NEXT_PUBLIC_ENABLE_GESTION_SOCIETE`.

Ils ne s'affichent QUE si cette variable vaut `'true'` dans votre `.env.local`.

### 3. Pourquoi la migration PostgreSQL les a "cachés" ?

La migration a créé un nouveau fichier `.env.local` avec uniquement :
```
DATABASE_URL=postgresql://...
```

Mais il manquait :
```
NEXT_PUBLIC_ENABLE_GESTION_SOCIETE=true
```

Sans cette variable, les champs ne s'affichent pas dans le formulaire.

## ✅ Solution appliquée

J'ai ajouté la variable manquante dans `.env.local` :
```bash
DATABASE_URL=postgresql://smartimmo:smartimmo@localhost:5432/smartimmo?schema=public
NEXT_PUBLIC_ENABLE_GESTION_SOCIETE=true
```

## 🔄 Action requise

**Redémarrez le serveur de développement** pour que les changements prennent effet :

```bash
# Arrêter le serveur (Ctrl+C)
# Puis relancer
npm run dev
```

Après redémarrage, les champs "Charges récupérables mensuelles" et "Charges non récupérables mensuelles" devraient réapparaître dans le formulaire de création/édition de baux.

## 📍 Où trouver ces champs ?

Dans le formulaire de bail :
1. Onglet **"Informations essentielles"**
2. Section bleue **"Granularité des charges (optionnel)"**
3. Deux champs :
   - Charges récupérables mensuelles (€) - Refacturées au locataire
   - Charges non récupérables mensuelles (€) - À la charge du propriétaire

## ✅ Vérification

Après le redémarrage, ouvrez un bail (création ou édition) et vous devriez voir :
- Un encadré bleu avec "Granularité des charges (optionnel)"
- Deux champs de saisie pour les montants
- Une info-bulle explicative sous chaque champ

---

**Conclusion :** La migration PostgreSQL n'a rien cassé, c'est juste que la variable d'environnement manquait dans le nouveau `.env.local`. Tout est rétabli ! 🎉

# 🚀 Configuration Gestion Déléguée - Smartimmo

## ⚠️ IMPORTANT - Configuration requise

### 1. Créer le fichier `.env.local` à la racine du projet

```bash
# .env.local
NEXT_PUBLIC_ENABLE_GESTION_SOCIETE=true
```

### 2. Redémarrer le serveur de développement

```bash
# Arrêter le serveur actuel (Ctrl+C)
# Puis relancer
npm run dev
```

### 3. Vérifier que le menu apparaît

Une fois le serveur redémarré, vous devriez voir dans le menu latéral :
- Section "**Gestion**"
- Item "**Gestion déléguée**" avec icône 💼

### 4. Lancer le seed (optionnel mais recommandé)

Pour avoir des données de test :

```bash
npx tsx prisma/seeds/management-companies-seed.ts
```

Cela créera :
- Société "ImmoGest" (taux 6%, min 30€)
- Catégorie "frais_gestion" (si inexistante)
- 1-2 biens liés à cette société
- 1 bail avec charges détaillées

## 🔍 Vérification de l'installation

### Étape 1 : Menu latéral
✅ Présence de "Gestion déléguée" dans la section Gestion

### Étape 2 : Page de gestion
✅ Accès à `http://localhost:3000/gestion-deleguee`
✅ Liste des sociétés de gestion
✅ Bouton "Nouvelle société"

### Étape 3 : Création d'une société
✅ Clic sur "Nouvelle société"
✅ Formulaire complet avec tous les champs
✅ Affectation de biens disponible
✅ Sauvegarde fonctionnelle

### Étape 4 : Modale Bail
✅ Ouvrir/créer un bail
✅ Onglet financier contient "Granularité des charges (optionnel)"
✅ Deux champs : "Charges récupérables" et "Charges non récupérables"

### Étape 5 : Commission automatique
✅ Créer une transaction de loyer pour un bien lié à une société
✅ Vérifier la création automatique de la commission
✅ Voir la commission indentée dans la liste

## 🐛 Dépannage

### Le menu n'apparaît pas
➡️ Vérifier que `.env.local` existe et contient `NEXT_PUBLIC_ENABLE_GESTION_SOCIETE=true`
➡️ Redémarrer complètement le serveur (stop + start)
➡️ Vider le cache : `rm -rf .next` puis `npm run dev`

### Erreur Prisma
➡️ Régénérer le client : `npx prisma generate`
➡️ Synchroniser la DB : `npx prisma db push`

### La modale de société ne s'ouvre pas
➡️ Vérifier la console navigateur pour les erreurs
➡️ Vérifier que les biens existent dans la base

## 📚 Documentation complète

- `IMPLEMENTATION-GESTION-DELEGUEE.md` - Documentation technique complète
- `IMPLEMENTATION-GESTION-DELEGUEE-RESUME.md` - Résumé et guide rapide

## 🎯 Prochains tests manuels

Une fois le setup fait :

1. **Créer une société** "Test Gestion" avec :
   - Taux : 0.07 (7%)
   - Minimum : 25€
   - Mode : LOYERS_UNIQUEMENT

2. **Affecter un bien** à cette société

3. **Créer un bail** pour ce bien avec :
   - Loyer : 500€
   - Charges récup : 30€
   - Charges non-récup : 40€

4. **Créer une transaction loyer** :
   - Vérifier l'encart "Commission estimée"
   - Vérifier le calcul : 500 × 0.07 = 35€ (> 25€ min)
   - Sauvegarder et vérifier que 2 transactions sont créées

5. **Vérifier la liste** :
   - Transaction loyer : +530€ (500 + 30)
   - Commission : -35€ (indentée en dessous)
   - Badge "Auto (Gestion)"

---

💡 **Besoin d'aide ?** Consultez les fichiers de documentation mentionnés ci-dessus.


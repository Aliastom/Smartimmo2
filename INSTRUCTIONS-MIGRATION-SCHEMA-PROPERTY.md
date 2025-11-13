# ⚠️ INSTRUCTIONS POUR FINALISER LA MIGRATION

## Problème actuel

Le schéma Prisma a été synchronisé avec la base de données ✅
Mais le client Prisma ne peut pas être régénéré car le serveur Next.js est en cours d'exécution.

---

## 🔧 Étapes pour finaliser

### 1. Arrêter le serveur de développement

Dans le terminal où tourne `npm run dev`, appuyez sur `Ctrl+C` pour arrêter le serveur.

### 2. Régénérer le client Prisma

```bash
npx prisma generate
```

Cette commande va générer le client Prisma avec les nouveaux champs `isArchived` et `archivedAt`.

### 3. Redémarrer le serveur

```bash
npm run dev
```

### 4. Tester la suppression de bien

1. Aller sur `http://localhost:3000/biens`
2. Cliquer sur l'icône 🗑️ (Poubelle) d'un bien
3. La nouvelle modale s'ouvre avec 3 options :
   - **Archiver** (par défaut)
   - **Transférer** vers un autre bien
   - **Supprimer définitivement**

---

## ✅ Vérification rapide

Une fois le serveur redémarré, vérifiez que :

1. **Pas d'erreur** `Unknown argument 'isArchived'`
2. **La modale s'affiche** avec les 3 options
3. **L'archivage fonctionne** (le bien disparaît de la liste)
4. **Le transfert fonctionne** (toutes les données passent au bien cible)
5. **La suppression définitive** est bloquée si le bien a des données

---

## 📝 Commandes complètes

```bash
# 1. Arrêter le serveur (Ctrl+C dans le terminal npm run dev)

# 2. Régénérer Prisma
npx prisma generate

# 3. Redémarrer
npm run dev

# 4. Tester !
# http://localhost:3000/biens
```

---

## 🎯 Ce qui a été implémenté

✅ Schéma Prisma avec `isArchived` et `archivedAt`
✅ Service `deletePropertySmart` avec 3 modes
✅ API `DELETE /api/properties/:id` mise à jour
✅ API `GET /api/properties/:id/stats` créée
✅ Modale sophistiquée `ConfirmDeletePropertyDialog`
✅ BiensClient intégré avec la nouvelle modale
✅ Base de données synchronisée

**Il ne reste qu'à régénérer le client Prisma !**


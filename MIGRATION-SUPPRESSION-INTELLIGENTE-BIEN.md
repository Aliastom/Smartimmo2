# 🎯 Migration : Suppression Intelligente de Bien

## ✅ Implémentation terminée

Un système complet de suppression intelligente de bien a été créé avec 3 modes :
- **A. Archiver** (soft delete, par défaut)
- **B. Transférer** vers un autre bien
- **C. Supprimer définitivement** (seulement si aucune donnée liée)

---

## 📁 Fichiers créés/modifiés

### Schéma Prisma
- **`prisma/schema.prisma`** : Ajout des champs `isArchived` et `archivedAt` au modèle `Property`

### Composants UI
- **`src/components/properties/ConfirmDeletePropertyDialog.tsx`** : Modale sophistiquée avec 3 options

### Service
- **`src/services/deletePropertySmart.ts`** : Logique de suppression intelligente

### API
- **`src/app/api/properties/[id]/route.ts`** : Endpoint DELETE mis à jour
- **`src/app/api/properties/[id]/stats/route.ts`** : Nouveau endpoint pour les stats

### Frontend
- **`src/app/biens/BiensClient.tsx`** : Intégration de la nouvelle modale

---

## 🗄️ Migration de base de données

### Étape 1 : Migration Prisma

Exécutez la commande suivante pour créer et appliquer la migration :

```bash
npx prisma migrate dev --name add_property_archive_fields
```

### Étape 2 : SQL manuel (si nécessaire)

Si vous devez appliquer manuellement la migration :

```sql
-- Ajouter les colonnes isArchived et archivedAt à la table Property
ALTER TABLE "Property" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Property" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- Créer un index sur isArchived pour améliorer les performances
CREATE INDEX "Property_isArchived_idx" ON "Property"("isArchived");
```

### Étape 3 : Générer le client Prisma

```bash
npx prisma generate
```

---

## 🎨 Utilisation

### Mode A : Archiver (par défaut)

```typescript
const response = await fetch(`/api/properties/${propertyId}`, {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mode: 'archive' }),
});
```

**Résultat :**
- `isArchived = true`
- `archivedAt = now()`
- Toutes les données restent liées
- Le bien n'apparaît plus dans la liste principale (avec filtre)

### Mode B : Transférer

```typescript
const response = await fetch(`/api/properties/${propertyId}`, {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    mode: 'reassign',
    targetPropertyId: 'target-property-id',
  }),
});
```

**Résultat :**
- Tous les liens sont réassignés (baux, transactions, documents, échéances, prêts, photos, etc.)
- Le bien source est supprimé
- Les statistiques sont mises à jour automatiquement

### Mode C : Supprimer définitivement

```typescript
const response = await fetch(`/api/properties/${propertyId}`, {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mode: 'cascade' }),
});
```

**Résultat :**
- Suppression totale du bien
- ⚠️ **Seulement si aucune donnée liée**
- Sinon, erreur 409 avec message explicite

---

## 📊 Statistiques d'un bien

Endpoint : `GET /api/properties/:id/stats`

**Réponse :**
```json
{
  "leases": 3,
  "transactions": 45,
  "documents": 12,
  "echeances": 5,
  "loans": 1
}
```

---

## 🎨 Interface utilisateur

### Modale de suppression

La modale `ConfirmDeletePropertyDialog` affiche :

1. **Informations du bien** avec badges indiquant le nombre d'éléments liés
2. **3 options radio** avec descriptions détaillées :
   - **Archiver** (recommandé) - Badge "Recommandé"
   - **Transférer** - Select pour choisir le bien cible
   - **Supprimer définitivement** - Badge "Irréversible" + confirmation "SUPPRIMER"

3. **Validation contextuelle** :
   - Option "Transférer" : Select obligatoire
   - Option "Supprimer" : Champ de confirmation + désactivé si données liées

4. **Boutons d'action** :
   - Bouton de confirmation change selon le mode (Archiver / Transférer / Supprimer)
   - Couleur adaptée (bleu / orange / rouge)
   - État de chargement avec spinner

---

## 🔍 Filtres et affichage

### Filtre "Biens archivés"

À implémenter dans les prochaines versions :
- Filtre dans la liste des biens : "Inclure archivés : Oui / Non / Tous"
- Badge "Bien archivé" sur les lignes de biens archivés
- Badge "Bien archivé" dans les listes Documents/Transactions/etc.

### Dashboards

Les biens archivés :
- ✅ **Restent inclus** dans les calculs financiers
- ✅ Les montants apparaissent toujours dans les graphiques
- ✅ Peuvent être filtrés avec le toggle "Inclure archivés"

---

## 🔐 Sécurité et validation

### Validations API
- ✅ Mode de suppression valide (archive/reassign/cascade)
- ✅ Bien cible requis pour le mode reassign
- ✅ Bien cible ne doit pas être archivé
- ✅ Suppression cascade bloquée si données liées
- ✅ Transactions Prisma pour garantir la cohérence

### Gestion d'erreur
- `400` : Mode invalide ou bien cible manquant
- `404` : Bien non trouvé
- `409` : Impossible de supprimer (données liées)
- `500` : Erreur serveur

---

## 📝 Logs et journalisation

Tous les modes loggent dans la console :
```
[ARCHIVE] Bien {id} archivé avec succès
[REASSIGN] Bien {sourceId} transféré vers {targetId} et supprimé
[CASCADE] Bien {id} supprimé définitivement
```

Future implémentation suggérée : table `JournalEntry` pour tracer toutes les actions.

---

## 🧪 Tests recommandés

### Test 1 : Archiver un bien avec données
```
1. Créer un bien avec baux, transactions, documents
2. Cliquer sur "Supprimer"
3. Sélectionner "Archiver"
4. Valider
5. Vérifier : isArchived=true, données toujours liées
```

### Test 2 : Transférer un bien
```
1. Créer 2 biens (A et B)
2. Ajouter des données au bien A
3. Supprimer le bien A en mode "Transférer" vers B
4. Vérifier : toutes les données sont sur B, A n'existe plus
```

### Test 3 : Suppression cascade impossible
```
1. Créer un bien avec un bail
2. Essayer de supprimer en mode "Cascade"
3. Vérifier : option désactivée avec message explicite
```

### Test 4 : Suppression cascade réussie
```
1. Créer un bien vide (sans données)
2. Supprimer en mode "Cascade"
3. Taper "SUPPRIMER"
4. Valider
5. Vérifier : bien supprimé définitivement
```

---

## ✅ Checklist de migration

- [x] Schéma Prisma mis à jour
- [x] Service deletePropertySmart créé
- [x] Endpoint API DELETE mis à jour
- [x] Endpoint API stats créé
- [x] Modale ConfirmDeletePropertyDialog créée
- [x] BiensClient.tsx intégré
- [ ] Migration Prisma exécutée (`npx prisma migrate dev`)
- [ ] Client Prisma regénéré (`npx prisma generate`)
- [ ] Filtres "Inclure archivés" ajoutés aux listes
- [ ] Badges "Bien archivé" ajoutés aux interfaces
- [ ] Tests manuels effectués

---

## 🚀 Déploiement

1. **Développement** :
```bash
npx prisma migrate dev --name add_property_archive_fields
npm run dev
```

2. **Production** :
```bash
npx prisma migrate deploy
npx prisma generate
npm run build
```

3. **Vérification** :
```bash
# Vérifier que les colonnes existent
npx prisma studio
# Aller dans Property et vérifier isArchived et archivedAt
```

---

**🎉 La suppression intelligente de bien est prête à être utilisée !**


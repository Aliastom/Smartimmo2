# 🔄 Migration des Documents Existants vers DocumentLink

## 📋 Vue d'ensemble

Ce guide explique comment migrer vos documents existants vers le nouveau système de liens polymorphiques (`DocumentLink`).

---

## ⚠️ Important : Migration Optionnelle

**La migration n'est PAS obligatoire** pour que le système fonctionne.

### Pourquoi ?

Les champs legacy (`propertyId`, `leaseId`, `tenantId`, `transactionId`) sont **conservés** dans le modèle `Document` pour assurer la rétrocompatibilité.

Vos documents existants continueront de fonctionner normalement même sans DocumentLink.

### Quand migrer ?

Migrez vos documents existants si vous voulez :
- ✅ Profiter des nouvelles fonctionnalités (liens multiples, document principal)
- ✅ Uniformiser votre système de documents
- ✅ Simplifier les requêtes (filtrage par contexte plus performant)

---

## 🚀 Utilisation du Script de Migration

### Étape 1 : Simulation (Dry-Run)

Avant de migrer, faites une simulation pour voir ce qui sera créé :

```bash
npx ts-node scripts/migrate-documents-to-links.ts
```

**Exemple de sortie :**

```
🔍 Mode DRY-RUN : Simulation de la migration (aucun changement en base)

📊 Documents trouvés : 150

✅ DPE-2024.pdf → Créerait 1 lien(s) : PROPERTY/clxxx...
✅ Bail-Dupont.pdf → Créerait 2 lien(s) : LEASE/clyyy..., PROPERTY/clxxx...
⏭️  Assurance-PNO.pdf : Déjà migré (1 lien(s))
✅ Facture-Travaux.pdf → Créerait 1 lien(s) : TRANSACTION/clzzz...

============================================================
📊 Résumé de la Simulation
============================================================
Documents à migrer             : 148
Documents déjà migrés          : 2
Liens qui seraient créés       : 165
============================================================

💡 Pour exécuter la migration réelle, lancez :
   npx ts-node scripts/migrate-documents-to-links.ts --execute
```

### Étape 2 : Sauvegarde de la Base de Données

**IMPORTANT** : Avant de lancer la migration réelle, faites une sauvegarde de votre base de données.

#### Avec SQLite (par défaut)

```bash
# Copier le fichier de base de données
cp prisma/dev.db prisma/dev.db.backup-$(date +%Y%m%d-%H%M%S)
```

#### Avec PostgreSQL

```bash
pg_dump -U username -d smartimmo > backup-$(date +%Y%m%d-%H%M%S).sql
```

### Étape 3 : Exécution de la Migration

Une fois la sauvegarde faite et la simulation validée :

```bash
npx ts-node scripts/migrate-documents-to-links.ts --execute
```

**Exemple de sortie :**

```
⚠️  ATTENTION : Cette migration va créer des liens en base de données.

   Assurez-vous d'avoir une sauvegarde de votre base de données avant de continuer.

   Démarrage dans 3 secondes...

🚀 Démarrage de la migration des documents vers DocumentLink...

📊 Documents trouvés : 150

📄 Traitement : DPE-2024.pdf (clxxx...)
   ✅ Lien créé : PROPERTY/clxxx...

📄 Traitement : Bail-Dupont.pdf (clyyy...)
   ✅ Lien créé : LEASE/clyyy...
   ✅ Lien créé : PROPERTY/clxxx...

📄 Traitement : Assurance-PNO.pdf (clzzz...)
   ⏭️  Déjà migré (1 lien(s) existant(s))

...

============================================================
📊 Statistiques de Migration
============================================================
Total de documents traités     : 150
Documents déjà migrés (ignorés) : 2
Documents migrés avec succès    : 148
Liens créés                     : 165
Erreurs                         : 0
============================================================

✅ Migration terminée avec succès !
```

---

## 🔍 Vérification Post-Migration

### 1. Vérifier dans Prisma Studio

```bash
npx prisma studio
```

- Ouvrir la table `DocumentLink`
- Vérifier que les liens ont été créés
- Exemple de ligne :

```
id          : clxxx...
documentId  : cldoc123...
entityType  : PROPERTY
entityId    : clprop456...
isPrimary   : false
createdAt   : 2025-10-16T...
updatedAt   : 2025-10-16T...
```

### 2. Vérifier avec une Requête SQL

```sql
-- Compter les liens créés par type
SELECT 
  entityType, 
  COUNT(*) as count 
FROM DocumentLink 
GROUP BY entityType;

-- Exemple de résultat :
-- entityType  | count
-- GLOBAL      | 15
-- PROPERTY    | 85
-- LEASE       | 42
-- TENANT      | 12
-- TRANSACTION | 11
```

### 3. Tester dans l'Application

1. Ouvrir la page Documents globale
2. Vérifier que les documents s'affichent avec leurs rattachements
3. Ouvrir l'onglet Documents d'un Bien
4. Vérifier que les documents du bien apparaissent

---

## 📊 Logique de Migration

### Règles Appliquées

Le script crée des `DocumentLink` basés sur les champs legacy :

```typescript
// 1. Si propertyId existe
if (document.propertyId) {
  DocumentLink(documentId, entityType: 'PROPERTY', entityId: propertyId)
}

// 2. Si leaseId existe
if (document.leaseId) {
  DocumentLink(documentId, entityType: 'LEASE', entityId: leaseId)
}

// 3. Si tenantId existe
if (document.tenantId) {
  DocumentLink(documentId, entityType: 'TENANT', entityId: tenantId)
}

// 4. Si transactionId existe
if (document.transactionId) {
  DocumentLink(documentId, entityType: 'TRANSACTION', entityId: transactionId)
}

// 5. Si aucun lien spécifique → GLOBAL
if (no links created) {
  DocumentLink(documentId, entityType: 'GLOBAL', entityId: null)
}
```

### Cas Spéciaux

#### Document lié à plusieurs entités

```typescript
// Exemple : Bail signé lié à la fois au bail ET au bien
Document {
  id: "doc-123",
  propertyId: "property-456",
  leaseId: "lease-789"
}

// Résultat de la migration :
DocumentLink { documentId: "doc-123", entityType: "PROPERTY", entityId: "property-456" }
DocumentLink { documentId: "doc-123", entityType: "LEASE", entityId: "lease-789" }
```

#### Document sans lien spécifique

```typescript
// Exemple : Document global (assurance PNO)
Document {
  id: "doc-abc",
  propertyId: null,
  leaseId: null,
  tenantId: null,
  transactionId: null
}

// Résultat de la migration :
DocumentLink { documentId: "doc-abc", entityType: "GLOBAL", entityId: null }
```

---

## 🛡️ Sécurité et Rollback

### Sécurité

- ✅ Le script ne modifie **JAMAIS** les documents existants
- ✅ Il crée uniquement des `DocumentLink`
- ✅ Les champs legacy sont **conservés**
- ✅ Aucune perte de données possible

### En Cas de Problème

#### 1. Annuler la Migration (Rollback)

Si vous avez fait une sauvegarde :

```bash
# Restaurer la sauvegarde SQLite
mv prisma/dev.db.backup-YYYYMMDD-HHMMSS prisma/dev.db

# Ou restaurer PostgreSQL
psql -U username -d smartimmo < backup-YYYYMMDD-HHMMSS.sql
```

#### 2. Supprimer les Liens Créés

Si vous voulez juste supprimer les liens sans restaurer toute la base :

```sql
-- Supprimer tous les DocumentLink
DELETE FROM DocumentLink;

-- Ou supprimer seulement ceux créés pendant la migration
DELETE FROM DocumentLink 
WHERE createdAt > '2025-10-16T00:00:00.000Z';
```

#### 3. Relancer la Migration

Si la migration a échoué à mi-chemin :

```bash
# Le script ignore automatiquement les documents déjà migrés
npx ts-node scripts/migrate-documents-to-links.ts --execute
```

---

## 🎯 Après la Migration

### Avantages Immédiats

1. **Liens multiples** : Un document peut être rattaché à plusieurs contextes
2. **Document principal** : Définir une version principale par contexte
3. **Filtrage optimisé** : Requêtes plus rapides avec les indexes
4. **Interface unifiée** : Utiliser `DocumentsListUnified` partout

### Prochaines Étapes

1. **Définir les documents principaux**
   - Pour chaque contexte, définir quel document est principal
   - Utiliser l'endpoint `/api/documents/[id]/set-primary`

2. **Nettoyer les champs legacy** (optionnel)
   - Une fois la migration validée, vous pouvez créer un script pour mettre à null les champs legacy
   - ⚠️ Attendre quelques semaines pour être sûr que tout fonctionne

3. **Profiter des nouvelles fonctionnalités**
   - Lier un document à plusieurs biens
   - Gérer les versions de documents
   - Utiliser les composants UI créés

---

## 📝 Exemple de Migration Complète

### Avant Migration

```
Document {
  id: "doc-dpe-123",
  filenameOriginal: "DPE-Immeuble-A.pdf",
  propertyId: "prop-appt-1",
  leaseId: null,
  tenantId: null,
  transactionId: null
}
```

### Après Migration (Étape 1)

```
Document {
  id: "doc-dpe-123",
  filenameOriginal: "DPE-Immeuble-A.pdf",
  propertyId: "prop-appt-1",  // Conservé
  leaseId: null,
  tenantId: null,
  transactionId: null
}

DocumentLink {
  id: "link-1",
  documentId: "doc-dpe-123",
  entityType: "PROPERTY",
  entityId: "prop-appt-1",
  isPrimary: false
}
```

### Après Migration (Étape 2 : Lier à d'autres biens)

Utiliser l'endpoint finalize avec `link_existing` :

```typescript
POST /api/documents/finalize
{
  tempId: "temp-456",
  context: { entityType: "PROPERTY", entityId: "prop-appt-2" },
  dedup: {
    decision: "link_existing",
    matchedId: "doc-dpe-123"
  }
}
```

**Résultat** :

```
Document {
  id: "doc-dpe-123",
  // ... inchangé
}

DocumentLink {
  id: "link-1",
  documentId: "doc-dpe-123",
  entityType: "PROPERTY",
  entityId: "prop-appt-1",
  isPrimary: false
}

DocumentLink {
  id: "link-2",           // NOUVEAU
  documentId: "doc-dpe-123",
  entityType: "PROPERTY",
  entityId: "prop-appt-2",
  isPrimary: false
}
```

---

## 🆘 Dépannage

### Erreur : "Cannot find module 'ts-node'"

**Solution** :
```bash
npm install --save-dev ts-node
```

### Erreur : "PrismaClient is not a constructor"

**Solution** :
```bash
npx prisma generate
```

### Erreur : "Table 'DocumentLink' does not exist"

**Solution** :
```bash
npx prisma db push
```

### Le script est lent

**Cause** : Beaucoup de documents à migrer

**Solution** : C'est normal. Le script crée les liens un par un pour éviter les erreurs. Laissez-le se terminer.

---

## 📞 Support

En cas de problème, consulter :
1. Les logs du script (affichés dans la console)
2. La documentation : `README-DOCUMENT-LINKS.md`
3. Le guide d'intégration : `INTEGRATION-DOCUMENT-LINKS.md`

---

## ✅ Checklist de Migration

- [ ] Lire ce guide complet
- [ ] Faire une simulation (`dry-run`)
- [ ] Créer une sauvegarde de la base de données
- [ ] Exécuter la migration (`--execute`)
- [ ] Vérifier les liens créés (Prisma Studio)
- [ ] Tester dans l'application
- [ ] (Optionnel) Définir les documents principaux
- [ ] (Optionnel) Nettoyer les champs legacy après quelques semaines

---

**Date** : 16 Octobre 2025  
**Version** : 1.0  
**Auteur** : AI Assistant (Claude Sonnet 4.5)


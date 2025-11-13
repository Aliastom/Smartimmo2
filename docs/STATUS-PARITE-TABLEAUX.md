# État d'Avancement - Parité Tableaux Global/Property

## Date : 8 octobre 2025

## Objectif
Créer une parité visuelle et fonctionnelle complète entre les tableaux des sections globales et les onglets du détail d'un bien.

## Statut Global : 🟡 EN COURS (40% complété)

---

## ✅ Complété

### 1. DocumentsTable Réutilisable
**Fichier** : `src/ui/tables/DocumentsTable.tsx`

**Caractéristiques** :
- ✅ Colonnes : TYPE | NOM FICHIER | BIEN (si global) | TAILLE | DATE | ACTIONS
- ✅ Actions : Voir (👁️) | Télécharger (⬇️) | Supprimer (🗑️)
- ✅ Props : `context`, `showPropertyColumn`, `getPropertyName`
- ✅ Empty state avec icône et message contextuel
- ✅ Styles uniformes avec tooltips

**Utilisation** :
```tsx
// Global
<DocumentsTable 
  documents={documents}
  context="global"
  showPropertyColumn={true}
  getPropertyName={getPropertyName}
  onView={handleView}
  onDownload={handleDownload}
  onDelete={handleDelete}
/>

// Property
<DocumentsTable 
  documents={documents}
  context="property"
  showPropertyColumn={false}
  onDelete={handleDelete}
/>
```

### 2. PropertyDocumentsClient Amélioré
**Fichier** : `src/ui/properties/PropertyDocumentsClient.tsx`

**Changements** :
- ✅ Utilise `DocumentsTable` au lieu d'une liste custom
- ✅ Filtres ajoutés : Type de document + Recherche (identiques à la page globale)
- ✅ Requête API avec `propertyId` + filtres
- ✅ Header avec compteur de documents
- ✅ Zone de drop maintenue pour upload

### 3. tenantRepository.findByPropertyId
**Fichier** : `src/infra/repositories/tenantRepository.ts`

**Statut** : ✅ Déjà implémenté (session précédente)
- Méthode ajoutée pour récupérer locataires par bien
- Inclut les baux liés au bien
- Plus d'erreur "findByPropertyId is not a function"

---

## 🟡 En Cours

### 4. TransactionsTable - Action "Télécharger PJ"
**Fichier** : `src/ui/tables/TransactionsTable.tsx`

**À faire** :
- [ ] Ajouter colonne PJ cliquable (compteur : 0, 1, n)
- [ ] Action "Télécharger PJ" dans menu actions
- [ ] Modal viewer de PJ uniforme
- [ ] Ordre actions : Éditer | Dupliquer | PJ ⬇️ | PJ ⬆️ | Supprimer

**Colonnes cibles** :
```
DATE | BIEN/LOCATAIRE | LIBELLÉ | CATÉGORIE | PÉRIODE | MONTANT | PJ | ACTIONS
```

---

## ❌ À Faire (Priorité Haute)

### 5. Remplacer Tableaux Pages Globales
**Fichiers à modifier** :
- `src/app/transactions/TransactionsPageClient.tsx`
- `src/app/leases-tenants/page.tsx`
- `src/app/documents/page.tsx`

**Objectif** :
- Utiliser `TransactionsTable`, `LeasesTable`, `TenantsTable`, `DocumentsTable`
- Props `context="global"`
- Supprimer tables custom/DataTable

### 6. LeasesTable - Parité Complète
**Fichier** : `src/ui/tables/LeasesTable.tsx`

**Vérifications** :
- [ ] Mêmes colonnes que section globale
- [ ] Mêmes badges de statut
- [ ] Mêmes actions : PDF | Quittance | $ | Upload | Éditer | Supprimer
- [ ] Badge paiement du mois (Payé/Partiel/Impayé)

### 7. TenantsTable - Badge Baux Actifs
**Fichier** : `src/ui/tables/TenantsTable.tsx`

**À ajouter** :
- [ ] Badge "X bail(s) actif(s)" avec lien vers onglet Baux
- [ ] Colonne STATUT (Actif/Inactif basé sur baux)
- [ ] Actions identiques global/property

### 8. Viewer de PJ Uniforme
**Nouveau fichier** : `src/ui/components/AttachmentViewer.tsx`

**Fonctionnalités** :
- [ ] Modal avec liste des PJ
- [ ] Prévisualisation (PDF, images)
- [ ] Actions : Télécharger, Supprimer
- [ ] Utiliser dans Transactions + autres sections

### 9. Unifier Styles Boutons/Icônes
**Objectif** :
- [ ] Mêmes couleurs : Bleu (éditer), Vert (télécharger), Rouge (supprimer)
- [ ] Mêmes tooltips (texte identique)
- [ ] Mêmes variants Tailwind
- [ ] Supprimer classes CSS custom

### 10. Filtres dans Onglets Bien
**Fichiers** :
- `src/ui/properties/PropertyTransactionsClient.tsx` ✅ (Déjà fait)
- `src/ui/properties/PropertyLeasesClient.tsx`
- `src/ui/properties/PropertyTenantsClient.tsx`
- `src/ui/properties/PropertyDocumentsClient.tsx` ✅ (Complété)

**À ajouter** :
- [ ] Baux : Statut, Date début/fin
- [ ] Locataires : Statut, Recherche nom/email

---

## 🗑️ Nettoyage

### 11. Composants Obsolètes à Supprimer
- [ ] `src/ui/components/PropertyTransactionsTab.tsx` (si existe)
- [ ] `src/ui/components/PropertyDocumentsTab.tsx` (si existe)
- [ ] `src/ui/components/PropertyLeasesTab.tsx` (si existe)

### 12. Logs Console à Retirer
**Rechercher dans** :
- `src/app/biens/[id]/*`
- `src/ui/properties/*`

**Patterns** :
```typescript
console.log(...)
console.error(...) // Garder uniquement en catch
console.info(...)
```

---

## 📊 DoD (Definition of Done)

### Critères d'Acceptation

**Visuel** :
- [ ] Tableaux Transactions/Baux/Locataires/Documents identiques (colonnes, icônes, couleurs)
- [ ] Mêmes boutons d'actions (ordre, style, tooltips)
- [ ] Mêmes filtres (labels, placeholders, formats)

**Fonctionnel** :
- [ ] Action "Télécharger PJ" présente dans Transactions (bien)
- [ ] Onglet Locataires sans erreur + liste correcte
- [ ] Onglet Documents liste les docs du bien (pas "0 document" si docs existent)
- [ ] Viewer de PJ uniforme entre global et property

**Architecture** :
- [ ] 4 composants tables factorisés dans `src/ui/tables/*`
- [ ] Pages globales utilisent ces composants
- [ ] Onglets bien utilisent ces composants
- [ ] Aucun doublon de code

**Nettoyage** :
- [ ] Composants obsolètes supprimés
- [ ] Logs console retirés (sauf errors)
- [ ] Pas de styles CSS doublons

---

## 🚧 Blocages / Risques

**Aucun blocage technique identifié pour l'instant.**

**Risques potentiels** :
1. **Prisma EPERM** : Erreur intermittente sur Windows - Solution : Redémarrer serveur
2. **Nombre de fichiers** : ~15 fichiers à modifier - Risque de régression
3. **Tests manuels requis** : Pas de tests automatisés

---

## 📝 Notes Techniques

### Structure des Props pour Tables

```typescript
interface TableProps {
  // Data
  data: T[];
  loading?: boolean;
  
  // Context
  context?: 'global' | 'property' | 'lease';
  
  // Columns visibility
  showPropertyColumn?: boolean;
  showLeaseColumn?: boolean;
  showPaymentStatus?: boolean;
  
  // Callbacks
  onEdit?: (item: T) => void;
  onDuplicate?: (item: T) => void;
  onDelete?: (id: string) => void;
  onView?: (item: T) => void;
  onDownload?: (item: T) => void;
  
  // Helpers
  getPropertyName?: (id?: string) => string;
  getLeaseName?: (id?: string) => string;
}
```

### Ordre des Actions (Standard)

```
[Éditer] [Dupliquer] [Télécharger PJ] [Upload PJ] [Supprimer]
  🔵       🔵          🟢              🟢          🔴
```

### Couleurs Standard

- **Bleu** : Éditer, Voir, Info
- **Vert** : Télécharger, Succès, Valider
- **Rouge** : Supprimer, Annuler, Erreur
- **Gris** : Dupliquer, Neutre

---

## 🎯 Prochaine Session

**Priorités** :
1. Mettre à jour `TransactionsTable` avec colonne PJ + action télécharger
2. Créer `AttachmentViewer` modal
3. Remplacer tables dans `/transactions` par `TransactionsTable`
4. Nettoyer logs console
5. Tests manuels complets

**Estimation** : 2-3 heures de développement + tests

---

## 📚 Documentation

- 📄 `docs/ARCHITECTURE-BIENS.md` - Architecture globale
- 📄 `docs/CHANGELOG-ARCHITECTURE-BIENS.md` - Changelog initial
- 📄 `docs/CHANGELOG-UX-BIENS-HARMONISATION.md` - Harmonisation UX
- 📄 `docs/STATUS-PARITE-TABLEAUX.md` - Ce document

---

**Dernière mise à jour** : 8 octobre 2025, 15:30


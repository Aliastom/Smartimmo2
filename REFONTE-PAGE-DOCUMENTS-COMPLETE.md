# REFONTE PAGE DOCUMENTS - COMPLÈTE ✅

**Date:** 26 octobre 2025  
**Statut:** Implémentation terminée  
**Approche:** Réplication exacte de la structure de la page Transactions

---

## 🎯 OBJECTIF

Refondre la page "Documents" (http://localhost:3000/documents) pour adopter EXACTEMENT la même organisation, les mêmes composants visuels et les mêmes comportements UX que la page "Transactions".

**Portée:**
- ✅ Route concernée : /documents (page principale)
- ✅ Réutilisation des composants existants (KPI cards filtrantes, charts, filtres, tableau)
- ✅ Aucune modification de la logique backend de documents, ni des hooks d'upload
- ✅ Conservation des permissions/guard et du thème existant

---

## 📁 FICHIERS CRÉÉS

### Composants de Graphiques

#### 1. `src/components/documents/DocumentsMonthlyChart.tsx`
**Graphique évolution mensuelle des documents** (2 colonnes):
- Type : Line chart
- Axe X : Mois (Jan, Fév, ...)
- Axe Y : Nombre de documents uploadés
- Tooltip : Nombre de documents + mois

**Props:**
```typescript
interface DocumentsMonthlyChartProps {
  data: MonthlyDocumentData[];
  isLoading?: boolean;
}

interface MonthlyDocumentData {
  month: string; // Format: 'YYYY-MM'
  count: number; // Nombre de documents uploadés
}
```

#### 2. `src/components/documents/DocumentsByTypeChart.tsx`
**Graphique répartition par type de document** (1 colonne):
- Type : Donut chart
- Catégories : Quittance de loyer, Bail signé, Relevé bancaire, Taxe foncière, Facture travaux, Photo du bien, Autre
- Légende scrollable avec pourcentages
- Palette de 10 couleurs

**Props:**
```typescript
interface DocumentsByTypeChartProps {
  data: DocumentTypeData[];
  isLoading?: boolean;
}

interface DocumentTypeData {
  type: string;
  count: number;
  color?: string;
}
```

#### 3. `src/components/documents/DocumentsOcrStatusChart.tsx`
**Graphique statut OCR** (1 colonne):
- Type : Donut chart (3 parts)
- Couleurs : Vert (traités) / Rouge (échoués) / Amber (en attente)
- Taux de succès en bas
- Détails avec compteurs

**Props:**
```typescript
interface DocumentsOcrStatusChartProps {
  data: OcrStatusData;
  isLoading?: boolean;
}

interface OcrStatusData {
  processed: number; // OCR traité avec succès
  failed: number; // OCR échoué
  pending: number; // En attente OCR/classification
}
```

---

### Composant KPI Bar

#### 4. `src/components/documents/DocumentsKpiBar.tsx`
**Cartes KPI filtrantes** (5 cartes) :
- 🔵 **Total documents** → Reset tous les filtres (couleur bleue)
- 🟡 **En attente OCR / classification** → Filtre sur pending (couleur amber)
- 🟡 **Non classés** → Filtre sur unclassified (couleur yellow)
- 🔴 **OCR échoué** → Filtre sur OCR failed (couleur rouge)
- 🔴 **Orphelins** → Filtre sur documents sans liaison (couleur rouge)

**Props:**
```typescript
interface DocumentsKpiBarProps {
  kpis: DocumentKpis;
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
  isLoading?: boolean;
}

interface DocumentKpis {
  total: number;
  pending: number;
  unclassified: number;
  ocrFailed: number;
  orphans: number;
}
```

---

### Hooks

#### 5. `src/hooks/useDocumentsKpis.ts`
**Hook pour récupérer les KPI documents** :
- Paramètres : période (periodStart, periodEnd), refreshKey
- Retour : `{ kpis, isLoading, error }`
- API : `/api/documents/kpis`

#### 6. `src/hooks/useDocumentsCharts.ts`
**Hook pour récupérer les données des graphiques** :
- Paramètres : période, refreshKey
- Retour : `{ data: { monthly, byType, ocrStatus }, isLoading, error }`
- API : `/api/documents/charts`

---

### Routes API

#### 7. `src/app/api/documents/kpis/route.ts`
**Endpoint GET pour les KPI documents** :
- URL : `/api/documents/kpis`
- Query params : `periodStart`, `periodEnd`
- Retour :
```json
{
  "total": 1250,
  "pending": 45,
  "unclassified": 23,
  "ocrFailed": 12,
  "orphans": 8
}
```

**Logique:**
- Total = count de tous les documents (non supprimés)
- Pending = OCR pending OU classification pending
- Unclassified = pas de typeDocument OU classification_status = "unclassified"
- OcrFailed = ocrStatus = "failed"
- Orphans = documents sans aucune liaison (via DocumentLink)

#### 8. `src/app/api/documents/charts/route.ts`
**Endpoint GET pour les graphiques** :
- URL : `/api/documents/charts`
- Query params : `periodStart`, `periodEnd`
- Retour :
```json
{
  "monthly": [
    { "month": "2025-01", "count": 45 },
    { "month": "2025-02", "count": 52 }
  ],
  "byType": [
    { "type": "Quittance de loyer", "count": 423, "color": "#3b82f6" },
    { "type": "Bail signé", "count": 89, "color": "#10b981" }
  ],
  "ocrStatus": {
    "processed": 1102,
    "failed": 12,
    "pending": 45
  }
}
```

**Logique:**
- Monthly : agrégation par mois de `createdAt`
- ByType : groupement par `typeDocument`, mapping via DocumentType
- OcrStatus : comptage par `ocrStatus`

---

### Composant Client Principal

#### 9. `src/app/documents/DocumentsClient.tsx`
**Composant client principal de la page Documents** :
- Structure identique à `TransactionsClient.tsx`
- Gestion d'état : documents, pagination, filtres, KPI filter actif
- Hooks pour KPI et charts avec période et refreshKey
- Filtres avancés pliables (Type, OCR Status, Liaisons, Dates)
- Tableau avec colonnes : Document, Type, **OCR** (remplace Statut), Lié à, Taille, Date, Actions
- Modals : DocumentModal (vue détail), ConfirmDeleteDocumentModal

**États principaux:**
```typescript
- documents: DocumentTableRow[]
- filters: { query, type, ocrStatus, linkedTo, dateFrom, dateTo }
- activeKpiFilter: 'total' | 'pending' | 'unclassified' | 'ocrFailed' | 'orphans'
- periodStart, periodEnd (format YYYY-MM)
- refreshKey (pour forcer le rafraîchissement)
```

**Comportements:**
- Les cartes KPI filtrent le tableau (toggle on/off, retour à "total" par défaut)
- Les filtres + période se synchronisent avec l'URL (query params)
- Upload via `useUploadReviewModal` (contexte global)
- Pagination standard (prev/next)

---

### Modifications du Tableau

#### 10. `src/components/documents/unified/DocumentTable.tsx`
**Colonne "Statut" → "OCR"** :
- Remplacement de `getStatusBadge()` par `getOcrBadge(doc)`
- Badge OCR avec statut : Traité (✓), Échoué (⚠️), En attente (⏰)
- Couleurs : Vert (completed/processed), Rouge (failed), Amber (pending)
- Tooltip optionnel pour afficher score OCR/classification (si dispo dans les données)

---

### Page Route

#### 11. `src/app/documents/page.tsx`
**Route principale mise à jour** :
```tsx
import { Suspense } from 'react';
import DocumentsClient from './DocumentsClient';

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<div>Chargement...</div>}>
        <DocumentsClient />
      </Suspense>
    </div>
  );
}
```

---

## 🎨 STRUCTURE VISUELLE (identique à /transactions)

```
┌─────────────────────────────────────────────────────────────┐
│  [Header]                                                    │
│  Documents                                        [Uploader] │
│  Suivi du cycle de vie et de la qualité de classement       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  [Graphiques - 4 colonnes]                                   │
│  ┌──────────────┬──────────┬──────────┬──────────┐         │
│  │ Évolution    │Répartit. │  Statut  │          │         │
│  │ mensuelle    │par type  │   OCR    │          │         │
│  │   (2 col)    │ (1 col)  │ (1 col)  │          │         │
│  └──────────────┴──────────┴──────────┴──────────┘         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  [Cartes KPI filtrantes - 5 cartes]                          │
│  ┌──────┬──────┬──────┬──────┬──────┐                      │
│  │Total │Attente│Non  │OCR   │Orphel│                      │
│  │Docs  │      │classé│échoué│ins   │                      │
│  └──────┴──────┴──────┴──────┴──────┘                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  [Filtres]                                   [Masquer]       │
│  [Recherche_________________________] [Rechercher] [Reset]  │
│  Type | OCR Status | Liaisons | Date début | Date fin       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  [Tableau]                                                   │
│  Document | Type | OCR | Lié à | Taille | Date | Actions   │
│  ─────────────────────────────────────────────────────────  │
│  📄 doc1  │ Quit │ ✓   │ Bien  │ 1.2MB  │ 2j   │ 👁️⬇️🗑️   │
│  📄 doc2  │ Bail │ ⏰  │ Bail  │ 850KB  │ 5j   │ 👁️⬇️🗑️   │
│  ─────────────────────────────────────────────────────────  │
│                    [< Précédent] [Suivant >]                │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ CHECKLIST DE VALIDATION

### Graphiques
- [x] Graphique 1 : Évolution mensuelle affiche bien le nombre d'uploads par mois
- [x] Graphique 2 : Répartition par type additionne 100% et affiche tous les types
- [x] Graphique 3 : Statut OCR affiche traités/échoués/en attente avec taux de succès

### Cartes KPI
- [x] Carte "Total documents" reset tous les filtres
- [x] Carte "En attente" filtre sur ocrStatus=pending OU classificationStatus=pending
- [x] Carte "Non classés" filtre sur typeDocument=null OU classificationStatus=unclassified
- [x] Carte "OCR échoué" filtre sur ocrStatus=failed
- [x] Carte "Orphelins" filtre sur documents sans liaisons
- [x] Les cartes sont cliquables et montrent l'état actif (bordure/teinte)

### Filtres
- [x] Filtres pliables/dépliables avec bouton "Afficher/Masquer"
- [x] Champ texte libre (recherche sur nom, texte OCR, tags)
- [x] Type de document (select avec tous les types)
- [x] Statut OCR (select : Traité, Échoué, En attente)
- [x] Liaisons (select : Tous, Orphelin, Lié à Bien/Bail/Transaction/Locataire/Global)
- [x] Période d'upload (date début/fin)
- [x] Bouton "Réinitialiser" qui reset tous les filtres

### Tableau
- [x] Colonne "Statut" remplacée par "OCR"
- [x] Badge OCR affiche "Traité (✓)", "Échoué (⚠️)", "En attente (⏰)"
- [x] Colonnes : Document | Type | OCR | Lié à | Taille | Date | Actions
- [x] Actions : 👁️ voir, ⬇️ télécharger, 🗑️ supprimer
- [x] Pagination fonctionnelle (Précédent/Suivant)

### Comportements
- [x] Les filtres KPI + filtres avancés filtrent bien le tableau
- [x] Upload via bouton "Uploader" ouvre la modal unifiée (contexte global)
- [x] Les modals existantes (view, delete) fonctionnent sans modification
- [x] Le refreshKey force le rechargement des KPI et graphiques après actions
- [x] Pas de régression sur les fonctionnalités existantes

---

## 🚫 HORS PÉRIMÈTRE (non fait)

- ❌ Pas de nouvelle logique backend/DB
- ❌ Pas de modification des modals existants (upload, reclasser, relier, doublon)
- ❌ Pas d'ajout de nouvelles routes ou endpoints (sauf KPI/charts)
- ❌ Pas de nouvelles features (historique des reclassifications, etc.)

---

## 📊 COMPARAISON AVEC /transactions

| Aspect | Transactions | Documents |
|--------|-------------|-----------|
| **Graphiques** | 3 (Évolution cumulée, Catégories, Recettes/Dépenses) | 3 (Évolution mensuelle, Types, Statut OCR) |
| **Cartes KPI** | 4 (Recettes, Dépenses, Solde, Non rapprochées) | 5 (Total, Attente, Non classés, OCR échoué, Orphelins) |
| **Filtres** | Type, Nature, Catégorie, Montant, Dates, Statut, Bien, Bail, Locataire | Type, OCR Status, Liaisons, Dates, Recherche |
| **Colonne spéciale** | Statut (Rapprochée/Non rapprochée) | OCR (Traité/Échoué/Attente) |
| **Modals** | TransactionModal, DeleteModal | DocumentModal, DeleteModal |
| **Upload** | Nouveau bouton modal | Bouton "Uploader" (modal unifiée) |

---

## 🎯 RÉSULTAT FINAL

La page Documents adopte maintenant **exactement** la même structure visuelle et UX que la page Transactions :
- ✅ Même disposition (graphiques au-dessus, cartes KPI en dessous)
- ✅ Même pattern de cartes filtrantes (cliquables, état actif)
- ✅ Même système de filtres pliables
- ✅ Même tableau avec pagination
- ✅ Même gestion d'état et synchronisation URL
- ✅ Aucune régression sur les fonctionnalités existantes

**La refonte est complète et fonctionnelle ! ✨**


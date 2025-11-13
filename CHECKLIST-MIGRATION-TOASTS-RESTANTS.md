# ✅ Checklist : Migration des Toasts Restants

> **Statut** : Migration des fichiers critiques ✅ terminée  
> **Prochaine étape** : Migrer les fichiers non-critiques (admin, UI legacy)

---

## 🎯 Fichiers Critiques (✅ Migrés)

- [x] `src/hooks/useToggleRapprochement.ts`
- [x] `src/components/transactions/TransactionDrawer.tsx`
- [x] `src/components/transactions/TransactionModalV2.tsx`
- [x] `src/components/transactions/ConfirmDeleteTransactionModal.tsx`
- [x] `src/app/transactions/TransactionsClient.tsx`
- [x] `src/components/documents/ConfirmDeleteDocumentModal.tsx`
- [x] `src/components/documents/StagedUploadModal.tsx`
- [x] `src/app/layout.tsx` (Provider monté)
- [x] `src/lib/notify2.ts` (Wrapper créé)

---

## 📋 Fichiers Restants (Non-Critiques)

### 🔴 Priorité Haute (À migrer sous 1 semaine)

- [ ] `src/components/transactions/TransactionModal.tsx` (ancien modal, peut-être deprecated ?)
- [ ] `src/ui/transactions/TransactionModal.tsx`
- [ ] `src/app/baux/LeasesPageClient.tsx`
- [ ] `src/ui/leases-tenants/RentReceiptModal.tsx`
- [ ] `src/ui/leases-tenants/LeaseRowActions.tsx`
- [ ] `src/ui/leases-tenants/LeasePdfModal.tsx`

### 🟡 Priorité Moyenne (À migrer sous 1 mois)

- [ ] `src/app/admin/natures-categories/NaturesCategoriesAdminClient.tsx`
- [ ] `src/app/admin/documents/types/DocumentTypesAdminClient.tsx`
- [ ] `src/app/admin/natures-categories/NatureCategoryFormModal.tsx`
- [ ] `src/app/admin/nature-mapping/page.tsx`
- [ ] `src/app/admin/documents/types/KeywordsManagement.tsx`
- [ ] `src/app/admin/documents/types/TypeSignalsManagement.tsx`
- [ ] `src/app/admin/documents/types/DocumentTypeFormModal.tsx`
- [ ] `src/app/admin/signals/SignalsCatalogClient.tsx`
- [ ] `src/app/admin/documents/types/SignalsManagement.tsx`
- [ ] `src/app/admin/documents/types/RulesManagement.tsx`
- [ ] `src/app/admin/documents/types/DocumentTestModal.tsx`

### 🟢 Priorité Basse (À migrer progressivement)

- [ ] `src/ui/hooks/useLeases.ts`
- [ ] `src/ui/tenants/TenantDetailClient.tsx`
- [ ] `src/ui/admin/EditCategoryModal.tsx`
- [ ] `src/ui/admin/DeleteCategoryModal.tsx`
- [ ] `src/ui/admin/CreateCategoryModal.tsx`
- [ ] `src/app/leases-tenants/locataires/page.tsx`
- [ ] `src/app/leases-tenants/baux/page.tsx`
- [ ] `src/ui/hooks/useDocuments.ts`
- [ ] `src/hooks/usePhotos.ts`
- [ ] `src/ui/hooks/useLeaseStatusSync.ts`
- [ ] `src/ui/hooks/useTenants.ts`

---

## 🔧 Procédure de Migration (Pour Chaque Fichier)

### 1. Ouvrir le fichier
```bash
code src/path/to/file.tsx
```

### 2. Remplacer l'import
```typescript
// ❌ Avant
import { toast } from 'react-hot-toast';

// ✅ Après
import { notify2 } from '@/lib/notify2';
```

### 3. Remplacer les appels
```typescript
// ❌ Avant
toast.success('Message');
toast.error('Erreur');
alert('Message');

// ✅ Après
notify2.success('Message');
notify2.error('Erreur');
notify2.info('Message');
```

### 4. Vérifier les lints
```bash
npm run lint
```

### 5. Tester en développement
```bash
npm run dev
# Tester la fonctionnalité dans l'interface
```

### 6. Cocher dans cette checklist

---

## 🤖 Commandes Utiles

### Trouver tous les fichiers avec toast
```bash
grep -r "from 'react-hot-toast'" src/
grep -r "alert(" src/ --include="*.tsx" --include="*.ts"
```

### Remplacer automatiquement (avec prudence !)
```bash
# Remplacer l'import dans tous les fichiers
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s/from 'react-hot-toast'/from '@\/lib\/notify2'/g" {} +

# Remplacer toast. par notify2.
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s/toast\./notify2\./g" {} +
```

**⚠️ ATTENTION** : Vérifiez toujours manuellement après un remplacement automatique !

---

## 📊 Progression

### Statistiques Actuelles

- **Fichiers totaux avec toasts** : 37
- **Fichiers migrés** : 9 ✅
- **Fichiers restants** : 28 ⏳
- **Pourcentage de migration** : 24% 

### Objectifs

- **Court terme (1 semaine)** : Migrer les 6 fichiers priorité haute → 40%
- **Moyen terme (1 mois)** : Migrer les 11 fichiers priorité moyenne → 70%
- **Long terme (3 mois)** : Migration complète à 100%

---

## 🧹 Nettoyage Final (Après Migration 100%)

### 1. Supprimer le package
```bash
npm uninstall react-hot-toast
```

### 2. Vérifier qu'aucune référence ne reste
```bash
grep -r "react-hot-toast" src/
grep -r "alert(" src/ --include="*.tsx" --include="*.ts"
```

### 3. Commit final
```bash
git add .
git commit -m "🎉 Migration toasts complète - Suppression de react-hot-toast"
```

---

## 📝 Notes pour les Développeurs

### Fichiers Potentiellement Deprecated
Ces fichiers semblent être des anciennes versions :
- `src/components/transactions/TransactionModalV2.tsx.backup`
- `src/ui/transactions/TransactionModal.tsx` (doublon ?)
- `src/components/transactions/TransactionModal.tsx` (ancien ?)

→ **Action** : Vérifier si ces fichiers sont encore utilisés avant de migrer.

### Stratégie "Au Fil de l'Eau"
Pour les fichiers non-critiques (admin, UI legacy) :
- Migrer lors de la prochaine modification du fichier
- Ajouter une note dans la PR : "Migré vers notify2"
- Pas besoin de PRs dédiées pour chaque fichier

---

## 🎯 Milestones

### Milestone 1 : Critique ✅ (24 oct 2025)
- [x] Migration des fichiers critiques (transactions, drawer)
- [x] Provider monté dans layout
- [x] Wrapper notify2 créé
- [x] Documentation rédigée

### Milestone 2 : Haute Priorité (31 oct 2025)
- [ ] Migration des 6 fichiers priorité haute
- [ ] Tests de non-régression
- [ ] Validation utilisateur

### Milestone 3 : Moyenne Priorité (30 nov 2025)
- [ ] Migration des 11 fichiers priorité moyenne
- [ ] Revue de code
- [ ] Tests d'intégration

### Milestone 4 : Finalisation (31 jan 2026)
- [ ] Migration des fichiers restants
- [ ] Suppression de react-hot-toast
- [ ] Documentation mise à jour
- [ ] Célébration 🎉

---

## 📞 Support

**Questions ?** → Consultez le [guide rapide](./GUIDE-RAPIDE-TOASTS.md) ou le [rapport complet](./RAPPORT-MIGRATION-TOASTS-V2.md)

---

**Dernière mise à jour** : 24 octobre 2025  
**Prochaine revue** : 31 octobre 2025


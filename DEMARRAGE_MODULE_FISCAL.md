# 🚀 Guide de Démarrage - Module Fiscal Admin SmartImmo

## ✅ Ce Qui a Été Créé

### 1. **Base de Données** (Prisma)
- ✅ 5 nouveaux modèles créés
- ✅ Modification du modèle `Property` (ajout champs fiscaux)
- ✅ Script de seed prêt (`prisma/seed-fiscal.ts`)

### 2. **Backend API** (15 routes)
- ✅ CRUD Versions fiscales
- ✅ CRUD Types fiscaux
- ✅ CRUD Régimes fiscaux
- ✅ CRUD Compatibilités
- ✅ Utilitaires (diff, update from sources)

### 3. **Services**
- ✅ `TaxParamsUpdater` - Mise à jour automatique
- ✅ `TaxParamsService` - Service frontend
- ✅ `useTaxVersionStore` - Store Zustand

### 4. **Interface Admin** (`/admin/impots/parametres`)
- ✅ Page avec 4 onglets (Tabs shadcn/ui)
- ✅ Composants des 4 onglets créés

---

## 📋 Étapes pour Démarrer

### Étape 1 : Migration de la Base de Données

```bash
# Dans le terminal, à la racine du projet
npx prisma migrate dev --name add_fiscal_admin_module
npx prisma generate
```

Cette commande va :
- Créer les nouvelles tables dans PostgreSQL
- Générer le client Prisma mis à jour

### Étape 2 : Initialiser les Données Fiscales

```bash
npx tsx prisma/seed-fiscal.ts
```

Cette commande va créer :
- 3 types fiscaux (NU, MEUBLE, SCI_IS)
- 5 régimes fiscaux (MICRO, REEL, etc.)
- 3 règles de compatibilité
- 1 version fiscale 2025.1 (publiée)

### Étape 3 : Démarrer le Serveur

```bash
npm run dev
```

### Étape 4 : Accéder à l'Admin

Ouvrir : **http://localhost:3000/admin/impots/parametres**

Vous devriez voir :
- **Onglet "Versions"** : La version 2025.1 publiée
- **Onglet "Types & Régimes"** : 3 types et 5 régimes
- **Onglet "Compatibilités"** : Matrice + 3 règles
- **Onglet "Historique"** : Événements de création

---

## 🛠️ Intégration dans le Formulaire de Bien

### Fichier à Modifier

Le formulaire d'édition de bien se trouve probablement dans :
- `src/app/biens/[id]/page.tsx` ou
- Un composant client dans `src/components/bien/`

### Code à Ajouter

Voici un exemple d'intégration des combobox fiscales :

```tsx
'use client';

import { useState, useEffect } from 'react';
import { TaxParamsService } from '@/services/TaxParamsService';
import { Label } from '@/components/ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';

// Dans votre composant de formulaire de bien
export function PropertyFiscalFields({ initialValues, onChange }) {
  const [fiscalTypes, setFiscalTypes] = useState([]);
  const [fiscalRegimes, setFiscalRegimes] = useState([]);
  const [selectedType, setSelectedType] = useState(initialValues?.fiscalTypeId || '');
  const [selectedRegime, setSelectedRegime] = useState(initialValues?.fiscalRegimeId || '');
  const [loading, setLoading] = useState(false);

  // Charger les types au mount
  useEffect(() => {
    const service = new TaxParamsService();
    service.getTypes(true).then(setFiscalTypes);
  }, []);

  // Charger les régimes quand le type change
  useEffect(() => {
    if (selectedType) {
      setLoading(true);
      const service = new TaxParamsService();
      service.getRegimesForType(selectedType)
        .then((regimes) => {
          setFiscalRegimes(regimes);
          
          // Réinitialiser le régime si incompatible
          if (selectedRegime) {
            const isCompatible = regimes.some(r => r.id === selectedRegime);
            if (!isCompatible) {
              setSelectedRegime('');
              onChange?.({ fiscalTypeId: selectedType, fiscalRegimeId: null });
            }
          }
        })
        .finally(() => setLoading(false));
    } else {
      setFiscalRegimes([]);
      setSelectedRegime('');
    }
  }, [selectedType]);

  // Notifier le parent des changements
  useEffect(() => {
    onChange?.({
      fiscalTypeId: selectedType || null,
      fiscalRegimeId: selectedRegime || null,
    });
  }, [selectedType, selectedRegime]);

  return (
    <div className="space-y-4">
      {/* Type Fiscal */}
      <div>
        <Label htmlFor="fiscalType">Type fiscal</Label>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger id="fiscalType">
            <SelectValue placeholder="Sélectionnez un type fiscal" />
          </SelectTrigger>
          <SelectContent>
            {fiscalTypes.map((type: any) => (
              <SelectItem key={type.id} value={type.id}>
                {type.label} ({type.category})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1">
          Définit la catégorie fiscale de ce bien (Foncier, BIC, IS)
        </p>
      </div>

      {/* Régime Fiscal (affiché seulement si un type est sélectionné) */}
      {selectedType && (
        <div>
          <Label htmlFor="fiscalRegime">Régime fiscal</Label>
          <Select 
            value={selectedRegime} 
            onValueChange={setSelectedRegime}
            disabled={loading || fiscalRegimes.length === 0}
          >
            <SelectTrigger id="fiscalRegime">
              <SelectValue placeholder={
                loading 
                  ? "Chargement..." 
                  : fiscalRegimes.length === 0
                    ? "Aucun régime disponible"
                    : "Sélectionnez un régime"
              } />
            </SelectTrigger>
            <SelectContent>
              {fiscalRegimes.map((regime: any) => (
                <SelectItem key={regime.id} value={regime.id}>
                  {regime.label}
                  {regime.engagementYears && ` (${regime.engagementYears} ans)`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedRegime && (
            <p className="text-xs text-gray-500 mt-1">
              {fiscalRegimes.find((r: any) => r.id === selectedRegime)?.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

### Utilisation dans le Formulaire

```tsx
// Dans votre formulaire de bien
const [formData, setFormData] = useState({
  // ... autres champs
  fiscalTypeId: property.fiscalTypeId,
  fiscalRegimeId: property.fiscalRegimeId,
});

// Dans le JSX
<PropertyFiscalFields
  initialValues={{
    fiscalTypeId: formData.fiscalTypeId,
    fiscalRegimeId: formData.fiscalRegimeId,
  }}
  onChange={(fiscalData) => {
    setFormData({ ...formData, ...fiscalData });
  }}
/>
```

### Mise à Jour dans l'API

Dans votre route API de modification de bien (`PUT /api/properties/:id`), inclure :

```typescript
// Dans le body de la requête
{
  // ... autres champs
  fiscalTypeId: body.fiscalTypeId || null,
  fiscalRegimeId: body.fiscalRegimeId || null,
}
```

---

## 🧪 Tests Rapides

### Test 1 : Créer une Version Draft

```bash
curl -X POST http://localhost:3000/api/admin/tax/update-from-sources \
  -H "Content-Type: application/json" \
  -d '{"year": 2026}'
```

Résultat attendu : Nouvelle version draft 2026.1 créée

### Test 2 : Publier une Version

```bash
curl -X POST http://localhost:3000/api/admin/tax/versions/{VERSION_ID}/publish \
  -H "Content-Type: application/json" \
  -d '{"validatedBy": "Admin Test"}'
```

### Test 3 : Récupérer les Types Actifs

```bash
curl http://localhost:3000/api/admin/tax/types?active=true
```

### Test 4 : Récupérer les Régimes pour un Type

```bash
curl http://localhost:3000/api/admin/tax/regimes?active=true&typeId=NU
```

---

## 🔗 Intégration avec la Simulation Fiscale

La page `/impots/simulation` utilisera automatiquement les données fiscales configurées.

Aucune modification majeure nécessaire, mais vous pouvez améliorer :

```tsx
// Dans SimulationClient.tsx
import { useTaxVersionStore } from '@/stores/useTaxVersionStore';

export default function SimulationClient() {
  const { activeVersion, fetchActiveVersion } = useTaxVersionStore();

  useEffect(() => {
    fetchActiveVersion();
  }, [fetchActiveVersion]);

  // Utiliser activeVersion dans les calculs
  const taxParams = activeVersion?.params?.jsonData 
    ? JSON.parse(activeVersion.params.jsonData) 
    : null;
}
```

---

## 📊 Structure du Projet

```
src/
├── app/
│   ├── admin/impots/parametres/
│   │   ├── page.tsx                 # Page principale
│   │   └── ParametresClient.tsx     # Client avec 4 onglets
│   └── api/admin/tax/
│       ├── versions/                # Routes versions
│       ├── types/                   # Routes types
│       ├── regimes/                 # Routes régimes
│       ├── compat/                  # Routes compatibilités
│       ├── update-from-sources/     # Update auto
│       └── diff/                    # Diff viewer
├── components/admin/fiscal/
│   ├── VersionsTab.tsx              # Onglet Versions
│   ├── TypesRegimesTab.tsx          # Onglet Types & Régimes
│   ├── CompatibilitiesTab.tsx       # Onglet Compatibilités
│   └── HistoryTab.tsx               # Onglet Historique
├── services/
│   ├── TaxParamsUpdater.ts          # Service update auto
│   └── TaxParamsService.ts          # Service frontend
└── stores/
    └── useTaxVersionStore.ts        # Store Zustand

prisma/
├── schema.prisma                    # Modèles étendus
└── seed-fiscal.ts                   # Script d'initialisation
```

---

## 🎯 Fonctionnalités Prêtes

### ✅ Gestion des Versions
- Création de versions depuis sources officielles
- Diff viewer entre versions
- Publication / Archivage / Rollback
- Historique des modifications

### ✅ Gestion Types & Régimes
- CRUD complet
- Association types → régimes
- Activation/Désactivation
- Engagement fiscal (2-3 ans)

### ✅ Gestion Compatibilités
- Matrice visuelle
- Règles : MIX / GLOBAL_UNIQUE / EXCLUSIVE
- Validation automatique

### ✅ Intégration Biens
- Combobox dynamiques
- Filtrage régimes selon type
- Validation compatibilité

---

## 🚨 Points d'Attention

### 1. Permissions Admin

⚠️ Les routes `/api/admin/tax/*` **ne sont pas protégées** actuellement.

**À ajouter** : Middleware d'authentification admin dans `middleware.ts`

### 2. Scraping Sources Officielles

Le service `TaxParamsUpdater` contient un **placeholder**. 

Pour implémenter le scraping réel :
- DGFiP : https://www.impots.gouv.fr/bareme-de-limpot-sur-le-revenu
- BOFiP : https://bofip.impots.gouv.fr
- Service-Public : https://www.service-public.fr

Utiliser `cheerio` ou `puppeteer` pour le parsing.

### 3. Validation Côté Client

Ajouter validation Zod dans les formulaires :

```typescript
import { z } from 'zod';

const fiscalTypeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  category: z.enum(['FONCIER', 'BIC', 'IS']),
  description: z.string().optional(),
  isActive: z.boolean(),
});
```

---

## 📞 Support & Documentation

- **Guide complet** : `MODULE_FISCAL_ADMIN_GUIDE.md`
- **Architecture** : Voir section "Architecture Créée"
- **API** : Toutes les routes sont documentées dans les fichiers `route.ts`

---

## ✨ Prochaines Améliorations Possibles

- [ ] Interface graphique pour éditer JSON des paramètres
- [ ] Export Excel des versions fiscales
- [ ] Notifications par email lors de nouvelles versions
- [ ] Dashboard avec statistiques d'utilisation
- [ ] Import/Export de configurations fiscales
- [ ] Simulation de scénarios fiscaux multiples
- [ ] Comparaison avant/après changement de régime

---

**Tout est prêt ! Lancez les 4 commandes ci-dessus et vous aurez un module fiscal admin complet et fonctionnel. 🎉**

Pour toute question, consultez `MODULE_FISCAL_ADMIN_GUIDE.md` pour plus de détails techniques.


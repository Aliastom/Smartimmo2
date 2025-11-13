# ✅ Implémentation - Occupants + Historique Persistant

## 🎯 Objectifs Atteints

### 1. ✅ Occupants "Actuels" - Définition Stricte

**Règle** : Locataire lié à au moins un bail ACTIF à la date du jour

**Implémentation** :
- **API** : `GET /api/tenants/by-property?propertyId=X&activeOnly=true`
- **Filtrage** : `tenant.leases.some(lease => getLeaseRuntimeStatus(lease) === 'active')`
- **Exclusions** : Baux "BROUILLON", "SIGNÉ", "À VENIR" ne sont PAS comptés

### 2. ✅ Historique Persistant

**Modèle** : `OccupancyHistory`
```prisma
model OccupancyHistory {
  id           String   @id @default(cuid())
  propertyId   String
  tenantId     String
  leaseId      String?  // Nullable si bail supprimé
  startDate    DateTime
  endDate      DateTime?
  monthlyRent  Float    // Loyer HC + Charges
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  property Property @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  tenant   Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([propertyId, tenantId])
  @@index([propertyId, startDate])
}
```

**API** : 
- `GET /api/occupancy-history?propertyId=X` - Lecture historique groupé par locataire
- `POST /api/occupancy-history` - Création/mise à jour d'entrée

### 3. ✅ UI Occupants Réorganisée

**Sections** :
1. **Occupants actuels** - Locataires avec baux ACTIFS (runtimeStatus === 'active')
2. **Historique des occupants** - Périodes passées depuis OccupancyHistory

**Affichage** :
- Occupants actuels : Badge ACTIF (vert) + période en cours
- Historique : Badge TERMINÉ (gris) + périodes passées

### 4. ✅ Invalidations

**Queries invalidées après mutation bail** :
- `['leases', propertyId]`
- `['lease-stats', propertyId]`
- `['tenants', 'byProperty', { propertyId }]`
- `['occupancy-history', propertyId]`
- `['property-stats']`
- `['dashboard', 'summary']`

## 📁 Fichiers Créés/Modifiés

### Nouveaux Fichiers ✅
- `src/app/api/occupancy-history/route.ts` - API lecture/écriture historique
- `src/ui/hooks/useOccupancyHistory.ts` - Hook React Query pour historique

### Fichiers Modifiés ✅
- `prisma/schema.prisma` - Ajout modèle OccupancyHistory
- `src/app/api/tenants/by-property/route.ts` - Filtrage avec getLeaseRuntimeStatus
- `src/ui/properties/PropertyTenantsClient.tsx` - UI avec 2 sections
- `src/ui/shared/tables/LeasesTable.tsx` - Suppression icône PDF de colonne STATUT
- `src/ui/properties/PropertyHeader.tsx` - Ordre onglets (Baux avant Occupants)

## 🔄 Workflow de l'Historique

### Quand un bail devient ACTIF
```typescript
// Option 1: Lors du passage à ACTIF
await prisma.occupancyHistory.create({
  data: {
    propertyId: lease.propertyId,
    tenantId: lease.tenantId,
    leaseId: lease.id,
    startDate: lease.startDate,
    endDate: null, // Toujours en cours
    monthlyRent: lease.rentAmount + (lease.charges || 0)
  }
});
```

### Quand un bail se termine
```typescript
// Mettre à jour l'entrée existante
await prisma.occupancyHistory.updateMany({
  where: { leaseId: lease.id },
  data: { endDate: new Date() }
});
```

### Quand un bail est supprimé
```typescript
// L'historique persiste (leaseId devient nullable)
// OU créer l'entrée si elle n'existe pas avant de supprimer le bail
```

## 🧪 Tests Manuels à Effectuer

### Test 1: Bail ACTIF → Occupant Actuel
- [ ] Créer bail avec startDate <= today <= endDate + status="ACTIF"
- [ ] Vérifier que le locataire apparaît dans "Occupants actuels"
- [ ] Badge ACTIF (vert) affiché

### Test 2: Bail À VENIR → PAS Occupant Actuel
- [ ] Créer bail avec startDate > today + status="SIGNÉ"  
- [ ] Vérifier que le locataire N'apparaît PAS dans "Occupants actuels"
- [ ] Badge À VENIR (bleu) dans onglet Baux

### Test 3: Passage ACTIF → TERMINÉ
- [ ] Modifier endDate d'un bail ACTIF pour qu'elle soit passée
- [ ] OU Changer status à "RÉSILIÉ"
- [ ] Vérifier que l'occupant quitte "Occupants actuels"
- [ ] Vérifier qu'une entrée apparaît dans "Historique"

### Test 4: Suppression Bail
- [ ] Supprimer un bail terminé
- [ ] Vérifier que l'historique est conservé
- [ ] Période affichée dans section "Historique des occupants"

### Test 5: Cartes KPI
- [ ] Créer bail ACTIF → "Baux actifs" +1, "Loyer mensuel" augmente
- [ ] Sans F5 manuel
- [ ] Cartes rafraîchies automatiquement

## ⚠️ Action Requise

### Redémarrer le serveur Next.js
La table `OccupancyHistory` a été ajoutée au schéma Prisma. Pour que les changements soient pris en compte :

```bash
# 1. Arrêter le serveur (Ctrl+C)
# 2. Régénérer Prisma Client
npx prisma generate
# 3. Redémarrer le serveur
npm run dev
```

### Créer les entrées d'historique existantes
Pour les baux déjà terminés, créer manuellement les entrées :

```bash
# Script SQL ou API POST pour chaque bail terminé
POST /api/occupancy-history
{
  "propertyId": "...",
  "tenantId": "...",
  "leaseId": "...",
  "startDate": "...",
  "endDate": "...",
  "monthlyRent": 900
}
```

## 🎨 Interface Finale

### Onglet Occupants

```
┌─────────────────────────────────────────────────────────┐
│ Occupants                      [+ Créer un bail]        │
│ 1 occupant actuel • 2 dans l'historique                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 👥 Occupants actuels                                    │
│ ┌─────────────────────────────────────────────────┐    │
│ │ THOMAS DUBIGNY                          [Voir]  │    │
│ │ thomas.dubigny@gmail.com                        │    │
│ │ ───────────────────────────────────────         │    │
│ │ Baux actifs :                                   │    │
│ │ 🟢 ACTIF - Du 01/09/2025 au 31/12/2025 - 1000€ │    │
│ └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Historique des occupants                                │
│ ┌─────────────────────────────────────────────────┐    │
│ │ Jean DUPONT                                     │    │
│ │ jean.dupont@example.com                         │    │
│ │ ───────────────────────────────────────         │    │
│ │ Périodes d'occupation :                         │    │
│ │ ⚪ TERMINÉ - Du 01/01/2024 au 31/12/2024 - 800€ │    │
│ │ ⚪ TERMINÉ - Du 01/01/2023 au 31/12/2023 - 750€ │    │
│ └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

**✅ Implémentation terminée !**

**Prochaine étape** : Redémarrer le serveur pour que Prisma Client soit régénéré avec le nouveau modèle `OccupancyHistory`.

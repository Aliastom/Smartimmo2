# Administration des Types de Documents

## Vue d'ensemble

Cette fonctionnalité permet de gérer les types de documents utilisés dans l'application SmartImmo via une interface d'administration dédiée.

## Caractéristiques

### Types de documents

1. **Types Système** (`isSystem: true`)
   - Préchargés lors de l'initialisation (seed)
   - Code **IMMUTABLE** (non modifiable)
   - **Suppression interdite** (403 Forbidden)
   - Seule désactivation possible via `isActive: false`
   - Exemples: `RENT_RECEIPT`, `SIGNED_LEASE`, `EDL_IN`, etc.

2. **Types Custom** (`isSystem: false`)
   - Créés par les administrateurs
   - Modifiables (label, icône, ordre, actif)
   - Supprimables si non référencés (soft-delete)
   - Code au format `UPPER_SNAKE_CASE`

### Règles de gestion

- **Création**: Code obligatoire en `UPPER_SNAKE_CASE`, label obligatoire, icône optionnelle
- **Modification**: 
  - Types système: seuls label, icône, ordre et `isActive` modifiables
  - Types custom: tous les champs modifiables sauf le code
- **Suppression**:
  - Types système: 403 Forbidden
  - Types utilisés (`documentsCount > 0`): 409 Conflict
  - Types custom non utilisés: soft-delete (`isActive: false`)

## Endpoints API

### GET `/api/admin/document-types`
Récupère la liste des types de documents avec leur usage.

**Query params:**
- `includeInactive` (boolean): inclure les types inactifs

**Response:**
```json
{
  "items": [
    {
      "id": "...",
      "code": "RENT_RECEIPT",
      "label": "Quittance de loyer",
      "icon": "Receipt",
      "isSystem": true,
      "isActive": true,
      "order": 0,
      "documentsCount": 5,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "counts": {
    "type-id": 5
  }
}
```

### POST `/api/admin/document-types`
Crée un nouveau type custom.

**Body:**
```json
{
  "code": "CONTRACT",
  "label": "Contrat",
  "icon": "FileText",
  "order": 10
}
```

**Validations:**
- `code`: UPPER_SNAKE_CASE, unique
- `label`: requis
- Crée automatiquement avec `isSystem: false`, `isActive: true`

**Responses:**
- `201`: Type créé
- `400`: Validation error (format code invalide)
- `409`: Duplicate code

### PUT `/api/admin/document-types/:id`
Met à jour un type existant.

**Body:**
```json
{
  "label": "Nouveau label",
  "icon": "FileCheck",
  "order": 20,
  "isActive": false
}
```

**Protections:**
- Types système: code non modifiable (403)
- `isSystem` non modifiable

**Responses:**
- `200`: Type mis à jour
- `403`: Tentative de modifier le code d'un type système
- `404`: Type non trouvé

### DELETE `/api/admin/document-types/:id`
Supprime (désactive) un type custom.

**Protections:**
- Types système: 403 Forbidden
- Types utilisés: 409 Conflict avec `documentsCount`

**Responses:**
- `200`: Type désactivé (`isActive: false`)
- `403`: Type système
- `409`: Type utilisé

### GET `/api/admin/document-types/:id/usage`
Récupère l'usage d'un type.

**Response:**
```json
{
  "id": "...",
  "code": "EDL_IN",
  "label": "État des lieux d'entrée",
  "documentsCount": 5,
  "isSystem": true,
  "isActive": true
}
```

## Interface utilisateur

### Page `/admin/document-types`

**Composants:**
1. **Header**
   - Titre "Types de documents"
   - Bouton "+ Nouveau type"

2. **Filtres**
   - Barre de recherche (label/code)
   - Toggle "Afficher types inactifs"

3. **Table**
   - Colonnes: Icône, Label, Code, Statut, Ordre, Documents, Actions
   - Badges: "Système" (gris), "Actif" (vert), "Inactif" (jaune)
   - Actions: Modifier (tous), Supprimer (custom uniquement)

4. **Statistiques**
   - Types totaux
   - Types système
   - Types custom actifs

5. **Modals**
   - Création: code, label, icône, ordre
   - Édition: label, icône, ordre, actif (pour custom)

### Composant `IconPicker`

Sélecteur d'icônes Lucide React avec:
- Liste d'icônes communes (FileText, Receipt, etc.)
- Recherche par nom
- Prévisualisation
- Dropdown avec sélection visuelle

## Hooks React Query

### `useAdminDocumentTypes(includeInactive)`
Récupère la liste admin avec usage.

### `useCreateDocumentType()`
Mutation pour créer un type.

### `useUpdateDocumentType()`
Mutation pour mettre à jour un type.

### `useDeleteDocumentType()`
Mutation pour supprimer (désactiver) un type.

### `useDocumentTypeUsage(id)`
Récupère l'usage d'un type spécifique.

**Invalidations:**
- Toutes les mutations invalident `['documentTypes', 'admin']` et `['documents', 'types']`
- Garantit la cohérence entre la liste admin et la liste publique

## Tests d'acceptation

✅ **Test 1**: Page admin accessible  
✅ **Test 2**: GET liste avec counts  
✅ **Test 3**: POST création type custom  
✅ **Test 4**: Type visible dans liste active  
✅ **Test 5**: PUT modification label/icône/ordre  
✅ **Test 6**: DELETE soft-delete  
✅ **Test 7**: Type inactif invisible dans liste active  
✅ **Test 8**: DELETE type système → 403  
✅ **Test 9**: DELETE type utilisé → 409  
✅ **Test 10**: PUT code système → 403  
✅ **Test 11**: GET /usage fonctionnel  
✅ **Test 12**: Validation UPPER_SNAKE_CASE → 400  

## Intégrations

### Documents existants

Les comboboxes de sélection de type dans:
- Modal d'upload de document
- Filtres de la page Documents
- Modal de transaction (pièces jointes)

...utilisent tous l'endpoint `/api/document-types` (actifs uniquement) et sont automatiquement synchronisés via l'invalidation des queries.

### Migration et seed

Les types système sont créés via le seed:
```bash
node prisma/seed-document-types.js
```

Types système pré-définis:
- `RENT_RECEIPT` - Quittance de loyer
- `SIGNED_LEASE` - Bail signé
- `LEASE_DRAFT` - Brouillon de bail
- `EDL_IN` - État des lieux d'entrée
- `EDL_OUT` - État des lieux de sortie
- `RIB` - Relevé d'identité bancaire
- `INSURANCE` - Assurance
- `TAX` - Impôts
- `MISC` - Divers
- `PHOTO` - Photo

## Sécurité

1. **Validation backend systématique** (Zod schemas)
2. **Normalisation du code** (toUpperCase().trim())
3. **Protections sur types système** (code immutable, suppression interdite)
4. **Vérification de l'usage** avant suppression
5. **Soft-delete** pour traçabilité

## Évolutions futures

- [ ] Logging audit (createdBy, updatedBy) si table User disponible
- [ ] Permissions granulaires (admin vs super-admin)
- [ ] Import/export de types custom
- [ ] Historique des modifications


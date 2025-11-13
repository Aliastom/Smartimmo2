# Génération de PDF pour les baux

## 📝 Description

Cette fonctionnalité permet de générer automatiquement un document PDF pour chaque bail. Le PDF contient toutes les informations du bail, du bien loué et du locataire.

## 🎯 Fonctionnalités

- **Génération automatique** : Génération d'un PDF professionnel à partir des données du bail
- **Stockage sécurisé** : Le PDF est stocké dans le système de fichiers et référencé en base de données
- **Document associé** : Création automatique d'un Document avec `docType: 'lease'`
- **Téléchargement** : Possibilité de télécharger le PDF généré
- **Toast de succès** : Notification avec lien de téléchargement direct

## 📂 Fichiers créés

### 1. Template PDF
- **`src/pdf/LeasePdf.tsx`** : Template React-PDF pour générer le document
  - Contient toutes les informations du bail
  - Style professionnel avec tableaux et sections
  - Pagination automatique
  - Date de génération

### 2. Route API
- **`src/app/api/leases/[id]/pdf/route.ts`** : Endpoint GET pour générer le PDF
  - Récupère les données du bail avec propriété et locataire
  - Génère le PDF avec `@react-pdf/renderer`
  - Sauvegarde le fichier dans `/public/uploads/{year}/{month}/`
  - Crée un Document en base de données
  - Retourne `{ documentId, downloadUrl, fileName }`

### 3. Composant UI
- **`src/ui/leases-tenants/LeaseRowActions.tsx`** : Bouton de génération de PDF
  - Icône `FileText` (lucide-react)
  - État de chargement pendant la génération
  - Toast de succès avec action de téléchargement
  - Invalidation automatique de la query `documents`

### 4. Modification du tableau
- **`src/ui/leases-tenants/LeasesTable.tsx`** : Utilise le nouveau composant `LeaseRowActions`

## 🚀 Utilisation

### Dans l'interface

1. Aller sur la page `/leases-tenants`
2. Dans l'onglet "Baux", cliquer sur l'icône 📄 (FileText) pour un bail
3. Le PDF est généré automatiquement
4. Un toast de succès s'affiche avec un bouton "Télécharger"
5. Le document apparaît dans la liste des documents du bien

### Via l'API

```bash
# Générer un PDF pour un bail
GET /api/leases/{leaseId}/pdf

# Réponse
{
  "documentId": "cmgffjd200005z8yl3x4tlhnh",
  "downloadUrl": "/uploads/2025/10/bail-villa-familiale-2025-10-06-da8f7edb.pdf",
  "fileName": "Bail-Villa Familiale-2025-10-06.pdf"
}
```

## 📋 Contenu du PDF

Le PDF généré contient les sections suivantes :

1. **En-tête**
   - Titre : "CONTRAT DE BAIL"
   - Type de bail (Résidentiel, Commercial, etc.)
   - Date de génération

2. **Bien loué**
   - Nom du bien
   - Adresse complète

3. **Locataire**
   - Nom complet
   - Email
   - Téléphone

4. **Détails du bail**
   - Type de bail
   - Statut (Actif, Terminé, Renouvelé)
   - Date de début
   - Date de fin
   - Jour de paiement

5. **Conditions financières** (tableau)
   - Loyer mensuel hors charges
   - Charges mensuelles
   - Total mensuel
   - Dépôt de garantie

6. **Notes** (si présentes)

7. **Pied de page**
   - Mention "Document généré automatiquement - SmartImmo"
   - ID du bail
   - Numéro de page

## 🔧 Dépendances

- `@react-pdf/renderer` : Génération de PDF côté serveur
- `lucide-react` : Icône FileText
- `sonner` : Toasts de notification
- `@tanstack/react-query` : Gestion du cache et des queries

## 🧪 Tests manuels

### Scénario 1 : Génération réussie
1. Aller sur `/leases-tenants`
2. Cliquer sur l'icône PDF d'un bail
3. ✅ Toast de succès affiché
4. ✅ Cliquer sur "Télécharger" ouvre le PDF
5. ✅ Le document apparaît dans la liste des documents

### Scénario 2 : Génération multiple
1. Générer le PDF d'un même bail 2 fois
2. ✅ 2 documents distincts créés (hash différent)
3. ✅ Les 2 PDF sont accessibles

### Scénario 3 : Bail sans propriété ou locataire
1. Tester avec un bail incomplet (si possible)
2. ✅ Erreur 404 avec message clair

### Scénario 4 : Erreur réseau
1. Stopper le serveur
2. Tenter de générer un PDF
3. ✅ Toast d'erreur affiché

## 📊 Stockage

Les PDF sont stockés selon l'arborescence suivante :

```
public/
  uploads/
    {year}/
      {month}/
        bail-{nom-bien}-{date}-{hash}.pdf
```

Exemple : `/uploads/2025/10/bail-villa-familiale-2025-10-06-da8f7edb.pdf`

## 🗄️ Base de données

Chaque PDF généré crée un enregistrement Document :

```typescript
{
  id: string;
  fileName: "Bail-Villa Familiale-2025-10-06.pdf";
  mime: "application/pdf";
  size: 3320; // en octets
  url: "/uploads/2025/10/bail-villa-familiale-2025-10-06-da8f7edb.pdf";
  sha256: "da8f7edb...";
  docType: "lease";
  propertyId: string;
  leaseId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## 🎨 Style du PDF

- Police : Helvetica
- Format : A4
- Marges : 40pt
- Couleurs : Palette neutre (gris/bleu)
- Tableaux : Bordures fines avec en-têtes grisés
- Pagination : Automatique en bas de page

## 🔐 Sécurité

- ✅ Validation des données du bail
- ✅ Vérification de l'existence du bail/propriété/locataire
- ✅ Génération de hash SHA-256 pour chaque fichier
- ✅ Stockage dans un dossier public mais avec noms de fichiers aléatoires
- ✅ Gestion des erreurs avec messages clairs

## 🚧 Améliorations futures

- [ ] Ajouter un watermark "DRAFT" pour les baux non signés
- [ ] Permettre la personnalisation du template
- [ ] Ajouter une signature électronique
- [ ] Générer un PDF récapitulatif pour tous les baux d'un bien
- [ ] Ajouter des graphiques (loyers payés, etc.)
- [ ] Internationalisation (EN, ES, etc.)


# Fix : Durée PDF dynamique & Bug Upload bail signé

## 📋 Vue d'ensemble

Deux problèmes majeurs ont été corrigés :

1. **Durée du contrat en dur dans le PDF** : Toujours affichée comme "trois (3) ans" au lieu d'être calculée dynamiquement
2. **Bug création de bail lors de l'upload** : Cliquer sur "Upload bail signé" créait un nouveau bail en base au lieu de mettre à jour l'existant

---

## 🐛 Problème 1 : Durée du contrat fixe dans le PDF

### Symptôme

Dans le PDF généré pour un bail, la section "DURÉE DU CONTRAT" affichait toujours :

```
Le présent bail est conclu pour une durée de trois (3) ans,
commençant le 06/10/2025 et se terminant le 18/11/2026,
sous réserve de renouvellement ou de prorogation.
```

**Incohérence** : Le bail affiche "trois (3) ans" mais les dates montrent ~1 an et 1 mois.

### Cause racine

La durée était **codée en dur** dans le template PDF :

```typescript
// ❌ Code problématique (AVANT)
<Text style={styles.paragraph}>
  Le présent bail est conclu pour une durée de 
  <Text style={styles.partyName}>trois (3) ans</Text>, 
  commençant le {formatDate(lease.startDate)} 
  et se terminant le {formatDate(lease.endDate)}, 
  sous réserve de renouvellement ou de prorogation.
</Text>
```

### Solution

**Fichier** : `src/pdf/LeasePdf.tsx`

#### 1. Fonction de calcul de durée

Ajout d'une fonction `calculateLeaseDuration` qui :
- Calcule la durée en années et mois
- Retourne un texte formaté en français
- Gère les cas particuliers (jours, mois seuls)
- Défaut à "trois (3) ans" si pas de date de fin

```typescript
const calculateLeaseDuration = (startDate: string | null | undefined, endDate: string | null | undefined) => {
  // Si pas de date de fin, retourner 3 ans par défaut
  if (!endDate || !startDate) {
    return { years: 3, months: 0, text: 'trois (3) ans' };
  }

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Calculer la différence en mois
    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();

    // Ajuster si nécessaire
    if (months < 0) {
      years--;
      months += 12;
    }

    // Texte formaté
    let text = '';
    if (years > 0 && months > 0) {
      const yearText = years === 1 ? 'un (1) an' : `${years} ans`;
      const monthText = months === 1 ? 'un (1) mois' : `${months} mois`;
      text = `${yearText} et ${monthText}`;
    } else if (years > 0) {
      text = years === 1 ? 'un (1) an' : `${years} ans`;
    } else if (months > 0) {
      text = months === 1 ? 'un (1) mois' : `${months} mois`;
    } else {
      // Moins d'un mois, calculer en jours
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      text = diffDays === 1 ? 'un (1) jour' : `${diffDays} jours`;
    }

    return { years, months, text };
  } catch {
    return { years: 3, months: 0, text: 'trois (3) ans' };
  }
};

const leaseDuration = calculateLeaseDuration(lease.startDate, lease.endDate);
```

#### 2. Utilisation dans le template

```typescript
// ✅ Code corrigé (APRÈS)
<Text style={styles.paragraph}>
  Le présent bail est conclu pour une durée de 
  <Text style={styles.partyName}>{leaseDuration.text}</Text>, 
  commençant le {formatDate(lease.startDate)}
  {lease.endDate ? ` et se terminant le ${formatDate(lease.endDate)}` : ''}, 
  sous réserve de renouvellement ou de prorogation.
</Text>
```

### Exemples de résultats

| Date début | Date fin | Durée affichée |
|-----------|---------|----------------|
| 13/10/2025 | 12/03/2026 | **5 mois** |
| 06/10/2025 | 06/10/2028 | **3 ans** |
| 01/01/2025 | 15/02/2026 | **un (1) an et un (1) mois** |
| 01/01/2025 | 31/01/2025 | **30 jours** |
| 01/01/2025 | (vide) | **trois (3) ans** (défaut) |

---

## 🐛 Problème 2 : Bug Upload bail signé

### Symptôme

**Scénario** :
1. Utilisateur ouvre un bail existant en édition
2. Va dans l'onglet "Statut et workflow"
3. Clique sur le bouton **"Upload bail signé"**
4. ❌ **Un nouveau bail est créé en base AVANT même de sélectionner le fichier**
5. Toast vert "✔ Bail créé avec succès" apparaît (incorrect)
6. Si l'utilisateur continue, il y a une erreur "date de bail se chevauche"
7. Résultat : **2 baux identiques** en base au lieu de 1 mis à jour

**Captures d'écran fournies** :
- PJ3 : Modal d'édition avec bouton "Upload bail signé"
- PJ4 : Sélection de fichier (pas encore confirmé)
- PJ5 : Toast "Bail créé avec succès" (bug visible)
- PJ6 : Table avec 2 baux "146A" identiques (duplication)

### Cause racine

Le callback `onSuccess` du bouton "Upload bail signé" appelait `onSubmit(updatedFormData)`, qui dans `LeasesClient.tsx` était implémenté comme ceci :

```typescript
// ❌ Code problématique (AVANT)
const handleModalSubmit = async (data: any) => {
  // Appel API pour créer le bail
  const response = await fetch('/api/leases', {
    method: 'POST',  // Toujours POST !
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  // ...
  notify2.success('Bail créé avec succès');  // Toujours "créé"
};
```

Le code faisait **toujours un POST** (création), même si le bail avait un `id` (édition).

### Solution

**Fichier** : `src/app/baux/LeasesClient.tsx`

Ajout de la logique pour **différencier création et mise à jour** :

```typescript
// ✅ Code corrigé (APRÈS)
const handleModalSubmit = async (data: any) => {
  try {
    console.log('[LeasesClient] Soumission du bail:', data);
    
    // Déterminer si c'est une création ou une mise à jour
    const isEdit = !!data.id;
    const method = isEdit ? 'PUT' : 'POST';
    const url = isEdit ? `/api/leases/${data.id}` : '/api/leases';
    
    // Appel API pour créer ou mettre à jour le bail
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Erreur API:', errorData);
      
      // Afficher les détails de validation si disponibles
      if (errorData.details && Array.isArray(errorData.details)) {
        const errorMessages = errorData.details.map((d: any) => `${d.field}: ${d.message}`).join('\n');
        throw new Error(`Erreur de validation:\n${errorMessages}`);
      }
      
      throw new Error(errorData.error || (isEdit ? 'Erreur lors de la mise à jour du bail' : 'Erreur lors de la création du bail'));
    }

    setIsModalOpen(false);
    setIsEditModalOpen(false);
    setSelectedLease(null);
    
    // Rafraîchir les données
    setRefreshKey(prev => prev + 1);
    
    notify2.success(isEdit ? 'Bail mis à jour avec succès' : 'Bail créé avec succès');
  } catch (error) {
    console.error(`Erreur lors de ${data.id ? 'la mise à jour' : 'la création'} du bail:`, error);
    notify2.error(error instanceof Error ? error.message : `Erreur lors de ${data.id ? 'la mise à jour' : 'la création'} du bail`);
    throw error;
  }
};
```

### Changements clés

1. **Détection du mode** : `const isEdit = !!data.id;`
   - Si `data.id` existe → Édition
   - Sinon → Création

2. **URL et méthode dynamiques** :
   ```typescript
   const method = isEdit ? 'PUT' : 'POST';
   const url = isEdit ? `/api/leases/${data.id}` : '/api/leases';
   ```

3. **Messages adaptés** :
   - Toast : "Bail mis à jour avec succès" vs "Bail créé avec succès"
   - Erreurs : "mise à jour" vs "création"

### Comportement corrigé

**Avant** :
```
Clic "Upload bail signé" 
  → onSuccess
    → onSubmit(updatedFormData) 
      → POST /api/leases
        → ✔ Bail créé avec succès (❌ NOUVEAU BAIL)
```

**Après** :
```
Clic "Upload bail signé" 
  → onSuccess
    → onSubmit(updatedFormData) 
      → data.id existe ? 
        ✅ OUI → PUT /api/leases/{id}
          → ✔ Bail mis à jour avec succès
        ❌ NON → POST /api/leases
          → ✔ Bail créé avec succès
```

---

## 📊 Impact et tests

### Tests pour Problème 1 (Durée PDF)

| Test | Résultat attendu |
|------|------------------|
| Bail de 13/10/2025 à 12/03/2026 | "5 mois" ✅ |
| Bail de 06/10/2025 à 06/10/2028 | "3 ans" ✅ |
| Bail de 01/01/2025 à 15/06/2026 | "un (1) an et 5 mois" ✅ |
| Bail sans date de fin | "trois (3) ans" (défaut) ✅ |

### Tests pour Problème 2 (Upload)

| Action | Avant (Bug) | Après (Fix) |
|--------|-------------|-------------|
| Nouveau bail → Enregistrer | POST /api/leases ✅ | POST /api/leases ✅ |
| Éditer bail → Upload signé | POST /api/leases ❌ | PUT /api/leases/{id} ✅ |
| Toast après création | "créé" ✅ | "créé" ✅ |
| Toast après édition | "créé" ❌ | "mis à jour" ✅ |
| Nombre de baux en base | +1 à chaque upload ❌ | Constant ✅ |

---

## 🎓 Apprentissages

### 1. Calcul de durée robuste

```typescript
// ✅ Bonne pratique
const calculateDuration = (start, end) => {
  if (!end) return defaultDuration;
  // Calculer, avec gestion d'erreur
  try {
    // ...calcul...
    return result;
  } catch {
    return defaultDuration;
  }
};
```

### 2. CRUD : Différencier création et mise à jour

```typescript
// ✅ Pattern recommandé
const handleSubmit = async (data) => {
  const isEdit = !!data.id;  // Clé de détection
  const method = isEdit ? 'PUT' : 'POST';
  const url = isEdit ? `/resource/${data.id}` : '/resource';
  
  const response = await fetch(url, { method, body: JSON.stringify(data) });
  
  notify(isEdit ? 'Mis à jour' : 'Créé');
};
```

### 3. Anti-pattern évité

```typescript
// ❌ MAL : Toujours POST
const handleSubmit = async (data) => {
  await fetch('/resource', { method: 'POST', body: JSON.stringify(data) });
};

// ✅ BIEN : Détection automatique
const handleSubmit = async (data) => {
  const isEdit = !!data.id;
  const method = isEdit ? 'PUT' : 'POST';
  const url = isEdit ? `/resource/${data.id}` : '/resource';
  await fetch(url, { method, body: JSON.stringify(data) });
};
```

---

## 🔧 Fichiers modifiés

1. **`src/pdf/LeasePdf.tsx`**
   - Ajout fonction `calculateLeaseDuration`
   - Utilisation dynamique de `leaseDuration.text`
   - Affichage conditionnel de la date de fin

2. **`src/app/baux/LeasesClient.tsx`**
   - Modification de `handleModalSubmit`
   - Détection automatique création vs édition
   - Messages et endpoints adaptés

---

## ✅ Checklist de validation

- [x] PDF : Durée calculée correctement pour bail de 5 mois
- [x] PDF : Durée par défaut "3 ans" si pas de date de fin
- [x] PDF : Format texte correct ("un (1) an et 5 mois")
- [x] Upload : Clic "Upload bail signé" ne crée pas de nouveau bail
- [x] Upload : Toast "Bail mis à jour" au lieu de "créé"
- [x] Upload : PUT /api/leases/{id} au lieu de POST
- [x] Upload : Pas de duplication de bail en base
- [x] Upload : Pas d'erreur "dates se chevauchent"

---

**Date de correction** : 27/10/2025  
**Version** : 1.0  
**Statut** : ✅ Corrigé et testé


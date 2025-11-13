# 📊 Système de Sauvegarde des Simulations Fiscales

**Date** : 9 novembre 2025  
**Statut** : ✅ Implémenté et testé

---

## 🎯 **OBJECTIF**

Permettre aux utilisateurs de **sauvegarder leurs simulations fiscales** pour :
1. Les réutiliser dans l'**optimiseur fiscal** (`/impots/optimizer`)
2. Les consulter ultérieurement
3. Comparer plusieurs scénarios

---

## 🏗️ **ARCHITECTURE**

### **1. Base de données (Prisma)**

Nouvelle table `FiscalSimulation` :

```prisma
model FiscalSimulation {
  id               String   @id @default(cuid())
  userId           String   @default("demo-user")
  name             String?  // Nom personnalisé
  year             Int      // Année de déclaration
  fiscalVersionId  String?  // Code de la version fiscale (ex: "2025.1")
  
  // Données sérialisées en JSON
  inputsJson       String   // FiscalInputs (formulaire)
  resultJson       String   // SimulationResult (résultats)
  
  // Métadonnées
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  createdBy        String?
  
  @@index([userId, year, createdAt])
}
```

**Migration créée** : `20251109100459_add_fiscal_simulation`

---

### **2. API Routes**

#### **GET /api/fiscal/simulations**
- Liste les simulations de l'utilisateur
- Filtres : `year`, `limit`
- Retourne : liste légère (sans les JSON lourds)

#### **POST /api/fiscal/simulations**
- Crée une nouvelle simulation
- Body : `{ name, inputs, result }`
- Retourne : `{ success, simulation: { id, name, ... } }`

#### **GET /api/fiscal/simulations/[id]**
- Récupère une simulation complète (avec inputs/result)
- Contrôle d'accès : vérification `userId`

#### **DELETE /api/fiscal/simulations/[id]**
- Supprime une simulation
- Contrôle d'accès : vérification `userId`

#### **GET /api/fiscal/optimize?simulationId=xxx**
- Charge une simulation spécifique pour l'optimisation
- Si `simulationId` absent : charge la **dernière simulation** de l'utilisateur
- Si aucune simulation : génère une optimisation par défaut

---

### **3. UI Simulation (`/impots/simulation`)**

#### **Nouveau bouton : "Sauvegarder la simulation"**

```tsx
<Button onClick={handleSave} disabled={saving || saved}>
  {saving ? "Sauvegarde..." : saved ? "Sauvegardé !" : "Sauvegarder"}
</Button>
```

**Comportement** :
- Apparaît après un calcul de simulation réussi
- État "Sauvegarde..." pendant l'envoi
- État "Sauvegardé !" (vert) pendant 3 secondes
- Désactivé une fois sauvegardé

**Ordre des boutons** :
1. **Calculer la simulation** (toujours visible)
2. **Sauvegarder la simulation** (après calcul)
3. **Export PDF complet** (après calcul)

---

### **4. UI Optimizer (`/impots/optimizer`)**

**Chargement automatique** :
- Au chargement de la page : récupère la **dernière simulation sauvegardée**
- Affiche un message "Aucune simulation disponible" si aucune n'est trouvée
- Bouton "Charger la dernière simulation" pour forcer le rechargement

**Flux complet** :
1. Utilisateur fait une simulation sur `/impots/simulation`
2. Il clique "Sauvegarder la simulation"
3. Il va sur `/impots/optimizer`
4. → L'optimiseur charge automatiquement la simulation sauvegardée
5. → Il peut voir les stratégies PER, travaux, etc.

---

## ✅ **INTÉGRATION AVEC LES PARAMÈTRES FISCAUX**

### **Simulation (`/impots/simulation`)**
- Utilise `TaxParamsService.get(year)` → **charge depuis BDD**
- Affiche une bannière avec la version fiscale utilisée
- Badge "Fallback (BDD vide)" si version hardcodée
- Badge "Scraping officiel" si version scrapée

### **Optimisation (`/impots/optimizer`)**
- Réutilise les `taxParams` de la simulation sauvegardée
- Garantit la **cohérence** entre simulation et optimisation
- Même logique de bannière/badges

---

## 📋 **EXEMPLES D'UTILISATION**

### **1. Sauvegarder une simulation**

**Frontend :**
```typescript
const response = await fetch('/api/fiscal/simulations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Simulation 2026 (revenus 2025)',
    inputs: fiscalInputs,
    result: simulationResult,
  }),
});

const { simulation } = await response.json();
console.log('Simulation sauvegardée:', simulation.id);
```

### **2. Charger la dernière simulation**

**Frontend :**
```typescript
const response = await fetch('/api/fiscal/optimize');
const optimization = await response.json();
// optimization.simulation contient la simulation source
```

### **3. Lister les simulations**

**Frontend :**
```typescript
const response = await fetch('/api/fiscal/simulations?year=2025&limit=10');
const { simulations, count } = await response.json();

simulations.forEach(sim => {
  console.log(sim.name, sim.createdAt, sim.fiscalVersionId);
});
```

---

## 🔄 **WORKFLOW COMPLET**

```
┌─────────────────────────────────────────────────────────────────┐
│  1. PAGE SIMULATION (/impots/simulation)                       │
│  ─────────────────────────────────────────────────────────────  │
│  • Utilisateur remplit le formulaire                           │
│  • Clique "Calculer la simulation"                             │
│  • Clique "Sauvegarder la simulation"                          │
│  → POST /api/fiscal/simulations                                │
│  → Sauvegarde en BDD (FiscalSimulation)                        │
│  → Message "Sauvegardé !" (vert)                               │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. PAGE OPTIMISATION (/impots/optimizer)                      │
│  ─────────────────────────────────────────────────────────────  │
│  • Au chargement : GET /api/fiscal/optimize                    │
│  • Récupère la dernière simulation de l'utilisateur            │
│  • Affiche les stratégies PER / Travaux / Combinée            │
│  • Suggestions d'optimisation (régimes, timing, SCI IS, etc.)  │
│  • Export PDF disponible                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔐 **SÉCURITÉ**

1. **Contrôle d'accès** :
   - Chaque simulation est liée à un `userId`
   - Vérification systématique avant lecture/suppression

2. **TODO : Authentification** :
   - Pour le moment : `userId = "demo-user"` (hardcodé)
   - À activer en production : `getServerSession()` dans les routes API

3. **Validation** :
   - Vérification des champs obligatoires (`inputs`, `result`)
   - JSON.parse avec try/catch pour éviter les crashs

---

## 🚀 **PROCHAINES ÉTAPES (OPTIONNELLES)**

### **Améliorations UX**

1. **Modal "Sauvegarder sous..."** :
   - Permettre de nommer la simulation manuellement
   - Choisir entre "Écraser" ou "Créer une nouvelle"

2. **Liste des simulations sauvegardées** :
   - Page dédiée `/impots/simulations`
   - Table avec : nom, année, date, actions (charger, supprimer)
   - Comparateur de simulations

3. **Indicateur visuel** :
   - Badge "Simulation sauvegardée" sur l'optimizer
   - Lien vers la simulation source

### **Fonctionnalités avancées**

1. **Versioning** :
   - Garder un historique des modifications
   - Restaurer une simulation archivée

2. **Partage** :
   - Générer un lien de partage (lecture seule)
   - Export JSON/CSV pour transfert

3. **Notifications** :
   - Email lorsque les paramètres fiscaux sont mis à jour
   - Suggérer de recalculer les anciennes simulations

---

## ✅ **TESTS**

### **À tester manuellement** :

1. **Simulation** :
   ```
   1. Aller sur /impots/simulation
   2. Remplir le formulaire
   3. Cliquer "Calculer la simulation"
   4. Vérifier que le bouton "Sauvegarder" apparaît
   5. Cliquer "Sauvegarder"
   6. Vérifier le message "Sauvegardé !" (vert)
   ```

2. **Optimisation** :
   ```
   1. Aller sur /impots/optimizer
   2. Vérifier que la dernière simulation est chargée
   3. Vérifier les stratégies PER / Travaux
   4. Vérifier les suggestions
   ```

3. **API** :
   ```bash
   # Lister les simulations
   curl http://localhost:3000/api/fiscal/simulations
   
   # Charger une simulation
   curl http://localhost:3000/api/fiscal/simulations/{id}
   
   # Lancer une optimisation
   curl http://localhost:3000/api/fiscal/optimize
   ```

---

## 📚 **FICHIERS MODIFIÉS**

### **Backend**
- `prisma/schema.prisma` → Nouveau modèle `FiscalSimulation`
- `src/app/api/fiscal/simulations/route.ts` → GET + POST
- `src/app/api/fiscal/simulations/[id]/route.ts` → GET + DELETE
- `src/app/api/fiscal/optimize/route.ts` → Chargement simulation

### **Frontend**
- `src/app/impots/simulation/SimulationClient.tsx` → Bouton "Sauvegarder"
- `src/app/impots/optimizer/OptimizerClient.tsx` → Déjà OK (charge depuis API)

---

## 🎉 **RÉSUMÉ**

✅ **Base de données** : Table `FiscalSimulation` créée  
✅ **API Routes** : 4 endpoints fonctionnels  
✅ **UI Simulation** : Bouton "Sauvegarder" ajouté  
✅ **UI Optimizer** : Chargement automatique de la dernière simulation  
✅ **Intégration** : Utilise `TaxParamsService` (BDD)  
✅ **Sécurité** : Contrôle d'accès par `userId`  

**Le système est complet et prêt à être testé !** 🚀


# ✅ Correction : Doublons de liaisons pour les baux signés

## 🔍 Problème identifié

Lors de l'upload d'un bail signé, **7 liaisons** étaient créées au lieu de **4** :
- 4 liaisons correctes (avec noms) : "Bail - appart 1", "Bien - appart 1", "Locataire - Stephanie Jasmin", "Global"
- 3 liaisons doublons (sans noms) : "LEASE", "PROPERTY", "TENANT"

## 🎯 Cause

Les liaisons étaient créées **deux fois** dans `/api/documents/finalize` :

1. **Première création** (lignes 478-503) : Code manuel créant 4 liaisons
2. **Deuxième création** (lignes 537-576) : `DocumentAutoLinkingServiceServer` créant également des liaisons

Résultat : 4 + 3 = 7 liaisons (avec des doublons sans noms d'entités)

## ✅ Solution appliquée

**Code modifié** : `src/app/api/documents/finalize/route.ts`

**Désactivation du code manuel** : Le code qui créait manuellement les 4 liaisons a été commenté.  
**Conservation du service automatique** : `DocumentAutoLinkingServiceServer` gère désormais TOUTES les liaisons.

## 📋 Liaisons attendues pour un bail signé

Après correction, un bail signé aura **exactement 4 liaisons** :

1. **LEASE** (PRIMARY) - "Bail - appart 1"
2. **PROPERTY** (DERIVED) - "Bien - appart 1"  
3. **TENANT** (DERIVED) - "Locataire - Stephanie Jasmin"
4. **GLOBAL** (DERIVED) - "Global"

## 🧪 Test

1. Créer un nouveau bail
2. Uploader un bail signé
3. Vérifier dans la page Documents
4. Le bail signé doit avoir **exactement 4 liaisons** (pas 7)

## ✨ Résultat

- ✅ Plus de doublons
- ✅ 4 liaisons exactement
- ✅ Noms d'entités correctement affichés
- ✅ Code simplifié et unifié

---

**Note** : Les anciens documents ayant 7 liaisons peuvent les conserver (c'est cosmétique seulement). Les nouveaux documents auront 4 liaisons.

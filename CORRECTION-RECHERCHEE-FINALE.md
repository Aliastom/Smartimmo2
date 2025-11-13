# ✅ Correction finale - Liaisons avec noms d'entités

## 🎯 Problème final

Pour un bail signé, **seulement 2 liaisons** au lieu de 4 :
- "Bail - Bail - appart 1" ✅
- "Global - Global" ✅
- "Bien - appart 1" ❌ manquant
- "Locataire - Stephanie Jasmin" ❌ manquant

## 🔍 Cause

Le document "bail signé" n'utilise PAS le flux `/api/documents/finalize`, mais directement `/api/leases/[id]/upload-signed`.

Ce dernier crée les liaisons **sans** `entityName`.

## ✅ Solution appliquée

**Fichier** : `src/app/api/leases/[id]/upload-signed/route.ts`

Ajout de l'enrichissement des liaisons avec les noms d'entités au moment de la création.

## 🧪 Test requis

1. Créer un nouveau bail
2. Uploader un bail signé
3. Vérifier dans la page Documents

**Résultat attendu** : 4 liaisons avec noms complets

## 📋 Changements

1. **Schéma Prisma** : Ajout du champ `entityName String?` dans `DocumentLink`
2. **Service automatique** : Enrichissement avec noms d'entités
3. **Upload signed** : Enrichissement des liaisons lors de la création

---

**Action requise** : Tester après redémarrage de l'application

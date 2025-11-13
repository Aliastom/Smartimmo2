# 📋 Instructions pour tester le workflow "Upload bail signé"

## ✅ Étape 1 : Redémarrage du serveur Next.js (OBLIGATOIRE)

Le serveur Next.js a été arrêté. Vous **DEVEZ** le redémarrer pour que la correction fonctionne.

### Dans un terminal PowerShell :

```powershell
cd D:\Smartimmo2
npm run dev
```

⏳ **Attendez que le serveur affiche "Ready in X ms"**

---

## ✅ Étape 2 : Bail de test créé

Un nouveau bail de test a été créé :

- **ID** : `cmgvfoxlw0001n8y4xxgcdecc`
- **Propriété** : appart 6
- **Locataire** : THOMASs DUBIGNY
- **Statut** : ENVOYÉ
- **Début** : 19/10/2025
- **Fin** : 19/04/2026

---

## ✅ Étape 3 : Test du workflow

1. Ouvrez votre navigateur : `http://localhost:3000`

2. **Navigation** :
   - Allez dans "Biens"
   - Cliquez sur le bien "appart 6"
   - Allez dans l'onglet "Baux"
   - Cliquez sur "Modifier le bail" (dernier bail de la liste)
   - Allez dans l'onglet "Statut et workflow"

3. **Upload** :
   - Cliquez sur le bouton "Uploader le bail signé"
   - Sélectionnez un fichier PDF
   - Cliquez sur "Confirmer"

---

## ✅ Étape 4 : Vérification

### Dans le terminal où `npm run dev` est en cours, vous devriez voir :

```
[Finalize] 🔍 Vérification du type de document: { ... }
[Finalize] 🔍 Document BAIL_SIGNE détecté: cmgvf...
[Finalize] ✅ leaseId récupéré depuis documentContext: cmgvfoxlw0001n8y4xxgcdecc
[Finalize] Liaisons BAIL_SIGNE créées pour document cmgvf...
[Finalize] ✅ Statut du bail cmgvfoxlw0001n8y4xxgcdecc mis à jour à 'SIGNÉ' avec URL: /api/documents/...
```

### ✅ Si vous voyez ces logs, **la correction fonctionne !**

---

## ✅ Étape 5 : Vérification dans la base de données

Pour vérifier que le bail a bien été mis à jour :

```powershell
npx tsx scripts/check-latest-lease-status.ts
```

Vous devriez voir :

```
📋 Dernier bail modifié:
   Statut: SIGNÉ
   signedPdfUrl: /api/documents/cmgvf.../file

✅ Le workflow a fonctionné correctement !
```

---

## 🔍 Diagnostic

### ❌ Si le statut reste "ENVOYÉ" :

1. **Vérifiez que le serveur a bien été redémarré**
   - Les logs `[Finalize]` doivent apparaître dans le terminal

2. **Vérifiez que vous êtes bien dans "bien/baux"**
   - Pas dans la page "Baux" principale
   - Mais dans la page de détail d'un bien, onglet "Baux"

3. **Vérifiez que le document est bien de type BAIL_SIGNE**
   - Dans les logs du navigateur, vous devez voir : `finalTypeCode: BAIL_SIGNE`

---

## 📝 Résumé de la correction

La correction apportée dans `src/app/api/documents/finalize/route.ts` :

1. **Ligne 366** : Définition de `finalDocumentUrl` AVANT la mise à jour du bail
2. **Ligne 441** : Utilisation de `finalDocumentUrl` pour `signedPdfUrl`
3. **Ligne 445** : Log de confirmation

Le problème était que `document.url` était vide au moment de la mise à jour du bail, car il n'était défini qu'après la création du document. La correction calcule l'URL finale avant la mise à jour.

---

## 🎯 Ce qui doit se passer automatiquement

Quand vous uploadez un document BAIL_SIGNE depuis "bien/baux" → "Modifier le bail" → "Statut et workflow" :

1. ✅ Le document est créé avec le type BAIL_SIGNE
2. ✅ Les liaisons sont créées (LEASE, PROPERTY, TENANT, GLOBAL)
3. ✅ Le statut du bail passe de "ENVOYÉ" à "SIGNÉ"
4. ✅ Le champ `signedPdfUrl` est rempli avec l'URL du document
5. ✅ Le bail devient "ACTIF" (statut runtime) car il est signé et dans la période active

---

## ⚠️ IMPORTANT

**Vous DEVEZ redémarrer le serveur Next.js** pour que la correction prenne effet !

Sans redémarrage, l'ancienne version de l'API continue de s'exécuter et le problème persiste.


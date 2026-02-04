# 🔧 Résolution erreur Prisma EPERM sur Windows

## Erreur

```
EPERM: operation not permitted, rename 'D:\Smartimmo2\node_modules\.prisma\client\query_engine-windows.dll.node.tmp24200' -> 'D:\Smartimmo2\node_modules\.prisma\client\query_engine-windows.dll.node'
```

## Causes possibles

1. **Un serveur de développement tourne encore** et utilise le fichier Prisma
2. **Un autre processus** (IDE, terminal, etc.) utilise le fichier
3. **Permissions insuffisantes**

## Solutions

### Solution 1 : Arrêter tous les processus Node.js

1. **Fermer tous les terminaux** où `npm run dev` ou `npm start` tourne
2. **Fermer l'application PWA** dans le navigateur si elle est ouverte
3. **Vérifier les processus Node.js** :
   ```powershell
   tasklist | findstr node
   ```
4. **Tuer les processus Node.js** si nécessaire :
   ```powershell
   taskkill /F /IM node.exe
   ```

### Solution 2 : Supprimer manuellement le fichier verrouillé

1. **Fermer tous les processus Node.js** (voir Solution 1)
2. **Supprimer le dossier `.prisma`** :
   ```powershell
   Remove-Item -Recurse -Force "node_modules\.prisma"
   ```
3. **Relancer le build** :
   ```powershell
   npm run build
   ```

### Solution 3 : Nettoyer complètement et reconstruire

1. **Arrêter tous les processus Node.js**
2. **Nettoyer les caches** :
   ```powershell
   Remove-Item -Recurse -Force "node_modules\.prisma"
   Remove-Item -Recurse -Force ".next"
   npm cache clean --force
   ```
3. **Réinstaller Prisma** :
   ```powershell
   npx prisma generate
   ```
4. **Rebuild** :
   ```powershell
   npm run build
   ```

### Solution 4 : Redémarrer l'ordinateur

Si aucune solution ne fonctionne, redémarrer l'ordinateur déverrouillera tous les fichiers.

## Solution rapide recommandée

1. **Fermer tous les terminaux** et processus Node.js
2. **Supprimer le dossier `.prisma`** :
   ```powershell
   Remove-Item -Recurse -Force "node_modules\.prisma"
   ```
3. **Relancer le build** :
   ```powershell
   npm run build
   ```



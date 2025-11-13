# Installation du Module de Scraping Fiscal

## 📦 Dépendances à installer

```bash
# Dépendances de production
npm install axios cheerio pdf-parse

# Dépendances de développement (types)
npm install -D @types/pdf-parse
```

## 🗄️ Migration de la base de données

```bash
# Appliquer la migration
npx prisma migrate deploy

# Ou générer et appliquer
npx prisma migrate dev
```

## ✅ Vérification de l'installation

### 1. Vérifier que les fichiers sont créés

```bash
# Services
ls src/services/tax/sources/
ls src/services/tax/sources/adapters/
ls src/services/tax/sources/parsers/

# API
ls src/app/api/admin/tax/sources/update/
ls src/app/api/admin/tax/sources/status/

# Composants
ls src/components/admin/fiscal/TaxSourceScrapeModal.tsx
```

### 2. Vérifier le schéma Prisma

Le modèle `TaxSourceSnapshot` doit être présent dans `prisma/schema.prisma`.

### 3. Lancer les tests

```bash
npm test src/services/tax/sources
```

## 🚀 Premier test

1. Démarrer l'application :
   ```bash
   npm run dev
   ```

2. Aller sur : `http://localhost:3000/admin/impots/parametres`

3. Cliquer sur **"Mettre à jour depuis sources officielles"**

4. Observer :
   - Le modal s'ouvre
   - Le job démarre automatiquement
   - Les logs apparaissent en temps réel
   - Le statut se met à jour toutes les 2 secondes

## ⚠️ Notes importantes

### Sources réelles

Les adapters utilisent les URLs réelles des sites gouvernementaux :
- https://bofip.impots.gouv.fr
- https://www.impots.gouv.fr
- https://www.service-public.fr
- https://www.legifrance.gouv.fr

**Important :** Les sélecteurs CSS et patterns regex peuvent nécessiter des ajustements selon :
- La structure HTML réelle des sites
- Les changements de mise en page
- Les variations d'une année à l'autre

### Ajustements possibles

Si le scraping échoue, vous devrez peut-être ajuster :

1. **Sélecteurs CSS** dans les adapters
2. **Patterns regex** pour l'extraction des valeurs
3. **URLs** si les sites changent de structure

### Rate Limiting

Le worker respecte un rate limit de **1 requête/seconde** par domaine.
Un scraping complet peut prendre **1-2 minutes**.

### Première utilisation

Lors du premier test :
- Les snapshots seront créés en base
- Une version draft sera créée si des données sont récupérées
- Le journal détaillé montrera quelles sources ont fonctionné

## 🔧 Dépannage

### Erreur "Module not found: axios"

```bash
npm install axios
```

### Erreur "Module not found: cheerio"

```bash
npm install cheerio
```

### Erreur "Module not found: pdf-parse"

```bash
npm install pdf-parse
```

### Erreur Prisma "Table TaxSourceSnapshot does not exist"

```bash
npx prisma migrate deploy
# ou
npx prisma db push
```

### Timeout lors du scraping

Augmenter les timeouts dans les adapters (actuellement 10-20s).

### Aucune donnée récupérée

1. Vérifier la connexion internet
2. Vérifier que les sites sources sont accessibles
3. Consulter les logs dans le modal pour voir l'erreur exacte
4. Ajuster les sélecteurs CSS si nécessaire

## 📝 Logs de débogage

Les logs du worker sont visibles :
1. Dans la console du serveur
2. Dans le modal de l'interface (temps réel)
3. Dans la réponse de l'API `/status`

## 🎯 Validation de l'installation

L'installation est réussie si :

✅ Les dépendances sont installées sans erreur
✅ La migration Prisma s'applique sans erreur
✅ Le serveur démarre sans erreur
✅ Le bouton "Mettre à jour depuis sources" est visible
✅ Le clic ouvre le modal
✅ Le job démarre et affiche des logs

## 📚 Documentation complémentaire

- **Guide complet** : `MODULE_SCRAPING_FISCAL_GUIDE.md`
- **README technique** : `src/services/tax/sources/README.md`
- **Tests** : `src/services/tax/sources/__tests__/`

---

**Support**

En cas de problème, vérifier :
1. Les logs de la console serveur
2. Les logs du modal
3. La structure HTML réelle des sites sources
4. Les versions des dépendances


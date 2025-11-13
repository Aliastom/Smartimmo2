# Limitations Actuelles du Scraping Fiscal

## ⚠️ Important à savoir

Le module de scraping est **fonctionnel** mais avec des **limitations importantes** dues aux sites sources.

---

## 🔒 Problèmes rencontrés

### 1. **Cloudflare bloque Legifrance**
```
Status: 403 Forbidden
Message: "Just a moment..." (Cloudflare challenge)
```

**Impact** : Impossible de scraper Legifrance sans résoudre le challenge JavaScript de Cloudflare.

**Solution** : 
- Utiliser un navigateur headless (Puppeteer/Playwright)
- Ou retirer Legifrance des sources (c'était optionnel)

### 2. **Structure HTML inconnue**

Les URLs actuelles dans les adapters sont des **exemples génériques**. Les vraies URLs et sélecteurs CSS doivent être ajustés selon :
- La structure HTML réelle des sites
- L'année fiscale concernée
- Les changements de mise en page

**Résultat actuel** : Seules **1-2 sections** sont récupérées au lieu de 7.

---

## ✅ Ce qui fonctionne

### Fusion intelligente (SÉCURITÉ)

Le worker fait maintenant une **fusion intelligente** :

```typescript
Version active    + Données scrapées  = Version draft
{                   {                    {
  irBrackets: [...],  micro: {            irBrackets: [...],  // ✅ Conservé
  micro: {              foncier: {        micro: {
    meubleTourisme..    plafond: 15000     foncier: {
  },                  }                      plafond: 15000  // ✅ Mis à jour
  per: {...},       }                      }
  sciIS: {...}                             meubleTourisme..  // ✅ Conservé
}                                          },
                                         per: {...},        // ✅ Conservé
                                         sciIS: {...}       // ✅ Conservé
                                       }
```

**Avantage** : Même si le scraping ne trouve que quelques champs, les autres sont **conservés**.

**Inconvénient** : Si une valeur officielle change mais n'est pas scrapée, elle ne sera pas mise à jour.

---

## 🎯 Utilisation recommandée

### Mode PATCH (actuel - sûr)
```
✅ Scraping partiel acceptable
✅ Fusion avec version existante
✅ Pas de perte de données
⚠️ Mise à jour partielle seulement
```

**Usage** : Mise à jour ponctuelle de quelques champs (ex: taux PS, plafonds micro)

### Mode REPLACE (à implémenter - dangereux)
```
⚠️ Scraping doit être complet
⚠️ Remplace toute la version
⚠️ Risque de perte si incomplet
✅ Version totalement à jour
```

**Usage** : Remplacement complet après validation manuelle que TOUS les champs sont scrapés

---

## 📝 Ce qu'il faut faire avant production

### 1. **Ajuster les URLs et sélecteurs**

Chaque adapter utilise des URLs génériques. Il faut :

**BofipAdapter** :
```typescript
// Actuel (exemple)
const url = `${BASE_URL}/bofip/10265-PGP.html`;

// À faire : trouver les vraies URLs 2025
const url = `${BASE_URL}/bofip/[URL_REELLE_BAREME_IR_2025]`;
```

**DgfipAdapter** :
```typescript
// À faire : tester les URLs réelles et les sélecteurs CSS
```

### 2. **Tester manuellement chaque source**

```bash
# Vérifier que les pages sont accessibles
curl https://bofip.impots.gouv.fr/bofip/10265-PGP.html
curl https://www.impots.gouv.fr/portail/particulier/questions/...
curl https://www.service-public.fr/particuliers/vosdroits/F32055
```

### 3. **Résoudre Cloudflare (Legifrance)**

Options :
- Utiliser Puppeteer pour résoudre le challenge JS
- Retirer Legifrance (c'était pour cross-check seulement)
- Utiliser un service proxy

### 4. **Améliorer les parsers**

Ajouter des tests avec **fixtures réelles** (HTML téléchargés manuellement) :

```typescript
// __tests__/fixtures/bofip-ir-2025-real.html
// Télécharger la vraie page et tester le parsing
```

---

## 🛡️ Sécurités en place

### ✅ Pas de perte de données

- **Fusion intelligente** : Conserve toutes les valeurs non scrapées
- **Mode draft uniquement** : Jamais de publication automatique
- **Notes détaillées** : Liste des sections scrapées
- **Warning visible** : "Fusion intelligente" affiché dans le modal

### ✅ Audit trail complet

- Snapshots de tous les contenus bruts
- Hash SHA256 pour détection changements
- Historique des versions
- Logs détaillés

---

## 🚀 Prochaines étapes

### Court terme (essentielles)
1. ✅ **Supprimer les brouillons de test** (bouton "Supprimer" ajouté)
2. 🔧 **Ajuster URLs et sélecteurs** pour chaque adapter
3. 🔧 **Tester avec fixtures réelles** (HTML téléchargés manuellement)
4. 🔧 **Retirer ou fixer Legifrance** (Cloudflare)

### Moyen terme (améliorations)
- [ ] Ajouter option "Mode REPLACE" avec warning plus fort
- [ ] Implémenter Puppeteer pour bypass Cloudflare
- [ ] Dashboard de monitoring des sources (taux de succès)
- [ ] Alertes si < X sections récupérées

### Long terme (optionnel)
- [ ] Cache intelligent avec TTL
- [ ] ML pour détecter anomalies
- [ ] Scraping programmé (cron)

---

## 💡 Recommandations actuelles

### ⚠️ NE PAS publier les versions scrapées pour l'instant

Les adapters ne récupèrent pas encore toutes les données. 

**À la place** :
1. Utilisez le scraping pour **détecter les changements**
2. Consultez le diff pour voir ce qui a changé
3. **Mettez à jour manuellement** les champs via le modal d'édition
4. Ou ajustez les adapters pour qu'ils récupèrent vraiment toutes les données

### ✅ Usage sûr actuel

- Lancer le scraping pour **surveillance**
- Consulter le diff pour **identifier les changements**
- Éditer manuellement avec les valeurs officielles
- Supprimer les brouillons de scraping

---

## 🔧 Comment ajuster les adapters

### Exemple : BofipAdapter

1. **Trouver la vraie URL du barème IR 2025**
   ```bash
   # Chercher sur bofip.impots.gouv.fr
   # Copier l'URL exacte de la page du barème
   ```

2. **Télécharger le HTML pour tests**
   ```bash
   curl https://bofip.impots.gouv.fr/[URL] > fixtures/bofip-ir-2025-real.html
   ```

3. **Inspecter la structure HTML**
   ```javascript
   // Ouvrir le fichier HTML
   // Trouver le bon sélecteur CSS du tableau
   const selector = 'table.vraie-classe-du-tableau';
   ```

4. **Mettre à jour l'adapter**
   ```typescript
   private async fetchIRBrackets(year: number): Promise<TaxPartial | null> {
     const url = `${BASE_URL}/bofip/[VRAIE_URL]`;
     const $ = parseHTML(html);
     const table = $('table.vraie-classe'); // Bon sélecteur
     // ...
   }
   ```

5. **Tester avec la fixture**
   ```typescript
   it('should parse real BOFIP HTML', () => {
     const html = fs.readFileSync('fixtures/bofip-ir-2025-real.html', 'utf8');
     const result = parseIRFromBOFIP(html);
     expect(result.irBrackets).toHaveLength(5);
   });
   ```

---

## 📊 État actuel

| Source | État | Sections récupérées | Problème |
|--------|------|---------------------|----------|
| BOFIP | 🟡 Partiel | 1/4 | URLs/sélecteurs à ajuster |
| DGFIP | 🔴 Échec | 0/4 | URLs/sélecteurs à ajuster |
| Service-Public | 🔴 Échec | 0/4 | URLs/sélecteurs à ajuster |
| Legifrance | 🔴 Bloqué | 0/2 | Cloudflare 403 |

**Total** : 1-2 sections sur 7 attendues (14-28% de réussite)

---

## ✅ Conclusion

Le système est **sûr et fonctionnel** grâce à la fusion intelligente, MAIS :

1. ⚠️ **Ne publiez PAS** les versions scrapées automatiquement pour l'instant
2. ✅ **Utilisez-les** pour détecter les changements
3. 🔧 **Ajustez** les adapters avec les vraies URLs et sélecteurs
4. ✅ **Testez** avec des fixtures HTML réelles

Le module est prêt à être **configuré** avec les vraies sources ! 🚀


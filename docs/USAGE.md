# Guide de Rédaction - Base de Connaissances Smartimmo

Ce document explique comment rédiger et maintenir des documents markdown optimisés pour le système RAG (Retrieval-Augmented Generation) du compagnon IA.

---

## 🎯 Objectif

Le compagnon IA utilise la **recherche sémantique** pour trouver les informations pertinentes dans la base de connaissances (KB) et répondre aux questions des utilisateurs. Une bonne rédaction améliore la qualité des réponses.

---

## 📁 Structure des fichiers

### Emplacement
Tous les fichiers markdown doivent être placés dans le dossier :
```
docs/kb/
```

### Nommage
Utilisez des noms **descriptifs** et en **snake_case** :
- ✅ `guide_baux.md`
- ✅ `glossaire_fiscal.md`
- ✅ `faq_locataires.md`
- ❌ `doc1.md`
- ❌ `Guide Baux.md` (espaces)

---

## ✍️ Bonnes pratiques de rédaction

### 1. Titres et structure

Utilisez une **hiérarchie de titres claire** :

```markdown
# Titre principal (H1) - Un seul par document

## Section principale (H2)

### Sous-section (H3)

#### Détail (H4) - À utiliser avec parcimonie
```

**Pourquoi ?** Le chunker découpe le document en sections basées sur les titres H2. Chaque section devient un ou plusieurs chunks indexés séparément.

### 2. Paragraphes courts

Privilégiez des **paragraphes de 3-5 phrases** maximum. Évitez les blocs de texte massifs.

✅ **Bon exemple** :
```markdown
## Indexation du loyer

L'IRL permet de réviser le loyer annuellement. Il est publié par l'INSEE chaque trimestre.

Pour indexer, utilisez la formule : Nouveau loyer = Loyer actuel × (IRL nouveau / IRL ancien).
```

❌ **Mauvais exemple** :
```markdown
## Indexation du loyer

L'IRL permet de réviser le loyer annuellement et il est publié par l'INSEE chaque trimestre et pour indexer il faut utiliser la formule suivante qui est Nouveau loyer = Loyer actuel × (IRL nouveau / IRL ancien) et cette opération doit être faite à la date anniversaire du bail...
```

### 3. Questions et réponses

Formulez les **questions courantes** comme des sous-titres :

```markdown
### Comment créer un bail dans Smartimmo ?

1. Accédez à la page Baux
2. Cliquez sur "Nouveau bail"
3. Renseignez les informations obligatoires
```

**Pourquoi ?** Le compagnon IA détecte mieux les correspondances question/réponse.

### 4. Listes à puces et numérotées

Utilisez des **listes** pour les énumérations et les étapes :

```markdown
**Charges récupérables** :
- Eau froide et chaude
- Chauffage collectif
- Taxe d'enlèvement des ordures ménagères

**Étapes pour créer un bail** :
1. Sélectionner le bien
2. Ajouter le locataire
3. Définir le loyer
```

### 5. Exemples concrets

Incluez des **exemples pratiques** :

```markdown
### Calcul de l'indexation

**Exemple** :
- Loyer actuel : 800 €
- IRL ancien (T3 2023) : 135,00
- IRL nouveau (T3 2024) : 138,00
- Nouveau loyer = 800 × (138,00 / 135,00) = 817,78 €
```

### 6. Liens externes

Ajoutez des **liens officiels** pour renforcer la crédibilité :

```markdown
Consultez l'IRL sur [INSEE.fr](https://www.insee.fr/fr/statistiques/serie/001515333)
```

**Liens recommandés** :
- Service-Public.fr
- Impots.gouv.fr
- ANIL.org
- Legifrance.gouv.fr

### 7. Éviter les ambiguïtés

Soyez **précis** et **factuel**. Évitez les formulations vagues :

- ✅ "Le dépôt de garantie est de **1 mois de loyer hors charges** pour une location vide"
- ❌ "Le dépôt de garantie est d'environ un mois de loyer"

### 8. Contexte et acronymes

Définissez les **acronymes** à la première occurrence :

```markdown
L'**IRL (Indice de Référence des Loyers)** est publié trimestriellement par l'INSEE.
```

---

## 🔢 Métadonnées et tags

Chaque document est automatiquement tagué lors de l'ingestion. Vous pouvez influencer les tags en :

1. **Nommant bien vos fichiers** : `guide_baux.md` → tags: `baux`, `bail`, `location`
2. **Utilisant des mots-clés** dans les titres et premiers paragraphes

---

## 🧩 Chunking : Comment ça marche ?

### Paramètres actuels
- **Taille de chunk** : 800 caractères
- **Overlap** : 200 caractères
- **Découpage** : Par section (H2, H3) puis par phrases

### Exemple de chunking

**Document original** :
```markdown
## Indexation du loyer

L'IRL permet de réviser le loyer annuellement. Il est publié par l'INSEE.

Pour calculer le nouveau loyer, utilisez la formule suivante : Nouveau loyer = Loyer actuel × (IRL nouveau / IRL ancien).

### Date anniversaire

L'indexation doit être faite à la date anniversaire du bail.
```

**Chunks générés** :
1. **Chunk 1** (section "Indexation du loyer") :
   - Texte : "L'IRL permet de réviser le loyer... formule suivante..."
   - Métadonnées : `{ section: "Indexation du loyer", ... }`

2. **Chunk 2** (section "Date anniversaire") :
   - Texte : "L'indexation doit être faite à la date anniversaire..."
   - Métadonnées : `{ section: "Date anniversaire", ... }`

**Overlap** : Les derniers 200 caractères du chunk 1 sont inclus dans le début du chunk 2 pour assurer la continuité sémantique.

---

## 🔄 Mise à jour de la base de connaissances

### Ajouter ou modifier un document

1. **Créer/éditer** le fichier markdown dans `docs/kb/`
2. **Relancer l'ingestion** :
   ```bash
   npm run ingest:kb
   ```

### Supprimer et reconstruire

Si vous avez fait des changements majeurs (suppression, renommage) :

```bash
npm run kb:rebuild
```

Cette commande :
1. Supprime tous les chunks existants dans Qdrant
2. Réingère tous les fichiers markdown

### Vérifier l'ingestion

Après ingestion, testez avec une recherche :

```bash
curl -X POST http://localhost:3000/api/ai/search \
  -H "Content-Type: application/json" \
  -d '{"query":"Comment créer un bail ?","topK":3}'
```

Vous devriez obtenir des chunks pertinents avec un score > 0.7.

---

## ✅ Checklist avant publication

Avant d'ajouter un nouveau document, vérifiez :

- [ ] Le fichier est en **markdown** (.md)
- [ ] Le **titre H1** est présent et descriptif
- [ ] Les **sections H2/H3** sont bien structurées
- [ ] Les **paragraphes sont courts** (3-5 phrases max)
- [ ] Des **exemples concrets** sont fournis
- [ ] Les **acronymes sont définis**
- [ ] Des **liens externes** sont ajoutés (si pertinent)
- [ ] Le document fait **au moins 500 caractères** (sinon trop petit)
- [ ] Pas d'**erreurs de frappe** ou de grammaire

---

## 📊 Métriques de qualité

Après ingestion, consultez les logs pour vérifier :

- **Nombre de chunks générés** : Idéalement 5-15 chunks par document (selon la longueur)
- **Taille moyenne des chunks** : Entre 400 et 800 caractères
- **Scores de recherche** : Testez des requêtes typiques, les scores doivent être > 0.7 pour être pertinents

---

## 🚀 Exemples de documents bien structurés

Consultez les exemples existants dans `docs/kb/` :

- `guide_baux.md` : Structure par questions/réponses
- `glossaire_fiscal.md` : Définitions courtes et précises
- `onboarding.md` : Pas-à-pas avec étapes numérotées
- `guide_transactions.md` : Mix de théorie et pratique

---

## 💡 Conseils avancés

### 1. Utiliser des encadrés

Pour mettre en avant des informations importantes :

```markdown
**Important** : Le dépôt de garantie doit être restitué dans un délai de 2 mois maximum.
```

### 2. Tableaux

Pour des comparaisons :

```markdown
| Type de bail | Durée | Préavis locataire |
|--------------|-------|-------------------|
| Vide         | 3 ans | 3 mois            |
| Meublé       | 1 an  | 1 mois            |
```

### 3. Code et formules

Pour les calculs :

```markdown
Formule :
\`\`\`
Nouveau loyer = Loyer actuel × (IRL nouveau / IRL ancien)
\`\`\`
```

### 4. Sections "Ressources complémentaires"

Ajoutez à la fin de chaque document :

```markdown
## Ressources complémentaires

- [Lien officiel 1](https://...)
- [Lien officiel 2](https://...)
```

---

## 🛠️ Dépannage

### Mes chunks ne sont pas retrouvés

- Vérifiez que le document a été correctement ingéré (logs d'ingestion)
- Testez avec des mots-clés exacts du document
- Vérifiez que le score de similarité n'est pas trop faible (<0.5)

### Les réponses sont incohérentes

- Assurez-vous que chaque chunk est **auto-suffisant** (contient assez de contexte)
- Évitez les références floues ("voir ci-dessus", "comme dit précédemment")
- Préférez répéter un peu d'information si nécessaire

### Les chunks sont trop longs/courts

- Ajustez la **structure des titres** (plus de H2 = plus de découpage)
- Utilisez des **paragraphes plus courts**
- Relancez `npm run kb:rebuild`

---

## 📞 Support

Pour toute question sur la rédaction de la KB :
- **Email** : tech@smartimmo.fr
- **Documentation technique** : `src/app/api/ai/README.md`

---

**Version** : 1.0 - PR #2  
**Dernière mise à jour** : 2025-11-03


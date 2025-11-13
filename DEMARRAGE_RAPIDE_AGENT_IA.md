# 🚀 DÉMARRAGE RAPIDE - AGENT IA SMARTIMMO

## ✅ TOUT EST PRÊT - 3 COMMANDES POUR DÉMARRER

---

## 1️⃣ Créer les tables et vues

```bash
npm run ai:setup
```

**Ce que ça fait :**
- ✅ Crée les tables AI (sessions, messages, logs)
- ✅ Crée la table ai_query_log (feedback)
- ✅ Génère des données de test
- ✅ **Crée les 6 vues SQL** (loyers, échéances, prêts, etc.)
- ✅ Génère le catalogue SQL avec alias FR

**Durée :** ~10 secondes

**Résultat attendu :**
```
✓ Vue v_loyers_encaissements_mensuels créée
✓ Vue v_loyers_a_encaisser_courant créée
✓ Vue v_echeances_3_mois créée
✓ Vue v_prets_statut créée
✓ Vue v_documents_statut créée
✓ Vue v_cashflow_global créée

✅ 6/6 vue(s) créée(s) avec succès
```

---

## 2️⃣ Démarrer l'application

```bash
npm run dev
```

**Attendez :**
```
✓ Ready in 3.2s
○ Local: http://localhost:3000
```

---

## 3️⃣ Tester le Compagnon IA

1. Ouvrir http://localhost:3000
2. Cliquer sur le **bouton Compagnon IA** (coin bas-droit)
3. Poser une question

---

## 🧪 Questions de test

### Questions SQL (répondent immédiatement)

✅ **"Combien de baux actifs ?"**
```
Réponse attendue : "Vous avez 12 baux actifs."
Source : 💾 SQL
```

✅ **"Loyers encaissés ce mois ?"**
```
Réponse attendue : "Vous avez encaissé 2 400€ ce mois."
Source : 💾 SQL via v_loyers_encaissements_mensuels
```

✅ **"Qui est en retard de paiement ?"**
```
Réponse attendue : Liste des locataires (emails masqués)
Source : 💾 SQL via v_loyers_a_encaisser_courant
```

✅ **"Échéances dans les 3 mois ?"**
```
Réponse attendue : Liste des échéances (indexations + prêts)
Source : 💾 SQL via v_echeances_3_mois
```

✅ **"Détails de mes prêts ?"**
```
Réponse attendue : Capital restant, mensualités, échéances
Source : 💾 SQL via v_prets_statut
```

### Questions guides (recherche dans la KB)

✅ **"Comment créer un bail ?"**
```
Réponse attendue : Procédure depuis la documentation
Source : 📚 Knowledge Base
```

---

## ❌ Si ça ne marche pas

### Les vues ne se créent pas ?

```bash
# Réessayer
npm run db:views

# Vérifier PostgreSQL
docker ps | grep postgres
```

### L'agent répond "erreur relation n'existe pas" ?

Les vues ne sont pas créées. Vérifier :

```bash
# Test manuel
psql "postgresql://smartimmo:smartimmo@localhost:5432/smartimmo" \
  -c "SELECT * FROM v_loyers_encaissements_mensuels LIMIT 1;"
```

Si erreur → les vues n'existent pas. Relancer :
```bash
npm run db:views
```

### L'agent ne répond pas du tout ?

1. Vérifier qu'Ollama tourne : `curl http://localhost:11434/api/tags`
2. Vérifier le serveur Next.js est démarré
3. Regarder les logs dans le terminal

---

## 🎯 Ce qui fonctionne maintenant

### ✅ 20+ questions supportées

**Baux & Loyers :**
- Combien de baux actifs ?
- Loyers encaissés ce mois / mois dernier ?
- Qui est en retard ?
- Total des cautions ?

**Prêts :**
- Capital restant sur mes prêts ?
- Mensualités totales ?
- Jusqu'à quand j'ai des prêts ?

**Échéances :**
- Échéances dans les 3 mois ?
- Indexations à prévoir ?

**Cashflow :**
- Cashflow du mois ?
- Entrées vs sorties ?

**Documents :**
- J'ai reçu le relevé propriétaire de mars ?
- Documents à classer ?

**Guides :**
- Comment créer un bail ?
- Qu'est-ce que l'IRL ?

### ✅ Intelligence automatique

- **Détection contexte** : Si vous êtes sur `/biens/[id]`, l'agent filtre automatiquement
- **Dates françaises** : "ce mois", "mois dernier", "d'ici 3 mois" → résolution auto
- **Alias FR** : "loyers encaissés", "baux actifs", "capital restant" → SQL auto
- **Fallback** : Si une source échoue, essaie automatiquement la suivante

### ✅ Sécurité

- Read-only garanti
- PII masquées
- LIMIT automatique
- Timeout 5s

---

## 🎉 C'EST PRÊT !

**Commande finale :**

```bash
npm run ai:setup && npm run dev
```

Puis testez : **"Combien de baux actifs ?"** dans le Compagnon IA !

---

**Questions ? Consultez `MAX_COVERAGE_PACK_FINAL.md` 📚**


# 🎯 COMMENCEZ ICI - AGENT IA SMARTIMMO

## ✅ TOUT EST PRÊT

---

## 🚀 INSTALLATION EN 2 COMMANDES

### 1️⃣ Setup

```bash
npm run ai:setup
```

**Attendez 10 secondes...**

✅ Résultat attendu :
```
✓ Vue v_loyers_encaissements_mensuels créée
✓ Vue v_loyers_a_encaisser_courant créée
✓ Vue v_echeances_3_mois créée
✓ Vue v_prets_statut créée
✓ Vue v_documents_statut créée
✓ Vue v_cashflow_global créée

✅ 6/6 vue(s) créée(s) avec succès
```

### 2️⃣ Démarrer

```bash
npm run dev
```

**Attendez "Ready in X.Xs"...**

---

## 🧪 TESTER

1. Ouvrir http://localhost:3000
2. Cliquer sur le **bouton Compagnon IA** (coin bas-droit, icône robot)
3. Poser une question

---

## 💬 QUESTIONS DE TEST

### Copier-coller dans le Compagnon IA :

```
Combien de baux actifs ?
```

**Réponse attendue :**
```
Vous avez 12 baux actifs.

Sources:
💾 SQL: SELECT COUNT(*) FROM "Lease"...
⏱ 25ms
```

---

### Autres questions à tester :

```
Loyers encaissés ce mois ?
Qui est en retard de paiement ?
Détails de mes prêts ?
Échéances dans les 3 mois ?
Comment créer un bail ?
```

**Toutes doivent fonctionner !** ✅

---

## ❌ SI ÇA NE MARCHE PAS

### Erreur "relation n'existe pas" ?

Les vues ne sont pas créées. Réessayer :

```bash
npm run db:views
```

Puis redémarrer :

```bash
npm run dev
```

### L'agent ne répond pas ?

Vérifier qu'Ollama tourne :

```bash
curl http://localhost:11434/api/tags
```

Si erreur, démarrer Ollama :

```bash
ollama serve
```

---

## 📚 DOCUMENTATION

| Fichier | Utilité |
|---------|---------|
| **🎯_COMMENCEZ_ICI.md** | Ce que vous lisez |
| `DEMARRAGE_RAPIDE_AGENT_IA.md` | Guide détaillé |
| `🚀_AGENT_IA_FINAL_TOUT_EST_PRET.md` | Synthèse complète |
| `MAX_COVERAGE_PACK_FINAL.md` | MAX COVERAGE |
| `UNDERSTANDING_BOOSTER_COMPLET.md` | UNDERSTANDING BOOSTER |

---

## 🎉 C'EST TOUT !

**2 commandes → L'agent IA est prêt !**

```bash
npm run ai:setup && npm run dev
```

**Puis testez avec : "Combien de baux actifs ?"** 🚀

---

**BON DÉVELOPPEMENT ! 🏠🤖**


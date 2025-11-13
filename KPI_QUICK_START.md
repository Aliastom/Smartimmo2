# 🚀 Quick Start - Moteur KPI

## ⚡ Démarrage rapide (3 minutes)

### 1. Vérifier que le serveur tourne

```bash
npm run dev
# Le serveur démarre sur http://localhost:3000
```

### 2. Tester l'endpoint healthcheck

```bash
curl http://localhost:3000/api/ai/kpi

# Résultat attendu :
# {"status":"ok","service":"KPI Intelligence","version":"1.0.0"}
```

### 3. Poser votre première question KPI

```bash
curl -X POST http://localhost:3000/api/ai/kpi \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Combien de biens au total ?"
  }'

# Résultat attendu :
# {
#   "matched": true,
#   "text": "📊 **Nombre total de biens** : X",
#   "result": { ... }
# }
```

---

## 📝 Questions d'exemple à tester

### Biens
```bash
"Combien de biens au total ?"
"Combien de biens vacants ?"
"Combien de biens loués ?"
```

### Baux
```bash
"Combien de baux actifs ?"
"Combien de baux arrivent à échéance ?"
"Combien de baux au total ?"
```

### Locataires
```bash
"Combien de locataires ?"
"Combien de locataires ont un bail actif ?"
```

### Finances (avec période temporelle)
```bash
"Combien de loyers encaissés ce mois ?"
"Combien de loyers encaissés cette année ?"
"Quel est mon cashflow ce mois ?"
"Quel est mon cashflow cette année ?"
"Combien j'ai dépensé ce mois ?"
"Combien de revenus cette semaine ?"
```

### Documents
```bash
"Combien de documents ?"
"Combien de documents non classés ?"
```

### Prêts
```bash
"Combien de prêts actifs ?"
"Quel est le montant total emprunté ?"
```

---

## 🧪 Script de test complet

Créez un fichier `test-kpi.sh` :

```bash
#!/bin/bash

# Script de test du moteur KPI
# Usage: ./test-kpi.sh

API_URL="http://localhost:3000/api/ai/kpi"

echo "🧪 Test du moteur KPI..."
echo ""

# Test 1 : Biens
echo "1️⃣  Combien de biens au total ?"
curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{"question":"Combien de biens au total ?"}' | jq .text
echo ""

# Test 2 : Baux actifs
echo "2️⃣  Combien de baux actifs ?"
curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{"question":"Combien de baux actifs ?"}' | jq .text
echo ""

# Test 3 : Loyers (temporel)
echo "3️⃣  Combien de loyers encaissés ce mois ?"
curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{"question":"Combien de loyers encaissés ce mois ?"}' | jq .text
echo ""

# Test 4 : Cashflow (temporel)
echo "4️⃣  Quel est mon cashflow cette année ?"
curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{"question":"Quel est mon cashflow cette année ?"}' | jq .text
echo ""

# Test 5 : Documents
echo "5️⃣  Combien de documents non classés ?"
curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{"question":"Combien de documents non classés ?"}' | jq .text
echo ""

# Test 6 : Pas de match (fallback)
echo "6️⃣  Comment créer un bail ? (pas de match KPI)"
curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{"question":"Comment créer un bail ?"}' | jq .matched
echo ""

echo "✅ Tests terminés !"
```

**Exécution** :
```bash
chmod +x test-kpi.sh
./test-kpi.sh
```

---

## 🎨 Test via l'interface du Compagnon IA

1. **Ouvrir l'interface du compagnon** (généralement `/dashboard` ou page avec le chat)

2. **Poser des questions** :
   - "Combien de biens au total ?"
   - "Combien de baux actifs ?"
   - "Combien de loyers encaissés ce mois ?"

3. **Observer** :
   - ✅ Réponse immédiate (sans Mistral)
   - ✅ Format : `📊 **Label** : valeur [unité]`
   - ✅ Pas de sources RAG affichées (car direct KPI)

---

## 🔍 Vérifier les logs

Dans la console du serveur, vous devriez voir :

```
[KPI][leases.active.count] SQL(12ms) value=8
[KPI][rents.received.sum] SQL(24ms) value=4850.00 period=2025-11-01→2025-12-01
```

Si pas de match :
```
[API /ai/chat] Erreur KPI (fallback vers RAG): Aucune intention détectée
```

---

## 🐛 Dépannage

### Erreur : "Cannot find module '@/server/kpi/...'"
**Solution** : Vérifier que le dossier `src/server/kpi/` existe et contient tous les fichiers.

### Erreur : "Prisma client not found"
**Solution** :
```bash
npx prisma generate
```

### Erreur : "Database connection failed"
**Solution** :
```bash
# Vérifier que PostgreSQL tourne
docker ps

# Démarrer si nécessaire
docker-compose up -d postgres
```

### Pas de résultat KPI (matched: false)
**Cause** : L'intention n'est pas reconnue.  
**Solution** : Ajouter un pattern dans `src/server/kpi/intent.ts`

### Valeur 0 pour tous les KPI
**Cause** : Base de données vide.  
**Solution** : Créer quelques données de test via l'interface.

---

## 📊 Performances attendues

| Métrique | Valeur |
|----------|--------|
| Temps de réponse KPI | **< 50ms** |
| Temps de réponse RAG | **2-5s** |
| Taux de match KPI | **~70%** (questions chiffrées) |
| CPU par requête | **< 1%** |

---

## 🎯 Next Steps

1. **Tester** toutes les questions d'exemple
2. **Ajouter des KPI** selon vos besoins (voir `src/server/kpi/README.md`)
3. **Ajuster les patterns** d'intention si besoin
4. **Monitorer** les logs pour détecter les questions non matchées

---

## 📚 Documentation complète

- **Guide technique** : `src/server/kpi/README.md`
- **Rapport d'implémentation** : `KPI_IMPLEMENTATION_COMPLETE.md`
- **Schéma BDD** : `prisma/schema.prisma`

---

**Bon test ! 🚀**


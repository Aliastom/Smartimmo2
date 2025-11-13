# 📑 Index - Moteur Générique de KPI

> Navigation rapide vers tous les fichiers de l'implémentation KPI

---

## 🏗️ Architecture & Code

### Moteur KPI principal (`src/server/kpi/`)

| Fichier | Description | Rôle |
|---------|-------------|------|
| [`src/server/kpi/registry.ts`](src/server/kpi/registry.ts) | **Catalogue des KPI** | Définit les 20+ KPI disponibles avec leurs requêtes SQL |
| [`src/server/kpi/time.ts`](src/server/kpi/time.ts) | **Parseur temporel** | Convertit "ce mois", "cette année" → dates SQL |
| [`src/server/kpi/query.ts`](src/server/kpi/query.ts) | **Exécuteur SQL** | Exécute les requêtes de manière sécurisée (read-only) |
| [`src/server/kpi/getKpi.ts`](src/server/kpi/getKpi.ts) | **Orchestrateur** | Point d'entrée principal, coordonne registry + time + query |
| [`src/server/kpi/explain.ts`](src/server/kpi/explain.ts) | **Formateur** | Convertit les valeurs en texte naturel (€, %, count, jours) |
| [`src/server/kpi/intent.ts`](src/server/kpi/intent.ts) | **Routeur d'intentions** | Détecte automatiquement l'intention via regex (12 patterns) |
| [`src/server/kpi/README.md`](src/server/kpi/README.md) | **Documentation technique** | Guide complet : architecture, API, exemples, maintenance |

---

## 🌐 API

| Fichier | Endpoint | Description |
|---------|----------|-------------|
| [`src/app/api/ai/kpi/route.ts`](src/app/api/ai/kpi/route.ts) | `POST /api/ai/kpi` | API directe pour interroger les KPI |
| [`src/app/api/ai/chat/route.ts`](src/app/api/ai/chat/route.ts) | `POST /api/ai/chat` | **Modifié** : intégration KPI avant RAG |

---

## 📚 Documentation

| Fichier | Audience | Contenu |
|---------|----------|---------|
| [`KPI_IMPLEMENTATION_PR_SUMMARY.md`](KPI_IMPLEMENTATION_PR_SUMMARY.md) | **Reviewers** | Résumé PR : fichiers créés, changements, checklist |
| [`KPI_IMPLEMENTATION_COMPLETE.md`](KPI_IMPLEMENTATION_COMPLETE.md) | **Développeurs** | Rapport complet : objectifs, implémentation, tests, roadmap |
| [`KPI_QUICK_START.md`](KPI_QUICK_START.md) | **Utilisateurs** | Guide démarrage rapide (3 min) + exemples de questions |
| [`src/server/kpi/README.md`](src/server/kpi/README.md) | **Mainteneurs** | Documentation technique approfondie |
| [`INDEX_KPI.md`](INDEX_KPI.md) | **Tous** | Ce fichier : navigation rapide |

---

## 🧪 Tests

| Fichier | Plateforme | Usage |
|---------|-----------|-------|
| [`test-kpi.ps1`](test-kpi.ps1) | Windows (PowerShell) | Script de test automatisé (7 questions) |

**Commandes** :
```powershell
# Windows
.\test-kpi.ps1

# Linux/Mac (à créer si besoin)
chmod +x test-kpi.sh && ./test-kpi.sh
```

---

## 🗂️ Arborescence complète

```
Smartimmo2/
├── src/
│   ├── server/
│   │   └── kpi/                          ← NOUVEAU DOSSIER
│   │       ├── registry.ts               ← Catalogue KPI
│   │       ├── time.ts                   ← Parseur temporel
│   │       ├── query.ts                  ← Exécuteur SQL
│   │       ├── getKpi.ts                 ← Orchestrateur
│   │       ├── explain.ts                ← Formateur
│   │       ├── intent.ts                 ← Routeur d'intentions
│   │       └── README.md                 ← Doc technique
│   │
│   └── app/
│       └── api/
│           └── ai/
│               ├── kpi/
│               │   └── route.ts          ← NOUVEAU : API KPI directe
│               └── chat/
│                   └── route.ts          ← MODIFIÉ : intégration KPI
│
├── KPI_IMPLEMENTATION_PR_SUMMARY.md      ← Résumé PR
├── KPI_IMPLEMENTATION_COMPLETE.md        ← Rapport complet
├── KPI_QUICK_START.md                    ← Guide démarrage
├── INDEX_KPI.md                          ← Ce fichier
└── test-kpi.ps1                          ← Script test PowerShell
```

---

## 🎯 Navigation par besoin

### Je veux **comprendre l'architecture**
→ Lire : [`src/server/kpi/README.md`](src/server/kpi/README.md) (section Architecture)

### Je veux **tester rapidement**
→ Suivre : [`KPI_QUICK_START.md`](KPI_QUICK_START.md) (3 minutes)

### Je veux **ajouter un nouveau KPI**
→ Consulter : [`src/server/kpi/README.md`](src/server/kpi/README.md) (section "Ajouter un KPI")

### Je veux **review le code**
→ Lire : [`KPI_IMPLEMENTATION_PR_SUMMARY.md`](KPI_IMPLEMENTATION_PR_SUMMARY.md) (checklist complète)

### Je veux **comprendre les choix techniques**
→ Lire : [`KPI_IMPLEMENTATION_COMPLETE.md`](KPI_IMPLEMENTATION_COMPLETE.md) (rapport détaillé)

### Je veux **voir tous les KPI disponibles**
→ Consulter : [`src/server/kpi/registry.ts`](src/server/kpi/registry.ts) (ligne 16)

### Je veux **comprendre la détection d'intentions**
→ Consulter : [`src/server/kpi/intent.ts`](src/server/kpi/intent.ts) (ligne 21)

### Je veux **ajouter une période temporelle**
→ Modifier : [`src/server/kpi/time.ts`](src/server/kpi/time.ts) (ligne 20)

---

## 🔗 Liens externes

| Ressource | URL |
|-----------|-----|
| Prisma Schema | [`prisma/schema.prisma`](prisma/schema.prisma) |
| API Chat (avant modif) | `src/app/api/ai/chat/route.ts` (voir git diff) |
| RAG (Qdrant) | `src/lib/ai/rag/` |

---

## 📊 Statistiques

- **Fichiers créés** : 11 (7 code + 4 docs)
- **Fichiers modifiés** : 1 (`chat/route.ts`)
- **Lignes ajoutées** : ~1,830 lignes
- **KPI disponibles** : 20+
- **Patterns d'intention** : 12
- **Expressions temporelles** : 9

---

## 🎨 Diagramme de flux

```
┌─────────────────────────────────────────────────────────────┐
│                   Utilisateur pose une question              │
│              "Combien de loyers encaissés ce mois ?"         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │   /api/ai/chat (POST)         │
         │   - Validation query          │
         └───────────┬───────────────────┘
                     │
                     ▼
         ┌───────────────────────────────┐
         │   intent.ts                   │
         │   Détection d'intention ?     │
         └───────┬───────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
  ✅ MATCH          ❌ PAS DE MATCH
        │                 │
        │                 │
        ▼                 ▼
┌───────────────┐   ┌──────────────┐
│  getKpi.ts    │   │  RAG         │
│  - registry   │   │  - Qdrant    │
│  - time       │   │  - Mistral   │
│  - query      │   │              │
│  - explain    │   │  (existant)  │
└───────┬───────┘   └──────┬───────┘
        │                  │
        ▼                  ▼
   📊 Réponse        💬 Réponse
   immédiate         RAG/LLM
   (< 50ms)          (2-5s)
```

---

## ✅ Checklist d'utilisation

- [ ] Lire [`KPI_QUICK_START.md`](KPI_QUICK_START.md)
- [ ] Démarrer le serveur (`npm run dev`)
- [ ] Tester avec [`test-kpi.ps1`](test-kpi.ps1)
- [ ] Essayer dans l'interface du compagnon
- [ ] Consulter les logs serveur
- [ ] Ajouter votre premier KPI custom
- [ ] Lire la doc technique complète

---

**Dernière mise à jour** : 4 novembre 2025  
**Version** : 1.0.0


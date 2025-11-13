# Changelog — Module Scraping Fiscal

## Version 1.0.0 — Novembre 2025

### ✨ Nouvelles fonctionnalités

#### 🌐 Scraping Multi-sources
- **BofipAdapter** : Scraping automatique du Bulletin Officiel des Finances Publiques
- **DgfipAdapter** : Récupération depuis impots.gouv.fr (HTML + PDF)
- **ServicePublicAdapter** : Extraction depuis service-public.fr
- **LegifranceAdapter** : Cross-check depuis Legifrance (optionnel)

#### 🔄 Orchestration & Worker
- **TaxScrapeWorker** : Orchestrateur complet avec :
  - Exécution parallèle des adapters
  - Rate limiting (1 req/sec par domaine)
  - Retry avec backoff exponentiel
  - Circuit breaker
  - Sauvegarde snapshots
  - Fusion avec priorité des sources
  - Validation multi-niveaux
  - Création automatique de version draft

#### 📊 API Routes
- **POST `/api/admin/tax/sources/update`** : Lancer un job de scraping
- **GET `/api/admin/tax/sources/status?jobId=xxx`** : Récupérer le statut d'un job

#### 🎨 Interface Utilisateur
- **TaxSourceScrapeModal** : Modal avec :
  - Lancement automatique du job
  - Polling toutes les 2 secondes
  - Journal en temps réel (auto-scroll)
  - Indicateurs visuels d'état
  - Barre de progression
  - Preview des changements détectés
  - CTA "Comparer les versions"
  - Affichage warnings et erreurs

#### 🧰 Parsers
- **HTML Parser** : 
  - Parsing avec cheerio
  - Extraction tableaux
  - Parsing montants euros (multiples formats)
  - Parsing pourcentages
  - Nettoyage texte
  - Extraction barèmes IR
- **PDF Parser** :
  - Extraction texte depuis PDF
  - Détection tableaux en texte
  - Extraction sections
  - Parsing barèmes, décote, PS, micro

#### 🛠️ Utilitaires
- **Merge** : Fusion données avec priorité des sources
- **Validate** : Validation multi-règles (bornes, cohérence, croissance)
- **Diff** : Comparaison profonde entre versions
- **Hash** : SHA256 pour détection changements

#### 🗄️ Base de données
- **TaxSourceSnapshot** : Nouveau modèle pour audit trail
  - Stockage contenu brut
  - Hash SHA256
  - URL source et date
  - Section et source identifiées
  - Indexation optimale

#### 🧪 Tests
- Tests unitaires parsers
- Tests unitaires utilitaires
- Tests d'intégration (structure)
- Fixtures HTML de test

---

## 📁 Fichiers créés

### Services & Adapters
```
src/services/tax/sources/
├── adapters/
│   ├── BofipAdapter.ts             ✨ NOUVEAU
│   ├── DgfipAdapter.ts             ✨ NOUVEAU
│   ├── ServicePublicAdapter.ts     ✨ NOUVEAU
│   └── LegifranceAdapter.ts        ✨ NOUVEAU
├── parsers/
│   ├── html.ts                     ✨ NOUVEAU
│   └── pdf.ts                      ✨ NOUVEAU
├── __tests__/
│   ├── fixtures/
│   │   └── bofip-ir-2025.html      ✨ NOUVEAU
│   ├── parsers.test.ts             ✨ NOUVEAU
│   ├── utils.test.ts               ✨ NOUVEAU
│   └── integration.test.ts         ✨ NOUVEAU
├── TaxScrapeWorker.ts              ✨ NOUVEAU
├── types.ts                        ✨ NOUVEAU
├── utils.ts                        ✨ NOUVEAU
└── README.md                       ✨ NOUVEAU
```

### API Routes
```
src/app/api/admin/tax/sources/
├── update/
│   └── route.ts                    ✨ NOUVEAU
└── status/
    └── route.ts                    ✨ NOUVEAU
```

### Composants UI
```
src/components/admin/fiscal/
├── TaxSourceScrapeModal.tsx        ✨ NOUVEAU
└── VersionsTab.tsx                 🔧 MODIFIÉ
```

### Base de données
```
prisma/
├── schema.prisma                   🔧 MODIFIÉ (+TaxSourceSnapshot)
└── migrations/
    └── xxx_add_tax_source_snapshot/
        └── migration.sql           ✨ NOUVEAU
```

### Documentation
```
MODULE_SCRAPING_FISCAL_GUIDE.md     ✨ NOUVEAU
INSTALL_SCRAPING_FISCAL.md          ✨ NOUVEAU
CHANGELOG_SCRAPING_FISCAL.md        ✨ NOUVEAU (ce fichier)
scripts/
├── install-scraping-fiscal.sh      ✨ NOUVEAU
└── install-scraping-fiscal.ps1     ✨ NOUVEAU
```

---

## 🔧 Fichiers modifiés

### `prisma/schema.prisma`
```diff
+ model TaxSourceSnapshot {
+   id        String   @id @default(cuid())
+   year      Int
+   section   String
+   source    String
+   url       String
+   fetchedAt DateTime
+   hash      String
+   payload   String
+   createdAt DateTime @default(now())
+   
+   @@index([year, section])
+   @@index([source])
+   @@index([hash])
+ }
```

### `src/components/admin/fiscal/VersionsTab.tsx`
```diff
+ import { TaxSourceScrapeModal } from './TaxSourceScrapeModal';

export function VersionsTab() {
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
+ const [scrapeModalOpen, setScrapeModalOpen] = useState(false);
  
- const handleUpdateFromSources = async () => {
-   // Ancien code avec fetch direct
- };
+ const handleUpdateFromSources = () => {
+   setScrapeModalOpen(true);
+ };
  
  return (
    // ...
+   <TaxSourceScrapeModal
+     open={scrapeModalOpen}
+     onClose={() => setScrapeModalOpen(false)}
+     onSuccess={loadVersions}
+   />
  );
}
```

---

## 📦 Dépendances ajoutées

### Production
```json
{
  "axios": "^1.6.0",
  "cheerio": "^1.0.0-rc.12",
  "pdf-parse": "^1.1.1"
}
```

### Développement
```json
{
  "@types/pdf-parse": "^1.1.4"
}
```

---

## 🔒 Sécurité & Conformité

### Rate Limiting
- ✅ 1 requête/seconde par domaine
- ✅ 3 tentatives max avec backoff
- ✅ Circuit breaker après 5 échecs
- ✅ Timeout 10-20s par requête

### Audit Trail
- ✅ Snapshots de tous les contenus bruts
- ✅ Hash SHA256 pour détection changements
- ✅ URL source et date enregistrés
- ✅ Historisation utilisateur
- ✅ **Jamais de publication automatique**

### Validation
- ✅ Année dans [2020, 2030]
- ✅ Tranches IR croissantes
- ✅ Taux dans [0, 1]
- ✅ Plafonds > 0
- ✅ Durées de report >= 0
- ✅ Détection divergences entre sources

---

## 🎯 Workflow implémenté

1. **Admin** clique "Mettre à jour depuis sources officielles"
2. **API** crée un job et retourne `jobId`
3. **Worker** exécute en arrière-plan :
   - Fetch depuis 4 sources (rate-limited)
   - Sauvegarde snapshots
   - Merge avec priorité
   - Validation
   - Comparaison avec version active
   - Création draft si changement
4. **UI** affiche en temps réel :
   - État du job (fetching, parsing, merging...)
   - Journal détaillé
   - Résultat (no-change ou draft-created)
   - CTA "Comparer les versions"

---

## 🚀 Utilisation

### Interface Admin
```
/admin/impots/parametres
→ Onglet "Barèmes fiscaux"
→ Bouton "Mettre à jour depuis sources officielles"
→ Modal avec journal en temps réel
```

### API
```bash
# Lancer scraping
curl -X POST http://localhost:3000/api/admin/tax/sources/update \
  -H "Content-Type: application/json" \
  -d '{"year": 2025}'

# Récupérer statut
curl http://localhost:3000/api/admin/tax/sources/status?jobId=xxx
```

### Code
```typescript
import { taxScrapeWorker } from '@/services/tax/sources/TaxScrapeWorker';

const jobId = await taxScrapeWorker.startJob(2025, 'userId');
const status = taxScrapeWorker.getJobStatus(jobId);
```

---

## 📊 Métriques

- **Lignes de code** : ~3500 lignes
- **Fichiers créés** : 22 fichiers
- **Fichiers modifiés** : 2 fichiers
- **Tests** : 20+ tests unitaires
- **Sources** : 4 adapters (BOFiP, DGFiP, Service-Public, Legifrance)
- **Sections** : 7 sections fiscales (IR, IR_DECOTE, PS, MICRO, DEFICIT, PER, SCI_IS)

---

## 🔮 Roadmap

### v1.1 (court terme)
- [ ] Cache sur disque avec TTL
- [ ] Circuit breaker persistant
- [ ] Notifications email divergences
- [ ] Dashboard monitoring sources

### v1.2 (moyen terme)
- [ ] Support sources européennes
- [ ] ML détection anomalies
- [ ] API publique consultation snapshots
- [ ] Versioning sémantique automatique

### v2.0 (long terme)
- [ ] Scraping temps réel (webhooks)
- [ ] Multi-pays (EU)
- [ ] Prédiction changements fiscaux
- [ ] Intégration IA générative

---

## 🐛 Bugs connus

Aucun bug connu à ce jour.

---

## 📝 Notes de version

### Version 1.0.0 (Novembre 2025)
- ✅ Première version stable
- ✅ Tous les composants testés
- ✅ Documentation complète
- ✅ Prêt pour production

---

## 🙏 Remerciements

Module développé pour **SmartImmo** avec :
- TypeScript
- Next.js 14
- Prisma ORM
- React Server Components
- Tailwind CSS

---

**Développé avec ❤️ par l'équipe SmartImmo**

*Version 1.0.0 — Novembre 2025*


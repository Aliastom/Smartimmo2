# Module de Scraping des Sources Fiscales Officielles

Ce module permet de récupérer automatiquement les barèmes fiscaux depuis les sources officielles françaises.

## Architecture

```
src/services/tax/sources/
├── adapters/           # Adapters pour chaque source
│   ├── BofipAdapter.ts
│   ├── DgfipAdapter.ts
│   ├── ServicePublicAdapter.ts
│   └── LegifranceAdapter.ts
├── parsers/            # Parsers HTML et PDF
│   ├── html.ts
│   └── pdf.ts
├── __tests__/          # Tests et fixtures
│   ├── fixtures/
│   ├── parsers.test.ts
│   ├── utils.test.ts
│   └── integration.test.ts
├── TaxScrapeWorker.ts  # Orchestrateur principal
├── types.ts            # Types TypeScript
├── utils.ts            # Utilitaires (merge, diff, validate)
└── README.md
```

## Sources

### 1. BOFiP (Priorité: HAUTE)
- **URL**: https://bofip.impots.gouv.fr
- **Confiance**: High
- **Données**: Barèmes IR, décote, PS, régimes micro
- **Format**: HTML avec tableaux structurés

### 2. DGFiP (Priorité: MOYENNE)
- **URL**: https://www.impots.gouv.fr
- **Confiance**: Medium
- **Données**: Barèmes IR, PS, micro
- **Format**: HTML + PDF

### 3. Service-Public (Priorité: MOYENNE)
- **URL**: https://www.service-public.fr
- **Confiance**: Medium
- **Données**: Plafonds micro, PER, déficit foncier, IS SCI
- **Format**: HTML

### 4. Legifrance (Priorité: BASSE - Cross-check)
- **URL**: https://www.legifrance.gouv.fr
- **Confiance**: Medium
- **Données**: CGI, CSS (textes juridiques)
- **Format**: HTML complexe

## Utilisation

### API

```typescript
// Lancer un job de scraping
POST /api/admin/tax/sources/update
Body: { year: 2025 }
Response: { jobId: "scrape-2025-xxxxx" }

// Récupérer le statut
GET /api/admin/tax/sources/status?jobId=scrape-2025-xxxxx
Response: {
  jobId: "scrape-2025-xxxxx",
  state: "completed",
  status: "draft-created",
  draftCode: "2025.import-xxxxx",
  changes: [...]
}
```

### Worker

```typescript
import { taxScrapeWorker } from '@/services/tax/sources/TaxScrapeWorker';

// Démarrer un job
const jobId = await taxScrapeWorker.startJob(2025, 'userId');

// Récupérer le statut
const status = taxScrapeWorker.getJobStatus(jobId);
```

## Priorité des sources

Lorsqu'une même donnée est trouvée dans plusieurs sources, la priorité est :

1. **BOFIP** (source la plus fiable)
2. **DGFIP**
3. **SERVICE_PUBLIC**
4. **LEGIFRANCE**

En cas de divergence, un warning est généré dans les logs.

## Validation

Les paramètres récupérés sont validés avec les règles suivantes :

- Année entre 2020 et 2030
- Tranches IR croissantes
- Taux dans [0, 1]
- Plafonds > 0
- Durées de report >= 0

## Rate Limiting

- 1 requête/seconde par domaine
- 3 tentatives maximum avec backoff exponentiel
- Cache de 48-72h

## Snapshots

Tous les contenus bruts sont sauvegardés dans `TaxSourceSnapshot` avec :
- Hash SHA256 du contenu
- URL source
- Date de récupération
- Section concernée

## Tests

```bash
# Lancer les tests
npm test src/services/tax/sources

# Tests avec coverage
npm test -- --coverage src/services/tax/sources
```

## Dépendances

- `axios`: Requêtes HTTP
- `cheerio`: Parsing HTML
- `pdf-parse`: Parsing PDF
- `crypto`: Hashing (natif Node.js)

## Conformité

- ✅ Respect robots.txt
- ✅ Rate limiting
- ✅ User-Agent identifiable
- ✅ Pas de publication automatique
- ✅ Audit trail complet
- ✅ Validation multi-niveaux

## Roadmap

- [ ] Cache sur disque avec TTL
- [ ] Circuit breaker pour les sources instables
- [ ] Notifications email en cas de divergence
- [ ] Dashboard de monitoring des sources
- [ ] Support de sources supplémentaires
- [ ] Export des snapshots pour audit


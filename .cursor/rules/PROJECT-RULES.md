# Règles Projet Smartimmo (LOCAL)

- Langue: Français
- TypeScript: strict
- Qualité: ESLint + Prettier
- Tests: Vitest (unitaires) + Playwright (e2e)

UI
- Thème: SIRIUS (Shuffle.dev)
- Navigation: sidebar foncée translucide + topbar fixe
- Composants: cards arrondies, tables légères (hover, pagination, filtres), modals avec overlay sombre
- Palette: gris/bleu sobres, ombres douces, transitions fluides
- Icônes: Lucide

Architecture
- Clean Architecture stricte: `src/domain`, `src/infra`, `src/ui`
- Aucune logique métier dans `src/ui/`

Données & Persistances
- Prisma + SQLite (local uniquement)
- Données fiscales: `config/tax/*.json`

Divers
- Pas d’auth, pas de Supabase (local only)
- App Router Next.js


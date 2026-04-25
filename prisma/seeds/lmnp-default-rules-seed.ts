/**
 * Seed additif des règles LMNP par défaut.
 *
 * SAFE:
 * - N'écrit que dans LmnpExportMappingRule
 * - Ne supprime aucune donnée
 * - N'écrase pas les règles custom existantes (hors périmètre seed)
 */

import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_MAPPING_VERSION = 'seed-lmnp-default-v1';
const SEED_ID_PREFIX = 'lmnpseed_';

type RuleTemplate = {
  code: string;
  natureCodes?: Array<string | null>;
  categorySlugCandidates?: string[];
  lmnpBucket: string;
  lmnpLabel: string;
  priority: number;
};

const DEFAULT_RULE_TEMPLATES: RuleTemplate[] = [
  {
    code: 'RECETTE_LOYER',
    natureCodes: ['RECETTE_LOYER', 'LOYER'],
    categorySlugCandidates: ['loyer'],
    lmnpBucket: 'RECETTES_LOCATIVES',
    lmnpLabel: 'Loyers encaisses',
    priority: 900,
  },
  {
    code: 'ASSURANCE',
    natureCodes: ['DEPENSE_ASSURANCE', 'ASSURANCE'],
    categorySlugCandidates: ['assurance', 'assurance-pno', 'assurance_pno'],
    lmnpBucket: 'CHARGES_ASSURANCE',
    lmnpLabel: 'Assurances (PNO, GLI, etc.)',
    priority: 780,
  },
  {
    code: 'FRAIS_BANCAIRES',
    natureCodes: ['DEPENSE_BANQUE', 'FRAIS_BANCAIRES'],
    categorySlugCandidates: ['frais-bancaires', 'frais_bancaires', 'banque'],
    lmnpBucket: 'CHARGES_FINANCIERES',
    lmnpLabel: 'Frais bancaires',
    priority: 700,
  },
  {
    code: 'ENTRETIEN',
    natureCodes: ['DEPENSE_ENTRETIEN', 'ENTRETIEN', 'DEPENSE_TRAVAUX'],
    categorySlugCandidates: ['entretien', 'travaux-entretien', 'travaux_entretien', 'travaux'],
    lmnpBucket: 'CHARGES_ENTRETIEN_REPARATION',
    lmnpLabel: 'Entretien et reparations',
    priority: 740,
  },
  {
    code: 'TAXES_IMPOTS',
    natureCodes: ['DEPENSE_TAXE', 'TAXES_IMPOTS'],
    categorySlugCandidates: ['taxe-fonciere', 'taxe_fonciere', 'taxes-impots', 'taxes_impots'],
    lmnpBucket: 'CHARGES_FISCALES',
    lmnpLabel: 'Taxes et impots (dont taxe fonciere)',
    priority: 800,
  },
  // Pret: interets (si categorie dediee disponible)
  {
    code: 'PRET_INTERETS',
    natureCodes: ['DEPENSE_BANQUE', 'INTERETS_EMPRUNT', 'DEPENSE_INTERETS_EMPRUNT'],
    categorySlugCandidates: ['interets-emprunt', 'interets_emprunt'],
    lmnpBucket: 'CHARGES_FINANCIERES',
    lmnpLabel: "Interets d'emprunt",
    priority: 850,
  },
  // Pret: assurance emprunteur (si categorie dediee disponible)
  {
    code: 'PRET_ASSURANCE',
    natureCodes: ['DEPENSE_ASSURANCE', 'ASSURANCE_EMPRUNTEUR', 'DEPENSE_ASSURANCE_EMPRUNTEUR'],
    categorySlugCandidates: ['assurance-emprunteur', 'assurance_emprunteur'],
    lmnpBucket: 'CHARGES_ASSURANCE',
    lmnpLabel: 'Assurance emprunteur',
    priority: 840,
  },
  // Fallback explicite
  {
    code: 'FALLBACK_EXPLICITE',
    natureCodes: [null],
    categorySlugCandidates: [],
    lmnpBucket: 'A_CLASSER',
    lmnpLabel: 'Non classe LMNP (validation manuelle)',
    priority: -1000,
  },
];

function parseExerciseYears(): number[] {
  const fromEnv = process.env.LMNP_SEED_EXERCISE_YEARS;
  if (fromEnv && fromEnv.trim().length > 0) {
    const parsed = fromEnv
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 2000 && n <= 2100);
    if (parsed.length > 0) return [...new Set(parsed)].sort((a, b) => a - b);
  }

  const now = new Date().getFullYear();
  return [now - 1, now];
}

function deterministicSeedRuleId(input: {
  organizationId: string;
  exerciseYear: number;
  code: string;
  natureCode: string | null;
  categoryId: string | null;
}): string {
  const payload = [
    DEFAULT_MAPPING_VERSION,
    input.organizationId,
    String(input.exerciseYear),
    input.code,
    input.natureCode ?? 'null',
    input.categoryId ?? 'null',
  ].join('|');
  const hash = createHash('sha1').update(payload).digest('hex').slice(0, 24);
  return `${SEED_ID_PREFIX}${hash}`;
}

function isManagedBySeed(row: { id: string; mappingVersion: string }): boolean {
  return row.id.startsWith(SEED_ID_PREFIX) || row.mappingVersion === DEFAULT_MAPPING_VERSION;
}

async function upsertSeedRule(params: {
  organizationId: string;
  exerciseYear: number;
  code: string;
  natureCode: string | null;
  categoryId: string | null;
  lmnpBucket: string;
  lmnpLabel: string;
  priority: number;
}): Promise<'created' | 'updated' | 'skipped_custom'> {
  const {
    organizationId,
    exerciseYear,
    code,
    natureCode,
    categoryId,
    lmnpBucket,
    lmnpLabel,
    priority,
  } = params;

  const functionalWhere = {
    organizationId,
    exerciseYear,
    propertyId: null as string | null,
    natureCode,
    categoryId,
    lmnpBucket,
  };

  const existingFunctional = await prisma.lmnpExportMappingRule.findFirst({
    where: functionalWhere,
    orderBy: { createdAt: 'asc' },
  });

  if (existingFunctional && !isManagedBySeed(existingFunctional)) {
    return 'skipped_custom';
  }

  const seedId = deterministicSeedRuleId({
    organizationId,
    exerciseYear,
    code,
    natureCode,
    categoryId,
  });

  const data = {
    organizationId,
    exerciseYear,
    propertyId: null as string | null,
    natureCode,
    categoryId,
    lmnpBucket,
    lmnpLabel,
    priority,
    active: true,
    mappingVersion: DEFAULT_MAPPING_VERSION,
  };

  if (existingFunctional) {
    await prisma.lmnpExportMappingRule.update({
      where: { id: existingFunctional.id },
      data,
    });
    return 'updated';
  }

  const existingById = await prisma.lmnpExportMappingRule.findUnique({
    where: { id: seedId },
    select: { id: true },
  });

  await prisma.lmnpExportMappingRule.upsert({
    where: { id: seedId },
    update: data,
    create: {
      id: seedId,
      ...data,
    },
  });

  return existingById ? 'updated' : 'created';
}

async function main() {
  const exerciseYears = parseExerciseYears();
  const organizations = await prisma.organization.findMany({
    select: { id: true, slug: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  if (organizations.length === 0) {
    console.log('ℹ️ Aucun organization trouvé : seed LMNP ignoré.');
    return;
  }

  const categories = await prisma.category.findMany({
    select: { id: true, slug: true },
  });
  const categoryBySlug = new Map(categories.map((c) => [c.slug.toLowerCase(), c.id]));

  let created = 0;
  let updated = 0;
  let skippedCustom = 0;

  console.log('🌱 Seed LMNP par défaut');
  console.log(`   - mappingVersion: ${DEFAULT_MAPPING_VERSION}`);
  console.log(`   - exerciseYears: ${exerciseYears.join(', ')}`);
  console.log(`   - organizations: ${organizations.length}`);

  for (const org of organizations) {
    for (const year of exerciseYears) {
      for (const tpl of DEFAULT_RULE_TEMPLATES) {
        const categoryId = (() => {
          for (const slug of tpl.categorySlugCandidates || []) {
            const hit = categoryBySlug.get(slug.toLowerCase());
            if (hit) return hit;
          }
          return null;
        })();

        const natureCodes = tpl.natureCodes?.length ? tpl.natureCodes : [null];
        for (const natureCandidate of natureCodes) {
          const natureCode = natureCandidate ?? null;

          const outcome = await upsertSeedRule({
            organizationId: org.id,
            exerciseYear: year,
            code: tpl.code,
            natureCode,
            categoryId,
            lmnpBucket: tpl.lmnpBucket,
            lmnpLabel: tpl.lmnpLabel,
            priority: tpl.priority,
          });

          if (outcome === 'created') created += 1;
          else if (outcome === 'updated') updated += 1;
          else skippedCustom += 1;
        }
      }
    }
  }

  console.log('✅ Seed LMNP terminé.');
  console.log(`   - created: ${created}`);
  console.log(`   - updated: ${updated}`);
  console.log(`   - skipped_custom: ${skippedCustom}`);
}

main()
  .catch((error) => {
    console.error('❌ Erreur seed LMNP:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


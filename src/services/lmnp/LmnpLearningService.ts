import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';

export type LmnpStoredPatternShape = {
  document_type_code?: string | null;
  category_id?: string | null;
  nature_code?: string | null;
  text_tokens: string[];
  ocr_tokens: string[];
};

export type LmnpLearningPatternMatch = {
  id: string;
  documentTypeCode?: string | null;
  categoryId?: string | null;
  natureCode?: string | null;
  textTokens: string[];
  ocrTokens: string[];
  lmnpBucket: string;
  lmnpLabel: string;
  confidence: number;
  usageCount: number;
};

export function normalizeLmnpText(s: string | null | undefined): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function tokenizeLmnpText(s: string | null | undefined): string[] {
  const n = normalizeLmnpText(s);
  return n
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 24);
}

function stableJson(obj: LmnpStoredPatternShape): string {
  return JSON.stringify({
    document_type_code: obj.document_type_code ?? null,
    category_id: obj.category_id ?? null,
    nature_code: obj.nature_code ?? null,
    text_tokens: [...obj.text_tokens].sort(),
    ocr_tokens: [...obj.ocr_tokens].sort(),
  });
}

export function buildLearningPatternKey(
  organizationId: string,
  shape: Pick<LmnpStoredPatternShape, 'document_type_code' | 'category_id' | 'nature_code'>,
  lmnpBucket: string,
  lmnpLabel: string,
): string {
  const doc = (shape.document_type_code || '').trim().toUpperCase();
  const cat = (shape.category_id || '').trim();
  const nat = (shape.nature_code || '').trim().toUpperCase();
  const payload = `${organizationId}|${doc}|${cat}|${nat}|${lmnpBucket}|${lmnpLabel}`;
  return createHash('sha256').update(payload).digest('hex');
}

export function parseLearningRow(row: {
  id: string;
  patternJson: string;
  lmnpBucket: string;
  lmnpLabel: string;
  confidence: number;
  usageCount: number;
}): LmnpLearningPatternMatch {
  let parsed: LmnpStoredPatternShape = {
    text_tokens: [],
    ocr_tokens: [],
  };
  try {
    parsed = { ...parsed, ...JSON.parse(row.patternJson) };
  } catch {
    // ignore
  }
  return {
    id: row.id,
    documentTypeCode: parsed.document_type_code ?? null,
    categoryId: parsed.category_id ?? null,
    natureCode: parsed.nature_code ?? null,
    textTokens: Array.isArray(parsed.text_tokens) ? parsed.text_tokens.map(String) : [],
    ocrTokens: Array.isArray(parsed.ocr_tokens) ? parsed.ocr_tokens.map(String) : [],
    lmnpBucket: row.lmnpBucket,
    lmnpLabel: row.lmnpLabel,
    confidence: row.confidence,
    usageCount: row.usageCount,
  };
}

export async function fetchLearningPatternsForOrganization(
  organizationId: string,
  take = 800,
): Promise<LmnpLearningPatternMatch[]> {
  const rows = await prisma.lmnpLearningPattern.findMany({
    where: { organizationId },
    orderBy: [{ usageCount: 'desc' }, { updatedAt: 'desc' }],
    take,
  });
  return rows.map(parseLearningRow);
}

export async function incrementLearningPatternUsage(ids: string[]): Promise<void> {
  const counts = new Map<string, number>();
  for (const id of ids) {
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  if (counts.size === 0) return;
  await prisma.$transaction(
    [...counts.entries()].map(([id, n]) =>
      prisma.lmnpLearningPattern.update({
        where: { id },
        data: { usageCount: { increment: n } },
      }),
    ),
  );
}

function mergeTokenLists(a: string[], b: string[]): string[] {
  return [...new Set([...(a || []), ...(b || [])].map((t) => normalizeLmnpText(t)).filter(Boolean))].slice(0, 32);
}

export interface RecordLmnpLearningInput {
  organizationId: string;
  propertyId?: string | null;
  documentTypeCode?: string | null;
  categoryId?: string | null;
  natureCode?: string | null;
  transactionLabel?: string | null;
  ocrText?: string | null;
  lmnpBucket: string;
  lmnpLabel: string;
  /** Confiance de la suggestion / correction (ne pas apprendre si < 0.6) */
  guidanceConfidence: number;
}

export async function recordLearningFromUserCorrection(input: RecordLmnpLearningInput): Promise<{ ok: boolean; reason?: string }> {
  if (input.guidanceConfidence < 0.6) {
    return { ok: false, reason: 'confidence_too_low' };
  }

  const doc = (input.documentTypeCode || '').trim().toUpperCase() || null;
  const cat = (input.categoryId || '').trim() || null;
  const nat = (input.natureCode || '').trim().toUpperCase() || null;
  const textTokens = tokenizeLmnpText(input.transactionLabel);
  const ocrTokens = tokenizeLmnpText(input.ocrText);

  const hasDoc = Boolean(doc);
  const hasCat = Boolean(cat);
  const hasNat = Boolean(nat);
  const hasEnoughLabel = textTokens.length >= 2;
  if (!hasDoc && !hasCat && !hasNat && !hasEnoughLabel) {
    return { ok: false, reason: 'incoherent' };
  }

  const shape: LmnpStoredPatternShape = {
    document_type_code: doc,
    category_id: cat,
    nature_code: nat,
    text_tokens: textTokens,
    ocr_tokens: ocrTokens,
  };

  const patternKey = buildLearningPatternKey(
    input.organizationId,
    {
      document_type_code: doc,
      category_id: cat,
      nature_code: nat,
    },
    input.lmnpBucket,
    input.lmnpLabel,
  );

  const existing = await prisma.lmnpLearningPattern.findUnique({
    where: {
      organizationId_patternKey: {
        organizationId: input.organizationId,
        patternKey,
      },
    },
  });

  const newConfidence = Math.min(Math.max(input.guidanceConfidence, 0.65), 0.95);

  if (!existing) {
    await prisma.lmnpLearningPattern.create({
      data: {
        organizationId: input.organizationId,
        propertyId: input.propertyId || null,
        patternKey,
        patternJson: stableJson(shape),
        lmnpBucket: input.lmnpBucket,
        lmnpLabel: input.lmnpLabel,
        confidence: newConfidence,
        usageCount: 0,
      },
    });
    return { ok: true };
  }

  let prev: LmnpStoredPatternShape = shape;
  try {
    prev = { ...shape, ...JSON.parse(existing.patternJson) };
  } catch {
    prev = shape;
  }
  const merged: LmnpStoredPatternShape = {
    document_type_code: doc ?? prev.document_type_code ?? null,
    category_id: cat ?? prev.category_id ?? null,
    nature_code: nat ?? prev.nature_code ?? null,
    text_tokens: mergeTokenLists(prev.text_tokens || [], textTokens),
    ocr_tokens: mergeTokenLists(prev.ocr_tokens || [], ocrTokens),
  };

  await prisma.lmnpLearningPattern.update({
    where: { id: existing.id },
    data: {
      patternJson: stableJson(merged),
      confidence: Math.max(existing.confidence, newConfidence),
      propertyId: input.propertyId || existing.propertyId,
    },
  });
  return { ok: true };
}

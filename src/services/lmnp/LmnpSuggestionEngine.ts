import type { LmnpLearningPatternMatch } from '@/services/lmnp/LmnpLearningService';
import { normalizeLmnpText, tokenizeLmnpText } from '@/services/lmnp/LmnpLearningService';

export type LmnpSuggestionSource =
  | 'learning'
  | 'document_type'
  | 'ocr'
  | 'transaction_category'
  | 'transaction_label'
  | 'filename'
  | 'fallback';

export interface LmnpSuggestionLinkedDocumentInput {
  id: string;
  filename?: string | null;
  documentTypeCode?: string | null;
  documentTypeLabel?: string | null;
  ocrText?: string | null;
}

export interface LmnpSuggestionInput {
  natureCode?: string | null;
  categoryId?: string | null;
  categorySlug?: string | null;
  transactionLabel?: string | null;
  linkedDocuments?: LmnpSuggestionLinkedDocumentInput[];
  /** Patterns appris (priorité la plus haute) */
  learningPatterns?: LmnpLearningPatternMatch[];
}

export interface LmnpSuggestionResult {
  suggestedBucket: string;
  suggestedLabel: string;
  suggestedNatureCode?: string;
  suggestedCategoryId?: string;
  confidence: number;
  reason: string;
  source: LmnpSuggestionSource;
  /** Présent si la suggestion provient de l’apprentissage (pour renforcer usageCount côté export). */
  matchedLearningPatternId?: string;
}

function includesAny(text: string, tokens: string[]): boolean {
  return tokens.some((t) => text.includes(t));
}

function normalize(s: string | null | undefined): string {
  return normalizeLmnpText(s);
}

function tokenizeLabel(s: string | null | undefined): string[] {
  return tokenizeLmnpText(s);
}

function tokenSet(tokens: string[]): Set<string> {
  return new Set((tokens || []).map((t) => normalizeLmnpText(t)).filter(Boolean));
}

function overlapScore(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const A = tokenSet(a);
  const B = tokenSet(b);
  let n = 0;
  for (const x of B) {
    if (A.has(x)) n += 1;
  }
  const denom = Math.sqrt(Math.max(1, A.size) * Math.max(1, B.size));
  return n / denom;
}

/** Confiance effective pour l’apprentissage (renforcement après plusieurs usages). */
export function effectiveLearningConfidence(p: LmnpLearningPatternMatch): number {
  let c = Math.min(Math.max(p.confidence, 0.55), 0.92);
  if (p.usageCount > 3) {
    c += Math.min(0.05 + (p.usageCount - 3) * 0.02, 0.12);
  }
  return Math.min(c, 0.98);
}

function findBestLearningMatch(input: LmnpSuggestionInput): LmnpSuggestionResult | null {
  const patterns = input.learningPatterns || [];
  if (patterns.length === 0) return null;

  const docs = input.linkedDocuments || [];
  const primaryDocType = (docs.map((d) => (d.documentTypeCode || '').toUpperCase()).find((t) => Boolean(t)) || '');
  const txTokens = tokenizeLabel(input.transactionLabel);
  const docBlob = normalize(docs.map((d) => `${d.filename || ''} ${d.ocrText || ''}`).join(' '));
  const docTokens = tokenizeLmnpText(docBlob);

  let best: { p: LmnpLearningPatternMatch; score: number } | null = null;

  for (const p of patterns) {
    const pDoc = (p.documentTypeCode || '').toUpperCase();
    if (primaryDocType && pDoc && primaryDocType !== pDoc) {
      continue;
    }

    let score = 0;
    if (primaryDocType && pDoc && primaryDocType === pDoc) {
      score += 1000;
    }
    if (p.categoryId && input.categoryId && p.categoryId === input.categoryId) {
      score += 120;
    }
    const nat = (input.natureCode || '').toUpperCase();
    if (p.natureCode && nat && p.natureCode.toUpperCase() === nat) {
      score += 90;
    }
    score += overlapScore(p.textTokens, txTokens) * 140;
    score += overlapScore(p.ocrTokens, docTokens) * 110;
    score += overlapScore(p.textTokens, docTokens) * 50;

    if (!best || score > best.score) {
      best = { p, score };
    }
  }

  if (!best) return null;

  const docMatched =
    Boolean(primaryDocType) &&
    Boolean((best.p.documentTypeCode || '').toUpperCase()) &&
    primaryDocType === (best.p.documentTypeCode || '').toUpperCase();

  const minScore = docMatched ? 400 : 88;
  if (best.score < minScore) {
    return null;
  }

  const conf = effectiveLearningConfidence(best.p);
  return {
    suggestedBucket: best.p.lmnpBucket,
    suggestedLabel: best.p.lmnpLabel,
    confidence: conf,
    reason: docMatched
      ? `Apprentissage Smartimmo (type document ${primaryDocType})`
      : 'Apprentissage Smartimmo (profil proche de corrections passées)',
    source: 'learning',
    matchedLearningPatternId: best.p.id,
  };
}

const OCR_EXPLOIT = ['edf', 'electricite', 'engie', 'gaz', 'eau', 'veolia', 'saur', 'orange', 'sfr', 'free', 'internet'];
const OCR_TRAVAUX = ['reparation', 'travaux', 'entretien', 'plomberie', 'serrurerie', 'chaudiere', 'ramonage'];
const OCR_COPRO = ['copropriete', 'syndic', 'appel de fonds', 'appel de charges'];

/**
 * Moteur simple, priorisé, document-aware pour suggestions LMNP.
 * Ordre : learning → document_type → OCR → catégorie → nature → libellé → filename → fallback
 */
export function computeLmnpSuggestion(input: LmnpSuggestionInput): LmnpSuggestionResult {
  const learned = findBestLearningMatch(input);
  if (learned) {
    return learned;
  }

  const docs = input.linkedDocuments || [];
  const nature = (input.natureCode || '').toUpperCase();
  const catSlug = normalize(input.categorySlug);
  const txLabel = normalize(input.transactionLabel);

  const docTypes = docs.map((d) => (d.documentTypeCode || '').toUpperCase());
  const docText = normalize(docs.map((d) => `${d.filename || ''} ${d.ocrText || ''}`).join(' '));

  // 1) Type document
  if (docTypes.includes('TAXE_FONCIERE')) {
    return {
      suggestedBucket: 'CHARGES_FISCALES',
      suggestedLabel: 'Taxe foncière',
      confidence: 0.98,
      reason: 'Basé sur le type de document TAXE_FONCIERE',
      source: 'document_type',
    };
  }
  if (docTypes.includes('TAXE_HABITATION')) {
    return {
      suggestedBucket: 'CHARGES_FISCALES',
      suggestedLabel: "Taxe d'habitation à vérifier",
      confidence: 0.95,
      reason: 'Basé sur le type de document TAXE_HABITATION',
      source: 'document_type',
    };
  }
  if (docTypes.includes('FACTURE_CHARGES')) {
    return {
      suggestedBucket: 'CHARGES_EXPLOITATION',
      suggestedLabel: 'Charges courantes',
      confidence: 0.92,
      reason: 'Basé sur le type de document FACTURE_CHARGES',
      source: 'document_type',
    };
  }
  if (docTypes.includes('FACTURE_TRAVAUX')) {
    return {
      suggestedBucket: 'CHARGES_ENTRETIEN_REPARATION',
      suggestedLabel: 'Entretien et réparations',
      confidence: 0.94,
      reason: 'Basé sur le type de document FACTURE_TRAVAUX',
      source: 'document_type',
    };
  }
  if (docTypes.includes('CONTRAT_ASSURANCE') || docTypes.includes('ATTESTATION_ASSURANCE_PNO') || docTypes.includes('ATTESTATION_ASSURANCE_GLI')) {
    return {
      suggestedBucket: 'CHARGES_ASSURANCE',
      suggestedLabel: 'Assurance',
      confidence: 0.95,
      reason: 'Basé sur le type de document assurance',
      source: 'document_type',
    };
  }
  if (docTypes.includes('CHARGES_COPRO')) {
    return {
      suggestedBucket: 'CHARGES_COPROPRIETE',
      suggestedLabel: 'Charges de copropriété',
      confidence: 0.95,
      reason: 'Basé sur le type de document CHARGES_COPRO',
      source: 'document_type',
    };
  }
  if (docTypes.includes('TABLEAU_AMO')) {
    return {
      suggestedBucket: 'CHARGES_FINANCIERES',
      suggestedLabel: 'Intérêts et assurance emprunteur',
      confidence: 0.98,
      reason: 'Basé sur le type de document TABLEAU_AMO',
      source: 'document_type',
    };
  }

  // 2) OCR / texte extrait / filename
  if (includesAny(docText, ['taxe fonciere'])) {
    return {
      suggestedBucket: 'CHARGES_FISCALES',
      suggestedLabel: 'Taxe foncière',
      confidence: 0.9,
      reason: 'OCR/nom fichier contient taxe foncière',
      source: 'ocr',
    };
  }
  if (includesAny(docText, ['taxe d habitation', "taxe d'habitation"])) {
    return {
      suggestedBucket: 'CHARGES_FISCALES',
      suggestedLabel: "Taxe d'habitation à vérifier",
      confidence: 0.88,
      reason: "OCR/nom fichier contient taxe d'habitation",
      source: 'ocr',
    };
  }
  if (includesAny(docText, OCR_EXPLOIT)) {
    return {
      suggestedBucket: 'CHARGES_EXPLOITATION',
      suggestedLabel: 'Charges courantes',
      confidence: 0.86,
      reason: 'OCR/nom fichier indique énergie/eau/internet',
      source: 'ocr',
    };
  }
  if (includesAny(docText, OCR_TRAVAUX)) {
    return {
      suggestedBucket: 'CHARGES_ENTRETIEN_REPARATION',
      suggestedLabel: 'Entretien et réparations',
      confidence: 0.86,
      reason: 'OCR/nom fichier indique travaux/réparations',
      source: 'ocr',
    };
  }
  if (includesAny(docText, ['assurance', 'pno', 'gli'])) {
    return {
      suggestedBucket: 'CHARGES_ASSURANCE',
      suggestedLabel: 'Assurance',
      confidence: 0.85,
      reason: 'OCR/nom fichier contient assurance/PNO/GLI',
      source: 'ocr',
    };
  }
  if (includesAny(docText, OCR_COPRO)) {
    return {
      suggestedBucket: 'CHARGES_COPROPRIETE',
      suggestedLabel: 'Charges de copropriété',
      confidence: 0.85,
      reason: 'OCR/nom fichier indique copropriété/syndic',
      source: 'ocr',
    };
  }
  if (includesAny(docText, ['interets', 'assurance emprunteur', 'capital restant du', 'tableau d amortissement'])) {
    return {
      suggestedBucket: 'CHARGES_FINANCIERES',
      suggestedLabel: 'Intérêts et assurance emprunteur',
      confidence: 0.9,
      reason: 'OCR/nom fichier indique un prêt/amortissement',
      source: 'ocr',
    };
  }

  // 3) Catégorie
  if (catSlug.includes('gestion')) {
    return {
      suggestedBucket: 'CHARGES_EXPLOITATION',
      suggestedLabel: 'Frais de gestion / plateforme',
      confidence: 0.8,
      reason: 'Basé sur la catégorie de transaction',
      source: 'transaction_category',
    };
  }

  // 4) Nature
  if (nature === 'DEPENSE_LOYER') {
    return {
      suggestedBucket: 'CHARGES_EXPLOITATION',
      suggestedLabel: 'Charges d’exploitation',
      suggestedNatureCode: nature,
      confidence: 0.78,
      reason: 'Basé sur la nature DEPENSE_LOYER',
      source: 'transaction_category',
    };
  }

  // 5) Libellé transaction
  if (includesAny(txLabel, ['airbnb', 'commission', 'service'])) {
    return {
      suggestedBucket: 'CHARGES_EXPLOITATION',
      suggestedLabel: 'Frais de plateforme / exploitation',
      confidence: 0.76,
      reason: 'Basé sur le libellé transaction (airbnb/commission/service)',
      source: 'transaction_label',
    };
  }
  if (includesAny(txLabel, ['taxe fonciere'])) {
    return {
      suggestedBucket: 'CHARGES_FISCALES',
      suggestedLabel: 'Taxe foncière',
      confidence: 0.76,
      reason: 'Basé sur le libellé transaction (taxe foncière)',
      source: 'transaction_label',
    };
  }
  if (includesAny(txLabel, ['assurance'])) {
    return {
      suggestedBucket: 'CHARGES_ASSURANCE',
      suggestedLabel: 'Assurance',
      confidence: 0.74,
      reason: 'Basé sur le libellé transaction (assurance)',
      source: 'transaction_label',
    };
  }

  // 6) Filename only (if OCR absent but filename present)
  const filenames = normalize(docs.map((d) => d.filename || '').join(' '));
  if (includesAny(filenames, OCR_EXPLOIT)) {
    return {
      suggestedBucket: 'CHARGES_EXPLOITATION',
      suggestedLabel: 'Charges courantes',
      confidence: 0.7,
      reason: 'Basé sur le nom du fichier',
      source: 'filename',
    };
  }

  // 7) fallback
  return {
    suggestedBucket: 'A_CLASSER',
    suggestedLabel: 'Non classé LMNP',
    confidence: 0.25,
    reason: 'Aucun signal suffisant (document/type/ocr/catégorie/libellé)',
    source: 'fallback',
  };
}

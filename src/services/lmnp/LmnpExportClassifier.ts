/**
 * Classification LMNP en lecture seule : aucune écriture sur Transaction / Category / Nature.
 */

export type LmnpClassificationResolutionSource =
  | 'override'
  | 'rule_property'
  | 'rule_global'
  | 'fallback';

export interface LmnpClassifierTransactionInput {
  id: string;
  propertyId: string;
  nature: string | null;
  categoryId: string | null;
}

export interface LmnpClassifierRuleInput {
  id: string;
  propertyId: string | null;
  natureCode: string | null;
  categoryId: string | null;
  lmnpBucket: string;
  lmnpLabel: string;
  priority: number;
}

export interface LmnpClassifierOverride {
  lmnpBucket: string;
  lmnpLabel: string;
}

export interface LmnpClassifyResult {
  bucket: string;
  label: string;
  confidence: number;
  resolutionSource: LmnpClassificationResolutionSource;
  matchedRuleId?: string;
}

function ruleMatchesTx(
  rule: LmnpClassifierRuleInput,
  tx: LmnpClassifierTransactionInput
): boolean {
  if (rule.propertyId != null && rule.propertyId !== tx.propertyId) {
    return false;
  }
  if (rule.natureCode != null && rule.natureCode !== tx.nature) {
    return false;
  }
  if (rule.categoryId != null && rule.categoryId !== tx.categoryId) {
    return false;
  }
  return true;
}

function sortRulesForResolution(rules: LmnpClassifierRuleInput[]): LmnpClassifierRuleInput[] {
  return [...rules].sort((a, b) => {
    const aSpec = a.propertyId != null ? 1 : 0;
    const bSpec = b.propertyId != null ? 1 : 0;
    if (bSpec !== aSpec) return bSpec - aSpec;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.id.localeCompare(b.id);
  });
}

export function classifyLmnpTransaction(
  tx: LmnpClassifierTransactionInput,
  overridesByTransactionId: ReadonlyMap<string, LmnpClassifierOverride>,
  rules: readonly LmnpClassifierRuleInput[]
): LmnpClassifyResult {
  const override = overridesByTransactionId.get(tx.id);
  if (override) {
    return {
      bucket: override.lmnpBucket,
      label: override.lmnpLabel,
      confidence: 1,
      resolutionSource: 'override',
    };
  }

  const ordered = sortRulesForResolution([...rules]);
  for (const rule of ordered) {
    if (!ruleMatchesTx(rule, tx)) continue;
    const isPropertyRule = rule.propertyId != null;
    return {
      bucket: rule.lmnpBucket,
      label: rule.lmnpLabel,
      confidence: isPropertyRule ? 0.95 : 0.85,
      resolutionSource: isPropertyRule ? 'rule_property' : 'rule_global',
      matchedRuleId: rule.id,
    };
  }

  return {
    bucket: 'A_CLASSER',
    label: 'Non classé LMNP',
    confidence: 0.25,
    resolutionSource: 'fallback',
  };
}

export function classifyLmnpDocument(
  documentId: string,
  overridesByDocumentId: ReadonlyMap<string, LmnpClassifierOverride>,
  fallbackLabel: string
): LmnpClassifyResult {
  const override = overridesByDocumentId.get(documentId);
  if (override) {
    return {
      bucket: override.lmnpBucket,
      label: override.lmnpLabel,
      confidence: 1,
      resolutionSource: 'override',
    };
  }
  return {
    bucket: 'JUSTIFICATIF',
    label: fallbackLabel || 'Pièce jointe',
    confidence: 0.7,
    resolutionSource: 'fallback',
  };
}

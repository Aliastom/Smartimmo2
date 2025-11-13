/**
 * Intent Router - Détecte l'intention de l'utilisateur et extrait les paramètres
 */

export type IntentMatch = {
  metricId: string;
  time?: string;
  confidence: number;
  propertyId?: string;
  tenantId?: string;
};

/**
 * Définition d'une règle d'intention
 */
type IntentRule = {
  metricId: string;
  re: RegExp;
  priority?: number; // Plus élevé = plus prioritaire
};

/**
 * Catalogue des intentions reconnues
 * Ordre important : les plus spécifiques d'abord
 */
const intents: IntentRule[] = [
  // BAUX - Spécifiques d'abord
  { metricId: "leases.ending.soon.count", re: /(combien|nombre).*(baux?).*(échéance|fin|expire|bientôt)/i, priority: 10 },
  { metricId: "leases.active.count", re: /(combien|nombre).*(baux?).*(actif|actifs|en cours)/i, priority: 9 },
  { metricId: "leases.total.count", re: /(combien|nombre).*(baux?).*(total|tous)?/i, priority: 5 },

  // BIENS
  { metricId: "properties.vacant.count", re: /(combien|nombre).*(biens?|propriétés?).*(vacant|vides?|libres?)/i, priority: 9 },
  { metricId: "properties.rented.count", re: /(combien|nombre).*(biens?|propriétés?).*(loué|louées?|occupé)/i, priority: 9 },
  { metricId: "properties.total.count", re: /(combien|nombre).*(biens?|propriétés?).*(total|tous)?/i, priority: 5 },

  // LOCATAIRES
  { metricId: "tenants.with.activeLease.count", re: /(combien|nombre).*(locataires?).*(bail|actif)/i, priority: 9 },
  { metricId: "tenants.total.count", re: /(combien|nombre).*(locataires?)/i, priority: 5 },

  // REVENUS & CASHFLOW
  { metricId: "rents.received.sum", re: /(combien|total|somme|montant).*(loyers?).*(reçu|encaissé|perçu)/i, priority: 9 },
  { metricId: "income.total.sum", re: /(combien|total|somme|montant).*(revenu|recette)/i, priority: 8 },
  { metricId: "expenses.total.sum", re: /(combien|total|somme|montant).*(dépense|charge|frais|payé)/i, priority: 8 },
  { metricId: "cashflow.net.sum", re: /(cashflow|cash.?flow|solde|bénéfice|résultat)/i, priority: 10 },

  // DOCUMENTS
  { metricId: "documents.ocr.pending.count", re: /(combien|nombre).*(documents?).*(non classés?|à traiter|pending|ocr)/i, priority: 9 },
  { metricId: "documents.total.count", re: /(combien|nombre).*(documents?)/i, priority: 5 },

  // PRÊTS
  { metricId: "loans.total.principal.sum", re: /(combien|total|somme|montant).*(emprunté|capital|prêt)/i, priority: 9 },
  { metricId: "loans.active.count", re: /(combien|nombre).*(prêts?|emprunts?).*(actif|en cours)/i, priority: 8 },
];

/**
 * Extrait les expressions temporelles d'une question
 */
function extractTimeExpression(question: string): string | undefined {
  const lowerQ = question.toLowerCase();

  // Patterns temporels reconnus
  const timePatterns = [
    /aujourd'hui/i,
    /hier/i,
    /(cette\s)?semaine/i,
    /semaine\s(dernière|précédente)/i,
    /(ce\s)?mois/i,
    /mois\s(dernier|précédent)/i,
    /(cette\s)?année/i,
    /année\s(dernière|précédente)/i,
    /ytd/i,
    /(dernier|précédent)\s(trimestre|quarter)/i,
  ];

  for (const pattern of timePatterns) {
    const match = lowerQ.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return undefined;
}

/**
 * Détecte l'intention de l'utilisateur à partir d'une question en langage naturel
 * @param question - Question de l'utilisateur
 * @returns IntentMatch si une intention est détectée, null sinon
 */
export function detectIntent(question: string): IntentMatch | null {
  if (!question || question.trim().length === 0) {
    return null;
  }

  const q = question.toLowerCase().trim();

  // Trier par priorité décroissante
  const sortedIntents = [...intents].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
  );

  // Chercher la première correspondance
  for (const intent of sortedIntents) {
    if (intent.re.test(q)) {
      const time = extractTimeExpression(question);

      return {
        metricId: intent.metricId,
        time,
        confidence: 0.9,
      };
    }
  }

  return null;
}


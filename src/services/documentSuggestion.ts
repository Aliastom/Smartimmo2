// Service de suggestion automatique de types de documents
// Basé sur le nom de fichier, le type MIME et le contexte

export interface SuggestionInput {
  context?: string; // 'property', 'lease', 'tenant', 'loan', 'transaction', 'global'
  filename: string;
  mime: string;
  ocr_excerpt?: string; // Contenu OCR du document (optionnel)
}

export interface SuggestionResult {
  type_code: string;
  confidence: number; // 0.0 à 1.0
  alternatives: Array<{
    type_code: string;
    confidence: number;
    evidence: string;
  }>;
  evidence: string;
}

export interface DocumentType {
  id: string;
  code: string;
  label: string;
  description?: string;
  icon?: string;
  color?: string;
  required?: boolean;
  metadata?: Record<string, any>;
}

// Règles de classification par mots-clés dans le nom de fichier
const FILENAME_PATTERNS = {
  // Quittances et reçus
  'RENT_RECEIPT': {
    patterns: ['quittance', 'receipt', 'loyer', 'rent', 'paiement', 'payment'],
    confidence: 0.9,
    evidence: 'Mot-clé "quittance/loyer" dans le nom de fichier'
  },
  
  // Baux et contrats
  'SIGNED_LEASE': {
    patterns: ['bail', 'lease', 'contrat', 'contract', 'location'],
    confidence: 0.9,
    evidence: 'Mot-clé "bail/contrat" dans le nom de fichier'
  },
  
  // Factures
  'INVOICE': {
    patterns: ['facture', 'invoice', 'bill', 'fact', 'fct'],
    confidence: 0.85,
    evidence: 'Mot-clé "facture" dans le nom de fichier'
  },
  
  // Photos
  'PHOTO': {
    patterns: ['photo', 'image', 'img', 'pic', 'picture'],
    confidence: 0.8,
    evidence: 'Mot-clé "photo/image" dans le nom de fichier'
  },
  
  // Documents d'identité
  'ID_DOCUMENT': {
    patterns: ['id', 'identite', 'identity', 'cni', 'passport', 'passeport'],
    confidence: 0.9,
    evidence: 'Mot-clé "identité/ID" dans le nom de fichier'
  },
  
  // Justificatifs de revenus
  'INCOME_PROOF': {
    patterns: ['salaire', 'salary', 'revenus', 'income', 'bulletin', 'pay', 'fiche'],
    confidence: 0.85,
    evidence: 'Mot-clé "revenus/salaire" dans le nom de fichier'
  },
  
  // Garanties
  'GUARANTEE': {
    patterns: ['garantie', 'guarantee', 'caution', 'depot', 'deposit'],
    confidence: 0.8,
    evidence: 'Mot-clé "garantie/caution" dans le nom de fichier'
  },
  
  // Assurances
  'INSURANCE': {
    patterns: ['assurance', 'insurance', 'assur', 'mutuelle'],
    confidence: 0.8,
    evidence: 'Mot-clé "assurance" dans le nom de fichier'
  },
  
  // Documents comptables
  'ACCOUNTING': {
    patterns: ['compta', 'accounting', 'comptable', 'balance', 'bilan'],
    confidence: 0.8,
    evidence: 'Mot-clé "comptable" dans le nom de fichier'
  },
  
  // Plans et schémas
  'PLAN': {
    patterns: ['plan', 'schema', 'schema', 'blueprint', 'drawing'],
    confidence: 0.7,
    evidence: 'Mot-clé "plan/schéma" dans le nom de fichier'
  },
  
  // Diagnostics
  'DIAGNOSTIC': {
    patterns: ['diagnostic', 'dpe', 'amiante', 'plomb', 'electrique'],
    confidence: 0.9,
    evidence: 'Mot-clé "diagnostic" dans le nom de fichier'
  },
  
  // Travaux
  'WORK_DOCUMENT': {
    patterns: ['travaux', 'work', 'renovation', 'renovation', 'devis', 'quote'],
    confidence: 0.8,
    evidence: 'Mot-clé "travaux/devis" dans le nom de fichier'
  },
  
  // Prêts et financements
  'LOAN_DOCUMENT': {
    patterns: ['pret', 'loan', 'credit', 'financement', 'mortgage'],
    confidence: 0.85,
    evidence: 'Mot-clé "prêt/crédit" dans le nom de fichier'
  },
  
  // Taxes et impôts
  'TAX_DOCUMENT': {
    patterns: ['taxe', 'tax', 'impot', 'fiscal', 'fiscalite'],
    confidence: 0.8,
    evidence: 'Mot-clé "taxe/impôt" dans le nom de fichier'
  }
};

// Règles par type MIME
const MIME_PATTERNS = {
  'application/pdf': {
    'RENT_RECEIPT': 0.3,
    'SIGNED_LEASE': 0.3,
    'INVOICE': 0.3,
    'ID_DOCUMENT': 0.2,
    'INCOME_PROOF': 0.2,
    'GUARANTEE': 0.2,
    'INSURANCE': 0.2,
    'ACCOUNTING': 0.2,
    'DIAGNOSTIC': 0.3,
    'WORK_DOCUMENT': 0.3,
    'LOAN_DOCUMENT': 0.3,
    'TAX_DOCUMENT': 0.2
  },
  'image/jpeg': {
    'PHOTO': 0.8,
    'ID_DOCUMENT': 0.4,
    'INCOME_PROOF': 0.3,
    'WORK_DOCUMENT': 0.3
  },
  'image/png': {
    'PHOTO': 0.8,
    'ID_DOCUMENT': 0.4,
    'INCOME_PROOF': 0.3,
    'WORK_DOCUMENT': 0.3
  },
  'image/jpg': {
    'PHOTO': 0.8,
    'ID_DOCUMENT': 0.4,
    'INCOME_PROOF': 0.3,
    'WORK_DOCUMENT': 0.3
  },
  'application/msword': {
    'SIGNED_LEASE': 0.4,
    'WORK_DOCUMENT': 0.4,
    'ACCOUNTING': 0.3
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    'SIGNED_LEASE': 0.4,
    'WORK_DOCUMENT': 0.4,
    'ACCOUNTING': 0.3
  },
  'application/vnd.ms-excel': {
    'ACCOUNTING': 0.6,
    'INCOME_PROOF': 0.4
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    'ACCOUNTING': 0.6,
    'INCOME_PROOF': 0.4
  }
};

// Règles par contexte
const CONTEXT_PATTERNS = {
  'property': {
    'PLAN': 0.4,
    'DIAGNOSTIC': 0.4,
    'WORK_DOCUMENT': 0.3,
    'PHOTO': 0.3
  },
  'lease': {
    'SIGNED_LEASE': 0.6,
    'RENT_RECEIPT': 0.4,
    'GUARANTEE': 0.3,
    'INSURANCE': 0.3
  },
  'tenant': {
    'ID_DOCUMENT': 0.5,
    'INCOME_PROOF': 0.5,
    'GUARANTEE': 0.4,
    'INSURANCE': 0.3
  },
  'transaction': {
    'RENT_RECEIPT': 0.6,
    'INVOICE': 0.4,
    'ACCOUNTING': 0.3
  },
  'loan': {
    'LOAN_DOCUMENT': 0.7,
    'INCOME_PROOF': 0.3,
    'GUARANTEE': 0.3
  }
};

export function suggestTypeGlobal(input: SuggestionInput, documentTypes: DocumentType[]): SuggestionResult {
  const filename_lower = input.filename.toLowerCase();
  const suggestions: Record<string, number> = {};
  const alternatives: Array<{ type_code: string; confidence: number; evidence: string }> = [];
  
  // 1. Analyse par nom de fichier
  for (const [type_code, rule] of Object.entries(FILENAME_PATTERNS)) {
    const hasPattern = rule.patterns.some(pattern => filename_lower.includes(pattern));
    if (hasPattern) {
      suggestions[type_code] = (suggestions[type_code] || 0) + rule.confidence;
      alternatives.push({
        type_code,
        confidence: rule.confidence,
        evidence: rule.evidence
      });
    }
  }
  
  // 2. Analyse par type MIME
  if (input.mime && MIME_PATTERNS[input.mime]) {
    for (const [type_code, confidence] of Object.entries(MIME_PATTERNS[input.mime])) {
      suggestions[type_code] = (suggestions[type_code] || 0) + confidence;
    }
  }
  
  // 3. Analyse par contexte
  if (input.context && CONTEXT_PATTERNS[input.context]) {
    for (const [type_code, confidence] of Object.entries(CONTEXT_PATTERNS[input.context])) {
      suggestions[type_code] = (suggestions[type_code] || 0) + confidence;
    }
  }
  
  // 4. Analyse OCR si disponible
  if (input.ocr_excerpt) {
    const ocr_lower = input.ocr_excerpt.toLowerCase();
    
    // Recherche de mots-clés spécifiques dans le contenu OCR
    if (ocr_lower.includes('quittance') || ocr_lower.includes('loyer')) {
      suggestions['RENT_RECEIPT'] = (suggestions['RENT_RECEIPT'] || 0) + 0.7;
    }
    if (ocr_lower.includes('bail') || ocr_lower.includes('location')) {
      suggestions['SIGNED_LEASE'] = (suggestions['SIGNED_LEASE'] || 0) + 0.7;
    }
    if (ocr_lower.includes('facture') || ocr_lower.includes('total')) {
      suggestions['INVOICE'] = (suggestions['INVOICE'] || 0) + 0.6;
    }
  }
  
  // 5. Normaliser les scores (max 1.0)
  for (const type_code in suggestions) {
    suggestions[type_code] = Math.min(suggestions[type_code], 1.0);
  }
  
  // 6. Trier par confiance et retourner le meilleur résultat
  const sortedSuggestions = Object.entries(suggestions)
    .sort(([,a], [,b]) => b - a);
  
  if (sortedSuggestions.length === 0) {
    return {
      type_code: 'OTHER',
      confidence: 0.1,
      alternatives: [],
      evidence: 'Aucun pattern reconnu'
    };
  }
  
  const [bestType, bestConfidence] = sortedSuggestions[0];
  
  // Construire la liste des alternatives
  const sortedAlternatives = alternatives
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3); // Top 3 alternatives
  
  return {
    type_code: bestType,
    confidence: bestConfidence,
    alternatives: sortedAlternatives,
    evidence: `Confiance: ${Math.round(bestConfidence * 100)}% basée sur l'analyse du fichier "${input.filename}"`
  };
}

// Fonction utilitaire pour obtenir le type de document par code
export function getDocumentTypeByCode(code: string, documentTypes: DocumentType[]): DocumentType | undefined {
  return documentTypes.find(dt => dt.code === code);
}

// Fonction pour obtenir tous les types de documents suggérés avec leur confiance
export function getAllSuggestions(input: SuggestionInput, documentTypes: DocumentType[]): Array<{
  documentType: DocumentType;
  confidence: number;
  evidence: string;
}> {
  const result = suggestTypeGlobal(input, documentTypes);
  const suggestions: Array<{ documentType: DocumentType; confidence: number; evidence: string }> = [];
  
  // Ajouter la suggestion principale
  const mainType = getDocumentTypeByCode(result.type_code, documentTypes);
  if (mainType) {
    suggestions.push({
      documentType: mainType,
      confidence: result.confidence,
      evidence: result.evidence
    });
  }
  
  // Ajouter les alternatives
  for (const alt of result.alternatives) {
    const altType = getDocumentTypeByCode(alt.type_code, documentTypes);
    if (altType && altType.code !== result.type_code) {
      suggestions.push({
        documentType: altType,
        confidence: alt.confidence,
        evidence: alt.evidence
      });
    }
  }
  
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}
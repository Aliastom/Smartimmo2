/**
 * Safe Input - Validation et nettoyage des inputs utilisateur
 * Prévention d'injections, limites de taille, détection PII basique
 */

// Limites
const MAX_QUERY_LENGTH = 500;
const MAX_CONTEXT_LENGTH = 10000;

/**
 * Résultat de la validation
 */
export interface ValidationResult {
  isValid: boolean;
  sanitized: string;
  errors: string[];
}

/**
 * Nettoie et valide une requête utilisateur
 * @param input L'input brut
 * @returns Résultat de validation
 */
export function sanitizeQuery(input: string): ValidationResult {
  const errors: string[] = [];

  // 1. Vérifier que l'input existe
  if (!input || typeof input !== 'string') {
    return {
      isValid: false,
      sanitized: '',
      errors: ['La requête est vide ou invalide'],
    };
  }

  // 2. Trim et normaliser
  let sanitized = input.trim();

  // 3. Vérifier la longueur
  if (sanitized.length === 0) {
    return {
      isValid: false,
      sanitized: '',
      errors: ['La requête est vide'],
    };
  }

  if (sanitized.length > MAX_QUERY_LENGTH) {
    errors.push(
      `La requête est trop longue (max ${MAX_QUERY_LENGTH} caractères)`
    );
    sanitized = sanitized.substring(0, MAX_QUERY_LENGTH);
  }

  // 4. Strip HTML/scripts basique
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<[^>]+>/g, '');

  // 5. Normaliser les espaces multiples
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  // 6. Détection PII basique (optionnel pour MVP)
  // Pour l'instant, on se contente de détecter des patterns évidents
  const hasPotentialPII = detectPII(sanitized);
  if (hasPotentialPII.detected) {
    // Pour MVP, on log seulement (pas de blocage)
    console.warn('[SafeInput] PII potentielle détectée:', hasPotentialPII.types);
  }

  return {
    isValid: errors.length === 0,
    sanitized,
    errors,
  };
}

/**
 * Valide un contexte fourni par l'utilisateur
 * @param context Array de contextes
 * @returns Résultat de validation
 */
export function validateContext(
  context: Array<{ text: string }>
): ValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(context)) {
    return {
      isValid: false,
      sanitized: '',
      errors: ['Le contexte doit être un tableau'],
    };
  }

  // Vérifier la longueur totale
  const totalLength = context.reduce((sum, c) => sum + (c.text?.length || 0), 0);
  if (totalLength > MAX_CONTEXT_LENGTH) {
    errors.push(
      `Le contexte est trop long (max ${MAX_CONTEXT_LENGTH} caractères)`
    );
  }

  // Nettoyer chaque élément
  const sanitizedContext = context
    .filter((c) => c && typeof c.text === 'string')
    .map((c) => ({
      text: c.text.trim().substring(0, 5000), // Limite par chunk
    }));

  return {
    isValid: errors.length === 0,
    sanitized: JSON.stringify(sanitizedContext),
    errors,
  };
}

/**
 * Détection basique de PII (Personal Identifiable Information)
 * Pour MVP : patterns simples (email, téléphone, numéro sécu)
 */
function detectPII(text: string): { detected: boolean; types: string[] } {
  const types: string[] = [];

  // Email
  if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(text)) {
    types.push('email');
  }

  // Téléphone FR (basique)
  if (/\b0[1-9](?:\s?\d{2}){4}\b/.test(text)) {
    types.push('phone');
  }

  // Numéro sécu (pattern très basique)
  if (/\b[12]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2}\b/.test(text)) {
    types.push('ssn');
  }

  return {
    detected: types.length > 0,
    types,
  };
}

/**
 * Masque les informations sensibles dans un texte (pour logs)
 * @param text Texte à masquer
 * @returns Texte masqué
 */
export function maskSensitiveData(text: string): string {
  let masked = text;

  // Masquer emails
  masked = masked.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    '***@***.***'
  );

  // Masquer téléphones
  masked = masked.replace(/\b0[1-9](?:\s?\d{2}){4}\b/g, '0X XX XX XX XX');

  return masked;
}


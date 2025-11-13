import { DocumentSuggestionConfig, DocumentMetadataSchema } from '@/types/document';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Instance Ajv pour la validation JSON Schema
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

/**
 * Valide une regex et retourne un objet avec isValid et message
 */
export function validateRegex(pattern: string): { isValid: boolean; message?: string } {
  try {
    new RegExp(pattern);
    return { isValid: true };
  } catch (error) {
    return { 
      isValid: false, 
      message: `Regex invalide: ${error instanceof Error ? error.message : 'Erreur inconnue'}` 
    };
  }
}

/**
 * Valide un contexte d'application
 */
export function validateContext(context: string): boolean {
  const validContexts = ['transaction', 'lease', 'property', 'tenant', 'loan', 'global'];
  return validContexts.includes(context);
}

/**
 * Valide un type MIME
 */
export function validateMimeType(mime: string): boolean {
  // Pattern simple pour valider les types MIME
  const mimePattern = /^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*(\*)?$/;
  return mimePattern.test(mime);
}

/**
 * Valide une configuration de suggestion
 */
export function validateSuggestionConfig(config: DocumentSuggestionConfig): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Valider les règles
  if (config.DocumentExtractionRule) {
    config.DocumentExtractionRule.forEach((rule, index) => {
      // Valider le pattern regex
      const regexValidation = validateRegex(rule.pattern);
      if (!regexValidation.isValid) {
        errors.push(`Règle ${index + 1}: ${regexValidation.message}`);
      }

      // Valider les contextes d'application
      if (rule.apply_in && rule.apply_in.length > 0) {
        const invalidContexts = rule.apply_in.filter(ctx => !validateContext(ctx));
        if (invalidContexts.length > 0) {
          errors.push(`Règle ${index + 1}: Contextes invalides: ${invalidContexts.join(', ')}`);
        }
      } else {
        errors.push(`Règle ${index + 1}: Au moins un contexte d'application est requis`);
      }

      // Valider le poids
      if (rule.weight < 0 || rule.weight > 10) {
        errors.push(`Règle ${index + 1}: Le poids doit être entre 0 et 10`);
      }

      // Valider le type de code
      if (!rule.type_code || rule.type_code.trim() === '') {
        errors.push(`Règle ${index + 1}: Le code de type est requis`);
      }

      // Valider les types MIME
      if (rule.mime_in && rule.mime_in.length > 0) {
        const invalidMimes = rule.mime_in.filter(mime => !validateMimeType(mime));
        if (invalidMimes.length > 0) {
          warnings.push(`Règle ${index + 1}: Types MIME potentiellement invalides: ${invalidMimes.join(', ')}`);
        }
      }

      // Avertissement si pas de mots-clés OCR ni de MIME
      if (!rule.ocr_keywords && !rule.mime_in) {
        warnings.push(`Règle ${index + 1}: Aucun filtre OCR ou MIME défini, la règle s'appliquera à tous les fichiers`);
      }
    });
  }

  // Valider les overrides MIME
  if (config.mime_overrides) {
    Object.entries(config.mime_overrides).forEach(([mime, typeCode]) => {
      if (!validateMimeType(mime)) {
        errors.push(`Override MIME invalide: ${mime}`);
      }
      if (!typeCode || typeCode.trim() === '') {
        errors.push(`Override MIME sans type: ${mime}`);
      }
    });
  }

  // Valider les contextes par défaut
  if (config.defaults_by_context) {
    Object.entries(config.defaults_by_context).forEach(([context, typeCode]) => {
      if (!validateContext(context)) {
        errors.push(`Contexte par défaut invalide: ${context}`);
      }
      if (!typeCode || typeCode.trim() === '') {
        errors.push(`Type par défaut vide pour le contexte: ${context}`);
      }
    });
  }

  // Valider les paramètres de post-processing
  if (config.postprocess) {
    const { min_confidence_for_autoselect, ask_top3_below } = config.postprocess;
    
    if (min_confidence_for_autoselect !== undefined) {
      if (min_confidence_for_autoselect < 0 || min_confidence_for_autoselect > 1) {
        errors.push('min_confidence_for_autoselect doit être entre 0 et 1');
      }
    }
    
    if (ask_top3_below !== undefined) {
      if (ask_top3_below < 0 || ask_top3_below > 1) {
        errors.push('ask_top3_below doit être entre 0 et 1');
      }
    }

    // Vérifier la cohérence des seuils
    if (min_confidence_for_autoselect !== undefined && ask_top3_below !== undefined) {
      if (min_confidence_for_autoselect < ask_top3_below) {
        warnings.push('min_confidence_for_autoselect devrait être supérieur à ask_top3_below');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Valide un schéma de métadonnées JSON
 */
export function validateMetadataSchema(schema: DocumentMetadataSchema): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Valider que c'est bien un objet
  if (schema.type !== 'object') {
    errors.push('Le type de schéma doit être "object"');
    return { isValid: false, errors, warnings };
  }

  // Valider les propriétés
  if (!schema.Property || typeof schema.Property !== 'object') {
    errors.push('Les propriétés du schéma sont requises');
    return { isValid: false, errors, warnings };
  }

  Object.entries(schema.Property).forEach(([fieldName, fieldSchema]) => {
    // Valider le nom du champ
    if (!fieldName || fieldName.trim() === '') {
      errors.push('Nom de champ vide');
      return;
    }

    // Valider le schéma du champ
    if (!fieldSchema.type) {
      errors.push(`Champ "${fieldName}": type requis`);
    }

    if (!fieldSchema.title) {
      errors.push(`Champ "${fieldName}": titre requis`);
    }

    // Valider les types supportés
    const supportedTypes = ['string', 'number', 'boolean', 'array', 'object'];
    if (fieldSchema.type && !supportedTypes.includes(fieldSchema.type)) {
      errors.push(`Champ "${fieldName}": type non supporté "${fieldSchema.type}"`);
    }

    // Valider les énumérations
    if (fieldSchema.enum && !Array.isArray(fieldSchema.enum)) {
      errors.push(`Champ "${fieldName}": enum doit être un tableau`);
    }

    // Avertissement pour les champs obligatoires sans description
    if (schema.required?.includes(fieldName) && !fieldSchema.description) {
      warnings.push(`Champ obligatoire "${fieldName}" sans description`);
    }
  });

  // Valider les champs requis
  if (schema.required) {
    if (!Array.isArray(schema.required)) {
      errors.push('Les champs requis doivent être un tableau');
    } else {
      schema.required.forEach(requiredField => {
        if (!schema.Property[requiredField]) {
          errors.push(`Champ requis "${requiredField}" non défini dans les propriétés`);
        }
      });
    }
  }

  // Tester la compilation du schéma avec Ajv
  try {
    const validate = ajv.compile(schema);
    if (!validate) {
      errors.push('Schéma JSON invalide selon JSON Schema Draft 7');
    }
  } catch (error) {
    errors.push(`Erreur de compilation du schéma: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Valide un flux de verrou
 */
export function validateLockFlow(flow: string): boolean {
  // Les flux valides doivent être en snake_case et contenir au moins un caractère
  const flowPattern = /^[a-z][a-z0-9_]*$/;
  return flowPattern.test(flow);
}

/**
 * Valide une liste de flux de verrous
 */
export function validateLockFlows(flows: string[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!Array.isArray(flows)) {
    errors.push('Les flux de verrous doivent être un tableau');
    return { isValid: false, errors };
  }

  flows.forEach((flow, index) => {
    if (!validateLockFlow(flow)) {
      errors.push(`Flux ${index + 1} invalide: "${flow}" (doit être en snake_case)`);
    }
  });

  // Vérifier les doublons
  const uniqueFlows = new Set(flows);
  if (uniqueFlows.size !== flows.length) {
    errors.push('Flux de verrous dupliqués détectés');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Valide les contextes par défaut
 */
export function validateDefaultContexts(contexts: string[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const validContexts = ['transaction', 'lease', 'property', 'tenant', 'loan', 'global'];

  if (!Array.isArray(contexts)) {
    errors.push('Les contextes par défaut doivent être un tableau');
    return { isValid: false, errors };
  }

  contexts.forEach((context, index) => {
    if (!validContexts.includes(context)) {
      errors.push(`Contexte ${index + 1} invalide: "${context}"`);
    }
  });

  // Vérifier les doublons
  const uniqueContexts = new Set(contexts);
  if (uniqueContexts.size !== contexts.length) {
    errors.push('Contextes dupliqués détectés');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Valide un type de document complet
 */
export function validateDocumentType(data: {
  code?: string;
  label?: string;
  suggestionConfig?: DocumentSuggestionConfig;
  lockInFlows?: string[];
  defaultContexts?: string[];
  metadataSchema?: DocumentMetadataSchema;
}): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Valider le code
  if (data.code !== undefined) {
    if (!data.code || data.code.trim() === '') {
      errors.push('Le code est requis');
    } else if (!/^[A-Z_]+$/.test(data.code)) {
      errors.push('Le code doit être en UPPER_SNAKE_CASE');
    }
  }

  // Valider le libellé
  if (data.label !== undefined) {
    if (!data.label || data.label.trim() === '') {
      errors.push('Le libellé est requis');
    }
  }

  // Valider la configuration de suggestion
  if (data.suggestionConfig) {
    const suggestionValidation = validateSuggestionConfig(data.suggestionConfig);
    errors.push(...suggestionValidation.errors);
    warnings.push(...suggestionValidation.warnings);
  }

  // Valider les flux de verrous
  if (data.lockInFlows) {
    const lockValidation = validateLockFlows(data.lockInFlows);
    errors.push(...lockValidation.errors);
  }

  // Valider les contextes par défaut
  if (data.defaultContexts) {
    const contextValidation = validateDefaultContexts(data.defaultContexts);
    errors.push(...contextValidation.errors);
  }

  // Valider le schéma de métadonnées
  if (data.metadataSchema) {
    const schemaValidation = validateMetadataSchema(data.metadataSchema);
    errors.push(...schemaValidation.errors);
    warnings.push(...schemaValidation.warnings);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

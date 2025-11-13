import { useState, useEffect } from 'react';

interface UseJsonFieldOptions {
  initial?: string;
  validateOnChange?: boolean;
}

export function useJsonField({ initial = '', validateOnChange = true }: UseJsonFieldOptions = {}) {
  const [raw, setRaw] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<any>(null);

  const validate = (s: string) => {
    try {
      const trimmed = s.trim();
      if (!trimmed) {
        setParsed(null);
        setError(null);
        return;
      }
      
      const parsedValue = JSON.parse(trimmed);
      setParsed(parsedValue);
      setError(null);
    } catch (e: any) {
      setParsed(null);
      setError(e.message);
    }
  };

  useEffect(() => {
    if (validateOnChange) {
      validate(raw);
    }
  }, [raw, validateOnChange]);

  const format = () => {
    if (!error && parsed != null) {
      setRaw(JSON.stringify(parsed, null, 2));
    }
  };

  const setExample = (example: any) => {
    setRaw(JSON.stringify(example, null, 2));
  };

  const setRawValue = (value: string) => {
    setRaw(value);
  };

  const clearError = () => {
    setError(null);
  };

  return {
    raw,
    setRaw: setRawValue,
    error,
    parsed,
    isValid: !error && raw.trim() !== '',
    format,
    setExample,
    clearError,
    validate: () => validate(raw)
  };
}

// Exemples JSON pour les différents champs
export const JSON_EXAMPLES = {
  defaultContexts: [
    "Contrat régi par la loi 89-462",
    "Signature des parties"
  ],
  suggestionsConfig: {
    minConfidenceToSuggest: 0.6,
    showTopK: 3
  },
  flowLocks: [
    { rule: "noAutoAssign" }
  ],
  metaSchema: {
    fields: {
      start_period: {
        type: "date",
        required: true
      }
    }
  }
};
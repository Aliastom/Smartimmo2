/**
 * Sérialisation exploitable des erreurs Storage / Supabase (évite "{}" ou [object Object]).
 */

function pickDefined(parts: Array<string | number | undefined | null>): string {
  return parts
    .filter((x) => x !== undefined && x !== null && String(x).trim() !== '')
    .map(String)
    .join(' — ');
}

/**
 * Extrait un message lisible depuis une erreur inconnue (Supabase StorageApiError, Error, objet plain).
 */
export function formatStorageError(error: unknown): string {
  if (error == null) return 'erreur_null';
  if (typeof error === 'string') return error;
  if (typeof error === 'number' || typeof error === 'boolean') return String(error);

  if (error instanceof Error) {
    const any = error as Error & {
      statusCode?: string | number;
      status?: string | number;
      details?: string;
      error?: string;
      cause?: unknown;
      code?: string;
    };
    const causeStr =
      any.cause instanceof Error
        ? `${any.cause.name}: ${any.cause.message}`
        : any.cause != null
          ? formatStorageError(any.cause)
          : '';

    const main = pickDefined([
      any.name !== 'Error' ? any.name : undefined,
      any.message,
      any.code,
      any.statusCode != null ? `statusCode=${any.statusCode}` : undefined,
      any.status != null ? `status=${any.status}` : undefined,
      any.details,
      any.error,
      causeStr || undefined,
    ]);

    if (main) return main;
    try {
      const extra = JSON.stringify(error, Object.getOwnPropertyNames(error));
      if (extra && extra !== '{}') return extra;
    } catch {
      /* ignore */
    }
    return error.stack?.slice(0, 800) || 'Error sans message';
  }

  try {
    const plain = error as Record<string, unknown>;
    const serialized = JSON.stringify(
      plain,
      (_k, v) => (typeof v === 'bigint' ? String(v) : v),
    );
    if (serialized && serialized !== '{}') return serialized;
  } catch {
    /* ignore */
  }

  try {
    return JSON.stringify(error, Object.getOwnPropertyNames(Object(error)));
  } catch {
    return String(error);
  }
}

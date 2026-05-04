/**
 * Clés candidates pour télécharger une PJ LMNP côté serveur (Supabase / local).
 * L’ordre privilégie la normalisation métier, puis la clé brute DB, puis variantes documents/<id>/filename.
 */

export function buildLmnpDocumentStorageKeyCandidates(input: {
  bucketKey: string;
  documentId: string;
  filenameOriginal?: string | null;
  fileName?: string | null;
  normalizeBucketKey: (bucketKey: string, documentId?: string, filename?: string) => string;
  generateStorageKey: (documentId: string, filename: string) => string;
}): string[] {
  const fn = (input.filenameOriginal || input.fileName || 'document.bin').trim();
  const out: string[] = [];

  out.push(input.normalizeBucketKey(input.bucketKey, input.documentId, input.filenameOriginal || input.fileName || undefined));
  out.push(input.bucketKey);

  out.push(input.generateStorageKey(input.documentId, fn));

  const sanitizedAlt = fn.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (sanitizedAlt !== fn) {
    out.push(input.generateStorageKey(input.documentId, sanitizedAlt));
  }

  out.push(`documents/${input.documentId}/${fn}`);
  out.push(`documents/${input.documentId}/${sanitizedAlt}`);

  return [...new Set(out.filter((k) => typeof k === 'string' && k.trim().length > 0))];
}

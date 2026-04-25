type BuildZipNameInput = {
  accountingMonth?: string | null;
  transactionDate?: Date | null;
  exerciseYear?: number | null;
  transactionAmount?: number | null;
  propertyName: string;
  documentTypeLabel?: string | null;
  originalFilename: string;
};

function asciiSlug(input: string): string {
  const stripped = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return stripped || 'document';
}

function toTitleToken(input: string): string {
  const words = asciiSlug(input)
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean);
  const compact = words
    .map((w) => `${w.charAt(0).toUpperCase()}${w.slice(1).toLowerCase()}`)
    .join('');
  return compact || 'Justificatif';
}

function shortDocumentType(label?: string | null, originalFilename?: string): string {
  const base = `${label || ''} ${originalFilename || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (/taxe.*foncier|foncier/.test(base)) return 'TaxeFonciere';
  if (/taxe.*habitation|habitation/.test(base)) return 'TaxeHabitation';
  if (/loyer|quittance/.test(base)) return 'Loyer';
  if (/(commission|frais).{0,20}gestion/.test(base)) return 'FraisGestion';
  if (/assurance|pno|gli/.test(base)) return 'Assurance';
  if (/entretien|reparation|travaux/.test(base)) return 'Travaux';
  if (/copro|syndic|charge/.test(base)) return 'Charges';
  if (/amort|emprunt|interet|pret/.test(base)) return 'Interets';
  return toTitleToken((label || 'Justificatif').replace(/\b(avis|facture|de|du|des|d)\b/gi, ' ').slice(0, 36));
}

function shortCity(propertyName: string): string {
  const normalized = asciiSlug(propertyName).replace(/_/g, ' ').trim();
  if (!normalized) return 'Bien';
  const token = normalized.split(' ')[0] || 'Bien';
  return toTitleToken(token).slice(0, 24);
}

function compactSuffix(originalFilename: string, docTypeShort: string): string {
  const parts = splitExt(originalFilename || 'document.pdf');
  const normalized = parts.base
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(avis|facture|de|du|des|d|document|piece|pj)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return '';
  const typeTokens = docTypeShort.toLowerCase();
  const reduced = normalized
    .split(' ')
    .filter((t) => t.length >= 3 && !typeTokens.includes(t))
    .slice(0, 2)
    .join(' ');
  if (!reduced) return '';
  return toTitleToken(reduced).slice(0, 24);
}

function splitExt(name: string): { base: string; ext: string } {
  const i = name.lastIndexOf('.');
  if (i <= 0) return { base: name, ext: 'bin' };
  return { base: name.slice(0, i), ext: name.slice(i + 1) };
}

export function buildLmnpZipDocumentName(input: BuildZipNameInput): string {
  const month =
    input.accountingMonth && /^\d{4}-\d{2}$/.test(input.accountingMonth)
      ? input.accountingMonth
      : input.transactionDate
      ? `${input.transactionDate.getUTCFullYear()}-${String(input.transactionDate.getUTCMonth() + 1).padStart(2, '0')}`
      : null;
  const yearToken =
    month?.slice(0, 4) ||
    (typeof input.exerciseYear === 'number' && Number.isFinite(input.exerciseYear) ? String(input.exerciseYear) : null) ||
    (input.transactionDate ? String(input.transactionDate.getUTCFullYear()) : '0000');

  const docType = shortDocumentType(input.documentTypeLabel, input.originalFilename);
  const amount = input.transactionAmount != null ? `${Math.round(Math.abs(input.transactionAmount))}€` : null;
  const city = shortCity(input.propertyName || 'Bien');
  const suffix = compactSuffix(input.originalFilename || 'document.pdf', docType);
  const ext = asciiSlug(splitExt(input.originalFilename || 'document.pdf').ext || 'pdf').toLowerCase();
  const parts = [month || yearToken, docType];
  if (amount && month) parts.push(amount);
  parts.push(city);
  if (suffix && parts.length < 5) parts.push(suffix);
  return `${parts.join('_')}.${ext}`;
}

export function ensureUniqueZipName(name: string, usedNames: Set<string>): string {
  if (!usedNames.has(name)) {
    usedNames.add(name);
    return name;
  }
  const parts = splitExt(name);
  let idx = 2;
  while (true) {
    const candidate = `${parts.base}_${idx}.${parts.ext}`;
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
    idx += 1;
  }
}


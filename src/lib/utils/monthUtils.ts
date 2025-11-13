/** Convertit 'YYYY-MM' + delta mois → 'YYYY-MM' */
export function addMonthsYYYYMM(yyyymm: string, delta: number): string {
  const [Y, M] = yyyymm.split('-').map(Number);
  const d = new Date(Date.UTC(Y, M - 1, 1));
  d.setUTCMonth(d.getUTCMonth() + delta);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Formate le libellé par mois (pure function) */
const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

export function formatMonthlyLabel(baseLabel: string, yyyymm: string, suffix?: string) {
  const [Y, M] = yyyymm.split('-').map(Number);
  const moisNom = MOIS[M - 1];
  const titre = `${baseLabel} – ${moisNom.charAt(0).toUpperCase()}${moisNom.slice(1)} ${Y}`;
  return suffix ? `${titre} - ${suffix}` : titre;
}

/** Extrait le baseLabel d'un libellé existant (retire les mois/années) */
export function extractBaseLabel(fullLabel: string): string {
  if (!fullLabel) return fullLabel;
  
  // Pattern pour retirer les parties de date/mois (flexible pour différents formats)
  // Exemples à retirer : "- Avril 2025", "– Mars 2025", "Janvier 2025"
  const patterns = [
    / ?–? ?(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) ?\d{4}/gi,
    / ?-? ?(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) ?\d{4}/gi,
    / ?\d{4}-\d{2}/g  // Format YYYY-MM
  ];
  
  let cleaned = fullLabel;
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // Nettoyer les espaces/tirets multiples et trailing
  cleaned = cleaned
    .replace(/\s*-\s*-\s*/g, ' - ')  // Double tirets
    .replace(/\s*–\s*–\s*/g, ' – ')  // Double tirets longs
    .replace(/\s+/g, ' ')             // Espaces multiples
    .replace(/\s*-\s*$/, '')          // Tiret trailing
    .replace(/\s*–\s*$/, '')          // Tiret long trailing
    .trim();
  
  return cleaned;
}

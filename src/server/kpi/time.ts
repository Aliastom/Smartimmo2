/**
 * Time Range Parser - Convertit une expression temporelle naturelle en bornes [from, to]
 */

export type TimeRange = { from: string; to: string };

const asDate = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Résout une expression temporelle en français vers des bornes de date
 * @param natural - Expression naturelle ("ce mois", "cette année", "aujourd'hui", etc.)
 * @returns TimeRange avec from/to au format YYYY-MM-DD
 */
export function resolveTime(natural?: string): TimeRange {
  const now = new Date();
  let start = new Date(now.getFullYear(), now.getMonth(), 1);
  let end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  if (!natural) {
    // Par défaut : mois courant
    return { from: asDate(start), to: asDate(end) };
  }

  const txt = natural.toLowerCase().trim();

  // Aujourd'hui
  if (/aujourd'hui|today/i.test(txt)) {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(start);
    end.setDate(end.getDate() + 1);
  }
  // Hier
  else if (/hier|yesterday/i.test(txt)) {
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start = new Date(end);
    start.setDate(start.getDate() - 1);
  }
  // Cette semaine
  else if (/(cette\s)?semaine|week/i.test(txt) && !/dernier|précédent|last/i.test(txt)) {
    const day = now.getDay() || 7; // 0=dimanche → 7
    start = new Date(now);
    start.setDate(now.getDate() - day + 1);
    end = new Date(start);
    end.setDate(start.getDate() + 7);
  }
  // Semaine dernière
  else if (/(semaine|week).*(dernier|précédent|last)/i.test(txt)) {
    const day = now.getDay() || 7;
    end = new Date(now);
    end.setDate(now.getDate() - day + 1);
    start = new Date(end);
    start.setDate(end.getDate() - 7);
  }
  // Ce mois (déjà calculé par défaut)
  else if (/(ce\s)?(mois|month)|courant|current/i.test(txt) && !/dernier|précédent|last/i.test(txt)) {
    // Déjà configuré
  }
  // Mois dernier
  else if (/(mois|month).*(dernier|précédent|last)/i.test(txt)) {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  // Cette année / Year to date
  else if (/(cette\s)?(année|year)|ytd/i.test(txt) && !/dernier|précédent|last/i.test(txt)) {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear() + 1, 0, 1);
  }
  // Année dernière
  else if (/(année|year).*(dernier|précédent|last)/i.test(txt)) {
    start = new Date(now.getFullYear() - 1, 0, 1);
    end = new Date(now.getFullYear(), 0, 1);
  }
  // Dernier trimestre
  else if (/(dernier|précédent|last).*(trimestre|quarter)/i.test(txt)) {
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
    const year = currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
    start = new Date(year, lastQuarter * 3, 1);
    end = new Date(year, (lastQuarter + 1) * 3, 1);
  }

  return { from: asDate(start), to: asDate(end) };
}


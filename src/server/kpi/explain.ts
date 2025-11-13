/**
 * Explain - Formate une valeur KPI en langage naturel
 */

/**
 * Formate une valeur de KPI en texte naturel avec unité
 * @param label - Label du KPI
 * @param value - Valeur numérique
 * @param format - Format d'affichage (€, %, count, days)
 * @returns Texte formaté pour l'utilisateur
 */
export function explain(label: string, value: number, format?: string): string {
  let formattedValue: string;

  switch (format) {
    case "€":
      formattedValue = `${value.toLocaleString("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} €`;
      break;

    case "%":
      formattedValue = `${value.toLocaleString("fr-FR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })} %`;
      break;

    case "days":
      formattedValue = `${Math.round(value)} jour${value > 1 ? "s" : ""}`;
      break;

    case "count":
    default:
      formattedValue = value.toLocaleString("fr-FR");
      break;
  }

  return `📊 **${label}** : ${formattedValue}`;
}


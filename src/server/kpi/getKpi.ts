/**
 * GetKPI - Point d'entrée principal pour récupérer une métrique
 */

import { KPI_REGISTRY } from "./registry";
import { runScalar } from "./query";
import { resolveTime } from "./time";

export type GetKpiParams = {
  metricId: string;
  userId?: string; // Optionnel pour ce MVP (pas de multi-tenant dans le schéma)
  time?: string; // Expression naturelle ("ce mois", "cette année", etc.)
  propertyId?: string;
  tenantId?: string;
};

export type KpiResult = {
  id: string;
  label: string;
  value: number;
  type: string;
  format?: string;
  matched: boolean;
  timeRange?: { from: string; to: string };
};

/**
 * Récupère la valeur d'un KPI avec ses paramètres
 * @param params - Paramètres du KPI (metricId, userId, time, etc.)
 * @returns Le résultat du KPI avec métadonnées
 */
export async function getKpi(params: GetKpiParams): Promise<KpiResult> {
  const { metricId, userId, time, propertyId, tenantId } = params;

  // Vérifier que le KPI existe
  const metric = KPI_REGISTRY[metricId];
  if (!metric) {
    throw new Error(`KPI inconnu: ${metricId}`);
  }

  // Construire les arguments SQL
  const args: any[] = [];
  let timeRange: { from: string; to: string } | undefined;

  // Si le KPI supporte la période temporelle
  if (metric.supportsTime) {
    timeRange = resolveTime(time);
    args.push(timeRange.from, timeRange.to);
  }

  // Si le KPI supporte le filtrage par bien
  if (metric.supportsProperty && propertyId) {
    args.push(propertyId);
  }

  // Si le KPI supporte le filtrage par locataire
  if (metric.supportsTenant && tenantId) {
    args.push(tenantId);
  }

  // Exécuter la requête
  const startTime = Date.now();
  const value = await runScalar(metric.sql, args);
  const duration = Date.now() - startTime;

  // Log compact
  console.log(
    `[KPI][${metricId}] SQL(${duration}ms) value=${value}${
      timeRange ? ` period=${timeRange.from}→${timeRange.to}` : ""
    }`
  );

  return {
    id: metricId,
    label: metric.label,
    value,
    type: metric.type,
    format: metric.format,
    matched: true,
    timeRange,
  };
}


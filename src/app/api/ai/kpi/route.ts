/**
 * API Route: /api/ai/kpi
 * Endpoint pour récupérer des KPI via intention ou metricId direct
 */

import { NextRequest, NextResponse } from "next/server";
import { getKpi } from "@/server/kpi/getKpi";
import { detectIntent } from "@/server/kpi/intent";
import { explain } from "@/server/kpi/explain";
import { aiConfig } from "@/lib/ai/config";

type KpiRequest = {
  metricId?: string;
  question?: string;
  userId?: string;
  time?: string;
  filters?: {
    propertyId?: string;
    tenantId?: string;
  };
};

/**
 * POST /api/ai/kpi
 * Récupère un KPI par metricId ou par question (détection d'intention)
 */
export async function POST(request: NextRequest) {
  // Vérifier si l'IA est activée
  if (!aiConfig.isEnabled()) {
    return NextResponse.json(
      { error: 'L\'assistant IA est actuellement désactivé' },
      { status: 503 }
    );
  }

  try {
    const body: KpiRequest = await request.json();
    const { metricId, question, userId = "demo", time, filters } = body;

    // Si aucun metricId ni question fournie
    if (!metricId && !question) {
      return NextResponse.json(
        {
          error: "Requête invalide",
          message: "Vous devez fournir soit 'metricId', soit 'question'",
        },
        { status: 400 }
      );
    }

    // Déterminer le metricId
    let resolvedMetricId: string | undefined = metricId;
    let detectedTime: string | undefined = time;

    if (!resolvedMetricId && question) {
      // Détecter l'intention à partir de la question
      const intent = detectIntent(question);

      if (!intent) {
        // Aucune intention détectée
        return NextResponse.json({
          matched: false,
          message: "Aucun KPI correspondant détecté",
        });
      }

      resolvedMetricId = intent.metricId;
      detectedTime = intent.time ?? time;
    }

    if (!resolvedMetricId) {
      return NextResponse.json({
        matched: false,
        message: "Impossible de déterminer le KPI demandé",
      });
    }

    // Récupérer le KPI
    const result = await getKpi({
      metricId: resolvedMetricId,
      userId,
      time: detectedTime,
      propertyId: filters?.propertyId,
      tenantId: filters?.tenantId,
    });

    // Formater en texte naturel
    const text = explain(result.label, result.value, result.format);

    return NextResponse.json({
      matched: true,
      text,
      result,
    });
  } catch (error: any) {
    console.error("[API /ai/kpi] Erreur:", error);

    return NextResponse.json(
      {
        error: "Erreur serveur",
        message: error.message || "Une erreur est survenue lors du calcul du KPI",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/kpi (healthcheck)
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "KPI Intelligence",
    version: "1.0.0",
  });
}


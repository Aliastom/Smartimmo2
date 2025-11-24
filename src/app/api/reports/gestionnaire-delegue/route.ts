/**
 * API endpoint pour générer le rapport d'anomalies de gestion déléguée
 * POST /api/reports/gestionnaire-delegue
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { computeDelegatedManagementIssues } from '@/services/reports/delegatedManagementReport';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { DelegatedManagementReportPDF } from '@/components/pdf/DelegatedManagementReportPDF';
import type { DelegatedManagementReportRequest } from '@/types/reports';
import { logError } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * Génère un rapport d'anomalies pour un gestionnaire délégué
 * Retourne un objet avec le PDF en base64 et le contenu de l'EML
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;

    const body: DelegatedManagementReportRequest = await request.json();

    // Valider les paramètres
    if (!body.gestionnaireId) {
      return NextResponse.json(
        { error: 'gestionnaireId est requis' },
        { status: 400 }
      );
    }

    if (!body.period || !body.period.from || !body.period.to) {
      return NextResponse.json(
        { error: 'period.from et period.to sont requis' },
        { status: 400 }
      );
    }

    // Convertir les dates
    const period = {
      from: new Date(body.period.from),
      to: new Date(body.period.to),
    };

    // Calculer les données du rapport
    const reportData = await computeDelegatedManagementIssues(
      body.gestionnaireId,
      period,
      body.include,
      organizationId
    );

    // Générer le PDF
    const pdfDocument = React.createElement(DelegatedManagementReportPDF, {
      data: reportData,
    });

    const pdfBuffer = await renderToBuffer(pdfDocument);

    // Convertir le PDF en base64 pour l'EML
    const pdfBase64 = pdfBuffer.toString('base64');

    // Retourner les données pour le front-end
    return NextResponse.json({
      success: true,
      pdfBase64,
      pdfFileName: `rapport-anomalies-${reportData.gestionnaire.name.toLowerCase().replace(/\s+/g, '-')}-${period.from.toISOString().split('T')[0]}.pdf`,
      reportData: {
        ...reportData,
        // Convertir les dates en strings pour JSON
        period: {
          from: reportData.period.from.toISOString(),
          to: reportData.period.to.toISOString(),
        },
        unmatchedTransactions: reportData.unmatchedTransactions.map(t => ({
          ...t,
          date: t.date.toISOString(),
        })),
        missingIndexations: reportData.missingIndexations.map(i => ({
          ...i,
          anniversaryDate: i.anniversaryDate.toISOString(),
        })),
      },
    });
  } catch (error) {
    logError('Erreur lors de la génération du rapport gestionnaire délégué', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur lors de la génération du rapport' },
      { status: 500 }
    );
  }
}


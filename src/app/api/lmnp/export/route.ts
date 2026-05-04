import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { buildLmnpExport } from '@/services/lmnp/LmnpExportBuilder';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  propertyId: z.string().min(1).optional(),
  lmnpActivityId: z.string().min(1).optional(),
  exerciseYear: z.coerce.number().int().min(2000).max(2100),
  mode: z.enum(['dryRun', 'final']),
  /** Obligatoire en mode final : hash renvoyé par le dernier dryRun sur les mêmes données. */
  dryRunPayloadHash: z.string().min(16).optional(),
  transientTxOverrides: z
    .array(
      z.object({
        transactionId: z.string().min(1),
        lmnpBucket: z.string().min(1),
        lmnpLabel: z.string().min(1),
      }),
    )
    .optional(),
  /** Inclure `lmnp/v2/debug-attachments-scope.json` dans le ZIP (défaut true). */
  includeDebugAttachmentScope: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    let user;
    try {
      user = await requireAuth();
    } catch {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 });
    }
    const json = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Payload invalide', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      propertyId,
      lmnpActivityId,
      exerciseYear,
      mode,
      dryRunPayloadHash,
      transientTxOverrides,
      includeDebugAttachmentScope,
    } = parsed.data;
    if (!propertyId && !lmnpActivityId) {
      return NextResponse.json({ success: false, error: 'propertyId ou lmnpActivityId requis' }, { status: 400 });
    }
    if ((transientTxOverrides?.length || 0) > 0) {
      console.info('[LMNP export] TRANSIENT_TX_OVERRIDES', {
        mode,
        propertyId,
        lmnpActivityId,
        exerciseYear,
        count: transientTxOverrides?.length || 0,
      });
    }

    if (mode === 'final' && !dryRunPayloadHash) {
      return NextResponse.json(
        {
          success: false,
          error: 'dryRunPayloadHash requis',
          message:
            'Effectuez un export en mode dryRun, puis renvoyez le champ dryRunPayloadHash identique pour générer le ZIP final.',
        },
        { status: 400 }
      );
    }

    const result = await buildLmnpExport({
      organizationId: user.organizationId,
      propertyId: propertyId ?? null,
      lmnpActivityId: lmnpActivityId ?? null,
      exerciseYear,
      mode,
      dryRunPayloadHash: dryRunPayloadHash ?? null,
      createdByUserId: user.id,
      transientTxOverrides: transientTxOverrides ?? [],
      includeDebugAttachmentScope,
    });

    if (result.mode === 'dryRun') {
      return NextResponse.json({
        success: true,
        manifest: result.manifest,
        anomalies: result.anomalies,
        dryRunPayloadHash: result.dryRunPayloadHash,
        ecrituresPreview: result.ecrituresPreview,
        mappingVersion: result.mappingVersion,
        recentRun: result.recentRun,
      });
    }

    return new NextResponse(result.zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'X-LMNP-Run-Id': result.runId,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';

    if (message === 'LMNP_ACTIVITY_NOT_FOUND') {
      return NextResponse.json(
        { success: false, code: 'LMNP_ACTIVITY_NOT_FOUND', error: 'Activité LMNP introuvable' },
        { status: 404 },
      );
    }
    if (message === 'LMNP_ACTIVITY_NO_PROPERTIES') {
      return NextResponse.json(
        { success: false, code: 'LMNP_ACTIVITY_NO_PROPERTIES', error: 'Aucun bien rattaché à cette activité LMNP' },
        { status: 422 },
      );
    }
    if (message === 'LMNP_NO_SIRET_CONFIGURED') {
      return NextResponse.json(
        { success: false, code: 'LMNP_NO_SIRET_CONFIGURED', error: 'Aucun SIRET configuré pour cette activité LMNP' },
        { status: 422 },
      );
    }
    if (message === 'PROPERTY_NOT_FOUND') {
      return NextResponse.json({ success: false, code: 'PROPERTY_NOT_FOUND', error: 'Bien introuvable' }, { status: 404 });
    }
    if (message === 'DRY_RUN_HASH_MISMATCH') {
      return NextResponse.json(
        {
          success: false,
          code: 'DRY_RUN_HASH_MISMATCH',
          error: 'dryRunPayloadHash invalide ou données modifiées depuis le dry run',
          message:
            'Les données ont changé depuis votre analyse, ou le hash est obsolète. Relancez « Analyser (dry run) » puis téléchargez à nouveau le ZIP.',
        },
        { status: 409 }
      );
    }
    if (message === 'BLOCKING_ANOMALIES') {
      return NextResponse.json(
        {
          success: false,
          code: 'BLOCKING_ANOMALIES',
          error: 'Anomalies bloquantes',
          message:
            'Des transactions ne sont pas classées par les règles LMNP. Ajoutez des règles ou des overrides (administration), ou corrigez les natures / catégories côté métier, puis refaites un dry run.',
        },
        { status: 422 }
      );
    }

    console.error('[LMNP export]', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la génération LMNP', details: message },
      { status: 500 }
    );
  }
}

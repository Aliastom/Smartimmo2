import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { recordLearningFromUserCorrection } from '@/services/lmnp/LmnpLearningService';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  propertyId: z.string().optional(),
  documentTypeCode: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  natureCode: z.string().optional().nullable(),
  transactionLabel: z.string().optional().nullable(),
  ocrText: z.string().optional().nullable(),
  lmnpBucket: z.string().min(1),
  lmnpLabel: z.string().min(1),
  guidanceConfidence: z.number().min(0).max(1),
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
        { status: 400 },
      );
    }

    const result = await recordLearningFromUserCorrection({
      organizationId: user.organizationId,
      propertyId: parsed.data.propertyId ?? null,
      documentTypeCode: parsed.data.documentTypeCode,
      categoryId: parsed.data.categoryId,
      natureCode: parsed.data.natureCode,
      transactionLabel: parsed.data.transactionLabel,
      ocrText: parsed.data.ocrText,
      lmnpBucket: parsed.data.lmnpBucket,
      lmnpLabel: parsed.data.lmnpLabel,
      guidanceConfidence: parsed.data.guidanceConfidence,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, skipped: true, reason: result.reason }, { status: 200 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('[LMNP learning-patterns]', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

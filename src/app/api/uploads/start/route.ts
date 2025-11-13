import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scope, transactionId } = body;

    console.log('[API] POST /api/uploads/start:', { scope, transactionId });

    // Expiration dans 2 jours
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 2);

    let uploadSession;

    // Si scope='transaction:edit' + transactionId → upsert (session unique par transaction)
    if (scope === 'transaction:edit' && transactionId) {
      uploadSession = await prisma.uploadSession.upsert({
        where: { transactionId },
        create: {
          scope,
          transactionId,
          expiresAt
        },
        update: {
          expiresAt // Rafraîchir l'expiration
        }
      });
      console.log('[API] Session upserted pour transaction:edit:', uploadSession.id);
    } 
    // Sinon (transaction:new, global, etc.) → créer nouvelle session
    else {
      uploadSession = await prisma.uploadSession.create({
        data: {
          scope: scope || 'global',
          transactionId: scope === 'transaction:new' ? null : transactionId,
          expiresAt
        }
      });
      console.log('[API] Nouvelle session créée:', uploadSession.id, 'scope:', scope);
    }

    return NextResponse.json({
      success: true,
      uploadSessionId: uploadSession.id,
      expiresAt: uploadSession.expiresAt,
      scope: uploadSession.scope
    });
  } catch (error) {
    console.error('Erreur lors de la création de la session d\'upload:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la création de la session d\'upload' },
      { status: 500 }
    );
  }
}

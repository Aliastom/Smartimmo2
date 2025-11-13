import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { leaseId, tenantId, type, mode, to, subject } = await req.json();

    await prisma.emailLog.create({
      data: {
        leaseId: leaseId || null,
        tenantId: tenantId || null,
        type,
        mode,
        to,
        subject,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error logging email:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de l\'enregistrement du log',
      details: error.message 
    }, { status: 500 });
  }
}


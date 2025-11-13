import { NextRequest, NextResponse } from 'next/server';
import { autoActivateLeases } from '@/domain/services/leaseActivationService';

export async function POST(request: NextRequest) {
  try {
    const count = await autoActivateLeases();
    
    return NextResponse.json({
      success: true,
      message: `${count} bail(x) activé(s)`,
      count
    });
  } catch (error: any) {
    console.error('[POST /api/leases/auto-activate] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to auto-activate leases' },
      { status: 500 }
    );
  }
}


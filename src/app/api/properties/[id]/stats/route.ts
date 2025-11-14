import { NextRequest, NextResponse } from 'next/server';
import { getPropertyStats } from '@/services/deletePropertySmart';
import { requireAuth } from '@/lib/auth/getCurrentUser';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const stats = await getPropertyStats(params.id, user.organizationId);
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching property stats:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des statistiques' },
      { status: 500 }
    );
  }
}


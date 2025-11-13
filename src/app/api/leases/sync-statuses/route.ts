import { NextResponse } from 'next/server';
import { checkAndUpdateLeaseStatuses } from '@/lib/services/leaseStatusService';

export async function POST() {
  try {
    const result = await checkAndUpdateLeaseStatuses();
    
    return NextResponse.json({
      message: 'Statuts des baux synchronisés avec succès',
      updated: result.updated
    });
  } catch (error) {
    console.error('Error syncing lease statuses:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la synchronisation des statuts' },
      { status: 500 }
    );
  }
}

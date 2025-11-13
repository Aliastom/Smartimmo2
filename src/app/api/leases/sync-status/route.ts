import { NextRequest, NextResponse } from 'next/server';
import { syncLeaseStatuses, syncPropertyLeaseStatuses } from '../../../../domain/services/leaseStatusSyncService';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    let result;
    if (propertyId) {
      // Synchroniser les baux d'une propriété spécifique
      result = await syncPropertyLeaseStatuses(propertyId);
    } else {
      // Synchroniser tous les baux
      result = await syncLeaseStatuses();
    }

    return NextResponse.json({
      success: true,
      updated: result.updated,
      details: result.details
    });

  } catch (error) {
    console.error('[POST /api/leases/sync-status] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur lors de la synchronisation des statuts' },
      { status: 500 }
    );
  }
}

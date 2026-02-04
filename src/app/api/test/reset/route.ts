/**
 * Endpoint de test : Reset des données de test
 * 
 * ⚠️ PROTÉGÉ : Ne fonctionne qu'en environnement de test avec token
 * 
 * Usage :
 * POST /api/test/reset
 * Headers: X-Test-Token: <token>
 * Body: { organizationId }
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Token de test (doit correspondre à TEST_API_TOKEN dans .env)
const TEST_TOKEN = process.env.TEST_API_TOKEN || 'test-token-change-me';

export async function POST(request: NextRequest) {
  // Vérifier le token
  const token = request.headers.get('X-Test-Token');
  if (token !== TEST_TOKEN) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  // Vérifier que nous sommes en environnement de test
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_TEST_ENDPOINTS !== 'true') {
    return NextResponse.json(
      { success: false, error: 'Test endpoints disabled in production' },
      { status: 403 }
    );
  }
  
  try {
    const body = await request.json();
    const { organizationId } = body;
    
    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'organizationId is required' },
        { status: 400 }
      );
    }
    
    // Supprimer toutes les données de test pour cette organisation
    // Ordre important : respecter les contraintes de clés étrangères
    
    // Transactions
    await prisma.transaction.deleteMany({
      where: { organizationId },
    });
    
    // Documents (si liés à des entités de cette org)
    await prisma.document.deleteMany({
      where: {
        OR: [
          { property: { organizationId } },
          { transaction: { organizationId } },
          { lease: { property: { organizationId } } },
        ],
      },
    });
    
    // Baux
    await prisma.lease.deleteMany({
      where: { organizationId },
    });
    
    // Prêts
    await prisma.loan.deleteMany({
      where: { organizationId },
    });
    
    // Échéances
    await prisma.echeanceRecurrente.deleteMany({
      where: { organizationId },
    });
    
    // Locataires
    await prisma.tenant.deleteMany({
      where: { organizationId },
    });
    
    // Biens
    await prisma.property.deleteMany({
      where: { organizationId },
    });
    
    return NextResponse.json({
      success: true,
      message: `All test data for organization ${organizationId} has been reset`,
    });
  } catch (error: any) {
    console.error('[TEST RESET] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

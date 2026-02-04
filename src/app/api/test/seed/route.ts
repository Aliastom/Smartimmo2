/**
 * Endpoint de test : Seed des données de test
 * 
 * ⚠️ PROTÉGÉ : Ne fonctionne qu'en environnement de test avec token
 * 
 * Usage :
 * POST /api/test/seed
 * Headers: X-Test-Token: <token>
 * Body: { organizationId, properties?, tenants?, leases?, transactions? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPropertyServicePrisma } from '@/domain/services/propertyServiceFactory';
import { createLeaseServiceWithMode } from '@/domain/services/leaseServiceFactory';
import { createTransactionServiceWithMode } from '@/domain/services/transactionServiceFactory';
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
    const { organizationId, properties = [], tenants = [], leases = [], transactions = [] } = body;
    
    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'organizationId is required' },
        { status: 400 }
      );
    }
    
    // Créer les propriétés via PropertyService
    const propertyService = createPropertyServicePrisma();
    const createdProperties = [];
    for (const prop of properties) {
      // Ajouter les champs requis avec valeurs par défaut si manquants
      const propertyData = {
        organizationId,
        name: prop.name,
        type: prop.type || 'apartment',
        address: prop.address,
        postalCode: prop.postalCode,
        city: prop.city,
        surface: prop.surface,
        rooms: prop.rooms,
        acquisitionDate: prop.acquisitionDate || new Date(),
        acquisitionPrice: prop.acquisitionPrice || 0,
        notaryFees: prop.notaryFees ?? 0,
        currentValue: (prop.currentValue ?? prop.acquisitionPrice) || 0,
        status: prop.status || 'vacant',
        ...(prop.managementCompanyId && { managementCompanyId: prop.managementCompanyId }),
        ...(prop.fiscalTypeId && { fiscalTypeId: prop.fiscalTypeId }),
        ...(prop.fiscalRegimeId && { fiscalRegimeId: prop.fiscalRegimeId }),
        ...(prop.rentalMode && { rentalMode: prop.rentalMode }),
        ...(prop.airbnbListingId && { airbnbListingId: prop.airbnbListingId }),
      };
      
      const result = await propertyService.createProperty(propertyData);
      createdProperties.push(result.property);
    }
    
    // Créer les locataires
    const createdTenants = [];
    for (const tenant of tenants) {
      const created = await prisma.tenant.create({
        data: {
          ...tenant,
          organizationId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      createdTenants.push(created);
    }
    
    // Créer les baux via LeaseService (en utilisant les IDs créés)
    const leaseService = createLeaseServiceWithMode('normal');
    const createdLeases = [];
    for (let i = 0; i < leases.length; i++) {
      const lease = leases[i];
      const propertyId = lease.propertyId || (createdProperties[i]?.id);
      const tenantId = lease.tenantId || (createdTenants[i]?.id);
      
      if (!propertyId || !tenantId) {
        continue; // Skip si pas de property/tenant disponible
      }
      
      const leaseData = {
        organizationId,
        propertyId,
        tenantId,
        type: lease.type || 'CLASSIC',
        startDate: lease.startDate || new Date(),
        endDate: lease.endDate || null,
        rentAmount: lease.rentAmount || 0,
        deposit: lease.deposit || null,
        status: lease.status || 'ACTIF',
        ...(lease.furnishedType && { furnishedType: lease.furnishedType }),
        ...(lease.paymentDay && { paymentDay: lease.paymentDay }),
        ...(lease.indexationType && { indexationType: lease.indexationType }),
        ...(lease.notes && { notes: lease.notes }),
      };
      
      const result = await leaseService.createLease(leaseData);
      createdLeases.push(result.lease);
    }
    
    // Créer les transactions via TransactionService (en utilisant les IDs créés)
    const transactionService = createTransactionServiceWithMode('normal');
    const createdTransactions = [];
    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];
      const propertyId = transaction.propertyId || (createdProperties[i]?.id);
      const leaseId = transaction.leaseId || (createdLeases[i]?.id);
      
      if (!propertyId) {
        continue; // Skip si pas de property disponible
      }
      
      const transactionData = {
        organizationId,
        propertyId,
        date: transaction.date || new Date(),
        nature: transaction.nature || 'LOYER',
        amount: transaction.amount || 0,
        label: transaction.label || 'Transaction Test',
        ...(leaseId && { leaseId }),
        ...(transaction.categoryId && { categoryId: transaction.categoryId }),
        ...(transaction.reference && { reference: transaction.reference }),
        ...(transaction.notes && { notes: transaction.notes }),
      };
      
      const result = await transactionService.createTransaction(transactionData);
      createdTransactions.push(result.transaction);
    }
    
    return NextResponse.json({
      success: true,
      data: {
        properties: createdProperties,
        tenants: createdTenants,
        leases: createdLeases,
        transactions: createdTransactions,
      },
    });
  } catch (error: any) {
    console.error('[TEST SEED] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

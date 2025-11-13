import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/test-nature-mapping
export async function GET() {
  try {
    console.log('=== TEST NATURE MAPPING ===');
    console.log('Prisma client:', !!prisma);
    console.log('natureCategoryAllowed:', !!prisma.natureCategoryAllowed);
    console.log('natureCategoryDefault:', !!prisma.natureCategoryDefault);
    
    // Test direct des modèles
    const allowedCount = await prisma.natureCategoryAllowed.count();
    const defaultCount = await prisma.natureCategoryDefault.count();
    
    console.log('Allowed count:', allowedCount);
    console.log('Default count:', defaultCount);
    
    // Récupérer quelques données
    const allowedRules = await prisma.natureCategoryAllowed.findMany({
      take: 3,
    });
    
    const defaultRules = await prisma.natureCategoryDefault.findMany({
      take: 3,
    });
    
    return NextResponse.json({
      success: true,
      debug: {
        prismaAvailable: !!prisma,
        natureCategoryAllowedAvailable: !!prisma.natureCategoryAllowed,
        natureCategoryDefaultAvailable: !!prisma.natureCategoryDefault,
        allowedCount,
        defaultCount,
        allowedRules,
        defaultRules,
      }
    });
  } catch (error) {
    console.error('Erreur test:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
